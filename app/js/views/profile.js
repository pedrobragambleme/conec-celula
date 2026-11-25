import { h, icon, avatar, clear, spinner, empty, sheet, field, formData, busy, toast, confirmBox, resizeImage, badge } from '../ui.js';
import { sb, run, uid, state, loadMe, uploadImage } from '../sb.js';
import { go, refresh } from '../app.js';
import { POST_SELECT, likedSet, postCard, pageHead, reportSheet, personLine } from './common.js';

export async function profile({ id }) {
  if (id === uid()) return meMenu();
  const [p, { count: followers }, { count: following }, { data: iFollow }, { data: blocked }] = await Promise.all([
    run(sb.from('profiles').select('id, full_name, avatar_url, bio, city, username, created_at').eq('id', id).maybeSingle()),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    sb.from('follows').select('following_id').eq('follower_id', uid()).eq('following_id', id),
    sb.from('blocks').select('blocked_id').eq('blocker_id', uid()).eq('blocked_id', id),
  ]);
  if (!p) return h('div', null, pageHead('Perfil', { back: 'explorar' }), empty('user', 'Perfil não encontrado'));
  let connected = !!iFollow?.length;
  const isBlocked = !!blocked?.length;

  const btn = h('button', { class: 'btn' + (connected ? ' ghost' : ''), onclick: async () => {
    await busy(btn, async () => {
      if (connected) await run(sb.from('follows').delete().eq('follower_id', uid()).eq('following_id', id));
      else await run(sb.from('follows').insert({ follower_id: uid(), following_id: id }));
      connected = !connected;
    });
    btn.textContent = connected ? 'Conectado ✓' : 'Conectar';
    btn.className = 'btn' + (connected ? ' ghost' : '');
  } }, connected ? 'Conectado ✓' : 'Conectar');

  const posts = h('div', { class: 'stack' }, spinner());
  run(sb.from('posts').select(POST_SELECT).eq('author_id', id).order('created_at', { ascending: false }).limit(30)).then(async (list) => {
    const liked = await likedSet(list);
    clear(posts, list.length ? list.map((x) => postCard(x, liked)) : h('p', { class: 'muted center' }, 'Nenhuma publicação ainda.'));
  });

  const more = h('button', { class: 'icon-btn', 'aria-label': 'Mais', onclick: () => sheet('Opções', (close) => h('div', { class: 'menu' },
    h('button', { class: 'menu-item', onclick: async () => {
      close();
      if (isBlocked) { await run(sb.from('blocks').delete().eq('blocker_id', uid()).eq('blocked_id', id), 'Desbloqueado'); refresh(); return; }
      if (!(await confirmBox(`Bloquear ${p.full_name}? Vocês deixarão de ver as publicações um do outro.`, { ok: 'Bloquear', danger: true }))) return;
      await run(sb.from('blocks').insert({ blocker_id: uid(), blocked_id: id }));
      await sb.from('follows').delete().eq('follower_id', uid()).eq('following_id', id);
      await sb.from('follows').delete().eq('follower_id', id).eq('following_id', uid());
      toast('Usuário bloqueado'); refresh();
    } }, icon('shield'), isBlocked ? 'Desbloquear' : 'Bloquear'),
    h('button', { class: 'menu-item', onclick: () => { close(); reportSheet('profile', id); } }, icon('flag'), 'Denunciar perfil'))) }, icon('dots'));

  return h('div', { class: 'stack' },
    pageHead('', { back: 'explorar', action: more }),
    h('div', { class: 'profile-head' },
      avatar(p, 88),
      h('h1', null, p.full_name),
      p.username ? h('small', { class: 'muted' }, '@' + p.username) : null,
      p.city ? h('small', { class: 'muted' }, icon('pin', 14), ' ', p.city) : null,
      p.bio ? h('p', null, p.bio) : null,
      h('div', { class: 'stats' },
        h('div', null, h('strong', null, followers ?? 0), h('small', null, 'conexões')),
        h('div', null, h('strong', null, following ?? 0), h('small', null, 'conectado a'))),
      isBlocked ? badge('Bloqueado', 'danger') : btn),
    h('h2', { class: 'section-title' }, 'Publicações'),
    posts);
}

export async function meMenu() {
  const me = state.me;
  const [{ count: followers }, { count: following }] = await Promise.all([
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', uid()),
    sb.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', uid()),
  ]);
  const item = (href, ic, label, extra) => h('a', { class: 'list-item', href }, icon(ic), h('span', { class: 'grow' }, label), extra || null);

  return h('div', { class: 'stack' },
    h('div', { class: 'profile-head' },
      avatar(me, 88),
      h('h1', null, me.full_name),
      me.username ? h('small', { class: 'muted' }, '@' + me.username) : null,
      state.premium ? badge('Premium ✨', 'gold') : null,
      me.bio ? h('p', null, me.bio) : null,
      h('div', { class: 'stats' },
        h('button', { class: 'linklike', onclick: () => connections('followers') }, h('strong', null, followers ?? 0), h('small', null, 'conexões')),
        h('button', { class: 'linklike', onclick: () => connections('following') }, h('strong', null, following ?? 0), h('small', null, 'conectado a'))),
      h('div', { class: 'row gap' },
        h('a', { class: 'btn ghost small', href: '#/editar-perfil' }, icon('edit', 18), 'Editar perfil'),
        h('a', { class: 'btn ghost small', href: `#/perfil-publico` , onclick: (e) => { e.preventDefault(); myPosts(); } }, icon('list', 18), 'Minhas publicações'))),
    h('div', { class: 'card list' },
      item('#/lembretes', 'clock', 'Lembretes e notificações'),
      item('#/leitura', 'book', 'Planos de leitura'),
      item('#/oracao/diario', 'pray', 'Diário de oração', state.premium ? null : badge('Premium', 'gold')),
      item('#/planos', 'crown', 'Planos e assinatura', state.premium ? badge('Ativo', 'ok') : null)),
    h('div', { class: 'card list' },
      item('#/celulas', 'cells', 'Minhas células e igrejas'),
      item('#/nova-igreja', 'church', 'Cadastrar uma igreja'),
      me.is_platform_admin ? item('#/admin', 'shield', 'Moderação (administrador)') : null),
    h('div', { class: 'card list' },
      item('#/termos', 'list', 'Termos de uso'),
      item('#/privacidade', 'shield', 'Privacidade'),
      h('button', { class: 'list-item', onclick: () => sb.auth.signOut() }, icon('out'), h('span', { class: 'grow' }, 'Sair'))),
    h('button', { class: 'link danger center small', onclick: deleteAccount }, 'Excluir minha conta'));
}

async function myPosts() {
  sheet('Minhas publicações', () => {
    const box = h('div', { class: 'stack' }, spinner());
    run(sb.from('posts').select(POST_SELECT).eq('author_id', uid()).order('created_at', { ascending: false }).limit(50)).then(async (list) => {
      const liked = await likedSet(list);
      clear(box, list.length ? list.map((p) => postCard(p, liked)) : h('p', { class: 'muted center' }, 'Você ainda não publicou nada.'));
    });
    return box;
  });
}

async function connections(kind) {
  sheet(kind === 'followers' ? 'Conexões' : 'Conectado a', () => {
    const box = h('div', { class: 'list' }, spinner());
    const q = kind === 'followers'
      ? sb.from('follows').select('p:profiles!follows_follower_id_fkey(id, full_name, avatar_url, city)').eq('following_id', uid())
      : sb.from('follows').select('p:profiles!follows_following_id_fkey(id, full_name, avatar_url, city)').eq('follower_id', uid());
    run(q).then((rows) => clear(box, rows.length ? rows.map((r) => personLine(r.p, r.p.city)) : h('p', { class: 'muted center' }, 'Ninguém ainda.')));
    return box;
  });
}

async function deleteAccount() {
  if (!(await confirmBox('Isso apaga sua conta, suas publicações, pedidos de oração e todos os seus dados, para sempre. Assinaturas ativas devem ser canceladas antes em Planos. Deseja continuar?', { ok: 'Excluir tudo', danger: true }))) return;
  await run(sb.rpc('delete_my_account'));
  await sb.auth.signOut();
  toast('Sua conta foi excluída.');
}

export async function editProfile() {
  const me = state.me;
  const priv = await run(sb.from('profiles_private').select('*').eq('user_id', uid()).maybeSingle()) || {};
  let avatarBlob = null;
  const avatarBox = h('div', { class: 'avatar-edit' }, avatar(me, 96));
  const file = h('input', { type: 'file', accept: 'image/*', hidden: true, onchange: async () => {
    if (!file.files[0]) return;
    avatarBlob = await resizeImage(file.files[0], 400, 0.85);
    clear(avatarBox, h('img', { class: 'avatar', src: URL.createObjectURL(avatarBlob), style: { width: '96px', height: '96px' }, alt: '' }));
  } });

  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    if (d.username && !/^[a-z0-9_.]{3,30}$/.test(d.username)) return toast('Usuário: 3 a 30 letras minúsculas, números, ponto ou _', 'err');
    await busy(form.querySelector('[type=submit]'), async () => {
      const patch = { full_name: d.full_name, username: d.username || null, bio: d.bio || null, city: d.city || null };
      if (avatarBlob) patch.avatar_url = await uploadImage(avatarBlob, 'avatar');
      await run(sb.from('profiles').update(patch).eq('id', uid()));
      await run(sb.from('profiles_private').update({ birth_date: d.birth_date || null, phone: d.phone || null, show_birthday: d.show_birthday }).eq('user_id', uid()), 'Perfil salvo!');
      await loadMe();
      go('eu');
    });
  } },
    h('div', { class: 'center' }, avatarBox, h('button', { type: 'button', class: 'link', onclick: () => file.click() }, 'Trocar foto'), file),
    field('Nome', h('input', { name: 'full_name', value: me.full_name, required: true, maxlength: 80 })),
    field('Usuário', h('input', { name: 'username', value: me.username || '', placeholder: 'ex.: maria.silva', maxlength: 30, autocapitalize: 'off' })),
    field('Sobre você', h('textarea', { name: 'bio', rows: 3, maxlength: 280, value: me.bio || '' })),
    field('Cidade', h('input', { name: 'city', value: me.city || '', maxlength: 60 })),
    h('div', { class: 'card soft stack' },
      h('strong', null, 'Dados privados'),
      h('small', { class: 'muted' }, 'Visíveis só para você e para os líderes das suas células.'),
      field('Telefone / WhatsApp', h('input', { name: 'phone', type: 'tel', value: priv.phone || '', maxlength: 20 })),
      field('Data de nascimento', h('input', { name: 'birth_date', type: 'date', value: priv.birth_date || '' })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'show_birthday', checked: priv.show_birthday !== false }),
        h('span', null, 'Mostrar meu aniversário (dia e mês) para a célula'))),
    h('button', { type: 'submit', class: 'btn block' }, 'Salvar'));
  return h('div', { class: 'stack' }, pageHead('Editar perfil', { back: 'eu' }), form);
}
