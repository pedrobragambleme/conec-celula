// Ponto de entrada: rotas, layout e sessão.
import { h, clear, icon, spinner, toast } from './ui.js';
import { sb, state, loadMe, refreshUnread } from './sb.js';
import { CONFIG } from './config.js';

const routes = [
  ['entrar', () => import('./views/auth.js').then((m) => m.login), { public: true, bare: true }],
  ['cadastro', () => import('./views/auth.js').then((m) => m.signup), { public: true, bare: true }],
  ['recuperar', () => import('./views/auth.js').then((m) => m.recover), { public: true, bare: true }],
  ['nova-senha', () => import('./views/auth.js').then((m) => m.newPassword), { bare: true }],
  ['termos', () => import('./views/legal.js').then((m) => m.terms), { public: true }],
  ['privacidade', () => import('./views/legal.js').then((m) => m.privacy), { public: true }],
  ['', () => import('./views/home.js').then((m) => m.home), { tab: 'home' }],
  ['post/:id', () => import('./views/home.js').then((m) => m.postDetail), { tab: 'home' }],
  ['explorar', () => import('./views/explore.js').then((m) => m.explore), { tab: 'explore' }],
  ['perfil/:id', () => import('./views/profile.js').then((m) => m.profile), { tab: 'me' }],
  ['eu', () => import('./views/profile.js').then((m) => m.meMenu), { tab: 'me' }],
  ['editar-perfil', () => import('./views/profile.js').then((m) => m.editProfile), { tab: 'me' }],
  ['celulas', () => import('./views/cells.js').then((m) => m.cellsHome), { tab: 'cells' }],
  ['nova-igreja', () => import('./views/church.js').then((m) => m.newChurch), { tab: 'cells' }],
  ['igreja/:id', () => import('./views/church.js').then((m) => m.church), { tab: 'cells' }],
  ['celula/:id', () => import('./views/cell.js').then((m) => m.cell), { tab: 'cells' }],
  ['celula/:id/:tab', () => import('./views/cell.js').then((m) => m.cell), { tab: 'cells' }],
  ['celula/:id/:tab/:sub', () => import('./views/cell.js').then((m) => m.cell), { tab: 'cells' }],
  ['oracao', () => import('./views/prayer.js').then((m) => m.prayer), { tab: 'pray' }],
  ['oracao/:tab', () => import('./views/prayer.js').then((m) => m.prayer), { tab: 'pray' }],
  ['lembretes', () => import('./views/reminders.js').then((m) => m.reminders), { tab: 'pray' }],
  ['leitura', () => import('./views/reading.js').then((m) => m.readingList), { tab: 'me' }],
  ['leitura/:id', () => import('./views/reading.js').then((m) => m.readingPlan), { tab: 'me' }],
  ['notificacoes', () => import('./views/notifications.js').then((m) => m.notifications), {}],
  ['planos', () => import('./views/plans.js').then((m) => m.plans), { tab: 'me' }],
  ['admin', () => import('./views/admin.js').then((m) => m.admin), { tab: 'me' }],
];

function match(path) {
  const parts = path.split('/').filter(Boolean);
  for (const [pattern, load, opts] of routes) {
    const pp = pattern.split('/').filter(Boolean);
    if (pp.length !== parts.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(parts[i])), true) : seg === parts[i]))) {
      return { load, opts, params };
    }
  }
  return null;
}

export function currentPath() {
  const raw = location.hash.replace(/^#\/?/, '');
  return raw.split('?')[0];
}
export function query() {
  return new URLSearchParams(location.hash.split('?')[1] || '');
}
export function go(path) { location.hash = '#/' + path.replace(/^#?\/?/, ''); }
export function refresh() { render(); }

const root = document.getElementById('app');
let renderToken = 0;

function nav(tab) {
  const item = (key, path, ic, label) => h('a', { href: '#/' + path, class: 'nav-item' + (tab === key ? ' active' : ''), 'aria-label': label },
    icon(ic, 24), h('span', null, label));
  return h('nav', { class: 'bottom-nav' },
    item('home', '', 'home', 'Início'),
    item('cells', 'celulas', 'cells', 'Células'),
    item('pray', 'oracao', 'pray', 'Oração'),
    item('explore', 'explorar', 'search', 'Explorar'),
    item('me', 'eu', 'user', 'Eu'));
}

function header() {
  return h('header', { class: 'top' },
    h('a', { href: '#/', class: 'brand', 'aria-label': CONFIG.APP_NAME },
      h('img', { src: 'icons/logo.svg', alt: '', width: 30, height: 30 }),
      h('span', null, 'Conec', h('b', null, ' Célula'))),
    h('a', { href: '#/notificacoes', class: 'icon-btn bell', 'aria-label': 'Notificações' },
      icon('bell'), h('i', { 'data-unread': '', hidden: true })));
}

async function render() {
  const token = ++renderToken;
  const path = currentPath();
  const m = match(path) || match('');
  if (!m.opts.public && !state.session) { go('entrar'); return; }
  if (state.session && (path === 'entrar' || path === 'cadastro')) { go(''); return; }

  const main = h('main', { class: 'view' }, spinner());
  if (m.opts.bare) clear(root, main);
  else clear(root, state.session ? header() : null, main, state.session ? nav(m.opts.tab) : null);
  window.scrollTo(0, 0);

  try {
    const view = await m.load();
    const node = await view(m.params, query());
    if (token !== renderToken) return;
    clear(main, node);
  } catch (e) {
    console.error(e);
    if (token !== renderToken) return;
    clear(main, h('div', { class: 'empty' }, icon('x', 36), h('strong', null, 'Algo deu errado'),
      h('p', { class: 'muted' }, e.message || 'Tente novamente.'),
      h('button', { class: 'btn', onclick: () => render() }, 'Tentar de novo')));
  }
  if (state.session) refreshUnread();
}

async function start() {
  clear(root, h('div', { class: 'splash' }, h('img', { src: 'icons/logo.svg', alt: '', width: 72, height: 72 }), spinner()));
  if (CONFIG.SUPABASE_URL.includes('SEU-PROJETO')) {
    clear(root, h('div', { class: 'empty', style: { marginTop: '20vh' } }, icon('gear', 36),
      h('strong', null, 'Falta configurar'),
      h('p', { class: 'muted' }, 'Preencha o arquivo js/config.js com os dados do seu Supabase (veja docs/instalacao.md).')));
    return;
  }

  let recovering = false;
  sb.auth.onAuthStateChange(async (event, session) => {
    const had = !!state.session;
    state.session = session;
    if (event === 'PASSWORD_RECOVERY') { recovering = true; await loadMe(); go('nova-senha'); return; }
    if (event === 'SIGNED_IN' && !had) { await loadMe(); if (!recovering) render(); }
    if (event === 'SIGNED_OUT') { state.me = null; state.myCells = []; go('entrar'); render(); }
  });

  const { data } = await sb.auth.getSession();
  state.session = data.session;
  if (state.session) await loadMe();

  // limpa tokens que o Supabase coloca na URL depois de confirmar e-mail
  if (/access_token|error_description|type=recovery/.test(location.hash)) {
    if (location.hash.includes('error_description')) toast('O link expirou ou é inválido. Peça outro.', 'err');
    history.replaceState(null, '', location.pathname + (recovering ? '#/nova-senha' : '#/'));
  }

  window.addEventListener('hashchange', render);
  render();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  setInterval(() => state.session && refreshUnread(), 60000);
}

start();
