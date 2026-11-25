-- =====================================================================
-- CONEC CÉLULA — agendamentos automáticos (rode por último)
-- ANTES de rodar, troque os dois valores abaixo:
--   SEU-PROJETO     -> o "Project ref" do Supabase (Settings > General)
--   SEU-SEGREDO     -> o mesmo CRON_SECRET que você cadastrou nas Edge Functions
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamentos antigos (caso rode este arquivo de novo)
do $$ begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('conec-notificar','conec-ausencias');
end $$;

-- A cada minuto: envia notificações push, lembretes de oração e versículo do dia
select cron.schedule('conec-notificar', '* * * * *', $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/notificar',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'SEU-SEGREDO'),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
$$);

-- Todo dia às 10h (horário de Brasília = 13h UTC): avisa líderes sobre membros ausentes
select cron.schedule('conec-ausencias', '0 13 * * *', $$ select public.check_absences(); $$);
