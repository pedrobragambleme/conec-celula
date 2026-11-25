// =====================================================================
// CONEC CÉLULA — Edge Function "notificar"
// Chamada a cada minuto pelo agendamento (003_agendamentos.sql).
// 1) envia por push as notificações novas (pedidos, curtidas, avisos...)
// 2) envia os lembretes de oração que chegaram na hora
// 3) envia o versículo do dia no horário escolhido por cada pessoa
//
// Variáveis (Edge Functions > Secrets): CRON_SECRET, VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY, VAPID_CONTACT (ex.: mailto:voce@email.com), APP_URL
// Configuração: desligar "Verify JWT" desta função.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }
  const report = { notifications: 0, reminders: 0, verses: 0, pushes: 0, removed: 0 };
  const outbox: { user_id: string; title: string; body: string; url: string; tag?: string }[] = [];

  // 1) notificações pendentes
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("notifications").select("id,user_id,title,body,link")
    .is("pushed_at", null).gte("created_at", since).limit(500);
  if (pending?.length) {
    await supabase.from("notifications").update({ pushed_at: new Date().toISOString() })
      .in("id", pending.map((n) => n.id));
    for (const n of pending) {
      outbox.push({ user_id: n.user_id, title: n.title, body: n.body ?? "", url: n.link ?? "#/", tag: n.id });
    }
    report.notifications = pending.length;
  }

  // versículo do dia (usado nos lembretes e no envio diário)
  const { data: votd } = await supabase.rpc("verse_of_the_day");
  const verse = votd?.[0] ?? { ref: "1 Tessalonicenses 5:17", text: "Orai sem cessar." };

  // 2) lembretes de oração
  const { data: reminders } = await supabase.rpc("claim_due_reminders");
  for (const r of reminders ?? []) {
    outbox.push({
      user_id: r.user_id, title: `🙏 ${r.label}`,
      body: `“${verse.text}” — ${verse.ref}`, url: "#/oracao", tag: "lembrete",
    });
  }
  report.reminders = reminders?.length ?? 0;

  // 3) versículo do dia
  const { data: verseUsers } = await supabase.rpc("claim_due_daily_verse");
  for (const v of verseUsers ?? []) {
    outbox.push({
      user_id: v.user_id, title: `📖 Versículo do dia · ${verse.ref}`,
      body: verse.text, url: "#/", tag: "versiculo",
    });
  }
  report.verses = verseUsers?.length ?? 0;

  if (!outbox.length) return Response.json(report);

  // envia
  const userIds = [...new Set(outbox.map((o) => o.user_id))];
  const { data: subs } = await supabase.from("push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth").in("user_id", userIds);
  const byUser = new Map<string, typeof subs>();
  for (const s of subs ?? []) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }
  const vapid = await loadVapid();
  const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");
  const dead: string[] = [];

  await Promise.all(outbox.flatMap((msg) =>
    (byUser.get(msg.user_id) ?? []).map(async (s) => {
      const payload = JSON.stringify({ title: msg.title, body: msg.body, url: appUrl + "/" + msg.url, tag: msg.tag });
      try {
        const res = await sendWebPush(s, payload, vapid);
        if (res.status === 404 || res.status === 410) dead.push(s.id);
        else if (res.ok) report.pushes++;
        else console.error("push falhou", res.status, await res.text());
      } catch (e) {
        console.error("push erro", e);
      }
    })
  ));
  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("id", dead);
    report.removed = dead.length;
  }
  return Response.json(report);
});

// =====================================================================
// Web Push (RFC 8291 + VAPID RFC 8292) usando apenas WebCrypto
// =====================================================================
type Vapid = { publicRaw: Uint8Array; publicB64: string; privateKey: CryptoKey; contact: string };

function b64uDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function b64uEncode(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const enc = new TextEncoder();

async function loadVapid(): Promise<Vapid> {
  const publicB64 = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const publicRaw = b64uDecode(publicB64);
  const jwk = {
    kty: "EC", crv: "P-256", ext: true,
    x: b64uEncode(publicRaw.slice(1, 33)), y: b64uEncode(publicRaw.slice(33, 65)),
    d: Deno.env.get("VAPID_PRIVATE_KEY")!,
  };
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  return { publicRaw, publicB64, privateKey, contact: Deno.env.get("VAPID_CONTACT") ?? "mailto:contato@conec.app" };
}

async function vapidJwt(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const header = b64uEncode(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64uEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.contact })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, v.privateKey, enc.encode(`${header}.${body}`)));
  return `${header}.${body}.${b64uEncode(sig)}`;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}

export async function encryptPayload(p256dh: string, authSecret: string, plaintext: Uint8Array) {
  const uaPublic = b64uDecode(p256dh);
  const auth = b64uDecode(authSecret);
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, ecdh, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: string, v: Vapid) {
  const body = await encryptPayload(sub.p256dh, sub.auth, enc.encode(payload));
  const jwt = await vapidJwt(sub.endpoint, v);
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "86400",
      Urgency: "normal",
      Authorization: `vapid t=${jwt}, k=${v.publicB64}`,
    },
    body,
  });
}
