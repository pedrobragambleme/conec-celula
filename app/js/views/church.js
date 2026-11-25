import { h, icon, field, formData, busy, sheet, clear, spinner, empty, badge, toast, confirmBox, WEEKDAYS, fmtDate, fmtDateTime } from '../ui.js';
import { sb, run, uid, state, loadMe } from '../sb.js';
import { go, refresh } from '../app.js';
import { pageHead, personLine } from './common.js';

export function newChurch() {
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    await busy(form.querySelector('button'), async () => {
      const c = await run(sb.from('churches').insert({ name: d.name, city: d.city || null, description: d.description || null, created_by: uid() }).select('id').single(), 'Igreja cadastrada!');
      await loadMe();
      go(`igreja/${c.id}`);
    });
  } },
    field('Nome da igreja', h('input', { name: 'name', required: true, maxlength: 100 })),
    field('Cidade', h('input', { name: 'city', maxlength: 60 })),
    field('Descrição', h('textarea', { name: 'description', rows: 3, maxlength: 500 })),
    h('p', { class: 'muted small' }, 'Você será o pastor/administrador e poderá adicionar outros administradores.'),
    h('button', { class: 'btn block' }, 'Cadastrar igreja'));
  return h('div', { class: 'stack' }, pageHead('Nova igreja', { back: 'celulas' }), form);
}

export async function church({ id }) {
  const ch = await run(sb.from('churches').select('*').eq('id', id).maybeSingle());
  if (!ch) return h('div', null, pageHead('Igreja', { back: 'celulas' }), empty('church', 'Igreja não encontrada'));
  const isAdmin = state.churchAdmin.includes(id);
  const cells = await run(sb.from('cells').select('id, name, color, neighborhood, meeting_day, is_listed').eq('church_id', id).eq('status', 'active').order('name'));

  const cellsList = h('div', { class: 'card list' }, cells.length ? cells.map((c) => h('a', { class: 'list-item', href: `#/celula/${c.id}` },
    h('i', { class: 'dot', style: { background: c.color } }),
    h('div', { class: 'grow' }, h('strong', null, c.name),
      h('small', { class: 'muted' }, [c.neighborhood, c.meeting_day !== null ? WEEKDAYS[c.meeting_day] : null].filter(Boolean).join(' · '))),
    !c.is_listed ? badge('Oculta') : null))
    : h('p', { class: 'muted center pad' }, 'Nenhuma célula ainda.'));

  return h('div', { class: 'stack' },
    pageHead(ch.name, { back: 'celulas', action: isAdmin ? h('button', { class: 'icon-btn', 'aria-label': 'Editar igreja', onclick: () => editChurch(ch) }, icon('edit')) : null }),
    ch.city || ch.description ? h('div', { class: 'card' }, ch.city ? h('p', { class: 'muted' }, icon('pin', 14), ' ', ch.city) : null, ch.description ? h('p', null, ch.description) : null) : null,
    isAdmin ? await adminPanel(ch) : null,
    h('div', { class: 'section-title row between' }, h('h2', null, 'Células'),
      isAdmin ? h('button', { class: 'btn small', onclick: () => newCell(ch) }, icon('plus', 18), 'Nova célula') : null),
    cellsList);
}

async function adminPanel(ch) {
  const box = h('div', { class: 'stack' }, spinner());
  const stats = await run(sb.rpc('church_stats', { p_church: ch.id }));
  const totals = stats.reduce((a, s) => ({ members: a.members + Number(s.members), visitors: a.visitors + Number(s.visitors_30d), pending: a.pending + Number(s.pending) }), { members: 0, visitors: 0, pending: 0 });
  const events = await run(sb.from('events').select('*').eq('church_id', ch.id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(5));
  clear(box,
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('strong', null, stats.length), h('small', null, 'células')),
      h('div', { class: 'kpi' }, h('strong', null, totals.members), h('small', null, 'membros')),
      h('div', { class: 'kpi' }, h('strong', null, totals.visitors), h('small', null, 'visitantes (30 dias)')),
      h('div', { class: 'kpi' }, h('strong', null, totals.pending), h('small', null, 'pedidos pendentes'))),
    stats.length ? h('div', { class: 'card table-wrap' }, h('table', { class: 'table' },
      h('thead', null, h('tr', null, ['Célula', 'Líder', 'Membros', 'Média presença', 'Visitantes', 'Último encontro'].map((t) => h('th', null, t)))),
      h('tbody', null, stats.map((s) => h('tr', { onclick: () => go(`celula/${s.cell_id}`) },
        h('td', null, s.cell_name, s.is_premium ? ' ✨' : ''), h('td', null, s.leader_name || '—'), h('td', null, s.members),
        h('td', null, s.avg_attendance ?? '—'), h('td', null, s.visitors_30d), h('td', null, s.last_meeting ? fmtDate(s.last_meeting) : '—')))))) : null,
    h('small', { class: 'muted' }, 'Presença e visitantes aparecem nas células com Plano Célula ✨.'),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn ghost small', onclick: () => churchEvent(ch) }, icon('calendar', 18), 'Evento da igreja'),
      h('button', { class: 'btn ghost small', onclick: () => manageAdmins(ch) }, icon('users', 18), 'Administradores')),
    events.length ? h('div', { class: 'card list' }, events.map((e) => h('div', { class: 'list-item' }, icon('calendar'),
      h('div', { class: 'grow' }, h('strong', null, e.title), h('small', { class: 'muted' }, fmtDateTime(e.starts_at))),
      h('button', { class: 'icon-btn', 'aria-label': 'Apagar evento', onclick: async () => {
        if (await confirmBox('Apagar evento?', { ok: 'Apagar', danger: true })) { await run(sb.from('events').delete().eq('id', e.id)); refresh(); }
      } }, icon('trash', 18))))) : null);
  return h('section', { class: 'stack' }, h('h2', { class: 'section-title' }, 'Painel do pastor'), box);
}

function editChurch(ch) {
  sheet('Editar igreja', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('churches').update({ name: d.name, city: d.city || null, description: d.description || null }).eq('id', ch.id), 'Salvo!'));
      close(); refresh();
    } },
      field('Nome', h('input', { name: 'name', value: ch.name, required: true })),
      field('Cidade', h('input', { name: 'city', value: ch.city || '' })),
      field('Descrição', h('textarea', { name: 'description', rows: 3, value: ch.description || '' })),
      h('button', { class: 'btn block' }, 'Salvar'));
    return form;
  });
}

export function cellForm(values = {}, onSubmit) {
  const colors = ['#E8603C', '#0E5E6F', '#7A5AF8', '#2E9E6A', '#D9468F', '#E2A400', '#3B82F6'];
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    await busy(form.querySelector('[type=submit]'), () => onSubmit({
      name: d.name, description: d.description || null,
      meeting_day: d.meeting_day === '' ? null : Number(d.meeting_day), meeting_time: d.meeting_time || null,
      neighborhood: d.neighborhood || null, city: d.city || null, color: d.color, is_listed: d.is_listed,
    }));
  } },
    field('Nome da célula', h('input', { name: 'name', required: true, value: values.name || '', maxlength: 60 })),
    field('Descrição', h('textarea', { name: 'description', rows: 2, value: values.description || '', maxlength: 400 })),
    h('div', { class: 'grid2' },
      field('Dia do encontro', h('select', { name: 'meeting_day' }, h('option', { value: '' }, '—'),
        WEEKDAYS.map((w, i) => h('option', { value: i, selected: values.meeting_day === i }, w)))),
      field('Horário', h('input', { name: 'meeting_time', type: 'time', value: (values.meeting_time || '').slice(0, 5) }))),
    h('div', { class: 'grid2' },
      field('Bairro', h('input', { name: 'neighborhood', value: values.neighborhood || '' })),
      field('Cidade', h('input', { name: 'city', value: values.city || '' }))),
    field('Cor', h('div', { class: 'colors' }, colors.map((c, i) => h('label', { class: 'color', style: { background: c } },
      h('input', { type: 'radio', name: 'color', value: c, checked: (values.color || colors[0]) === c || (!values.color && i === 0) }))))),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'is_listed', checked: values.is_listed !== false }),
      h('span', null, 'Aparecer na busca "Encontrar célula" (o endereço completo continua só para membros)')),
    h('button', { type: 'submit', class: 'btn block' }, values.name ? 'Salvar' : 'Criar célula'));
  return form;
}

function newCell(ch) {
  sheet('Nova célula', (close) => cellForm({}, async (data) => {
    const c = await run(sb.from('cells').insert({ ...data, church_id: ch.id, created_by: uid() }).select('id').single(), 'Célula criada! Você é o líder — depois pode passar a liderança.');
    close(); await loadMe(); go(`celula/${c.id}`);
  }));
}

function churchEvent(ch) {
  sheet('Evento da igreja', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () => run(sb.from('events').insert({
        church_id: ch.id, title: d.title, description: d.description || null, location: d.location || null,
        starts_at: new Date(d.starts_at).toISOString(), created_by: uid() }), 'Evento criado!'));
      close(); refresh();
    } },
      field('Título', h('input', { name: 'title', required: true })),
      field('Quando', h('input', { name: 'starts_at', type: 'datetime-local', required: true })),
      field('Local', h('input', { name: 'location' })),
      field('Descrição', h('textarea', { name: 'description', rows: 3 })),
      h('button', { class: 'btn block' }, 'Criar evento'));
    return form;
  });
}

function manageAdmins(ch) {
  sheet('Administradores', () => {
    const list = h('div', { class: 'list' }, spinner());
    const load = async () => {
      const rows = await run(sb.from('church_admins').select('role, p:profiles(id, full_name, avatar_url)').eq('church_id', ch.id));
      clear(list, rows.map((r) => personLine(r.p, r.role === 'pastor' ? 'Pastor' : 'Administrador',
        r.p.id !== uid() ? h('button', { class: 'icon-btn', 'aria-label': 'Remover', onclick: async (e) => {
          e.preventDefault();
          if (await confirmBox(`Remover ${r.p.full_name} da administração?`, { ok: 'Remover', danger: true })) {
            await run(sb.from('church_admins').delete().eq('church_id', ch.id).eq('user_id', r.p.id)); load();
          } } }, icon('trash', 18)) : null)));
    };
    load();
    const results = h('div', { class: 'list' });
    const input = h('input', { type: 'search', placeholder: 'Buscar pessoa pelo nome ou @usuário', oninput: async () => {
      const t = input.value.trim().replace(/[%,()]/g, '');
      if (t.length < 2) return clear(results);
      const people = await run(sb.from('profiles').select('id, full_name, avatar_url, username').or(`full_name.ilike.%${t}%,username.ilike.%${t}%`).limit(8));
      clear(results, people.map((p) => h('button', { class: 'list-item', onclick: async () => {
        await run(sb.from('church_admins').insert({ church_id: ch.id, user_id: p.id, role: 'admin' }), `${p.full_name} agora é administrador`);
        input.value = ''; clear(results); load();
      } }, icon('plus'), h('span', { class: 'grow' }, p.full_name, p.username ? ` (@${p.username})` : ''))));
    } });
    return h('div', { class: 'stack' }, list, h('strong', null, 'Adicionar administrador'), input, results);
  });
}
