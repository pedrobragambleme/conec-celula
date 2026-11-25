import { h, icon, empty, timeAgo } from '../ui.js';
import { sb, run, uid, refreshUnread } from '../sb.js';
import { refresh } from '../app.js';
import { pageHead } from './common.js';

const ICON = { join_request: 'users', join_approved: 'check', cell_post: 'sparkle', like: 'heart', comment: 'chat', follow: 'user',
  amen: 'pray', event: 'calendar', absence: 'bell', multiply: 'cells', subscription: 'crown' };

export async function notifications() {
  const list = await run(sb.from('notifications').select('*').eq('user_id', uid()).order('created_at', { ascending: false }).limit(60));
  const unread = list.filter((n) => !n.read_at).map((n) => n.id);
  if (unread.length) sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread).then(refreshUnread);

  return h('div', { class: 'stack' },
    pageHead('Notificações', { back: '', action: list.length ? h('button', { class: 'link small', onclick: async () => {
      await run(sb.from('notifications').delete().eq('user_id', uid()), 'Notificações limpas'); refresh();
    } }, 'Limpar') : null }),
    list.length ? h('div', { class: 'card list' }, list.map((n) => h('a', { class: 'list-item' + (n.read_at ? '' : ' unread'), href: n.link || '#/' },
      h('span', { class: 'n-ic' }, icon(ICON[n.type] || 'bell', 20)),
      h('div', { class: 'grow' }, h('strong', null, n.title), n.body ? h('small', { class: 'muted' }, n.body) : null),
      h('small', { class: 'muted' }, timeAgo(n.created_at)))))
      : empty('bell', 'Tudo em dia', 'Quando algo acontecer nas suas células ou com suas publicações, aparece aqui.'));
}
