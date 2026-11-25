// Componentes compartilhados entre telas.
import { h, icon, avatar, timeAgo, richText, sheet, field, formData, busy, toast, confirmBox } from '../ui.js';
import { sb, run, uid, state } from '../sb.js';
import { go, refresh } from '../app.js';

export function pageHead(title, { back, action } = {}) {
  return h('div', { class: 'page-head' },
    back ? h('button', { class: 'icon-btn', 'aria-label': 'Voltar', onclick: () => (history.length > 1 ? history.back() : go(back)) }, icon('back')) : null,
    h('h1', null, title),
    action || null);
}

export function premiumGate(title, text, kind = 'personal') {
  return h('div', { class: 'card premium-gate' },
    h('div', { class: 'row gap' }, icon('crown'), h('strong', null, title)),
    h('p', { class: 'muted' }, text),
    h('a', { class: 'btn small', href: '#/planos' + (kind === 'cell' ? '?tipo=celula' : '') },
      kind === 'cell' ? 'Conhecer o Plano Célula' : 'Conhecer o Premium'));
}

export function personLine(p, sub, right) {
  return h('a', { class: 'person', href: `#/perfil/${p.id}` },
    avatar(p, 42),
    h('div', { class: 'grow' }, h('strong', null, p.full_name || 'Sem nome'), sub ? h('small', { class: 'muted' }, sub) : null),
    right || null);
}

export function reportSheet(target_type, target_id) {
  sheet('Denunciar', (close) => {
    const form = h('form', { class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      const d = formData(form);
      await busy(form.querySelector('button'), () =>
        run(sb.from('reports').insert({ reporter_id: uid(), target_type, target_id, reason: d.reason }), 'Denúncia enviada. Obrigado!'));
      close();
    } },
      h('p', { class: 'muted' }, 'Conte o motivo. Nossa equipe vai analisar.'),
      field('Motivo', h('select', { name: 'reason', required: true },
        ['Conteúdo ofensivo', 'Assédio ou bullying', 'Spam ou golpe', 'Conteúdo impróprio', 'Informação falsa', 'Outro'].map((r) => h('option', null, r)))),
      h('button', { class: 'btn danger block' }, 'Enviar denúncia'));
    return form;
  });
}

// ---------------------------------------------------------------------
// Publicações do feed
// ---------------------------------------------------------------------
export const POST_SELECT = 'id, body, verse_ref, image_url, created_at, author:profiles!posts_author_id_fkey(id, full_name, avatar_url, username), post_likes(count), post_comments(count)';

export async function likedSet(posts) {
  if (!posts.length) return new Set();
  const { data } = await sb.from('post_likes').select('post_id').eq('user_id', uid()).in('post_id', posts.map((p) => p.id));
  return new Set((data || []).map((r) => r.post_id));
}

export function postCard(p, liked, { full = false } = {}) {
  let isLiked = liked.has(p.id);
  let likes = p.post_likes?.[0]?.count ?? 0;
  const likeBtn = h('button', { class: 'act' + (isLiked ? ' on' : ''), 'aria-label': 'Amém / curtir', onclick: async () => {
    isLiked = !isLiked; likes += isLiked ? 1 : -1; paint();
    const q = isLiked ? sb.from('post_likes').insert({ post_id: p.id, user_id: uid() })
      : sb.from('post_likes').delete().eq('post_id', p.id).eq('user_id', uid());
    const { error } = await q;
    if (error) { isLiked = !isLiked; likes += isLiked ? 1 : -1; paint(); }
  } });
  const paint = () => { likeBtn.replaceChildren(icon('heart', 20), h('span', null, likes || '')); likeBtn.classList.toggle('on', isLiked); };
  paint();

  const mine = p.author?.id === uid();
  const menu = h('button', { class: 'icon-btn', 'aria-label': 'Mais opções', onclick: () => sheet('Opções', (close) => h('div', { class: 'menu' },
    mine || state.me?.is_platform_admin ? h('button', { class: 'menu-item danger', onclick: async () => {
      close();
      if (!(await confirmBox('Apagar esta publicação?', { ok: 'Apagar', danger: true }))) return;
      await run(sb.from('posts').delete().eq('id', p.id), 'Publicação apagada');
      full ? go('') : refresh();
    } }, icon('trash'), 'Apagar') : null,
    !mine ? h('button', { class: 'menu-item', onclick: () => { close(); reportSheet('post', p.id); } }, icon('flag'), 'Denunciar') : null,
    h('button', { class: 'menu-item', onclick: () => { close(); sharePost(p); } }, icon('share'), 'Compartilhar'))) }, icon('dots'));

  return h('article', { class: 'card post' },
    h('div', { class: 'post-head' },
      h('a', { href: `#/perfil/${p.author?.id}`, class: 'row gap grow' }, avatar(p.author, 40),
        h('div', null, h('strong', null, p.author?.full_name), h('small', { class: 'muted' }, timeAgo(p.created_at)))),
      menu),
    p.verse_ref ? h('div', { class: 'verse-tag' }, icon('book', 16), p.verse_ref) : null,
    h('div', { onclick: full ? null : () => go(`post/${p.id}`), class: full ? '' : 'tap' }, richText(p.body)),
    p.image_url ? h('img', { class: 'post-img', src: p.image_url, alt: '', loading: 'lazy' }) : null,
    h('div', { class: 'post-actions' },
      likeBtn,
      h('a', { class: 'act', href: `#/post/${p.id}`, 'aria-label': 'Comentários' }, icon('chat', 20), h('span', null, p.post_comments?.[0]?.count || '')),
      h('button', { class: 'act', 'aria-label': 'Compartilhar', onclick: () => sharePost(p) }, icon('share', 20))));
}

export function sharePost(p) {
  const text = `${p.body}${p.verse_ref ? `\n— ${p.verse_ref}` : ''}\n\nvia Conec Célula`;
  if (navigator.share) navigator.share({ text, url: location.origin + location.pathname + `#/post/${p.id}` }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('Texto copiado!'));
}

export function composer(onDone, prefill = {}) {
  let imageBlob = null;
  const preview = h('div', { class: 'img-preview' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
    const f = fileInput.files[0]; if (!f) return;
    const { resizeImage } = await import('../ui.js');
    imageBlob = await resizeImage(f, 1280);
    preview.replaceChildren(h('img', { src: URL.createObjectURL(imageBlob), alt: '' }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remover imagem', onclick: () => { imageBlob = null; preview.replaceChildren(); } }, icon('x')));
  } });
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    if (!d.body) return;
    await busy(form.querySelector('[type=submit]'), async () => {
      let image_url = null;
      if (imageBlob) { const { uploadImage } = await import('../sb.js'); image_url = await uploadImage(imageBlob, 'post'); }
      await run(sb.from('posts').insert({ author_id: uid(), body: d.body, verse_ref: d.verse_ref || null, image_url }), 'Publicado!');
      onDone && onDone();
    });
  } },
    h('textarea', { name: 'body', rows: 4, placeholder: 'Compartilhe um versículo, uma reflexão ou um testemunho…', required: true, maxlength: 2000, value: prefill.body || '' }),
    h('input', { name: 'verse_ref', placeholder: 'Referência (ex.: Salmos 23:1) — opcional', maxlength: 60, value: prefill.verse_ref || '' }),
    preview,
    h('div', { class: 'row between' },
      h('button', { type: 'button', class: 'btn ghost small', onclick: () => fileInput.click() }, icon('image', 18), 'Foto'),
      h('button', { type: 'submit', class: 'btn small' }, icon('send', 18), 'Publicar')),
    fileInput);
  return form;
}
