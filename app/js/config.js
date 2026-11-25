// =====================================================================
// CONEC CÉLULA — CONFIGURAÇÃO
// Preencha com os dados do seu projeto Supabase (Settings > API).
// A "anon public key" pode ficar aqui: ela é pública por natureza.
// NUNCA coloque aqui a "service_role key".
// =====================================================================
export const CONFIG = {
  APP_NAME: 'Conec Célula',
  SUPABASE_URL: 'https://SEU-PROJETO.supabase.co',
  SUPABASE_ANON_KEY: 'COLE-AQUI-A-ANON-PUBLIC-KEY',
  VAPID_PUBLIC_KEY: 'COLE-AQUI-A-VAPID_PUBLIC_KEY',

  // preços exibidos no app (os cobrados ficam nas Secrets do Supabase: PRECO_PESSOAL / PRECO_CELULA)
  PRICE_PERSONAL: 9.90,
  PRICE_CELL: 29.90,

  // limites do plano grátis (precisam bater com a função plan_limit no banco)
  FREE_CELL_MEMBERS: 15,
  FREE_PRAYER_REMINDERS: 1,

  SUPPORT_EMAIL: 'contato@seudominio.com.br',
};
