import { h, icon, tabs, clear, spinner, empty, sheet, field, formData, busy, toast, confirmBox, badge, avatar,
  timeAgo, richText, fmtDate, fmtDateTime, fmtTime, WEEKDAYS, MONTHS, todayISO } from '../ui.js';
import { sb, run, uid, state, loadMe } from '../sb.js';
import { CONFIG } from '../config.js';
import { go, refresh } from '../app.js';
import { pageHead, premiumGate, personLine, reportSheet } from './common.js';
import { cellForm } from './church.js';
import { ROLE } from './cells.js';

const KIND = {
  tema: ['Tema do encontro', 'sparkle'], versiculo: ['Versículo', 'book'], dinamica: ['Dinâmica', 'users'],
  aviso: ['Aviso', 'bell'], discussao: ['Discussão', 'chat'],
};

export async function cell({ id, tab = 'mural', sub }) {
  const c = await run(sb.from('cells').select('*, churches(id, name)').eq('id', id).maybeSingle());
  if (!c) return h('div', null, pageHead('Célula', { back: 'celulas' }), empty('cells', 'Célula não encontrada', 'Ela pode ser privada ou ter sido removida.'));
  const { data: mem } = await sb.from('cell_members').select('role, status').eq('cell_id', id).eq('user_id', uid()).maybeSingle();
  const { data: leaderFlag } = await sb.rpc('is_cell_leader', { p_cell: id });
  const ctx = {
    c, id, member: mem?.status === 'approved', leader: !!leaderFlag, role: mem?.role,
    premium: !!(await sb.rpc('cell_is_premium', { p_cell: id })).data,
  };

  if (!ctx.member && !ctx.leader) return outsider(ctx, mem);

  if (tab === 'post' && sub) return thread(ctx, sub);

  const items = [['mural', 'Mural'], ['forum', 'Fórum'], ['agenda', 'Agenda'], ['membros', 'Membros']];
  if (ctx.leader) items.push(['presenca', 'Presença'], ['visitantes', 'Visitantes'], ['config', 'Ajustes']);
  const views = { mural, forum, agenda, membros, presenca, visitantes, config };
  const body = await (views[tab] || mural)(ctx);

  return h('div', { class: 'stack' },
    h('div', { class: 'cell-head', style: { '--c': c.color || '#E8603C' } },
      h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => go('celulas') }, icon('back')),
      h('div', { class: 'grow' },
        h('h1', null, c.name, ctx.premium ? ' ✨' : ''),
        h('small', null, [c.churches?.name, c.meeting_day !== null ? `${WEEKDAYS[c.meeting_day]}${c.meeting_time ? ' às ' + fmtTime(c.meeting_time) : ''}` : null].filter(Boolean).join(' · ')))),
    h('div', { class: 'tabs-scroll' }, tabs(items, tab, (t) => go(`celula/${id}/${t}`))),
    body);
}

// ---------------------------------------------------------------------
// Quem ainda não é membro
// ---------------------------------------------------------------------
async function outsider({ c, id }, mem) {
  const { data: list } = await sb.rpc('find_cells', { p_search: c.name });
  const info = (list || []).find((x) => x.id === id);
  const pending = mem?.status === 'pending';
  const btn = h('button', { class: 'btn block', disabled: pending, onclick: () => sheet('Pedir para entrar', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('cell_members').upsert(
        { cell_id: id, user_id: uid(), status: 'pending', role: 'member', message: d.message || null },
        { onConflict: 'cell_id,user_id' }), 'Pedido enviado! O líder vai receber uma notificação.'));
      close(); await loadMe(); refresh();
    } },
      field('Mensagem para o líder (opcional)', h('textarea', { name: 'message', rows: 3, maxlength: 300, placeholder: 'Ex.: Oi! Sou da igreja e moro no bairro…' })),
      h('button', { class: 'btn block' }, 'Enviar pedido'));
    return form;
  }) }, pending ? 'Pedido enviado — aguardando o líder' : 'Pedir para entrar');

  return h('div', { class: 'stack' },
    pageHead(c.name, { back: 'explorar' }),
    h('div', { class: 'card stack', style: { borderTop: `4px solid ${c.color}` } },
      h('p', { class: 'muted' }, icon('church', 16), ' ', c.churches?.name),
      c.description ? h('p', null, c.description) : null,
      h('div', { class: 'meta' },
        c.meeting_day !== null ? h('span', null, icon('calendar', 16), ` ${WEEKDAYS[c.meeting_day]}${c.meeting_time ? ' às ' + fmtTime(c.meeting_time) : ''}`) : null,
        c.neighborhood || c.city ? h('span', null, icon('pin', 16), ' ', [c.neighborhood, c.city].filter(Boolean).join(', ')) : null,
        info ? h('span', null, icon('users', 16), ` ${info.members} membros`) : null),
      h('p', { class: 'muted small' }, 'Esta é uma célula fechada. O endereço, o mural e as conversas aparecem depois que o líder aprovar sua entrada.'),
      btn,
      pending ? h('button', { class: 'link center small', onclick: async () => {
        await run(sb.from('cell_members').delete().eq('cell_id', id).eq('user_id', uid()), 'Pedido cancelado'); await loadMe(); refresh();
      } }, 'Cancelar pedido') : null));
}

// ---------------------------------------------------------------------
// MURAL: tema, versículo, dinâmica, avisos
// ---------------------------------------------------------------------
async function mural(ctx) {
  const posts = await run(sb.from('cell_posts')
    .select('*, author:profiles(id, full_name, avatar_url), cell_post_comments(count)')
    .eq('cell_id', ctx.id).neq('kind', 'discussao')
    .order('pinned', { ascending: false }).order('created_at', { ascending: false }).limit(40));
  const { data: priv } = await sb.from('cell_private').select('address').eq('cell_id', ctx.id).maybeSingle();

  return h('div', { class: 'stack' },
    priv?.address ? h('a', { class: 'card row gap', target: '_blank', rel: 'noopener',
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(priv.address)}` },
      icon('pin'), h('div', { class: 'grow' }, h('small', { class: 'muted' }, 'Local do encontro'), h('strong', null, priv.address))) : null,
    ctx.leader ? h('button', { class: 'btn block', onclick: () => newCellPost(ctx) }, icon('plus', 18), 'Publicar no mural') : null,
    posts.length ? posts.map((p) => cellPostCard(ctx, p))
      : empty('sparkle', 'O mural está vazio', ctx.leader ? 'Publique o tema, o versículo e a dinâmica do próximo encontro.' : 'Em breve o líder vai publicar o tema do encontro.'));
}

function cellPostCard(ctx, p) {
  const [label, ic] = KIND[p.kind];
  const canEdit = ctx.leader || p.author?.id === uid();
  return h('article', { class: `card cpost k-${p.kind}` },
    h('div', { class: 'row between' },
      h('span', { class: 'kind' }, icon(ic, 16), label, p.pinned ? ' · 📌 fixado' : ''),
      h('small', { class: 'muted' }, p.meeting_date ? 'Encontro de ' + fmtDate(p.meeting_date) : timeAgo(p.created_at))),
    h('h3', null, p.title),
    p.verse_ref ? h('div', { class: 'verse-tag' }, icon('book', 16), p.verse_ref) : null,
    p.body ? richText(p.body) : null,
    h('div', { class: 'row between mt' },
      h('a', { class: 'act', href: `#/celula/${ctx.id}/post/${p.id}` }, icon('chat', 18), ` ${p.cell_post_comments?.[0]?.count || 0} comentários`),
      canEdit ? h('div', { class: 'row' },
        ctx.leader ? h('button', { class: 'icon-btn', 'aria-label': p.pinned ? 'Desafixar' : 'Fixar', onclick: async () => {
          await run(sb.from('cell_posts').update({ pinned: !p.pinned }).eq('id', p.id)); refresh();
        } }, icon('pin', 18)) : null,
        h('button', { class: 'icon-btn', 'aria-label': 'Apagar', onclick: async () => {
          if (await confirmBox('Apagar esta publicação?', { ok: 'Apagar', danger: true })) { await run(sb.from('cell_posts').delete().eq('id', p.id)); refresh(); }
        } }, icon('trash', 18))) : h('button', { class: 'icon-btn', 'aria-label': 'Denunciar', onclick: () => reportSheet('cell_post', p.id) }, icon('flag', 18))));
}

function newCellPost(ctx, kind) {
  sheet(kind === 'discussao' ? 'Nova discussão' : 'Publicar no mural', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('[type=submit]'), () => run(sb.from('cell_posts').insert({
        cell_id: ctx.id, author_id: uid(), kind: kind || d.kind, title: d.title, body: d.body || null,
        verse_ref: d.verse_ref || null, meeting_date: d.meeting_date || null, pinned: !!d.pinned,
      }), 'Publicado! Os membros serão avisados.'));
      close(); refresh();
    } },
      kind ? null : field('Tipo', h('select', { name: 'kind' }, ['tema', 'versiculo', 'dinamica', 'aviso'].map((k) => h('option', { value: k }, KIND[k][0])))),
      field(kind ? 'Assunto' : 'Título', h('input', { name: 'title', required: true, maxlength: 120, placeholder: kind ? 'Sobre o que vamos conversar?' : 'Ex.: Fé que move montanhas' })),
      kind ? null : field('Versículo (referência)', h('input', { name: 'verse_ref', maxlength: 60, placeholder: 'Ex.: Marcos 11:22-24' })),
      field('Texto', h('textarea', { name: 'body', rows: 5, maxlength: 4000, placeholder: kind ? 'Escreva sua pergunta ou reflexão' : 'Perguntas para discussão, passo a passo da dinâmica, recados…' })),
      kind ? null : h('div', { class: 'grid2' },
        field('Data do encontro', h('input', { name: 'meeting_date', type: 'date' })),
        h('label', { class: 'check', style: { alignSelf: 'end' } }, h('input', { type: 'checkbox', name: 'pinned' }), h('span', null, 'Fixar no topo'))),
      h('button', { type: 'submit', class: 'btn block' }, 'Publicar'));
    return form;
  });
}

// ---------------------------------------------------------------------
// FÓRUM: discussões abertas pelos membros
// ---------------------------------------------------------------------
async function forum(ctx) {
  const posts = await run(sb.from('cell_posts')
    .select('id, title, body, created_at, author:profiles(id, full_name, avatar_url), cell_post_comments(count)')
    .eq('cell_id', ctx.id).eq('kind', 'discussao').order('created_at', { ascending: false }).limit(50));
  return h('div', { class: 'stack' },
    h('button', { class: 'btn block', onclick: () => newCellPost(ctx, 'discussao') }, icon('plus', 18), 'Iniciar discussão'),
    posts.length ? h('div', { class: 'card list' }, posts.map((p) => h('a', { class: 'list-item', href: `#/celula/${ctx.id}/post/${p.id}` },
      avatar(p.author, 38),
      h('div', { class: 'grow' }, h('strong', null, p.title), h('small', { class: 'muted' }, `${p.author?.full_name} · ${timeAgo(p.created_at)}`)),
      h('span', { class: 'badge' }, `💬 ${p.cell_post_comments?.[0]?.count || 0}`))))
      : empty('chat', 'Nenhuma discussão ainda', 'Faça uma pergunta, compartilhe uma reflexão ou continue o assunto do encontro.'));
}

async function thread(ctx, pid) {
  const p = await run(sb.from('cell_posts').select('*, author:profiles(id, full_name, avatar_url)').eq('id', pid).maybeSingle());
  if (!p) return h('div', null, pageHead('Discussão', { back: `celula/${ctx.id}` }), empty('chat', 'Não encontrada'));
  const list = h('div', { class: 'stack' });
  const load = async () => {
    const rows = await run(sb.from('cell_post_comments').select('id, body, created_at, author:profiles(id, full_name, avatar_url)').eq('post_id', pid).order('created_at'));
    clear(list, rows.length ? rows.map((c) => h('div', { class: 'comment' }, avatar(c.author, 34),
      h('div', { class: 'bubble grow' },
        h('div', { class: 'row between' }, h('strong', null, c.author.full_name), h('small', { class: 'muted' }, timeAgo(c.created_at))),
        richText(c.body),
        c.author.id === uid() || ctx.leader ? h('button', { class: 'link small', onclick: async () => {
          if (await confirmBox('Apagar comentário?', { ok: 'Apagar', danger: true })) { await run(sb.from('cell_post_comments').delete().eq('id', c.id)); load(); }
        } }, 'Apagar') : null)))
      : h('p', { class: 'muted center' }, 'Seja o primeiro a comentar.'));
  };
  load();
  const input = h('input', { placeholder: 'Escreva uma resposta…', maxlength: 2000 });
  return h('div', { class: 'stack' },
    pageHead(KIND[p.kind][0], { back: `celula/${ctx.id}/${p.kind === 'discussao' ? 'forum' : 'mural'}` }),
    cellPostCard(ctx, { ...p, cell_post_comments: null }),
    list,
    h('form', { class: 'comment-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!input.value.trim()) return;
      await run(sb.from('cell_post_comments').insert({ post_id: pid, author_id: uid(), body: input.value.trim() }));
      input.value = ''; load();
    } }, input, h('button', { class: 'icon-btn primary', 'aria-label': 'Enviar' }, icon('send'))));
}

// ---------------------------------------------------------------------
// AGENDA: eventos, aniversários, escala e leitura da célula
// ---------------------------------------------------------------------
async function agenda(ctx) {
  const [events, { data: bdays }, roster, { data: cplans }] = await Promise.all([
    run(sb.from('events').select('*, event_rsvps(user_id, status)').eq('cell_id', ctx.id)
      .gte('starts_at', new Date(Date.now() - 864e5).toISOString()).order('starts_at').limit(20)),
    sb.rpc('cell_birthdays', { p_cell: ctx.id }),
    run(sb.from('duty_roster').select('*, p:profiles(id, full_name)').eq('cell_id', ctx.id).gte('date', todayISO()).order('date').limit(30)),
    sb.from('cell_reading_plans').select('start_date, plan:reading_plans(id, title)').eq('cell_id', ctx.id),
  ]);
  const now = new Date();
  const m = now.getMonth() + 1, next = (m % 12) + 1;
  const monthBdays = (bdays || []).filter((b) => b.month === m || b.month === next)
    .sort((a, b) => ((a.month - m + 12) % 12) - ((b.month - m + 12) % 12) || a.day - b.day);

  const rsvp = (e) => {
    const mine = e.event_rsvps.find((r) => r.user_id === uid())?.status;
    const going = e.event_rsvps.filter((r) => r.status === 'going').length;
    const set = async (status) => {
      await run(sb.from('event_rsvps').upsert({ event_id: e.id, user_id: uid(), status }, { onConflict: 'event_id,user_id' }));
      refresh();
    };
    return h('div', { class: 'row gap wrap' },
      h('button', { class: 'chip' + (mine === 'going' ? ' on' : ''), onclick: () => set('going') }, 'Vou'),
      h('button', { class: 'chip' + (mine === 'maybe' ? ' on' : ''), onclick: () => set('maybe') }, 'Talvez'),
      h('button', { class: 'chip' + (mine === 'no' ? ' on' : ''), onclick: () => set('no') }, 'Não vou'),
      h('small', { class: 'muted' }, `${going} confirmados`));
  };

  return h('div', { class: 'stack' },
    h('div', { class: 'section-title row between' }, h('h2', null, 'Eventos'),
      ctx.leader ? h('button', { class: 'btn small', onclick: () => newEvent(ctx) }, icon('plus', 18), 'Evento') : null),
    events.length ? events.map((e) => h('div', { class: 'card stack' },
      h('div', { class: 'row between' }, h('strong', null, e.title),
        ctx.leader ? h('button', { class: 'icon-btn', 'aria-label': 'Apagar', onclick: async () => {
          if (await confirmBox('Apagar evento?', { ok: 'Apagar', danger: true })) { await run(sb.from('events').delete().eq('id', e.id)); refresh(); }
        } }, icon('trash', 18)) : null),
      h('small', { class: 'muted' }, icon('calendar', 14), ' ', fmtDateTime(e.starts_at), e.location ? ` · ${e.location}` : ''),
      e.description ? richText(e.description) : null,
      rsvp(e)))
      : h('p', { class: 'muted' }, 'Nenhum evento marcado.'),

    h('h2', { class: 'section-title' }, '🎂 Aniversariantes'),
    monthBdays.length ? h('div', { class: 'card list' }, monthBdays.map((b) => h('a', { class: 'list-item', href: `#/perfil/${b.user_id}` },
      avatar({ id: b.user_id, full_name: b.full_name, avatar_url: b.avatar_url }, 36),
      h('span', { class: 'grow' }, b.full_name),
      h('span', { class: 'badge' + (b.month === m && b.day === now.getDate() ? ' gold' : '') }, `${b.day} de ${MONTHS[b.month - 1]}`))))
      : h('p', { class: 'muted' }, 'Ninguém faz aniversário neste mês ou no próximo.'),

    h('div', { class: 'section-title row between' }, h('h2', null, 'Escala'),
      ctx.leader && ctx.premium ? h('button', { class: 'btn small', onclick: () => newRoster(ctx) }, icon('plus', 18), 'Escala') : null),
    !ctx.premium && ctx.leader ? premiumGate('Escala do encontro', 'Organize quem leva o lanche, quem cuida do louvor, da palavra e em qual casa será o encontro.', 'cell')
      : roster.length ? h('div', { class: 'card list' }, roster.map((r) => h('div', { class: 'list-item' },
        h('span', { class: 'badge' }, fmtDate(r.date)),
        h('div', { class: 'grow' }, h('strong', null, r.task), h('small', { class: 'muted' }, r.p?.full_name || r.note || '—')),
        ctx.leader ? h('button', { class: 'icon-btn', 'aria-label': 'Apagar', onclick: async () => { await run(sb.from('duty_roster').delete().eq('id', r.id)); refresh(); } }, icon('trash', 18)) : null)))
        : h('p', { class: 'muted' }, 'Nenhuma escala definida.'),

    h('div', { class: 'section-title row between' }, h('h2', null, 'Leitura em grupo'),
      ctx.leader ? h('button', { class: 'btn small ghost', onclick: () => pickCellPlan(ctx) }, icon('book', 18), 'Escolher') : null),
    cplans?.length ? h('div', { class: 'card list' }, cplans.map((cp) => h('a', { class: 'list-item', href: `#/leitura/${cp.plan.id}?celula=${ctx.id}` },
      icon('book'), h('div', { class: 'grow' }, h('strong', null, cp.plan.title), h('small', { class: 'muted' }, 'Desde ' + fmtDate(cp.start_date))))))
      : h('p', { class: 'muted' }, 'A célula ainda não tem um plano de leitura.'));
}

function newEvent(ctx) {
  sheet('Novo evento', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('events').insert({
        cell_id: ctx.id, title: d.title, description: d.description || null, location: d.location || null,
        starts_at: new Date(d.starts_at).toISOString(), created_by: uid() }), 'Evento criado! Os membros serão avisados.'));
      close(); refresh();
    } },
      field('Título', h('input', { name: 'title', required: true, placeholder: 'Ex.: Confraternização, culto especial, retiro' })),
      field('Quando', h('input', { name: 'starts_at', type: 'datetime-local', required: true })),
      field('Local', h('input', { name: 'location' })),
      field('Detalhes', h('textarea', { name: 'description', rows: 3 })),
      h('button', { class: 'btn block' }, 'Criar evento'));
    return form;
  });
}

async function membersList(ctx) {
  return run(sb.from('cell_members').select('user_id, role, status, message, created_at, p:profiles(id, full_name, avatar_url, city)')
    .eq('cell_id', ctx.id).in('status', ['approved', 'pending']).order('created_at'));
}

async function newRoster(ctx) {
  const members = (await membersList(ctx)).filter((m) => m.status === 'approved');
  sheet('Nova escala', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('duty_roster').insert({
        cell_id: ctx.id, date: d.date, task: d.task, user_id: d.user_id || null, note: d.note || null }), 'Escala salva!'));
      close(); refresh();
    } },
      field('Data', h('input', { name: 'date', type: 'date', required: true, value: todayISO() })),
      field('Função', h('input', { name: 'task', required: true, list: 'tasks', placeholder: 'Lanche, louvor, palavra, casa…' })),
      h('datalist', { id: 'tasks' }, ['Lanche', 'Louvor', 'Palavra', 'Oração', 'Casa (anfitrião)', 'Dinâmica', 'Crianças'].map((t) => h('option', { value: t }))),
      field('Responsável', h('select', { name: 'user_id' }, h('option', { value: '' }, '—'), members.map((m) => h('option', { value: m.user_id }, m.p.full_name)))),
      field('Observação', h('input', { name: 'note' })),
      h('button', { class: 'btn block' }, 'Salvar'));
    return form;
  });
}

async function pickCellPlan(ctx) {
  const plans = await run(sb.from('reading_plans').select('id, title, is_premium').order('created_at'));
  sheet('Plano de leitura da célula', (close) => h('div', { class: 'list' }, plans.map((p) => h('button', { class: 'list-item', onclick: async () => {
    await run(sb.from('cell_reading_plans').upsert({ cell_id: ctx.id, plan_id: p.id, start_date: todayISO() }), 'Plano definido para a célula!');
    close(); refresh();
  } }, icon('book'), h('span', { class: 'grow' }, p.title), p.is_premium ? badge('Premium', 'gold') : null))));
}

// ---------------------------------------------------------------------
// MEMBROS: lista, pedidos de entrada, funções, multiplicação
// ---------------------------------------------------------------------
async function membros(ctx) {
  const all = await membersList(ctx);
  const approved = all.filter((m) => m.status === 'approved');
  const pending = all.filter((m) => m.status === 'pending');
  const order = { leader: 0, co_leader: 1, host: 2, member: 3 };
  approved.sort((a, b) => order[a.role] - order[b.role] || a.p.full_name.localeCompare(b.p.full_name));

  const decide = (m, status) => async () => {
    await run(sb.from('cell_members').update({ status }).eq('cell_id', ctx.id).eq('user_id', m.user_id),
      status === 'approved' ? `${m.p.full_name} entrou na célula!` : 'Pedido recusado');
    refresh();
  };

  return h('div', { class: 'stack' },
    ctx.leader && pending.length ? h('section', { class: 'stack' },
      h('h2', { class: 'section-title' }, `Pedidos de entrada (${pending.length})`),
      pending.map((m) => h('div', { class: 'card stack' },
        personLine(m.p, timeAgo(m.created_at)),
        m.message ? h('p', { class: 'quote' }, `“${m.message}”`) : null,
        h('div', { class: 'row gap end' },
          h('button', { class: 'btn ghost small', onclick: decide(m, 'rejected') }, 'Recusar'),
          h('button', { class: 'btn small', onclick: decide(m, 'approved') }, icon('check', 18), 'Aprovar'))))) : null,

    h('div', { class: 'section-title row between' },
      h('h2', null, `Membros (${approved.length}${ctx.premium ? '' : '/' + CONFIG.FREE_CELL_MEMBERS})`),
      ctx.leader ? h('button', { class: 'btn small ghost', onclick: () => inviteSheet(ctx) }, icon('share', 18), 'Convidar') : null),
    !ctx.premium && approved.length >= CONFIG.FREE_CELL_MEMBERS - 2 && ctx.leader
      ? premiumGate('A célula está quase cheia', `No plano grátis, cada célula tem até ${CONFIG.FREE_CELL_MEMBERS} membros. Com o Plano Célula, não há limite.`, 'cell') : null,
    h('div', { class: 'card list' }, approved.map((m) => personLine(m.p, ROLE[m.role],
      ctx.leader && m.user_id !== uid() ? h('button', { class: 'icon-btn', 'aria-label': 'Opções do membro', onclick: (e) => { e.preventDefault(); memberMenu(ctx, m); } }, icon('dots')) : null))),

    ctx.leader && ctx.premium && approved.length >= 6 ? h('div', { class: 'card soft stack' },
      h('strong', null, '🌱 Hora de multiplicar?'),
      h('p', { class: 'muted' }, 'Crie uma nova célula a partir desta, com um novo líder e parte dos membros.'),
      h('button', { class: 'btn ghost small', onclick: () => multiplySheet(ctx, approved) }, 'Multiplicar célula')) : null,

    ctx.member && ctx.role !== 'leader' ? h('button', { class: 'link danger center small', onclick: async () => {
      if (!(await confirmBox('Sair desta célula?', { ok: 'Sair', danger: true }))) return;
      await run(sb.from('cell_members').delete().eq('cell_id', ctx.id).eq('user_id', uid()), 'Você saiu da célula');
      await loadMe(); go('celulas');
    } }, 'Sair da célula') : null);
}

function inviteSheet(ctx) {
  const link = `${location.origin}${location.pathname}#/celula/${ctx.id}`;
  const text = `Venha participar da célula ${ctx.c.name} no Conec Célula! Crie sua conta e peça para entrar: ${link}`;
  sheet('Convidar para a célula', h('div', { class: 'stack' },
    h('p', { class: 'muted' }, 'Envie este link. A pessoa cria a conta, pede para entrar e você aprova.'),
    h('input', { value: link, readonly: true, onclick: (e) => e.target.select() }),
    h('div', { class: 'row gap' },
      h('a', { class: 'btn', target: '_blank', rel: 'noopener', href: `https://wa.me/?text=${encodeURIComponent(text)}` }, 'Enviar no WhatsApp'),
      h('button', { class: 'btn ghost', onclick: () => navigator.clipboard?.writeText(link).then(() => toast('Link copiado!')) }, 'Copiar link'))));
}

function memberMenu(ctx, m) {
  sheet(m.p.full_name, (close) => h('div', { class: 'menu' },
    ['co_leader', 'host', 'member', ...(ctx.role === 'leader' || state.churchAdmin.includes(ctx.c.church_id) ? ['leader'] : [])]
      .filter((r) => r !== m.role).map((r) => h('button', { class: 'menu-item', onclick: async () => {
        close();
        if (r === 'leader' && !(await confirmBox(`Tornar ${m.p.full_name} líder? Você pode continuar como co-líder.`))) return;
        await run(sb.rpc('set_cell_role', { p_cell: ctx.id, p_user: m.user_id, p_role: r }), 'Função atualizada');
        if (r === 'leader' && ctx.role === 'leader') await sb.rpc('set_cell_role', { p_cell: ctx.id, p_user: uid(), p_role: 'co_leader' });
        await loadMe(); refresh();
      } }, icon('star'), `Tornar ${ROLE[r].toLowerCase()}`)),
    h('a', { class: 'menu-item', href: `#/perfil/${m.user_id}`, onclick: close }, icon('user'), 'Ver perfil'),
    h('button', { class: 'menu-item danger', onclick: async () => {
      close();
      if (!(await confirmBox(`Remover ${m.p.full_name} da célula?`, { ok: 'Remover', danger: true }))) return;
      await run(sb.from('cell_members').update({ status: 'removed' }).eq('cell_id', ctx.id).eq('user_id', m.user_id), 'Membro removido');
      refresh();
    } }, icon('trash'), 'Remover da célula')));
}

function multiplySheet(ctx, members) {
  sheet('Multiplicar célula', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      if (!d.leader) return toast('Escolha o novo líder', 'err');
      const ids = [...new Set([d.leader, ...(d.members || [])])];
      await busy(form.querySelector('[type=submit]'), async () => {
        const newId = await run(sb.rpc('multiply_cell', { p_cell: ctx.id, p_name: d.name, p_new_leader: d.leader, p_members: ids }), 'Nova célula criada! 🌱');
        close(); go(`celula/${newId}`);
      });
    } },
      field('Nome da nova célula', h('input', { name: 'name', required: true })),
      field('Novo líder', h('select', { name: 'leader', required: true }, h('option', { value: '' }, 'Escolha…'),
        members.filter((m) => m.user_id !== uid()).map((m) => h('option', { value: m.user_id }, m.p.full_name)))),
      h('strong', null, 'Quem vai para a nova célula?'),
      h('div', { class: 'checks' }, members.filter((m) => m.user_id !== uid()).map((m) =>
        h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'members', value: m.user_id, 'data-multi': '1' }), h('span', null, m.p.full_name)))),
      h('button', { type: 'submit', class: 'btn block' }, 'Criar nova célula'));
    return form;
  });
}

// ---------------------------------------------------------------------
// PRESENÇA (Plano Célula)
// ---------------------------------------------------------------------
async function presenca(ctx) {
  if (!ctx.premium) return premiumGate('Controle de presença', 'Marque quem foi a cada encontro, veja a frequência de cada membro e receba um aviso quando alguém faltar duas vezes seguidas.', 'cell');
  const meetings = await run(sb.from('meetings').select('id, date, notes, attendance(user_id, present)').eq('cell_id', ctx.id).order('date', { ascending: false }).limit(12));
  const members = (await membersList(ctx)).filter((m) => m.status === 'approved');

  const freq = members.map((m) => {
    const last = meetings.slice(0, 8);
    const present = last.filter((mt) => mt.attendance.some((a) => a.user_id === m.user_id && a.present)).length;
    return { m, pct: last.length ? Math.round((present / last.length) * 100) : null };
  }).sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));

  return h('div', { class: 'stack' },
    h('button', { class: 'btn block', onclick: () => attendanceSheet(ctx, members, null) }, icon('check', 18), 'Registrar encontro'),
    meetings.length ? h('div', { class: 'card list' }, meetings.map((mt) => h('button', { class: 'list-item', onclick: () => attendanceSheet(ctx, members, mt) },
      icon('calendar'), h('div', { class: 'grow' }, h('strong', null, fmtDate(mt.date)), mt.notes ? h('small', { class: 'muted' }, mt.notes) : null),
      h('span', { class: 'badge' }, `${mt.attendance.filter((a) => a.present).length}/${members.length}`))))
      : empty('calendar', 'Nenhum encontro registrado'),
    meetings.length ? h('section', null, h('h2', { class: 'section-title' }, 'Frequência (últimos 8 encontros)'),
      h('div', { class: 'card list' }, freq.map(({ m, pct }) => h('div', { class: 'list-item' }, avatar(m.p, 32),
        h('span', { class: 'grow' }, m.p.full_name),
        h('div', { class: 'bar' }, h('i', { style: { width: (pct ?? 0) + '%', background: pct < 50 ? '#E5484D' : pct < 75 ? '#E2A400' : '#2E9E6A' } })),
        h('small', { class: 'muted', style: { width: '3em', textAlign: 'right' } }, pct === null ? '—' : pct + '%'))))) : null);
}

function attendanceSheet(ctx, members, meeting) {
  sheet(meeting ? 'Encontro de ' + fmtDate(meeting.date) : 'Registrar encontro', (close) => {
    const presentSet = new Set((meeting?.attendance || []).filter((a) => a.present).map((a) => a.user_id));
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('[type=submit]'), async () => {
        const mt = await run(sb.from('meetings').upsert({ cell_id: ctx.id, date: d.date, notes: d.notes || null, created_by: uid() }, { onConflict: 'cell_id,date' }).select('id').single());
        const chosen = new Set(d.present || []);
        await run(sb.from('attendance').upsert(members.map((m) => ({ meeting_id: mt.id, user_id: m.user_id, present: chosen.has(m.user_id) })), { onConflict: 'meeting_id,user_id' }), 'Presença salva!');
      });
      close(); refresh();
    } },
      field('Data', h('input', { name: 'date', type: 'date', required: true, value: meeting?.date || todayISO(), readonly: !!meeting })),
      h('div', { class: 'row between' }, h('strong', null, 'Quem estava presente?'),
        h('button', { type: 'button', class: 'link small', onclick: () => form.querySelectorAll('[name=present]').forEach((i) => (i.checked = true)) }, 'Marcar todos')),
      h('div', { class: 'checks' }, members.map((m) => h('label', { class: 'check' },
        h('input', { type: 'checkbox', name: 'present', value: m.user_id, 'data-multi': '1', checked: presentSet.has(m.user_id) }),
        h('span', null, m.p.full_name)))),
      field('Observações', h('textarea', { name: 'notes', rows: 2, value: meeting?.notes || '', placeholder: 'Como foi o encontro? Algum pedido especial?' })),
      h('button', { type: 'submit', class: 'btn block' }, 'Salvar presença'),
      meeting ? h('button', { type: 'button', class: 'link danger center small', onclick: async () => {
        if (await confirmBox('Apagar este encontro?', { ok: 'Apagar', danger: true })) { await run(sb.from('meetings').delete().eq('id', meeting.id)); close(); refresh(); }
      } }, 'Apagar encontro') : null);
    return form;
  });
}

// ---------------------------------------------------------------------
// VISITANTES (Plano Célula)
// ---------------------------------------------------------------------
async function visitantes(ctx) {
  if (!ctx.premium) return premiumGate('Acompanhamento de visitantes', 'Registre quem visitou a célula, anote o contato e não esqueça de mandar aquela mensagem na semana seguinte.', 'cell');
  const list = await run(sb.from('visitors').select('*').eq('cell_id', ctx.id).order('visited_on', { ascending: false }).limit(100));
  const toFollow = list.filter((v) => !v.followed_up);
  const card = (v) => h('div', { class: 'list-item' },
    icon('user'),
    h('div', { class: 'grow' }, h('strong', null, v.name), h('small', { class: 'muted' }, `Visitou em ${fmtDate(v.visited_on)}${v.notes ? ' · ' + v.notes : ''}`)),
    v.phone ? h('a', { class: 'icon-btn', 'aria-label': 'WhatsApp', target: '_blank', rel: 'noopener',
      href: `https://wa.me/${v.phone.replace(/\D/g, '').replace(/^(?!55)/, '55')}?text=${encodeURIComponent(`Oi, ${v.name.split(' ')[0]}! Foi muito bom ter você na nossa célula. Esperamos você no próximo encontro! 😊`)}` }, icon('phone', 18)) : null,
    h('button', { class: 'icon-btn' + (v.followed_up ? ' ok' : ''), 'aria-label': 'Marcar como contatado', onclick: async () => {
      await run(sb.from('visitors').update({ followed_up: !v.followed_up }).eq('id', v.id)); refresh();
    } }, icon('check', 18)));
  return h('div', { class: 'stack' },
    h('button', { class: 'btn block', onclick: () => newVisitor(ctx) }, icon('plus', 18), 'Registrar visitante'),
    toFollow.length ? h('section', null, h('h2', { class: 'section-title' }, `Para fazer contato (${toFollow.length})`), h('div', { class: 'card list' }, toFollow.map(card))) : null,
    list.length - toFollow.length ? h('section', null, h('h2', { class: 'section-title' }, 'Já contatados'), h('div', { class: 'card list' }, list.filter((v) => v.followed_up).map(card))) : null,
    !list.length ? empty('user', 'Nenhum visitante registrado') : null);
}

function newVisitor(ctx) {
  sheet('Novo visitante', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('visitors').insert({
        cell_id: ctx.id, name: d.name, phone: d.phone || null, notes: d.notes || null, visited_on: d.visited_on, created_by: uid() }), 'Visitante registrado!'));
      close(); refresh();
    } },
      field('Nome', h('input', { name: 'name', required: true })),
      field('WhatsApp', h('input', { name: 'phone', type: 'tel', placeholder: '(11) 99999-9999' })),
      field('Data da visita', h('input', { name: 'visited_on', type: 'date', value: todayISO(), required: true })),
      field('Observações', h('input', { name: 'notes', placeholder: 'Quem convidou, pedido de oração…' })),
      h('small', { class: 'muted' }, 'Peça autorização da pessoa antes de guardar o contato dela (LGPD).'),
      h('button', { class: 'btn block' }, 'Salvar'));
    return form;
  });
}

// ---------------------------------------------------------------------
// AJUSTES (líder)
// ---------------------------------------------------------------------
async function config(ctx) {
  const { data: priv } = await sb.from('cell_private').select('*').eq('cell_id', ctx.id).maybeSingle();
  const { data: subs } = await sb.from('subscriptions').select('*').eq('cell_id', ctx.id).order('created_at', { ascending: false }).limit(1);
  const sub = subs?.[0];
  const loc = { lat: ctx.c.lat, lng: ctx.c.lng };
  const mapEl = h('div', { class: 'map small' });
  const locLabel = h('small', { class: 'muted' }, loc.lat ? `Marcado (${loc.lat}, ${loc.lng})` : 'Toque no mapa para marcar a região aproximada.');
  let picker;
  import('./explore.js').then((m) => m.pickLocation(mapEl, loc, (lat, lng) => { loc.lat = lat; loc.lng = lng; locLabel.textContent = 'Região marcada ✓ (salve abaixo)'; })).then((p) => (picker = p)).catch(() => {});

  const addr = h('textarea', { rows: 2, value: priv?.address || '', placeholder: 'Rua, número, complemento — só membros veem' });

  return h('div', { class: 'stack' },
    h('div', { class: 'card stack' },
      h('div', { class: 'row gap' }, icon('crown'), h('strong', null, 'Plano da célula')),
      ctx.premium
        ? h('p', null, 'Plano Célula ativo ✨', sub?.next_payment_date ? h('small', { class: 'muted' }, ` · próxima cobrança ${fmtDate(sub.next_payment_date)}`) : null)
        : h('p', { class: 'muted' }, `Plano grátis: até ${CONFIG.FREE_CELL_MEMBERS} membros, sem presença, visitantes e escala.`),
      h('a', { class: 'btn small' + (ctx.premium ? ' ghost' : ''), href: `#/planos?tipo=celula&celula=${ctx.id}` }, ctx.premium ? 'Gerenciar' : 'Assinar Plano Célula')),
    h('div', { class: 'card stack' }, h('strong', null, 'Informações'), cellForm(ctx.c, async (data) => {
      await run(sb.from('cells').update({ ...data, lat: loc.lat, lng: loc.lng }).eq('id', ctx.id));
      await run(sb.from('cell_private').update({ address: addr.value.trim() || null }).eq('cell_id', ctx.id), 'Célula atualizada!');
      await loadMe(); refresh();
    })),
    h('div', { class: 'card stack' },
      h('strong', null, 'Endereço do encontro'), addr,
      h('strong', null, 'Localização no mapa'),
      h('small', { class: 'muted' }, 'Aparece em "Encontrar célula" de forma aproximada (~100 m).'),
      mapEl, locLabel,
      h('button', { class: 'btn ghost small', type: 'button', onclick: () => picker?.useMyLocation() }, icon('pin', 18), 'Usar minha localização'),
      h('small', { class: 'muted' }, 'Depois de mudar endereço ou mapa, toque em "Salvar" no formulário acima.')),
    state.churchAdmin.includes(ctx.c.church_id) ? h('button', { class: 'link danger center small', onclick: async () => {
      if (!(await confirmBox('Arquivar esta célula? Ela some das buscas e do app.', { ok: 'Arquivar', danger: true }))) return;
      await run(sb.from('cells').update({ status: 'archived' }).eq('id', ctx.id), 'Célula arquivada');
      await loadMe(); go('celulas');
    } }, 'Arquivar célula') : null);
}
