# Guia de instalação: colocando o Conec Célula no ar

Este guia é para quem nunca publicou um app. Siga na ordem. Leva umas 2 horas na primeira vez.

## O que tem nesta pasta

| Pasta / arquivo | O que é |
|---|---|
| `app/` | O aplicativo (o site). É isso que vai para a Vercel. |
| `app/js/config.js` | **Único arquivo do app que você precisa editar.** |
| `supabase/migrations/` | Os 3 arquivos que criam o banco de dados. |
| `supabase/functions/` | 4 funções de servidor (notificações e Mercado Pago). |
| `ferramentas/gerar-chaves-notificacao.html` | Gera as chaves das notificações push. |

## Contas necessárias

- **GitHub** (você já tem)
- **Supabase**: supabase.com (banco de dados, login e funções)
- **Vercel**: vercel.com (hospedagem). Entre com o seu GitHub.
- **Mercado Pago**: conta de vendedor (para receber as assinaturas)
- **Domínio**: registro.br (ex.: `coneccelula.com.br`)

---

## Passo 1: Criar o projeto no Supabase

1. Em supabase.com, clique em **New project**.
2. Dê um nome (ex.: `conec-celula`), crie uma senha forte para o banco (guarde-a) e escolha a região **South America (São Paulo)**.
3. Espere uns 2 minutos até o projeto ficar pronto.

## Passo 2: Criar o banco de dados

1. No menu lateral, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo `supabase/migrations/001_estrutura.sql`, copie **tudo**, cole no editor e clique em **Run**. O resultado deve ser "Success".
3. Faça o mesmo com o `002_dados_iniciais.sql`, que cadastra 60 versículos e 5 planos de leitura.
4. **Ainda não rode o 003.** Ele fica para o Passo 7.

## Passo 3: Configurar o login

Abra **Authentication → URL Configuration**.
- **Site URL:** o endereço do seu site, ex.: `https://coneccelula.com.br`. Enquanto não tiver o domínio, use o endereço da Vercel (Passo 5).
- **Redirect URLs:** adicione o mesmo endereço.

**Importante antes de lançar:** o e-mail de confirmação que vem com o Supabase só envia poucos e-mails por hora. Configure um envio próprio em **Authentication → Emails → SMTP Settings**. Brevo e Resend são opções com plano gratuito. Na mesma tela você pode traduzir os textos dos e-mails para português.

## Passo 4: Preencher o `app/js/config.js`

1. No Supabase, abra **Project Settings → API** (ou **API Keys**).
2. Copie a **Project URL** para `SUPABASE_URL`.
3. Copie a chave **anon public** para `SUPABASE_ANON_KEY`. **Nunca** use a `service_role` aqui.
4. Gere as chaves de notificação: abra `ferramentas/gerar-chaves-notificacao.html` no navegador do computador, clique em **Gerar chaves** e copie a **pública** para `VAPID_PUBLIC_KEY`. Guarde a privada para o Passo 6.
5. Ajuste `SUPPORT_EMAIL` e, se quiser, os preços exibidos (`PRICE_PERSONAL`, `PRICE_CELL`).

## Passo 5: Publicar o site (GitHub + Vercel)

1. No GitHub, crie um repositório novo e privado, chamado `conec-celula`.
2. Envie os arquivos desta pasta: no repositório, use **Add file → Upload files** e arraste o conteúdo da pasta.
3. Na Vercel, clique em **Add New → Project**, escolha o repositório e configure:
   - **Root Directory:** `app`
   - **Framework Preset:** `Other`
   - Deixe o comando de build vazio e clique em **Deploy**.
4. A Vercel cria um endereço como `conec-celula.vercel.app`. Abra e teste o cadastro.

**Domínio próprio:** na Vercel, abra **Project → Settings → Domains**, adicione `coneccelula.com.br` e siga as instruções. No registro.br, em **DNS**, crie os registros que a Vercel mostrar. Depois volte ao Passo 3 e troque o endereço.

Daqui em diante, toda alteração enviada ao GitHub vai para o ar sozinha.

## Passo 6: Criar as funções de servidor

No Supabase, abra **Edge Functions → Deploy a new function → Via Editor**. Crie **4 funções** com estes nomes exatos, colando o conteúdo de cada `index.ts`:

| Nome | Arquivo | "Verify JWT" (em Details/Settings da função) |
|---|---|---|
| `notificar` | `supabase/functions/notificar/index.ts` | **DESLIGADO** |
| `mp-webhook` | `supabase/functions/mp-webhook/index.ts` | **DESLIGADO** |
| `mp-assinar` | `supabase/functions/mp-assinar/index.ts` | ligado |
| `mp-cancelar` | `supabase/functions/mp-cancelar/index.ts` | ligado |

Depois abra **Edge Functions → Secrets** e cadastre:

| Nome | Valor |
|---|---|
| `CRON_SECRET` | uma senha longa inventada por você (ex.: 40 letras e números) |
| `VAPID_PUBLIC_KEY` | a chave pública do Passo 4 |
| `VAPID_PRIVATE_KEY` | a chave privada do Passo 4 |
| `VAPID_CONTACT` | `mailto:seu-email@dominio.com` |
| `APP_URL` | `https://coneccelula.com.br` (ou o endereço da Vercel) |
| `MP_ACCESS_TOKEN` | o Access Token do Mercado Pago (Passo 8) |
| `MP_WEBHOOK_SECRET` | a assinatura secreta do webhook (Passo 8) |
| `PRECO_PESSOAL` | `9.90` |
| `PRECO_CELULA` | `29.90` |

Os preços cobrados são os destas Secrets. Se mudar aqui, mude também no `config.js`, para o app exibir o mesmo valor.

## Passo 7: Ligar os envios automáticos

1. Abra `supabase/migrations/003_agendamentos.sql` e troque:
   - `SEU-PROJETO` pelo **Project ref** (em Settings → General; é o código no meio da URL, como `abcdxyz`);
   - `SEU-SEGREDO` pelo mesmo `CRON_SECRET` do Passo 6.
2. Cole no **SQL Editor** e clique em **Run**.

A partir daí, a cada minuto o sistema envia os lembretes de oração, o versículo do dia e os avisos. Uma vez por dia, ele avisa os líderes sobre membros que faltaram.

## Passo 8: Mercado Pago (assinaturas)

1. Acesse **mercadopago.com.br/developers** → **Suas integrações** → **Criar aplicação**. Escolha *Pagamentos online* e *Assinaturas*.
2. Em **Credenciais de produção**, copie o **Access Token** (`APP_USR-...`) para a Secret `MP_ACCESS_TOKEN`.
3. Em **Webhooks → Configurar notificações**:
   - **URL de produção:** `https://SEU-PROJETO.supabase.co/functions/v1/mp-webhook`
   - **Eventos:** marque **Planos e assinaturas** (assinaturas e pagamentos recorrentes).
   - Salve e copie a **assinatura secreta** para a Secret `MP_WEBHOOK_SECRET`.
4. **Teste antes de lançar:** use as *credenciais de teste* e os *usuários de teste* do Mercado Pago, faça uma assinatura e confira se o plano é liberado. Depois troque para as credenciais de produção.

A assinatura recorrente é cobrada no **cartão de crédito**. O Pix não serve para cobrança mensal automática.

## Passo 9: Tornar-se administrador da plataforma

Crie sua conta no app e rode no SQL Editor (troque o e-mail):

```sql
update public.profiles set is_platform_admin = true
where id = (select id from auth.users where email = 'seu-email@dominio.com');
```

Vai aparecer **Eu → Moderação**, com as denúncias feitas pelos usuários.

**Dar um plano de cortesia** (ex.: para a sua igreja ou para testes):

```sql
-- Premium pessoal grátis por 1 ano
insert into public.subscriptions (kind, user_id, provider, status, valid_until)
select 'personal', id, 'manual', 'authorized', now() + interval '1 year'
from auth.users where email = 'pessoa@email.com';

-- Plano Célula grátis (troque pelo id da célula: aparece na URL, depois de #/celula/)
insert into public.subscriptions (kind, user_id, cell_id, provider, status, valid_until)
select 'cell', id, 'ID-DA-CELULA', 'manual', 'authorized', now() + interval '1 year'
from auth.users where email = 'lider@email.com';
```

## Passo 10: Instalar no celular

- **Android (Chrome):** abra o site e toque em **Instalar app** (ou ⋮ → *Adicionar à tela inicial*).
- **iPhone (Safari):** toque em **Compartilhar → Adicionar à Tela de Início**. No iPhone, as notificações **só funcionam** quando o app é aberto pelo ícone da tela de início (iOS 16.4 ou mais novo).

Depois, em **Oração → Lembretes**, toque em **Ativar notificações**.

---

## Como o app funciona

- **Igreja → Células.** Quem cadastra a igreja vira pastor. O pastor cria as células e vira líder delas. Depois passa a liderança: em *Membros*, toque em ⋯ → *Tornar líder*.
- **Entrar na célula.** A pessoa cria a conta, encontra a célula (busca ou link de convite) e pede para entrar. O líder recebe uma notificação e aprova.
- **Mural** (só líderes): tema, versículo, dinâmica e avisos. Todos os membros são notificados.
- **Fórum:** qualquer membro abre discussões.
- **Rede social:** publicações, curtidas, comentários, conexões, denúncia e bloqueio.
- **Oração:** pedidos (para todos, para a célula ou só para os líderes) com o botão "Orei por você", lembretes nos horários escolhidos e diário (Premium).

## Plano grátis × pagos

| | Grátis | Premium (pessoa) | Plano Célula (líder paga) |
|---|---|---|---|
| Células, mural, fórum, rede social, pedidos de oração | ✓ | ✓ | ✓ |
| Versículo do dia | ✓ | ✓ | ✓ |
| Lembretes de oração | 1 | até 20 | — |
| Diário de oração | | ✓ | |
| Planos de leitura | 2 | todos (5) | |
| Membros por célula | até 15 | | ilimitado |
| Presença, faltas, visitantes, escala, multiplicação | | | ✓ |

Para mudar os limites, altere a função `plan_limit` no `001_estrutura.sql` (rode só aquele trecho no SQL Editor) e os números no `config.js`.

## Custos para começar

- **Domínio .com.br:** anual, no registro.br.
- **Vercel e Supabase:** têm plano gratuito para começar. No Supabase gratuito, o projeto **pausa depois de uma semana sem uso**. Quando houver usuários de verdade, passe para o plano pago, que também faz backups diários.
- **Mercado Pago:** cobra uma taxa por pagamento recebido.

## Antes de lançar

- [ ] Revisar **Termos** e **Privacidade** (`app/js/views/legal.js`) com um advogado e colocar seu nome/CNPJ e e-mail.
- [ ] Configurar o SMTP próprio (Passo 3).
- [ ] Testar uma assinatura com as credenciais de teste do Mercado Pago.
- [ ] Testar as notificações no Android e no iPhone.
- [ ] Criar sua igreja e uma célula de exemplo.
