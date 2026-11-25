import { h, icon, empty, timeAgo, confirmBox, badge, richText } from '../ui.js';
import { sb, run, state } from '../sb.js';
import { refresh } from '../app.js';
import { pageHead } from './common.js';

const TABLE = { post: 'posts', comment: 'post_comments', prayer: 'prayer_requests', cell_post: 'cell_posts' };

export async function admin() {
  if (!state.me?.is_platform_admin) return h('div', null, pageHead('Moderação', { back: 'eu' }), empty('shield', 'Acesso restrito'));
  const reports = await run(sb.from('reports').select('*, reporter:profiles(full_name)').eq('status', 'open').order('created_at').limit(100));

  const preview = async (r) => {
    if (r.target_type === 'profile') {
      const { data } = await sb.from('profiles').select('full_name, bio').eq('id', r.target_id).maybeSingle();
      return data ? h('a', { href: `#/perfil/${r.target_id}`, class: 'link' }, data.full_name) : h('em', null, 'perfil removido');
    }
    const { data } = await sb.from(TABLE[r.target_type]).select('*').eq('id', r.target_id).maybeSingle();
    return data ? richText(data.body || data.title || '') : h('em', null, 'conteúdo já removido');
  };

  const cards = await Promise.all(reports.map(async (r) => h('div', { class: 'card stack' },
    h('div', { class: 'row between' }, badge(r.target_type), h('small', { class: 'muted' }, timeAgo(r.created_at))),
    h('strong', null, r.reason), h('small', { class: 'muted' }, 'Denunciado por ' + (r.reporter?.full_name || '—')),
    h('div', { class: 'quote' }, await preview(r)),
    h('div', { class: 'row gap end' },
      h('button', { class: 'btn ghost small', onclick: async () => { await run(sb.from('reports').update({ status: 'dismissed' }).eq('id', r.id)); refresh(); } }, 'Ignorar'),
      r.target_type !== 'profile' ? h('button', { class: 'btn danger small', onclick: async () => {
        if (!(await confirmBox('Remover este conteúdo?', { ok: 'Remover', danger: true }))) return;
        await sb.from(TABLE[r.target_type]).delete().eq('id', r.target_id);
        await run(sb.from('reports').update({ status: 'resolved' }).eq('id', r.id), 'Conteúdo removido'); refresh();
      } }, icon('trash', 16), 'Remover') : null))));

  return h('div', { class: 'stack' }, pageHead('Moderação', { back: 'eu' }),
    cards.length ? cards : empty('shield', 'Nenhuma denúncia aberta', 'Tudo tranquilo por aqui.'));
}
