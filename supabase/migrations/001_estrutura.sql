-- =====================================================================
-- CONEC CÉLULA — estrutura do banco de dados (Supabase / PostgreSQL)
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em RUN.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PERFIS
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  username text unique,
  avatar_url text,
  bio text,
  city text,
  timezone text not null default 'America/Sao_Paulo',
  daily_verse_enabled boolean not null default true,
  daily_verse_time time not null default '07:00',
  last_verse_sent_on date,
  is_platform_admin boolean not null default false,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now()
);

-- dados pessoais sensíveis ficam separados (LGPD): só o dono e líderes das células dele veem
create table public.profiles_private (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  birth_date date,
  phone text,
  show_birthday boolean not null default true
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, accepted_terms_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case when (new.raw_user_meta_data->>'accepted_terms') = 'true' then now() end
  );
  insert into public.profiles_private (user_id, birth_date)
  values (new.id, nullif(new.raw_user_meta_data->>'birth_date', '')::date);
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- IGREJAS E CÉLULAS
-- ---------------------------------------------------------------------
create table public.churches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  description text,
  logo_url text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.church_admins (
  church_id uuid references public.churches(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'admin' check (role in ('pastor','admin')),
  primary key (church_id, user_id)
);

create table public.cells (
  id uuid primary key default gen_random_uuid(),
  church_id uuid not null references public.churches(id) on delete cascade,
  parent_cell_id uuid references public.cells(id) on delete set null, -- multiplicação
  name text not null,
  description text,
  meeting_day smallint check (meeting_day between 0 and 6), -- 0 = domingo
  meeting_time time,
  neighborhood text,
  city text,
  lat double precision,
  lng double precision,
  is_listed boolean not null default true,   -- aparece em "encontrar célula"
  color text default '#E8603C',
  status text not null default 'active' check (status in ('active','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- endereço completo só para membros aprovados
create table public.cell_private (
  cell_id uuid primary key references public.cells(id) on delete cascade,
  address text,
  notes text
);

create table public.cell_members (
  cell_id uuid references public.cells(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader','co_leader','host','member')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  message text,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (cell_id, user_id)
);
create index on public.cell_members (user_id);

-- ---------------------------------------------------------------------
-- ASSINATURAS (Mercado Pago)
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('personal','cell')),
  user_id uuid not null references public.profiles(id) on delete cascade, -- quem paga
  cell_id uuid references public.cells(id) on delete cascade,
  provider text not null default 'mercadopago' check (provider in ('mercadopago','manual')),
  provider_id text unique,
  status text not null default 'pending' check (status in ('pending','authorized','paused','cancelled')),
  amount numeric(10,2),
  next_payment_date timestamptz,
  valid_until timestamptz, -- para planos manuais/cortesia
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'cell' or cell_id is not null)
);

-- ---------------------------------------------------------------------
-- FUNÇÕES DE PERMISSÃO (usadas nas regras de segurança)
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_church_admin(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from church_admins where church_id = p_church and user_id = auth.uid())
$$;

create or replace function public.is_cell_member(p_cell uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cell_members
                 where cell_id = p_cell and user_id = auth.uid() and status = 'approved')
$$;

create or replace function public.is_cell_leader(p_cell uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cell_members
                 where cell_id = p_cell and user_id = auth.uid() and status = 'approved'
                   and role in ('leader','co_leader'))
      or exists (select 1 from cells c join church_admins a on a.church_id = c.church_id
                 where c.id = p_cell and a.user_id = auth.uid())
$$;

-- o usuário logado é líder de alguma célula da qual p_user é membro?
create or replace function public.leads_user(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from cell_members m
    where m.user_id = p_user and m.status = 'approved' and public.is_cell_leader(m.cell_id))
$$;

create or replace function public.has_personal_premium(p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where user_id = p_user and kind = 'personal'
      and ((status = 'authorized' and provider = 'mercadopago')
        or (provider = 'manual' and (valid_until is null or valid_until > now()) and status = 'authorized')))
$$;

create or replace function public.cell_is_premium(p_cell uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from subscriptions
    where cell_id = p_cell and kind = 'cell' and status = 'authorized'
      and (valid_until is null or valid_until > now()))
$$;


-- ---------------------------------------------------------------------
-- MURAL DA CÉLULA (tema, versículo, dinâmica, aviso) + FÓRUM (discussões)
-- ---------------------------------------------------------------------
create table public.cell_posts (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('tema','versiculo','dinamica','aviso','discussao')),
  title text not null,
  body text,
  verse_ref text,
  meeting_date date,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.cell_posts (cell_id, created_at desc);

create table public.cell_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.cell_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- EVENTOS, ESCALA, ENCONTROS/PRESENÇA, VISITANTES
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid references public.cells(id) on delete cascade,
  church_id uuid references public.churches(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (cell_id is not null or church_id is not null)
);

create table public.event_rsvps (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  status text not null check (status in ('going','maybe','no')),
  primary key (event_id, user_id)
);

create table public.duty_roster (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  date date not null,
  task text not null,       -- lanche, louvor, casa, palavra, oração...
  user_id uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  date date not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cell_id, date)
);

create table public.attendance (
  meeting_id uuid references public.meetings(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  present boolean not null default true,
  primary key (meeting_id, user_id)
);

create table public.visitors (
  id uuid primary key default gen_random_uuid(),
  cell_id uuid not null references public.cells(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  visited_on date not null default current_date,
  followed_up boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ORAÇÃO
-- ---------------------------------------------------------------------
create table public.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  cell_id uuid references public.cells(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public','cell','leaders')),
  body text not null,
  is_answered boolean not null default false,
  answered_note text,
  created_at timestamptz not null default now(),
  check (visibility = 'public' or cell_id is not null)
);

create table public.prayer_amens (
  request_id uuid references public.prayer_requests(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

create table public.prayer_journal (  -- premium pessoal
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.prayer_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  time time not null,
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  label text not null default 'Hora de orar',
  enabled boolean not null default true,
  last_sent_on date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- REDE SOCIAL: publicações, curtidas, comentários, conexões
-- ---------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  verse_ref text,
  image_url text,
  created_at timestamptz not null default now()
);
create index on public.posts (created_at desc);

create table public.post_likes (
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.blocks (
  blocker_id uuid references public.profiles(id) on delete cascade,
  blocked_id uuid references public.profiles(id) on delete cascade,
  primary key (blocker_id, blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b)
                                          or (blocker_id = b and blocked_id = a))
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  target_type text not null check (target_type in ('post','comment','prayer','profile','cell_post')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PLANOS DE LEITURA
-- ---------------------------------------------------------------------
create table public.reading_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reading_plan_days (
  plan_id uuid references public.reading_plans(id) on delete cascade,
  day int not null,
  refs text not null,
  primary key (plan_id, day)
);

create table public.reading_progress (
  user_id uuid references public.profiles(id) on delete cascade,
  plan_id uuid references public.reading_plans(id) on delete cascade,
  day int not null,
  done_at timestamptz not null default now(),
  primary key (user_id, plan_id, day)
);

create table public.cell_reading_plans (
  cell_id uuid references public.cells(id) on delete cascade,
  plan_id uuid references public.reading_plans(id) on delete cascade,
  start_date date not null default current_date,
  primary key (cell_id, plan_id)
);

-- ---------------------------------------------------------------------
-- VERSÍCULOS, NOTIFICAÇÕES E PUSH
-- ---------------------------------------------------------------------
create table public.daily_verses (
  id serial primary key,
  ref text not null,
  text text not null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);
create index on public.notifications (pushed_at) where pushed_at is null;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- LIMITES DO PLANO GRÁTIS (altere os números aqui se quiser)
-- =====================================================================
create or replace function public.plan_limit(p_key text)
returns int language sql immutable as $$
  select case p_key
    when 'free_cell_members' then 15      -- membros por célula no plano grátis
    when 'free_prayer_reminders' then 1   -- lembretes de oração no plano grátis
    when 'premium_prayer_reminders' then 20
    else 0 end
$$;

create or replace function public.enforce_cell_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then
    if not cell_is_premium(new.cell_id) then
      select count(*) into n from cell_members where cell_id = new.cell_id and status = 'approved';
      if n >= plan_limit('free_cell_members') then
        raise exception 'LIMITE_PLANO: células no plano grátis podem ter até % membros. Assine o Plano Célula para liberar.', plan_limit('free_cell_members');
      end if;
    end if;
    new.joined_at := coalesce(new.joined_at, now());
  end if;
  return new;
end $$;
create trigger cell_member_limit before insert or update on public.cell_members
for each row execute function public.enforce_cell_member_limit();

create or replace function public.enforce_reminder_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int; lim int;
begin
  lim := case when has_personal_premium(new.user_id) then plan_limit('premium_prayer_reminders')
              else plan_limit('free_prayer_reminders') end;
  select count(*) into n from prayer_reminders where user_id = new.user_id;
  if n >= lim then
    raise exception 'LIMITE_PLANO: seu plano permite % lembrete(s) de oração.', lim;
  end if;
  return new;
end $$;
create trigger prayer_reminder_limit before insert on public.prayer_reminders
for each row execute function public.enforce_reminder_limit();

-- =====================================================================
-- AUTOMAÇÕES: quem cria igreja vira pastor; quem cria célula vira líder
-- =====================================================================
create or replace function public.after_church_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into church_admins (church_id, user_id, role) values (new.id, new.created_by, 'pastor')
    on conflict do nothing;
  end if;
  return new;
end $$;
create trigger church_creator_pastor after insert on public.churches
for each row execute function public.after_church_insert();

create or replace function public.after_cell_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into cell_private (cell_id) values (new.id) on conflict do nothing;
  if new.created_by is not null then
    insert into cell_members (cell_id, user_id, role, status, joined_at)
    values (new.id, new.created_by, 'leader', 'approved', now())
    on conflict (cell_id, user_id) do update set role = 'leader', status = 'approved';
  end if;
  return new;
end $$;
create trigger cell_creator_leader after insert on public.cells
for each row execute function public.after_cell_insert();

-- =====================================================================
-- NOTIFICAÇÕES AUTOMÁTICAS
-- =====================================================================
create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link)
$$;

create or replace function public.trg_cell_member_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; uname text; r record;
begin
  select name into cname from cells where id = new.cell_id;
  select full_name into uname from profiles where id = new.user_id;
  if tg_op = 'INSERT' and new.status = 'pending' then
    for r in select user_id from cell_members where cell_id = new.cell_id and status = 'approved' and role in ('leader','co_leader') loop
      perform notify(r.user_id, 'join_request', 'Novo pedido de entrada',
                     uname || ' quer entrar na célula ' || cname, '#/celula/' || new.cell_id || '/membros');
    end loop;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    perform notify(new.user_id, 'join_approved', 'Bem-vindo(a)!',
                   'Seu pedido para entrar na célula ' || cname || ' foi aprovado.', '#/celula/' || new.cell_id);
  end if;
  return new;
end $$;
create trigger cell_member_notify after insert or update on public.cell_members
for each row execute function public.trg_cell_member_notify();

create or replace function public.trg_cell_post_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare cname text; r record; label text;
begin
  if new.kind = 'discussao' then return new; end if;
  select name into cname from cells where id = new.cell_id;
  label := case new.kind when 'tema' then 'Tema do encontro' when 'versiculo' then 'Versículo'
                         when 'dinamica' then 'Dinâmica' else 'Aviso' end;
  for r in select user_id from cell_members where cell_id = new.cell_id and status = 'approved' and user_id <> new.author_id loop
    perform notify(r.user_id, 'cell_post', cname || ' · ' || label, new.title, '#/celula/' || new.cell_id);
  end loop;
  return new;
end $$;
create trigger cell_post_notify after insert on public.cell_posts
for each row execute function public.trg_cell_post_notify();

create or replace function public.trg_social_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare actor text; target uuid;
begin
  if tg_table_name = 'post_likes' then
    select author_id into target from posts where id = new.post_id;
    select full_name into actor from profiles where id = new.user_id;
    if target <> new.user_id then
      perform notify(target, 'like', actor || ' curtiu sua publicação', null, '#/post/' || new.post_id);
    end if;
  elsif tg_table_name = 'post_comments' then
    select author_id into target from posts where id = new.post_id;
    select full_name into actor from profiles where id = new.author_id;
    if target <> new.author_id then
      perform notify(target, 'comment', actor || ' comentou', left(new.body, 120), '#/post/' || new.post_id);
    end if;
  elsif tg_table_name = 'follows' then
    select full_name into actor from profiles where id = new.follower_id;
    perform notify(new.following_id, 'follow', actor || ' se conectou com você', null, '#/perfil/' || new.follower_id);
  elsif tg_table_name = 'prayer_amens' then
    select author_id into target from prayer_requests where id = new.request_id;
    select full_name into actor from profiles where id = new.user_id;
    if target <> new.user_id then
      perform notify(target, 'amen', actor || ' orou por você 🙏', null, '#/oracao');
    end if;
  end if;
  return new;
end $$;
create trigger like_notify after insert on public.post_likes for each row execute function public.trg_social_notify();
create trigger comment_notify after insert on public.post_comments for each row execute function public.trg_social_notify();
create trigger follow_notify after insert on public.follows for each row execute function public.trg_social_notify();
create trigger amen_notify after insert on public.prayer_amens for each row execute function public.trg_social_notify();

create or replace function public.trg_event_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.cell_id is not null then
    for r in select user_id from cell_members where cell_id = new.cell_id and status = 'approved'
             and user_id <> coalesce(new.created_by, '00000000-0000-0000-0000-000000000000') loop
      perform notify(r.user_id, 'event', 'Novo evento: ' || new.title,
                     to_char(new.starts_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), '#/celula/' || new.cell_id || '/agenda');
    end loop;
  end if;
  return new;
end $$;
create trigger event_notify after insert on public.events for each row execute function public.trg_event_notify();

-- =====================================================================
-- CONSULTAS PRONTAS (RPC)
-- =====================================================================

-- aniversariantes de uma célula (só membros veem; mostra dia/mês, nunca o ano)
create or replace function public.cell_birthdays(p_cell uuid)
returns table (user_id uuid, full_name text, avatar_url text, day int, month int)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url,
         extract(day from pp.birth_date)::int, extract(month from pp.birth_date)::int
  from cell_members m
  join profiles p on p.id = m.user_id
  join profiles_private pp on pp.user_id = p.id
  where m.cell_id = p_cell and m.status = 'approved'
    and pp.birth_date is not null and pp.show_birthday
    and public.is_cell_member(p_cell)
  order by extract(month from pp.birth_date), extract(day from pp.birth_date)
$$;

-- lista pública de células para "encontrar célula"
create or replace function public.find_cells(p_search text default null)
returns table (id uuid, name text, church_id uuid, church_name text, neighborhood text, city text,
               meeting_day smallint, meeting_time time, lat double precision, lng double precision,
               members bigint, color text)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.church_id, ch.name, c.neighborhood, c.city, c.meeting_day, c.meeting_time,
         c.lat, c.lng,
         (select count(*) from cell_members m where m.cell_id = c.id and m.status = 'approved'),
         c.color
  from cells c join churches ch on ch.id = c.church_id
  where c.status = 'active' and c.is_listed
    and (p_search is null or p_search = ''
         or c.name ilike '%' || p_search || '%' or ch.name ilike '%' || p_search || '%'
         or c.neighborhood ilike '%' || p_search || '%' or c.city ilike '%' || p_search || '%')
  order by ch.name, c.name
  limit 200
$$;

-- painel do pastor
create or replace function public.church_stats(p_church uuid)
returns table (cell_id uuid, cell_name text, leader_name text, members bigint, pending bigint,
               avg_attendance numeric, visitors_30d bigint, last_meeting date, is_premium boolean)
language sql stable security definer set search_path = public as $$
  select c.id, c.name,
    (select p.full_name from cell_members m join profiles p on p.id = m.user_id
      where m.cell_id = c.id and m.role = 'leader' and m.status = 'approved' limit 1),
    (select count(*) from cell_members m where m.cell_id = c.id and m.status = 'approved'),
    (select count(*) from cell_members m where m.cell_id = c.id and m.status = 'pending'),
    (select round(avg(x.n), 1) from (
        select count(*) filter (where a.present) as n
        from meetings mt left join attendance a on a.meeting_id = mt.id
        where mt.cell_id = c.id and mt.date > current_date - 60
        group by mt.id) x),
    (select count(*) from visitors v where v.cell_id = c.id and v.visited_on > current_date - 30),
    (select max(date) from meetings mt where mt.cell_id = c.id),
    public.cell_is_premium(c.id)
  from cells c
  where c.church_id = p_church and c.status = 'active' and public.is_church_admin(p_church)
  order by c.name
$$;

-- convidar/transformar alguém em líder (somente admins da igreja)
create or replace function public.set_cell_role(p_cell uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_cell_leader(p_cell) then raise exception 'Sem permissão'; end if;
  if p_role = 'leader' and not exists (select 1 from cells c where c.id = p_cell and is_church_admin(c.church_id))
     and not exists (select 1 from cell_members where cell_id = p_cell and user_id = auth.uid() and role = 'leader') then
    raise exception 'Somente o líder ou o pastor podem definir líderes';
  end if;
  update cell_members set role = p_role where cell_id = p_cell and user_id = p_user and status = 'approved';
end $$;

-- multiplicar célula: cria a célula filha com o novo líder
create or replace function public.multiply_cell(p_cell uuid, p_name text, p_new_leader uuid, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare parent cells; new_id uuid;
begin
  if not is_cell_leader(p_cell) then raise exception 'Sem permissão'; end if;
  select * into parent from cells where id = p_cell;
  insert into cells (church_id, parent_cell_id, name, meeting_day, meeting_time, neighborhood, city, color, created_by)
  values (parent.church_id, p_cell, p_name, parent.meeting_day, parent.meeting_time, parent.neighborhood, parent.city, parent.color, p_new_leader)
  returning id into new_id;
  update cell_members set status = 'removed' where cell_id = p_cell and user_id = any(p_members) and user_id <> p_new_leader;
  update cell_members set status = 'removed' where cell_id = p_cell and user_id = p_new_leader;
  insert into cell_members (cell_id, user_id, role, status, joined_at)
  select new_id, u, 'member', 'approved', now() from unnest(p_members) u where u <> p_new_leader
  on conflict do nothing;
  perform notify(p_new_leader, 'multiply', 'Nova célula: ' || p_name, 'Você agora é líder desta célula.', '#/celula/' || new_id);
  return new_id;
end $$;

-- versículo do dia (o mesmo para todo mundo no dia)
create or replace function public.verse_of_the_day()
returns table (ref text, text text) language sql stable security definer set search_path = public as $$
  select ref, text from daily_verses
  order by id
  offset (extract(doy from (now() at time zone 'America/Sao_Paulo'))::int % greatest((select count(*) from daily_verses), 1))
  limit 1
$$;

-- excluir minha conta (LGPD)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end $$;

-- ausências: avisa líderes quando um membro faltou aos 2 últimos encontros (rodado 1x por dia)
create or replace function public.check_absences()
returns void language plpgsql security definer set search_path = public as $$
declare r record; l record;
begin
  for r in
    select m.cell_id, m.user_id, p.full_name, c.name as cell_name
    from cell_members m join profiles p on p.id = m.user_id join cells c on c.id = m.cell_id
    where m.status = 'approved' and m.role = 'member' and cell_is_premium(m.cell_id)
      and (select count(*) from (
             select mt.id from meetings mt where mt.cell_id = m.cell_id order by mt.date desc limit 2) last2
           where not exists (select 1 from attendance a where a.meeting_id = last2.id and a.user_id = m.user_id and a.present)
          ) = 2
      and (select count(*) from meetings mt where mt.cell_id = m.cell_id) >= 2
      and (select max(mt.date) from meetings mt where mt.cell_id = m.cell_id) = current_date - 1
  loop
    for l in select user_id from cell_members where cell_id = r.cell_id and status = 'approved' and role in ('leader','co_leader') loop
      perform notify(l.user_id, 'absence', 'Sentimos falta de ' || r.full_name,
                     'Faltou aos 2 últimos encontros da ' || r.cell_name || '. Que tal mandar uma mensagem?',
                     '#/perfil/' || r.user_id);
    end loop;
  end loop;
end $$;

-- usadas pela função de notificações (somente o servidor pode chamar)
create or replace function public.claim_due_reminders()
returns table (user_id uuid, label text) language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    select r.id from prayer_reminders r join profiles p on p.id = r.user_id
    where r.enabled
      and extract(dow from (now() at time zone p.timezone))::smallint = any(r.days)
      and ((now() at time zone p.timezone)::date + r.time) <= (now() at time zone p.timezone)
      and ((now() at time zone p.timezone)::date + r.time) > (now() at time zone p.timezone) - interval '15 minutes'
      and (r.last_sent_on is null or r.last_sent_on < (now() at time zone p.timezone)::date)
    for update of r skip locked)
  update prayer_reminders r set last_sent_on = (now() at time zone p.timezone)::date
  from due, profiles p
  where r.id = due.id and p.id = r.user_id
  returning r.user_id, r.label;
end $$;

create or replace function public.claim_due_daily_verse()
returns table (user_id uuid) language plpgsql security definer set search_path = public as $$
begin
  return query
  update profiles p set last_verse_sent_on = (now() at time zone p.timezone)::date
  where p.daily_verse_enabled
    and ((now() at time zone p.timezone)::date + p.daily_verse_time) <= (now() at time zone p.timezone)
    and ((now() at time zone p.timezone)::date + p.daily_verse_time) > (now() at time zone p.timezone) - interval '15 minutes'
    and (p.last_verse_sent_on is null or p.last_verse_sent_on < (now() at time zone p.timezone)::date)
    and exists (select 1 from push_subscriptions s where s.user_id = p.id)
  returning p.id;
end $$;

revoke execute on function public.claim_due_reminders() from public, anon, authenticated;
revoke execute on function public.claim_due_daily_verse() from public, anon, authenticated;
revoke execute on function public.check_absences() from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- =====================================================================
-- SEGURANÇA (Row Level Security): quem pode ver e mexer em quê
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.profiles_private enable row level security;
alter table public.churches enable row level security;
alter table public.church_admins enable row level security;
alter table public.cells enable row level security;
alter table public.cell_private enable row level security;
alter table public.cell_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.cell_posts enable row level security;
alter table public.cell_post_comments enable row level security;
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.duty_roster enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;
alter table public.visitors enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.prayer_amens enable row level security;
alter table public.prayer_journal enable row level security;
alter table public.prayer_reminders enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.reading_plans enable row level security;
alter table public.reading_plan_days enable row level security;
alter table public.reading_progress enable row level security;
alter table public.cell_reading_plans enable row level security;
alter table public.daily_verses enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

-- perfis: qualquer usuário logado vê perfis públicos; cada um edita o seu
create policy "ver perfis" on public.profiles for select to authenticated using (true);
create policy "editar meu perfil" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and is_platform_admin = (select is_platform_admin from public.profiles where id = auth.uid()));

create policy "ver dados privados" on public.profiles_private for select to authenticated
  using (user_id = auth.uid() or public.leads_user(user_id));
create policy "editar meus dados privados" on public.profiles_private for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- igrejas
create policy "ver igrejas" on public.churches for select to authenticated using (true);
create policy "criar igreja" on public.churches for insert to authenticated with check (created_by = auth.uid());
create policy "editar igreja" on public.churches for update to authenticated using (public.is_church_admin(id));
create policy "apagar igreja" on public.churches for delete to authenticated
  using (exists (select 1 from public.church_admins where church_id = id and user_id = auth.uid() and role = 'pastor'));

create policy "ver admins" on public.church_admins for select to authenticated using (true);
create policy "gerir admins" on public.church_admins for insert to authenticated with check (public.is_church_admin(church_id));
create policy "remover admins" on public.church_admins for delete to authenticated using (public.is_church_admin(church_id));

-- células
create policy "ver células" on public.cells for select to authenticated
  using (is_listed or public.is_cell_member(id) or public.is_church_admin(church_id));
create policy "criar célula" on public.cells for insert to authenticated
  with check (created_by = auth.uid() and public.is_church_admin(church_id));
create policy "editar célula" on public.cells for update to authenticated using (public.is_cell_leader(id));
create policy "apagar célula" on public.cells for delete to authenticated using (public.is_church_admin(church_id));

create policy "ver endereço" on public.cell_private for select to authenticated using (public.is_cell_member(cell_id) or public.is_cell_leader(cell_id));
create policy "editar endereço" on public.cell_private for update to authenticated using (public.is_cell_leader(cell_id));

-- membros
create policy "ver membros" on public.cell_members for select to authenticated
  using (user_id = auth.uid() or public.is_cell_member(cell_id) or public.is_cell_leader(cell_id));
create policy "pedir para entrar" on public.cell_members for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and role = 'member');
create policy "líder aprova/adiciona" on public.cell_members for update to authenticated
  using (public.is_cell_leader(cell_id) or user_id = auth.uid())
  with check (public.is_cell_leader(cell_id)
              or (user_id = auth.uid() and status in ('pending','removed') and role = 'member'));
create policy "sair ou remover" on public.cell_members for delete to authenticated
  using (user_id = auth.uid() or public.is_cell_leader(cell_id));

-- assinaturas: só leitura pelo app; quem grava é o servidor (Mercado Pago)
create policy "ver assinaturas" on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or (cell_id is not null and public.is_cell_member(cell_id)) or public.is_platform_admin());

-- mural e fórum
create policy "ver mural" on public.cell_posts for select to authenticated using (public.is_cell_member(cell_id) or public.is_cell_leader(cell_id));
create policy "postar no mural" on public.cell_posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_cell_member(cell_id)
              and (kind = 'discussao' or public.is_cell_leader(cell_id)));
create policy "editar post mural" on public.cell_posts for update to authenticated
  using (author_id = auth.uid() or public.is_cell_leader(cell_id));
create policy "apagar post mural" on public.cell_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_cell_leader(cell_id));

create policy "ver comentários mural" on public.cell_post_comments for select to authenticated
  using (exists (select 1 from public.cell_posts p where p.id = post_id and public.is_cell_member(p.cell_id)));
create policy "comentar mural" on public.cell_post_comments for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.cell_posts p where p.id = post_id and public.is_cell_member(p.cell_id)));
create policy "apagar comentário mural" on public.cell_post_comments for delete to authenticated
  using (author_id = auth.uid() or exists (select 1 from public.cell_posts p where p.id = post_id and public.is_cell_leader(p.cell_id)));

-- eventos
create policy "ver eventos" on public.events for select to authenticated
  using ((cell_id is not null and public.is_cell_member(cell_id))
      or (church_id is not null and (public.is_church_admin(church_id)
          or exists (select 1 from public.cell_members m join public.cells c on c.id = m.cell_id
                     where c.church_id = events.church_id and m.user_id = auth.uid() and m.status = 'approved'))));
create policy "criar eventos" on public.events for insert to authenticated
  with check (created_by = auth.uid() and ((cell_id is not null and public.is_cell_leader(cell_id))
                                        or (church_id is not null and public.is_church_admin(church_id))));
create policy "editar eventos" on public.events for update to authenticated
  using ((cell_id is not null and public.is_cell_leader(cell_id)) or (church_id is not null and public.is_church_admin(church_id)));
create policy "apagar eventos" on public.events for delete to authenticated
  using ((cell_id is not null and public.is_cell_leader(cell_id)) or (church_id is not null and public.is_church_admin(church_id)));

create policy "ver presenças evento" on public.event_rsvps for select to authenticated using (true);
create policy "confirmar presença" on public.event_rsvps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- escala, encontros, presença, visitantes (recursos do Plano Célula)
create policy "ver escala" on public.duty_roster for select to authenticated using (public.is_cell_member(cell_id));
create policy "gerir escala" on public.duty_roster for all to authenticated
  using (public.is_cell_leader(cell_id)) with check (public.is_cell_leader(cell_id) and public.cell_is_premium(cell_id));

create policy "ver encontros" on public.meetings for select to authenticated using (public.is_cell_member(cell_id) or public.is_cell_leader(cell_id));
create policy "gerir encontros" on public.meetings for all to authenticated
  using (public.is_cell_leader(cell_id)) with check (public.is_cell_leader(cell_id) and public.cell_is_premium(cell_id));

create policy "ver presença" on public.attendance for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.meetings m where m.id = meeting_id and public.is_cell_leader(m.cell_id)));
create policy "marcar presença" on public.attendance for all to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and public.is_cell_leader(m.cell_id)))
  with check (exists (select 1 from public.meetings m where m.id = meeting_id and public.is_cell_leader(m.cell_id)));

create policy "ver visitantes" on public.visitors for select to authenticated using (public.is_cell_leader(cell_id));
create policy "gerir visitantes" on public.visitors for all to authenticated
  using (public.is_cell_leader(cell_id)) with check (public.is_cell_leader(cell_id) and public.cell_is_premium(cell_id));

-- oração
create policy "ver pedidos" on public.prayer_requests for select to authenticated
  using (author_id = auth.uid()
      or (visibility = 'public' and not public.is_blocked_between(auth.uid(), author_id))
      or (visibility = 'cell' and public.is_cell_member(cell_id))
      or (visibility = 'leaders' and public.is_cell_leader(cell_id)));
create policy "criar pedido" on public.prayer_requests for insert to authenticated
  with check (author_id = auth.uid() and (cell_id is null or public.is_cell_member(cell_id)));
create policy "editar pedido" on public.prayer_requests for update to authenticated using (author_id = auth.uid());
create policy "apagar pedido" on public.prayer_requests for delete to authenticated
  using (author_id = auth.uid() or public.is_platform_admin() or (cell_id is not null and public.is_cell_leader(cell_id)));

create policy "ver amém" on public.prayer_amens for select to authenticated using (true);
create policy "dar amém" on public.prayer_amens for insert to authenticated with check (user_id = auth.uid());
create policy "tirar amém" on public.prayer_amens for delete to authenticated using (user_id = auth.uid());

create policy "meu diário" on public.prayer_journal for select to authenticated using (user_id = auth.uid());
create policy "escrever diário" on public.prayer_journal for insert to authenticated
  with check (user_id = auth.uid() and public.has_personal_premium());
create policy "editar diário" on public.prayer_journal for update to authenticated using (user_id = auth.uid());
create policy "apagar diário" on public.prayer_journal for delete to authenticated using (user_id = auth.uid());

create policy "meus lembretes" on public.prayer_reminders for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- rede social
create policy "ver posts" on public.posts for select to authenticated
  using (not public.is_blocked_between(auth.uid(), author_id));
create policy "publicar" on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy "editar post" on public.posts for update to authenticated using (author_id = auth.uid());
create policy "apagar post" on public.posts for delete to authenticated using (author_id = auth.uid() or public.is_platform_admin());

create policy "ver curtidas" on public.post_likes for select to authenticated using (true);
create policy "curtir" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "descurtir" on public.post_likes for delete to authenticated using (user_id = auth.uid());

create policy "ver comentários" on public.post_comments for select to authenticated
  using (not public.is_blocked_between(auth.uid(), author_id));
create policy "comentar" on public.post_comments for insert to authenticated
  with check (author_id = auth.uid()
              and not exists (select 1 from public.posts p where p.id = post_id and public.is_blocked_between(auth.uid(), p.author_id)));
create policy "apagar comentário" on public.post_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_platform_admin()
         or exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));

create policy "ver conexões" on public.follows for select to authenticated using (true);
create policy "conectar" on public.follows for insert to authenticated
  with check (follower_id = auth.uid() and not public.is_blocked_between(follower_id, following_id));
create policy "desconectar" on public.follows for delete to authenticated using (follower_id = auth.uid() or following_id = auth.uid());

create policy "meus bloqueios" on public.blocks for all to authenticated
  using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy "denunciar" on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy "ver denúncias" on public.reports for select to authenticated using (public.is_platform_admin() or reporter_id = auth.uid());
create policy "resolver denúncias" on public.reports for update to authenticated using (public.is_platform_admin());

-- leitura
create policy "ver planos" on public.reading_plans for select to authenticated using (true);
create policy "ver dias" on public.reading_plan_days for select to authenticated using (true);
create policy "meu progresso" on public.reading_progress for all to authenticated
  using (user_id = auth.uid() or public.leads_user(user_id))
  with check (user_id = auth.uid()
    and (not (select is_premium from public.reading_plans where id = plan_id) or public.has_personal_premium()));
create policy "ver leitura da célula" on public.cell_reading_plans for select to authenticated using (public.is_cell_member(cell_id));
create policy "definir leitura da célula" on public.cell_reading_plans for all to authenticated
  using (public.is_cell_leader(cell_id)) with check (public.is_cell_leader(cell_id));

-- versículos e notificações
create policy "ver versículos" on public.daily_verses for select to authenticated using (true);
create policy "minhas notificações" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "marcar como lida" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "apagar notificação" on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy "meus dispositivos" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- =====================================================================
-- FOTOS (Storage): bucket público "midia" — cada usuário grava na própria pasta
-- =====================================================================
insert into storage.buckets (id, name, public) values ('midia', 'midia', true)
on conflict (id) do nothing;

create policy "enviar minhas fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'midia' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "trocar minhas fotos" on storage.objects for update to authenticated
  using (bucket_id = 'midia' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "apagar minhas fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'midia' and (storage.foldername(name))[1] = auth.uid()::text);

-- o servidor (Edge Functions) pode chamar as funções internas
grant execute on function public.claim_due_reminders() to service_role;
grant execute on function public.claim_due_daily_verse() to service_role;
grant execute on function public.check_absences() to service_role;
grant execute on function public.notify(uuid, text, text, text, text) to service_role;
