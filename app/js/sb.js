// Conexão com o Supabase e estado global do usuário logado.
import { createClient } from 'supabase-js';
import { CONFIG } from './config.js';
import { toast } from './ui.js';

export const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const state = {
  session: null,
  me: null,          // perfil
  premium: false,    // Premium pessoal ativo
  unread: 0,
  myCells: [],       // [{cell_id, role, status, cells:{...}}]
  churchAdmin: [],   // ids das igrejas que administro
};

export const uid = () => state.session?.user?.id;

export async function loadMe() {
  if (!uid()) { state.me = null; return; }
  const [{ data: me }, { data: premium }, { data: cells }, { data: admins }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid()).single(),
    sb.rpc('has_personal_premium'),
    sb.from('cell_members').select('cell_id, role, status, cells(id, name, color, church_id, churches(name))')
      .eq('user_id', uid()).in('status', ['approved', 'pending']),
    sb.from('church_admins').select('church_id, role').eq('user_id', uid()),
  ]);
  state.me = me;
  state.premium = !!premium;
  const seen = new Set();
  state.myCells = (cells || []).filter((c) => !seen.has(c.cell_id) && seen.add(c.cell_id));
  state.churchAdmin = (admins || []).map((a) => a.church_id);
}

export const isLeaderOf = (cellId) =>
  state.myCells.some((m) => m.cell_id === cellId && m.status === 'approved' && ['leader', 'co_leader'].includes(m.role));

// executa uma chamada e mostra erro amigável
export async function run(promise, okMsg) {
  const { data, error } = await promise;
  if (error) {
    const msg = friendlyError(error);
    toast(msg, 'err');
    throw Object.assign(new Error(msg), { handled: true, original: error });
  }
  if (okMsg) toast(okMsg);
  return data;
}

export function friendlyError(error) {
  const m = error?.message || String(error);
  if (m.includes('LIMITE_PLANO')) return m.replace(/^.*LIMITE_PLANO:\s*/, '');
  if (m.includes('row-level security')) return 'Você não tem permissão para isso (ou é um recurso de plano pago).';
  if (m.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('Email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos.';
  if (m.includes('User already registered')) return 'Este e-mail já tem cadastro. Tente entrar.';
  if (m.includes('Password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('duplicate key')) return 'Isso já existe.';
  if (m.includes('Failed to fetch')) return 'Sem conexão com a internet.';
  return m;
}

export async function uploadImage(blob, folder = 'img') {
  const path = `${uid()}/${folder}-${Date.now()}.jpg`;
  await run(sb.storage.from('midia').upload(path, blob, { contentType: 'image/jpeg', upsert: true }));
  return sb.storage.from('midia').getPublicUrl(path).data.publicUrl;
}

export async function refreshUnread() {
  if (!uid()) return 0;
  const { count } = await sb.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', uid()).is('read_at', null);
  state.unread = count || 0;
  document.querySelectorAll('[data-unread]').forEach((el) => {
    el.textContent = state.unread > 9 ? '9+' : String(state.unread);
    el.hidden = !state.unread;
  });
  return state.unread;
}
