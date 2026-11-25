// =====================================================================
// CONEC CÉLULA — Edge Function "mp-webhook"
// O Mercado Pago chama este endereço quando uma assinatura muda
// (aprovada, pausada, cancelada, nova cobrança...).
// Variáveis: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (opcional, mas recomendado)
// Configuração: DESLIGAR "Verify JWT" desta função.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MP = "https://api.mercadopago.com";
const token = () => Deno.env.get("MP_ACCESS_TOKEN")!;

async function mpGet(path: string) {
  const r = await fetch(MP + path, { headers: { Authorization: `Bearer ${token()}` } });
  if (!r.ok) throw new Error(`MP ${path} -> ${r.status}`);
  return r.json();
}

async function validSignature(req: Request, dataId: string): Promise<boolean> {
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (!secret) return true; // sem segredo configurado, aceita (configure para mais segurança)
  const sig = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === parts.v1;
}

async function syncPreapproval(id: string) {
  const p = await mpGet(`/preapproval/${id}`);
  const status = ["authorized", "paused", "cancelled", "pending"].includes(p.status) ? p.status : "pending";
  const patch = {
    status,
    amount: p.auto_recurring?.transaction_amount ?? null,
    next_payment_date: p.next_payment_date ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data: updated } = await admin.from("subscriptions").update(patch).eq("provider_id", id).select("id");
  if (!updated?.length && p.external_reference) {
    const [kind, user_id, cell_id] = String(p.external_reference).split(":");
    if ((kind === "personal" || kind === "cell") && user_id) {
      await admin.from("subscriptions").insert({
        kind, user_id, cell_id: cell_id || null, provider: "mercadopago", provider_id: id, ...patch,
      });
    }
  }
  if (status === "authorized") {
    const { data: sub } = await admin.from("subscriptions").select("user_id,kind").eq("provider_id", id).single();
    if (sub) {
      await admin.rpc("notify", {
        p_user: sub.user_id, p_type: "subscription",
        p_title: "Assinatura ativa ✨",
        p_body: sub.kind === "cell" ? "O Plano Célula foi liberado." : "Seu Premium foi liberado. Obrigado!",
        p_link: "#/planos",
      });
    }
  }
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let body: Record<string, any> = {};
    try { body = await req.json(); } catch { /* sem corpo */ }
    const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
    if (!dataId) return new Response("ok");

    if (!(await validSignature(req, dataId))) return new Response("assinatura inválida", { status: 401 });

    if (type === "subscription_preapproval" || type === "preapproval") {
      await syncPreapproval(dataId);
    } else if (type === "subscription_authorized_payment" || type === "authorized_payment") {
      const pay = await mpGet(`/authorized_payments/${dataId}`);
      if (pay.preapproval_id) await syncPreapproval(pay.preapproval_id);
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("erro", { status: 500 }); // o Mercado Pago tenta de novo depois
  }
});
