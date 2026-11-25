import { h, icon, empty, badge } from '../ui.js';
import { sb, run, state, loadMe } from '../sb.js';

const ROLE = { leader: 'Líder', co_leader: 'Co-líder', host: 'Anfitrião', member: 'Membro' };
export { ROLE };

export async function cellsHome() {
  await loadMe();
  const approved = state.myCells.filter((c) => c.status === 'approved');
  const pending = state.myCells.filter((c) => c.status === 'pending');
  const churches = state.churchAdmin.length
    ? await run(sb.from('churches').select('id, name, city').in('id', state.churchAdmin)) : [];

  const cellItem = (c, extra) => h('a', { class: 'list-item', href: `#/celula/${c.cell_id}` },
    h('i', { class: 'dot', style: { background: c.cells?.color || '#E8603C' } }),
    h('div', { class: 'grow' }, h('strong', null, c.cells?.name), h('small', { class: 'muted' }, c.cells?.churches?.name || '')),
    extra);

  return h('div', { class: 'stack' },
    h('h1', { class: 'page-title' }, 'Células'),
    approved.length
      ? h('div', { class: 'card list' }, approved.map((c) => cellItem(c, badge(ROLE[c.role] || 'Membro', c.role === 'leader' ? 'gold' : ''))))
      : empty('cells', 'Você ainda não está em uma célula', 'Encontre uma célula perto de você e peça para entrar.'),
    pending.length ? h('section', null, h('h2', { class: 'section-title' }, 'Aguardando aprovação'),
      h('div', { class: 'card list' }, pending.map((c) => cellItem(c, badge('Pendente'))))) : null,
    h('a', { class: 'btn block', href: '#/explorar?tab=celulas' }, icon('search', 18), 'Encontrar uma célula'),

    churches.length ? h('section', null, h('h2', { class: 'section-title' }, 'Igrejas que administro'),
      h('div', { class: 'card list' }, churches.map((c) => h('a', { class: 'list-item', href: `#/igreja/${c.id}` },
        icon('church'), h('div', { class: 'grow' }, h('strong', null, c.name), h('small', { class: 'muted' }, 'Painel do pastor · criar células')))))) : null,

    h('div', { class: 'card soft' },
      h('strong', null, 'É pastor ou líder?'),
      h('p', { class: 'muted' }, 'Cadastre sua igreja para criar as células, convidar líderes e acompanhar tudo pelo painel.'),
      h('a', { class: 'btn ghost small', href: '#/nova-igreja' }, icon('church', 18), 'Cadastrar igreja')));
}
