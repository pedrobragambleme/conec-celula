import { h, icon, sheet, field, formData, busy, toast, confirmBox, WD_SHORT, WEEKDAYS, fmtTime, empty } from '../ui.js';
import { sb, run, uid, state, loadMe } from '../sb.js';
import { CONFIG } from '../config.js';
import { refresh } from '../app.js';
import { pageHead } from './common.js';
import { pushStatus, enablePush, disablePush, isIOS, isStandalone } from '../push.js';

export async function reminders() {
  const [list, status] = await Promise.all([
    run(sb.from('prayer_reminders').select('*').eq('user_id', uid()).order('time')),
    pushStatus().catch(() => 'unsupported'),
  ]);
  const limit = state.premium ? 20 : CONFIG.FREE_PRAYER_REMINDERS;

  const pushCard = h('div', { class: 'card stack' + (status === 'on' ? '' : ' highlight') },
    h('div', { class: 'row gap' }, icon('bell'), h('strong', null, 'Notificações neste aparelho')),
    status === 'on' ? h('p', { class: 'muted' }, 'Ativadas ✓ Você vai receber os lembretes aqui.')
      : status === 'denied' ? h('p', { class: 'muted' }, 'Bloqueadas. Libere as notificações deste site nas configurações do navegador.')
      : isIOS() && !isStandalone() ? h('p', { class: 'muted' }, 'No iPhone: toque em Compartilhar ', icon('share', 14), ' → "Adicionar à Tela de Início". Depois abra o Conec Célula pelo ícone e ative aqui.')
      : h('p', { class: 'muted' }, 'Ative para receber o versículo do dia, os lembretes de oração e os avisos da célula.'),
    status === 'on'
      ? h('button', { class: 'btn ghost small', onclick: async (e) => { await busy(e.target, disablePush); refresh(); } }, 'Desativar neste aparelho')
      : status !== 'denied' ? h('button', { class: 'btn small', onclick: async (e) => {
        try { await busy(e.target, enablePush); toast('Notificações ativadas!'); refresh(); } catch (err) { toast(err.message, 'err'); }
      } }, 'Ativar notificações') : null);

  const verseForm = h('form', { class: 'card stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(verseForm);
    await busy(verseForm.querySelector('button'), () => run(sb.from('profiles').update({
      daily_verse_enabled: d.enabled, daily_verse_time: d.time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' }).eq('id', uid()), 'Salvo!'));
    await loadMe();
  } },
    h('div', { class: 'row gap' }, icon('book'), h('strong', null, 'Versículo do dia')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'enabled', checked: state.me.daily_verse_enabled }), h('span', null, 'Receber um versículo por dia')),
    field('Horário', h('input', { type: 'time', name: 'time', value: fmtTime(state.me.daily_verse_time) })),
    h('button', { class: 'btn ghost small' }, 'Salvar'));

  const card = (r) => h('div', { class: 'list-item' },
    h('div', { class: 'time-big' }, fmtTime(r.time)),
    h('div', { class: 'grow' }, h('strong', null, r.label),
      h('small', { class: 'muted' }, r.days.length === 7 ? 'Todos os dias' : r.days.map((d) => WEEKDAYS[d].slice(0, 3)).join(', '))),
    h('label', { class: 'switch', 'aria-label': 'Ativo' }, h('input', { type: 'checkbox', checked: r.enabled, onchange: async (e) => {
      await run(sb.from('prayer_reminders').update({ enabled: e.target.checked }).eq('id', r.id));
    } }), h('i')),
    h('button', { class: 'icon-btn', 'aria-label': 'Editar', onclick: () => editReminder(r) }, icon('edit', 18)));

  return h('div', { class: 'stack' },
    pageHead('Lembretes de oração', { back: 'oracao' }),
    pushCard,
    h('div', { class: 'section-title row between' }, h('h2', null, 'Meus horários de oração'),
      h('small', { class: 'muted' }, `${list.length}/${limit}`)),
    list.length ? h('div', { class: 'card list' }, list.map(card))
      : empty('clock', 'Nenhum horário cadastrado', 'Escolha os momentos do dia em que você costuma orar. Vamos te lembrar com um versículo.'),
    list.length < limit ? h('button', { class: 'btn block', onclick: () => editReminder() }, icon('plus', 18), 'Adicionar horário')
      : h('div', { class: 'card soft stack' },
        h('p', { class: 'muted' }, state.premium ? 'Você chegou ao limite de horários.' : `No plano grátis você tem ${CONFIG.FREE_PRAYER_REMINDERS} lembrete. Com o Premium, até 20 — manhã, almoço, noite…`),
        state.premium ? null : h('a', { class: 'btn small', href: '#/planos' }, 'Conhecer o Premium')),
    verseForm);
}

function editReminder(r) {
  sheet(r ? 'Editar lembrete' : 'Novo lembrete', (close) => {
    const days = new Set(r?.days ?? [0, 1, 2, 3, 4, 5, 6]);
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      const chosen = (d.days || []).map(Number);
      if (!chosen.length) return toast('Escolha pelo menos um dia', 'err');
      await busy(form.querySelector('[type=submit]'), async () => {
        const row = { time: d.time, label: d.label || 'Hora de orar', days: chosen.sort(), last_sent_on: null };
        await run(r ? sb.from('prayer_reminders').update(row).eq('id', r.id)
          : sb.from('prayer_reminders').insert({ ...row, user_id: uid() }), 'Lembrete salvo!');
        await sb.from('profiles').update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo' }).eq('id', uid());
      });
      close(); refresh();
    } },
      field('Horário', h('input', { type: 'time', name: 'time', required: true, value: r ? fmtTime(r.time) : '06:00' })),
      field('Nome', h('input', { name: 'label', value: r?.label || 'Hora de orar', maxlength: 60, placeholder: 'Ex.: Oração da manhã' })),
      h('strong', null, 'Dias'),
      h('div', { class: 'days' }, WD_SHORT.map((l, i) => h('label', { class: 'day' },
        h('input', { type: 'checkbox', name: 'days', value: i, 'data-multi': '1', checked: days.has(i) }), h('span', { title: WEEKDAYS[i] }, l)))),
      h('button', { type: 'submit', class: 'btn block' }, 'Salvar'),
      r ? h('button', { type: 'button', class: 'link danger center small', onclick: async () => {
        if (await confirmBox('Apagar este lembrete?', { ok: 'Apagar', danger: true })) { await run(sb.from('prayer_reminders').delete().eq('id', r.id)); close(); refresh(); }
      } }, 'Apagar lembrete') : null);
    return form;
  });
}
