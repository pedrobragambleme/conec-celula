import { h, icon, tabs, clear, spinner, empty, sheet, field, formData, busy, confirmBox, avatar, timeAgo, richText, badge } from '../ui.js';
import { sb, run, uid, state } from '../sb.js';
import { go, refresh } from '../app.js';
import { premiumGate, reportSheet } from './common.js';

const VIS = { public: 'Todos', cell: 'Minha célula', leaders: 'Só os líderes' };

export async function prayer({ tab = 'pedidos' }) {
  const body = tab === 'diario' ? await journal() : await requests(tab === 'meus');
  return h('div', { class: 'stack' },
    h('div', { class: 'row between' }, h('h1', { class: 'page-title' }, 'Oração'),
      h('a', { class: 'btn ghost small', href: '#/lembretes' }, icon('clock', 18), 'Lembretes')),
    tabs([['pedidos', 'Pedidos'], ['meus', 'Meus pedidos'], ['diario', 'Diário']], tab, (t) => go(t === 'pedidos' ? 'oracao' : `oracao/${t}`)),
    body);
}

async function requests(mine) {
  let q = sb.from('prayer_requests')
    .select('*, author:profiles(id, full_name, avatar_url), cells(name), prayer_amens(user_id)')
    .order('created_at', { ascending: false }).limit(50);
  q = mine ? q.eq('author_id', uid()) : q.eq('is_answered', false);
  const list = await run(q);

  const card = (r) => {
    let prayed = r.prayer_amens.some((a) => a.user_id === uid());
    let count = r.prayer_amens.length;
    const btn = h('button', { class: 'btn small' + (prayed ? ' ghost' : ''), onclick: async () => {
      prayed = !prayed; count += prayed ? 1 : -1; paint();
      const { error } = prayed
        ? await sb.from('prayer_amens').insert({ request_id: r.id, user_id: uid() })
        : await sb.from('prayer_amens').delete().eq('request_id', r.id).eq('user_id', uid());
      if (error) { prayed = !prayed; count += prayed ? 1 : -1; paint(); }
    } });
    const paint = () => { btn.textContent = prayed ? `🙏 Orei (${count})` : `🙏 Orar por isso${count ? ` (${count})` : ''}`; btn.className = 'btn small' + (prayed ? ' ghost' : ''); };
    paint();
    const isMine = r.author_id === uid();
    return h('article', { class: 'card stack prayer' + (r.is_answered ? ' answered' : '') },
      h('div', { class: 'row gap' }, avatar(r.author, 36),
        h('div', { class: 'grow' }, h('strong', null, r.author?.full_name),
          h('small', { class: 'muted' }, `${timeAgo(r.created_at)} · ${r.visibility === 'public' ? 'Para todos' : `${VIS[r.visibility]}${r.cells ? ' · ' + r.cells.name : ''}`}`)),
        r.is_answered ? badge('Respondida 🙌', 'ok') : null),
      richText(r.body),
      r.answered_note ? h('p', { class: 'quote' }, '🙌 ', r.answered_note) : null,
      h('div', { class: 'row between' },
        r.is_answered ? h('span') : btn,
        isMine ? h('div', { class: 'row' },
          !r.is_answered ? h('button', { class: 'link small', onclick: () => markAnswered(r) }, 'Foi respondida!') : null,
          h('button', { class: 'icon-btn', 'aria-label': 'Apagar', onclick: async () => {
            if (await confirmBox('Apagar este pedido?', { ok: 'Apagar', danger: true })) { await run(sb.from('prayer_requests').delete().eq('id', r.id)); refresh(); }
          } }, icon('trash', 18)))
          : h('button', { class: 'icon-btn', 'aria-label': 'Denunciar', onclick: () => reportSheet('prayer', r.id) }, icon('flag', 18))));
  };

  return h('div', { class: 'stack' },
    h('button', { class: 'btn block', onclick: newRequest }, icon('plus', 18), 'Fazer um pedido de oração'),
    list.length ? list.map(card) : empty('pray', mine ? 'Você ainda não fez pedidos' : 'Nenhum pedido por enquanto', 'Compartilhe seu pedido e deixe a comunidade orar com você.'));
}

function newRequest() {
  const cells = state.myCells.filter((c) => c.status === 'approved');
  sheet('Pedido de oração', (close) => {
    const cellSel = h('select', { name: 'cell_id' }, cells.map((c) => h('option', { value: c.cell_id }, c.cells?.name)));
    const cellField = field('Célula', cellSel);
    const vis = h('select', { name: 'visibility', onchange: () => (cellField.hidden = vis.value === 'public') },
      Object.entries(VIS).filter(([k]) => k === 'public' || cells.length).map(([k, v]) => h('option', { value: k }, v)));
    cellField.hidden = true;
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('prayer_requests').insert({
        author_id: uid(), body: d.body, visibility: d.visibility, cell_id: d.visibility === 'public' ? null : d.cell_id,
      }), 'Pedido enviado. Estamos orando com você 🙏'));
      close(); refresh();
    } },
      field('Pelo que você quer que a gente ore?', h('textarea', { name: 'body', rows: 5, required: true, maxlength: 1500 })),
      field('Quem pode ver', vis),
      cellField,
      h('button', { class: 'btn block' }, 'Enviar pedido'));
    return form;
  });
}

function markAnswered(r) {
  sheet('Oração respondida! 🙌', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('prayer_requests').update({ is_answered: true, answered_note: d.note || null }).eq('id', r.id), 'Glória a Deus!'));
      close(); refresh();
    } },
      field('Quer contar como Deus respondeu? (opcional)', h('textarea', { name: 'note', rows: 4, maxlength: 1000 })),
      h('button', { class: 'btn block' }, 'Marcar como respondida'));
    return form;
  });
}

async function journal() {
  if (!state.premium) return premiumGate('Diário de oração', 'Um espaço só seu para escrever orações, o que Deus tem falado e acompanhar as respostas ao longo do tempo.');
  const list = await run(sb.from('prayer_journal').select('*').eq('user_id', uid()).order('created_at', { ascending: false }).limit(100));
  const open = (entry) => sheet(entry ? 'Editar' : 'Nova anotação', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(entry
        ? sb.from('prayer_journal').update({ title: d.title || null, body: d.body }).eq('id', entry.id)
        : sb.from('prayer_journal').insert({ user_id: uid(), title: d.title || null, body: d.body }), 'Salvo'));
      close(); refresh();
    } },
      field('Título', h('input', { name: 'title', value: entry?.title || '', maxlength: 100 })),
      field('Oração / anotação', h('textarea', { name: 'body', rows: 8, required: true, value: entry?.body || '' })),
      h('button', { class: 'btn block' }, 'Salvar'),
      entry ? h('button', { type: 'button', class: 'link danger center small', onclick: async () => {
        if (await confirmBox('Apagar anotação?', { ok: 'Apagar', danger: true })) { await run(sb.from('prayer_journal').delete().eq('id', entry.id)); close(); refresh(); }
      } }, 'Apagar') : null);
    return form;
  });
  return h('div', { class: 'stack' },
    h('button', { class: 'btn block', onclick: () => open() }, icon('edit', 18), 'Escrever no diário'),
    h('p', { class: 'muted small center' }, '🔒 Só você vê o seu diário.'),
    list.length ? list.map((j) => h('button', { class: 'card journal', onclick: () => open(j) },
      h('small', { class: 'muted' }, new Date(j.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })),
      j.title ? h('strong', null, j.title) : null,
      h('p', null, j.body.length > 180 ? j.body.slice(0, 180) + '…' : j.body)))
      : empty('book', 'Seu diário está vazio', 'Comece escrevendo sua oração de hoje.'));
}
