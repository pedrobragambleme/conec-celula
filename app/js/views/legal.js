import { h } from '../ui.js';
import { CONFIG } from '../config.js';
import { state } from '../sb.js';
import { pageHead } from './common.js';

// ATENÇÃO: textos-modelo. Revise com um advogado e preencha os dados da sua empresa/CPF responsável.
const doc = (title, sections) => h('div', { class: 'stack legal' },
  pageHead(title, { back: state.session ? 'eu' : 'entrar' }),
  h('p', { class: 'muted small' }, 'Última atualização: ' + new Date().getFullYear()),
  sections.map(([t, p]) => h('section', null, h('h3', null, t), ...[].concat(p).map((x) => h('p', null, x)))));

export const terms = () => doc('Termos de Uso', [
  ['1. O que é o Conec Célula', `O ${CONFIG.APP_NAME} é uma plataforma para igrejas e células (pequenos grupos) se organizarem, compartilharem conteúdo cristão e orarem juntos.`],
  ['2. Cadastro', 'Para usar o app é preciso ter 13 anos ou mais. Menores de 18 anos devem usar com o conhecimento dos pais ou responsáveis. Você é responsável pelas informações que fornece e por manter sua senha em segredo.'],
  ['3. Células e igrejas', 'As células são grupos fechados: a entrada depende da aprovação do líder. Pastores e líderes são responsáveis pela moderação dos seus grupos.'],
  ['4. Conduta', 'Não é permitido publicar conteúdo ofensivo, discriminatório, violento, sexual, enganoso, spam ou que viole direitos de terceiros. Conteúdos podem ser removidos e contas suspensas em caso de violação. Use o botão "Denunciar" sempre que vir algo inadequado.'],
  ['5. Assinaturas', ['Os planos pagos (Premium e Plano Célula) são cobrados mensalmente pelo Mercado Pago até que você cancele. O cancelamento pode ser feito a qualquer momento na tela Planos e interrompe as próximas cobranças.',
    'Pelo Código de Defesa do Consumidor, você pode desistir da contratação em até 7 dias após o primeiro pagamento e pedir reembolso pelo e-mail ' + CONFIG.SUPPORT_EMAIL + '.']],
  ['6. Responsabilidade', 'O app é oferecido como está. Faremos o possível para mantê-lo disponível e seguro, mas não garantimos funcionamento ininterrupto.'],
  ['7. Contato', 'Dúvidas: ' + CONFIG.SUPPORT_EMAIL],
]);

export const privacy = () => doc('Política de Privacidade', [
  ['Quais dados coletamos', 'Nome, e-mail, foto (se você enviar), cidade, data de nascimento e telefone (opcionais), as publicações, pedidos de oração e participações em células, e dados técnicos necessários para enviar notificações.'],
  ['Para que usamos', 'Para o funcionamento do app: identificar você, mostrar seu perfil, organizar as células, lembrar aniversários, enviar lembretes e notificações e processar assinaturas. Não vendemos seus dados.'],
  ['Quem pode ver', ['Perfil (nome, foto, bio, cidade) e publicações: usuários logados do app.',
    'Telefone e data de nascimento: só você e os líderes das células das quais você participa. O aniversário aparece para a célula apenas como dia e mês, e você pode desativar.',
    'Conteúdo da célula (mural, fórum, endereço): somente membros aprovados.',
    'Pedidos de oração: conforme a visibilidade que você escolher (todos, célula ou só líderes).']],
  ['Dados religiosos', 'Pela LGPD, a convicção religiosa é um dado sensível. Ao criar a conta você consente com o tratamento desse dado para a finalidade do app. Você pode retirar o consentimento excluindo sua conta.'],
  ['Pagamentos', 'Os pagamentos são processados pelo Mercado Pago. Não armazenamos dados do seu cartão.'],
  ['Onde ficam os dados', 'Em servidores do Supabase, com acesso protegido por regras de segurança por usuário.'],
  ['Seus direitos', 'Você pode acessar, corrigir e excluir seus dados a qualquer momento (Eu → Editar perfil / Excluir minha conta) ou pedir pelo e-mail ' + CONFIG.SUPPORT_EMAIL + '.'],
]);
