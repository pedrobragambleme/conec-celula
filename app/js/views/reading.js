import { h, icon, badge, empty, avatar } from '../ui.js';
import { sb, run, uid, state, isLeaderOf } from '../sb.js';
import { refresh } from '../app.js';
import { pageHead, premiumGate } from './common.js';

export async function readingList() {
  const [plans, progress] = await Promise.all([
    run(sb.from('reading_plans').select('id, title, description, is_premium, reading_plan_days(count)').order('created_at')),
    run(sb.from('reading_progress').select('plan_id, day').eq('user_id', uid())),
  ]);
  const done = progress.reduce((m, p) => ((m[p.plan_id] = (m[p.plan_id] || 0) + 1), m), {});
  return h('div', { class: 'stack' },
    pageHead('Planos de leitura', { back: 'eu' }),
    plans.length ? plans.map((p) => {
      const total = p.reading_plan_days?.[0]?.count || 0;
      const n = done[p.id] || 0;
      return h('a', { class: 'card stack', href: `#/leitura/${p.id}` },
        h('div', { class: 'row between' }, h('strong', null, p.title), p.is_premium ? badge('Premium', 'gold') : badge('Grátis')),
        p.description ? h('p', { class: 'muted' }, p.description) : null,
        h('div', { class: 'row gap' }, h('div', { class: 'bar grow' }, h('i', { style: { width: total ? (n / total) * 100 + '%' : 0 } })),
          h('small', { class: 'muted' }, `${n}/${total}`)));
    }) : empty('book', 'Nenhum plano cadastrado'));
}

export async function readingPlan({ id }, q) {
  const [plan, days, progress] = await Promise.all([
    run(sb.from('reading_plans').select('*').eq('id', id).single()),
    run(sb.from('reading_plan_days').select('day, refs').eq('plan_id', id).order('day')),
    run(sb.from('reading_progress').select('day').eq('user_id', uid()).eq('plan_id', id)),
  ]);
  const locked = plan.is_premium && !state.premium;
  const done = new Set(progress.map((p) => p.day));
  const nextDay = days.find((d) => !done.has(d.day))?.day;

  // progresso da célula (quando aberto a partir da agenda da célula)
  let group = null;
  const cellId = q.get('celula');
  if (cellId && isLeaderOf(cellId)) {
    const { data: members } = await sb.from('cell_members').select('user_id, p:profiles(id, full_name, avatar_url)').eq('cell_id', cellId).eq('status', 'approved');
    const { data: prog } = await sb.from('reading_progress').select('user_id, day').eq('plan_id', id).in('user_id', (members || []).map((m) => m.user_id));
    if (members && prog) {
      const count = prog.reduce((m, p) => ((m[p.user_id] = (m[p.user_id] || 0) + 1), m), {});
      group = h('div', { class: 'card stack' }, h('strong', null, 'Progresso da célula'),
        h('div', { class: 'list' }, members.map((m) => h('div', { class: 'list-item' }, avatar(m.p, 30), h('span', { class: 'grow' }, m.p.full_name),
          h('small', { class: 'muted' }, `${count[m.user_id] || 0}/${days.length}`)))));
    }
  }

  const toggle = async (day, checked) => {
    if (checked) await run(sb.from('reading_progress').insert({ user_id: uid(), plan_id: id, day }));
    else await run(sb.from('reading_progress').delete().eq('user_id', uid()).eq('plan_id', id).eq('day', day));
    refresh();
  };

  return h('div', { class: 'stack' },
    pageHead(plan.title, { back: 'leitura' }),
    plan.description ? h('p', { class: 'muted' }, plan.description) : null,
    locked ? premiumGate('Plano Premium', 'Este plano faz parte do Premium. Os planos "João em 21 dias" e "Atos em 28 dias" são grátis.') : null,
    nextDay && !locked ? h('div', { class: 'verse-card' }, h('small', null, `Leitura de hoje · dia ${nextDay}`),
      h('blockquote', null, days.find((d) => d.day === nextDay).refs),
      h('button', { class: 'btn light small', onclick: () => toggle(nextDay, true) }, icon('check', 18), 'Marcar como lido')) : null,
    !nextDay && done.size ? h('div', { class: 'card center' }, h('div', { class: 'big-emoji' }, '🎉'), h('strong', null, 'Plano concluído! Glória a Deus.')) : null,
    group,
    h('div', { class: 'card list' + (locked ? ' locked' : '') }, days.map((d) => h('label', { class: 'list-item check' },
      h('input', { type: 'checkbox', disabled: locked, checked: done.has(d.day), onchange: (e) => toggle(d.day, e.target.checked) }),
      h('span', { class: 'grow' }, h('small', { class: 'muted' }, `Dia ${d.day} · `), d.refs)))));
}
