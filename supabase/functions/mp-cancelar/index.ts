// =====================================================================
// CONEC CÉLULA — Edge Function "mp-cancelar"
// Cancela a assinatura do usuário no Mercado Pago.
// Variáveis: MP_ACCESS_TOKEN.  Configuração: deixar "Verify JWT" LIGADO.
// =====================================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Faça login novamente." }, 401);

    const { subscription_id } = await req.json();
    const { data: sub } = await admin.from("subscriptions").select("*")
      .eq("id", subscription_id).eq("user_id", user.id).single();
    if (!sub) return json({ error: "Assinatura não encontrada." }, 404);

    if (sub.provider === "mercadopago" && sub.provider_id) {
      const r = await fetch(`https://api.mercadopago.com/preapproval/${sub.provider_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}` },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!r.ok) {
        console.error(await r.text());
        return json({ error: "Não foi possível cancelar no Mercado Pago." }, 502);
      }
    }
    await admin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);
    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
