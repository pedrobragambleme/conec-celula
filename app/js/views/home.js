import { h, icon, tabs, sheet, empty, spinner, clear, avatar, timeAgo, richText, confirmBox, fmtDateTime } from '../ui.js';
import { sb, run, uid, state } from '../sb.js';
import { go, refresh } from '../app.js';
import { POST_SELECT, likedSet, postCard, composer, pageHead, reportSheet } from './common.js';

let feedTab = 'todos';

export async function home() {
  const [{ data: votd }, { data: events }] = await Promise.all([
    sb.rpc('verse_of_the_day'),
    sb.from('events').select('id, title, starts_at, cell_id, cells(name)')
      .gte('starts_at', new Date().toISOString()).order('starts_at').limit(3),
  ]);
  const verse = votd?.[0];
  const firstName = (state.me?.full_name || '').split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const approved = state.myCells.filter((c) => c.status === 'approved');

  const feedBox = h('div', { class: 'stack' }, spinner());
  const loadFeed = async () => {
    clear(feedBox, spinner());
    let q = sb.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(30);
    if (feedTab === 'conexoes') {
      const { data: f } = await sb.from('follows').select('following_id').eq('follower_id', uid());
      const ids = [...(f || []).map((x) => x.following_id), uid()];
      q = q.in('author_id', ids);
    }
    const posts = await run(q);
    const liked = await likedSet(posts);
    clear(feedBox, posts.length ? posts.map((p) => postCard(p, liked))
      : empty('users', feedTab === 'conexoes' ? 'Nada por aqui ainda' : 'Seja o primeiro a publicar',
        feedTab === 'conexoes' ? 'Conecte-se com pessoas em Explorar para ver as publicações delas.' : 'Compartilhe um versículo que tocou você hoje.',
        feedTab === 'conexoes' ? h('a', { href: '#/explorar', class: 'btn small' }, 'Explorar pessoas') : null));
  };
  const tabBox = h('div');
  const paintTabs = () => clear(tabBox, tabs([['todos', 'Para você'], ['conexoes', 'Conexões']], feedTab, (t) => { feedTab = t; paintTabs(); loadFeed(); }));
  paintTabs();
  loadFeed();

  const openComposer = (prefill) => sheet('Nova publicação', (close) => composer(() => { close(); loadFeed(); }, prefill));

  return h('div', { class: 'stack' },
    h('div', { class: 'hello' }, h('h1', null, `${greet}, ${firstName || 'irmão(ã)'}!`)),
    verse ? h('section', { class: 'verse-card' },
      h('small', null, 'Versículo do dia'),
      h('blockquote', null, `“${verse.text}”`),
      h('cite', null, verse.ref),
      h('div', { class: 'row gap mt' },
        h('button', { class: 'btn light small', onclick: () => openComposer({ body: verse.text, verse_ref: verse.ref }) }, icon('share', 18), 'Compartilhar'),
        h('a', { class: 'btn light small', href: '#/lembretes' }, icon('clock', 18), 'Lembretes de oração'))) : null,

    approved.length
      ? h('section', null, h('div', { class: 'section-title' }, h('h2', null, 'Minhas células')),
        h('div', { class: 'chips scroll' }, approved.map((c) =>
          h('a', { class: 'cell-chip', href: `#/celula/${c.cell_id}`, style: { '--c': c.cells?.color || '#E8603C' } },
            h('i'), c.cells?.name))))
      : h('a', { class: 'card cta', href: '#/celulas' }, icon('cells', 28),
        h('div', null, h('strong', null, 'Encontre sua célula'), h('p', { class: 'muted' }, 'Peça para entrar e participe do grupo.'))),

    events?.length ? h('section', null, h('div', { class: 'section-title' }, h('h2', null, 'Próximos eventos')),
      h('div', { class: 'card list' }, events.map((e) => h('a', { class: 'list-item', href: e.cell_id ? `#/celula/${e.cell_id}/agenda` : '#/celulas' },
        icon('calendar'), h('div', { class: 'grow' }, h('strong', null, e.title), h('small', { class: 'muted' }, `${fmtDateTime(e.starts_at)}${e.cells ? ' · ' + e.cells.name : ''}`)))))) : null,

    h('button', { class: 'card composer-open', onclick: () => openComposer() },
      avatar(state.me, 36), h('span', { class: 'muted grow' }, 'Compartilhe algo com a comunidade…'), icon('plus')),
    tabBox,
    feedBox);
}

export async function postDetail({ id }) {
  const post = await run(sb.from('posts').select(POST_SELECT).eq('id', id).maybeSingle());
  if (!post) return h('div', null, pageHead('Publicação', { back: '' }), empty('chat', 'Publicação não encontrada'));
  const liked = await likedSet([post]);
  const list = h('div', { class: 'stack' });
  const load = async () => {
    const comments = await run(sb.from('post_comments')
      .select('id, body, created_at, author:profiles!post_comments_author_id_fkey(id, full_name, avatar_url)')
      .eq('post_id', id).order('created_at'));
    clear(list, comments.length ? comments.map((c) => h('div', { class: 'comment' },
      h('a', { href: `#/perfil/${c.author.id}` }, avatar(c.author, 34)),
      h('div', { class: 'bubble grow' },
        h('div', { class: 'row between' }, h('strong', null, c.author.full_name), h('small', { class: 'muted' }, timeAgo(c.created_at))),
        richText(c.body),
        h('div', { class: 'row gap' },
          c.author.id === uid() || post.author.id === uid()
            ? h('button', { class: 'link small', onclick: async () => {
              if (await confirmBox('Apagar comentário?', { ok: 'Apagar', danger: true })) {
                await run(sb.from('post_comments').delete().eq('id', c.id)); load();
              } } }, 'Apagar') : null,
          c.author.id !== uid() ? h('button', { class: 'link small', onclick: () => reportSheet('comment', c.id) }, 'Denunciar') : null))))
      : h('p', { class: 'muted center' }, 'Nenhum comentário ainda.'));
  };
  load();
  const input = h('input', { placeholder: 'Escreva um comentário…', maxlength: 1000, required: true });
  const form = h('form', { class: 'comment-form', onsubmit: async (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    await run(sb.from('post_comments').insert({ post_id: id, author_id: uid(), body: input.value.trim() }));
    input.value = ''; load();
  } }, input, h('button', { class: 'icon-btn primary', 'aria-label': 'Enviar' }, icon('send')));
  return h('div', { class: 'stack' }, pageHead('Publicação', { back: '' }), postCard(post, liked, { full: true }),
    h('h2', { class: 'section-title' }, 'Comentários'), list, form);
}
