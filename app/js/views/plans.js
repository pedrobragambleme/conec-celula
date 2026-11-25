import { h, icon, money, busy, toast, confirmBox, fmtDate, badge } from '../ui.js';
import { sb, run, uid, state, loadMe, friendlyError } from '../sb.js';
import { CONFIG } from '../config.js';
import { refresh } from '../app.js';
import { pageHead } from './common.js';

const FREE = ['Entrar em células e participar do mural e fórum', 'Rede social: publicar, curtir, comentar e se conectar', 'Pedidos de oração', 'Versículo do dia por notificação', `${CONFIG.FREE_PRAYER_REMINDERS} lembrete de oração`, 'Planos de leitura "João" e "Atos"'];
const PERSONAL = ['Até 20 lembretes de oração por dia', 'Diário de oração privado', 'Todos os planos de leitura (Salmos, Provérbios, Novo Testamento…)', 'Selo Premium no perfil', 'Ajuda a manter o app no ar 💛'];
const CELL = ['Membros ilimitados (grátis: até ' + CONFIG.FREE_CELL_MEMBERS + ')', 'Controle de presença e frequência', 'Aviso automático quando alguém falta 2 vezes', 'Cadastro e acompanhamento de visitantes', 'Escala (lanche, louvor, palavra, casa…)', 'Multiplicação de célula', 'Dados no painel do pastor'];

const list = (items, ok = true) => h('ul', { class: 'features' }, items.map((t) => h('li', null, ok ? '✓ ' : '', t)));

export async function plans(_p, q) {
  if (q.get('retorno')) { toast('Recebemos seu retorno do Mercado Pago. A liberação pode levar alguns minutos.'); await loadMe(); }
  const subs = await run(sb.from('subscriptions').select('*, cells(name)').eq('user_id', uid()).order('created_at', { ascending: false }));
  const ledCells = state.myCells.filter((c) => c.status === 'approved' && ['leader', 'co_leader'].includes(c.role));
  const preferCell = q.get('tipo') === 'celula';
  const preselect = q.get('celula');

  const subscribe = async (btn, kind, cell_id) => {
    await busy(btn, async () => {
      const { data, error } = await sb.functions.invoke('mp-assinar', { body: { kind, cell_id } });
      if (error || data?.error) {
        let msg = data?.error;
        if (!msg && error?.context?.json) { try { msg = (await error.context.json()).error; } catch { /* */ } }
        return toast(msg || friendlyError(error), 'err');
      }
      location.href = data.init_point;
    });
  };

  const cancel = async (s) => {
    if (!(await confirmBox('Cancelar a assinatura? Os recursos pagos deixam de funcionar.', { ok: 'Cancelar assinatura', danger: true }))) return;
    const { data, error } = await sb.functions.invoke('mp-cancelar', { body: { subscription_id: s.id } });
    if (error || data?.error) return toast(data?.error || 'Não foi possível cancelar agora.', 'err');
    toast('Assinatura cancelada'); await loadMe(); refresh();
  };

  const active = subs.filter((s) => s.status === 'authorized');
  const personalActive = active.find((s) => s.kind === 'personal');
  const cellSelect = h('select', null, ledCells.map((c) => h('option', { value: c.cell_id, selected: c.cell_id === preselect }, c.cells?.name)));
  const cellIsActive = (id) => active.some((s) => s.kind === 'cell' && s.cell_id === id);

  const personalCard = h('div', { class: 'card plan' + (!preferCell ? ' featured' : '') },
    h('div', { class: 'row between' }, h('h3', null, '✨ Premium'), h('strong', { class: 'price' }, money(CONFIG.PRICE_PERSONAL), h('small', null, '/mês'))),
    h('p', { class: 'muted' }, 'Para a sua vida de oração e leitura.'),
    list(PERSONAL),
    personalActive ? badge('Seu plano atual', 'ok')
      : h('button', { class: 'btn block', onclick: (e) => subscribe(e.currentTarget, 'personal') }, 'Assinar Premium'));

  const cellCard = h('div', { class: 'card plan' + (preferCell ? ' featured' : '') },
    h('div', { class: 'row between' }, h('h3', null, '👥 Plano Célula'), h('strong', { class: 'price' }, money(CONFIG.PRICE_CELL), h('small', null, '/mês'))),
    h('p', { class: 'muted' }, 'Pago pelo líder. Libera para a célula inteira.'),
    list(CELL),
    ledCells.length ? h('div', { class: 'stack' },
      ledCells.length > 1 ? cellSelect : null,
      h('button', { class: 'btn block', onclick: (e) => {
        const id = ledCells.length > 1 ? cellSelect.value : ledCells[0].cell_id;
        if (cellIsActive(id)) return toast('Esta célula já tem o Plano Célula.', 'err');
        subscribe(e.currentTarget, 'cell', id);
      } }, 'Assinar para ' + (ledCells.length > 1 ? 'a célula escolhida' : ledCells[0].cells?.name)))
      : h('p', { class: 'muted small' }, 'Disponível para líderes de célula.'));

  return h('div', { class: 'stack' },
    pageHead('Planos', { back: 'eu' }),
    active.length ? h('section', { class: 'stack' }, h('h2', { class: 'section-title' }, 'Minhas assinaturas'),
      h('div', { class: 'card list' }, active.map((s) => h('div', { class: 'list-item' }, icon('crown'),
        h('div', { class: 'grow' }, h('strong', null, s.kind === 'personal' ? 'Premium' : `Plano Célula · ${s.cells?.name || ''}`),
          h('small', { class: 'muted' }, s.provider === 'manual' ? 'Cortesia' : `${money(s.amount || 0)}/mês${s.next_payment_date ? ' · próxima cobrança ' + fmtDate(s.next_payment_date) : ''}`)),
        s.provider === 'mercadopago' ? h('button', { class: 'link small danger', onclick: () => cancel(s) }, 'Cancelar') : null)))) : null,
    subs.some((s) => s.status === 'pending') && !active.length ? h('div', { class: 'card soft' },
      h('p', { class: 'muted' }, 'Tem um pagamento em andamento. Assim que o Mercado Pago confirmar, o plano é liberado automaticamente.')) : null,
    preferCell ? [cellCard, personalCard] : [personalCard, cellCard],
    h('div', { class: 'card plan' }, h('div', { class: 'row between' }, h('h3', null, 'Grátis'), h('strong', { class: 'price' }, 'R$ 0')), list(FREE)),
    h('p', { class: 'muted small center' }, 'Pagamento seguro pelo Mercado Pago (cartão de crédito). Cancele quando quiser.'));
}
