import { h, field, formData, busy, toast } from '../ui.js';
import { sb, run, friendlyError, state, loadMe } from '../sb.js';
import { go } from '../app.js';

function shell(title, subtitle, form, footer) {
  return h('div', { class: 'auth' },
    h('div', { class: 'auth-hero' },
      h('img', { src: 'icons/logo.svg', alt: '', width: 64, height: 64 }),
      h('h1', null, 'Conec ', h('span', null, 'Célula')),
      h('p', null, 'Sua célula, sua igreja e sua vida de oração, conectadas.')),
    h('div', { class: 'card auth-card' }, h('h2', null, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null, form, footer));
}

export function login() {
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    await busy(form.querySelector('button'), async () => {
      const { error } = await sb.auth.signInWithPassword({ email: d.email, password: d.password });
      if (error) return toast(friendlyError(error), 'err');
      go('');
    });
  } },
    field('E-mail', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email', inputmode: 'email' })),
    field('Senha', h('input', { name: 'password', type: 'password', required: true, autocomplete: 'current-password' })),
    h('button', { class: 'btn block', type: 'submit' }, 'Entrar'),
    h('a', { href: '#/recuperar', class: 'link center' }, 'Esqueci minha senha'));
  return shell('Entrar', null, form,
    h('p', { class: 'center mt' }, 'Ainda não tem conta? ', h('a', { href: '#/cadastro', class: 'link' }, 'Criar conta grátis')));
}

export function signup() {
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    if (!d.terms) return toast('Você precisa aceitar os termos para continuar.', 'err');
    const age = d.birth_date ? (Date.now() - new Date(d.birth_date)) / (365.25 * 864e5) : 99;
    if (age < 13) return toast('O app é para maiores de 13 anos.', 'err');
    await busy(form.querySelector('button'), async () => {
      const { data, error } = await sb.auth.signUp({
        email: d.email, password: d.password,
        options: {
          data: { full_name: d.full_name, birth_date: d.birth_date || '', accepted_terms: 'true' },
          emailRedirectTo: location.origin + location.pathname,
        },
      });
      if (error) return toast(friendlyError(error), 'err');
      if (data.session) { go(''); return; }
      form.replaceWith(h('div', { class: 'stack center' },
        h('div', { class: 'big-emoji' }, '📩'),
        h('h3', null, 'Confirme seu e-mail'),
        h('p', { class: 'muted' }, `Enviamos um link para ${d.email}. Abra o e-mail e toque no link para ativar sua conta.`),
        h('a', { href: '#/entrar', class: 'btn ghost' }, 'Voltar para entrar')));
    });
  } },
    field('Nome completo', h('input', { name: 'full_name', required: true, autocomplete: 'name', maxlength: 80 })),
    field('E-mail', h('input', { name: 'email', type: 'email', required: true, autocomplete: 'email' })),
    field('Senha', h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' }), 'Mínimo de 6 caracteres'),
    field('Data de nascimento', h('input', { name: 'birth_date', type: 'date' }), 'Usamos para lembrar seu aniversário na célula (o ano não aparece).'),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'terms' }),
      h('span', null, 'Li e aceito os ', h('a', { href: '#/termos', target: '_blank', class: 'link' }, 'Termos de Uso'),
        ' e a ', h('a', { href: '#/privacidade', target: '_blank', class: 'link' }, 'Política de Privacidade'), '.')),
    h('button', { class: 'btn block', type: 'submit' }, 'Criar conta'));
  return shell('Criar conta', 'É grátis. Depois você pode encontrar e entrar na sua célula.', form,
    h('p', { class: 'center mt' }, 'Já tem conta? ', h('a', { href: '#/entrar', class: 'link' }, 'Entrar')));
}

export function recover() {
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    await busy(form.querySelector('button'), async () => {
      await run(sb.auth.resetPasswordForEmail(d.email, { redirectTo: location.origin + location.pathname }),
        'Se o e-mail estiver cadastrado, você receberá um link.');
    });
  } },
    field('E-mail', h('input', { name: 'email', type: 'email', required: true })),
    h('button', { class: 'btn block', type: 'submit' }, 'Enviar link'));
  return shell('Recuperar senha', 'Enviaremos um link para você criar uma nova senha.', form,
    h('p', { class: 'center mt' }, h('a', { href: '#/entrar', class: 'link' }, 'Voltar')));
}

export function newPassword() {
  const form = h('form', { class: 'stack', onsubmit: async (e) => {
    e.preventDefault();
    const d = formData(form);
    await busy(form.querySelector('button'), async () => {
      await run(sb.auth.updateUser({ password: d.password }), 'Senha alterada!');
      if (!state.me) await loadMe();
      go('');
    });
  } },
    field('Nova senha', h('input', { name: 'password', type: 'password', required: true, minlength: 6, autocomplete: 'new-password' })),
    h('button', { class: 'btn block', type: 'submit' }, 'Salvar nova senha'));
  return shell('Nova senha', null, form);
}
