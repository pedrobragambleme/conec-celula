// Pequena biblioteca de interface: criação de elementos, ícones, avisos, janelas.

export function h(tag, props, ...children) {
  const el = tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'line' || tag === 'polyline'
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) sk.startsWith('--') ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
      }
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'selected') el.selected = !!v;
      else if (k === 'ref' && typeof v === 'function') v(el);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) { el.replaceChildren(); append(el, children); return el; }

// ---------------------------------------------------------------------
// Ícones (traço simples, 24x24)
// ---------------------------------------------------------------------
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  cells: 'M9 7a4 4 0 1 0 0 .01M17 11a3 3 0 1 0 0 .01M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7M15 14.3c3.3-.6 7 1.6 7 5.7',
  pray: 'M12 3c-1 2-4 5-4 9v4l-3 3M12 3c1 2 4 5 4 9v4l3 3M12 3v10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  user: 'M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM3.5 21c.8-4 4.3-6.5 8.5-6.5s7.7 2.5 8.5 6.5',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9zM10 20a2 2 0 0 0 4 0',
  plus: 'M12 5v14M5 12h14',
  heart: 'M12 20s-7.5-4.6-9.3-9.2C1.4 7.3 3.7 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.3 0 5.6 3.3 4.3 6.8C19.5 15.4 12 20 12 20z',
  chat: 'M4 5h16v11H9l-5 4z',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5',
  book: 'M4 5c3-1.5 5.5-1.5 8 0v15c-2.5-1.5-5-1.5-8 0zM20 5c-3-1.5-5.5-1.5-8 0v15c2.5-1.5 5-1.5 8 0z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.5-2-3.5-2.4 1a7.5 7.5 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.5 7.5 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.5 7.5 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7.5 7.5 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.5 7.5 0 0 0 1.7-1l2.4 1 2-3.5z',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  gift: 'M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-1-3-5-4-5-1.5S10.5 7 12 7zM12 7c1-3 5-4 5-1.5S13.5 7 12 7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  flag: 'M5 21V4M5 4h12l-2 4 2 4H5',
  map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14',
  send: 'M4 12l16-8-6 16-2.5-6.5z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 8.5h.01',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  sparkle: 'M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  church: 'M12 2v4M10 4h4M5 21V11l7-5 7 5v10M9 21v-5a3 3 0 0 1 6 0v5M3 21h18',
  share: 'M12 3v12M7 8l5-5 5 5M5 14v6h14v-6',
  dots: 'M5 12h.01M12 12h.01M19 12h.01',
};

export function icon(name, size = 22) {
  return h('svg', { class: 'ic', width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    h('path', { d: P[name] || P.dots }));
}

// ---------------------------------------------------------------------
// Avisos (toast), carregando, janelas (sheet), confirmação
// ---------------------------------------------------------------------
export function toast(msg, type = 'ok') {
  const t = h('div', { class: `toast toast-${type}`, role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 3200);
}

export const spinner = () => h('div', { class: 'spinner', 'aria-label': 'Carregando' });

export function sheet(title, content, { onClose } = {}) {
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 250);
    onClose && onClose();
  };
  const wrap = h('div', { class: 'sheet-wrap', onclick: (e) => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-head' },
        h('h3', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: close }, icon('x'))),
      h('div', { class: 'sheet-body' }, typeof content === 'function' ? content(close) : content)));
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  return close;
}

export function confirmBox(message, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const close = sheet('Confirmar', (close) => h('div', null,
      h('p', { class: 'muted' }, message),
      h('div', { class: 'row gap end mt' },
        h('button', { class: 'btn ghost', onclick: () => { done = true; close(); resolve(false); } }, 'Cancelar'),
        h('button', { class: `btn ${danger ? 'danger' : ''}`, onclick: () => { done = true; close(); resolve(true); } }, ok))),
      { onClose: () => { if (!done) resolve(false); } });
  });
}

// ---------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------
export function field(label, input, hint) {
  return h('label', { class: 'field' }, h('span', null, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
}

export function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.multi) { (out[el.name] ||= []); if (el.checked) out[el.name].push(el.value); }
      else out[el.name] = el.checked;
    } else out[el.name] = el.value.trim();
  }
  return out;
}

export async function busy(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true; btn.classList.add('loading');
  try { return await fn(); }
  finally { btn.disabled = false; btn.classList.remove('loading'); btn.textContent = label; }
}

// ---------------------------------------------------------------------
// Datas e textos
// ---------------------------------------------------------------------
export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WD_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  if (s < 604800) return `${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}
export const fmtDate = (d) => new Date(d.length === 10 ? d + 'T12:00:00' : d)
  .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
export const fmtDateTime = (d) => new Date(d).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtTime = (t) => (t || '').slice(0, 5);
export const money = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';
}

export function avatar(p, size = 40) {
  const style = { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' };
  if (p?.avatar_url) return h('img', { class: 'avatar', src: p.avatar_url, alt: '', style, loading: 'lazy' });
  const hue = [...(p?.id || p?.full_name || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return h('div', { class: 'avatar', style: { ...style, background: `hsl(${hue} 45% 88%)`, color: `hsl(${hue} 40% 30%)` } }, initials(p?.full_name));
}

// texto com quebras de linha e links seguros
export function richText(text = '') {
  const parts = [];
  text.split(/(https?:\/\/[^\s]+)/g).forEach((chunk, i) => {
    if (i % 2) parts.push(h('a', { href: chunk, target: '_blank', rel: 'noopener noreferrer' }, chunk));
    else parts.push(chunk);
  });
  return h('p', { class: 'rich' }, parts);
}

export function empty(iconName, title, text, action) {
  return h('div', { class: 'empty' }, icon(iconName, 36), h('strong', null, title), text ? h('p', { class: 'muted' }, text) : null, action || null);
}

export function tabs(items, active, onPick) {
  return h('div', { class: 'tabs', role: 'tablist' },
    items.map(([key, label]) => h('button', {
      class: 'tab' + (key === active ? ' active' : ''), role: 'tab', 'aria-selected': String(key === active),
      onclick: () => onPick(key),
    }, label)));
}

export function badge(text, kind = '') { return h('span', { class: `badge ${kind}` }, text); }

// redimensiona uma imagem antes de enviar (economiza dados e armazenamento)
export function resizeImage(file, max = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao processar imagem'))), 'image/jpeg', quality);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Imagem inválida'));
    img.src = URL.createObjectURL(file);
  });
}
