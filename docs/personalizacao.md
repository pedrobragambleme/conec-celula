# Personalização

## Nome do app

| Onde | O que trocar |
|---|---|
| `app/js/config.js` | `APP_NAME` |
| `app/index.html` | `<title>`, `apple-mobile-web-app-title` |
| `app/manifest.webmanifest` | `name`, `short_name` |
| `app/js/app.js` | texto do cabeçalho (`'Conec'` e `' Célula'`) |
| `app/js/views/auth.js` | título da tela de login |
| `supabase/functions/mp-assinar/index.ts` | texto `reason` que aparece no Mercado Pago |

## Logo e ícones

Substitua os arquivos em `app/icons/`, mantendo os mesmos nomes:

| Arquivo | Tamanho | Uso |
|---|---|---|
| `logo.svg` | vetorial | Cabeçalho, login, favicon |
| `icon-192.png` | 192×192 | Ícone do app, iPhone |
| `icon-512.png` | 512×512 | Ícone do app |
| `icon-maskable-512.png` | 512×512, fundo até a borda | Android (o sistema recorta em círculo) |
| `badge-72.png` | 72×72, branco com fundo transparente | Ícone pequeno da notificação no Android |

Depois de trocar, aumente a versão em `app/sw.js` (`const VERSION = 'conec-v2'`) para os celulares baixarem os novos arquivos.

## Cores

No topo de `app/css/app.css`:

```css
--primary: #0E5E6F;   /* azul-petróleo: botões, links */
--accent:  #FF7A59;   /* coral: destaques */
--bg:      #FBF7F2;   /* fundo */
```

Também tem uma versão para o modo escuro do celular (`@media (prefers-color-scheme: dark)`). Troque também `theme_color` em `manifest.webmanifest` e `theme-color` em `index.html`.

## Preços

O preço precisa ser trocado em **dois lugares**:
1. **Cobrado:** Supabase → Edge Functions → Secrets → `PRECO_PESSOAL` e `PRECO_CELULA`.
2. **Exibido:** `app/js/config.js` → `PRICE_PERSONAL` e `PRICE_CELL`.

O novo preço vale para novas assinaturas. As antigas continuam com o valor anterior no Mercado Pago.

## Limites do plano grátis

1. No banco, rode no SQL Editor a função `plan_limit` de `001_estrutura.sql` com os números novos:
   ```sql
   create or replace function public.plan_limit(p_key text)
   returns int language sql immutable as $$
     select case p_key
       when 'free_cell_members' then 20
       when 'free_prayer_reminders' then 2
       when 'premium_prayer_reminders' then 20
       else 0 end
   $$;
   ```
2. No app, ajuste `FREE_CELL_MEMBERS` e `FREE_PRAYER_REMINDERS` em `config.js`.
3. Os textos da tela de planos ficam em `app/js/views/plans.js`.

## Versículos e planos de leitura

```sql
-- novo versículo do dia
insert into daily_verses (ref, text) values ('Referência', 'Texto');

-- novo plano de leitura
with p as (insert into reading_plans (title, description, is_premium)
           values ('Romanos em 16 dias', 'Um capítulo por dia.', false) returning id)
insert into reading_plan_days (plan_id, day, refs)
select p.id, d, 'Romanos ' || d from p, generate_series(1, 16) d;
```

## Horários automáticos

- **Lembretes, versículo e push:** a cada minuto (`003_agendamentos.sql`, job `conec-notificar`).
- **Alerta de faltas:** todo dia às 13h UTC, que é 10h em Brasília (job `conec-ausencias`). Para mudar, rode de novo o `cron.schedule` com outro horário.

## Termos e privacidade

Os textos ficam em `app/js/views/legal.js`. São **modelos**: revise com um advogado e inclua o nome ou CNPJ do responsável e o e-mail de contato (`SUPPORT_EMAIL` em `config.js`).
