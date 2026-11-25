// =====================================================================
// CONEC CÉLULA — Edge Function "mp-assinar"
// Cria uma assinatura no Mercado Pago e devolve o link de pagamento.
// Variáveis: MP_ACCESS_TOKEN, APP_URL, PRECO_PESSOAL (ex.: 9.90), PRECO_CELULA (ex.: 29.90)
// Configuração: deixar "Verify JWT" LIGADO.
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

    const { kind, cell_id } = await req.json();
    if (kind !== "personal" && kind !== "cell") return json({ error: "Plano inválido." }, 400);

    let reason = "Conec Célula Premium";
    if (kind === "cell") {
      if (!cell_id) return json({ error: "Informe a célula." }, 400);
      const { data: isLeader } = await userClient.rpc("is_cell_leader", { p_cell: cell_id });
      if (!isLeader) return json({ error: "Somente o líder pode assinar pela célula." }, 403);
      const { data: cell } = await admin.from("cells").select("name").eq("id", cell_id).single();
      reason = `Conec Célula · Plano Célula (${cell?.name ?? ""})`;
    }

    // já tem assinatura ativa?
    let q = admin.from("subscriptions").select("id").eq("status", "authorized").eq("kind", kind);
    q = kind === "cell" ? q.eq("cell_id", cell_id) : q.eq("user_id", user.id);
    const { data: active } = await q;
    if (active?.length) return json({ error: "Este plano já está ativo." }, 409);

    const amount = Number(Deno.env.get(kind === "cell" ? "PRECO_CELULA" : "PRECO_PESSOAL") ?? (kind === "cell" ? "29.90" : "9.90"));
    const appUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

    const mpRes = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`,
      },
      body: JSON.stringify({
        reason,
        external_reference: `${kind}:${user.id}:${cell_id ?? ""}`,
        payer_email: user.email,
        back_url: `${appUrl}/#/planos?retorno=1`,
        status: "pending",
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: amount,
          currency_id: "BRL",
        },
      }),
    });
    const mp = await mpRes.json();
    if (!mpRes.ok) {
      console.error("Mercado Pago:", mp);
      return json({ error: "Mercado Pago recusou: " + (mp.message ?? mpRes.status) }, 502);
    }

    await admin.from("subscriptions").insert({
      kind, user_id: user.id, cell_id: kind === "cell" ? cell_id : null,
      provider: "mercadopago", provider_id: mp.id, status: "pending", amount,
    });

    return json({ init_point: mp.init_point });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado. Tente de novo." }, 500);
  }
});
