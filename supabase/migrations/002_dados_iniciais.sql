-- =====================================================================
-- CONEC CÉLULA — dados iniciais: versículos do dia e planos de leitura
-- Rode DEPOIS do 001_estrutura.sql
-- Texto bíblico baseado na tradução de João Ferreira de Almeida (domínio público).
-- Você pode acrescentar quantos versículos quiser nesta tabela.
-- =====================================================================

insert into public.daily_verses (ref, text) values
('João 3:16', 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.'),
('Salmos 23:1', 'O Senhor é o meu pastor; nada me faltará.'),
('Filipenses 4:13', 'Posso todas as coisas naquele que me fortalece.'),
('Isaías 41:10', 'Não temas, porque eu sou contigo; não te assombres, porque eu sou teu Deus; eu te fortaleço, e te ajudo, e te sustento com a destra da minha justiça.'),
('Mateus 11:28', 'Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.'),
('Romanos 8:28', 'E sabemos que todas as coisas contribuem juntamente para o bem daqueles que amam a Deus.'),
('Provérbios 3:5', 'Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.'),
('Josué 1:9', 'Esforça-te, e tem bom ânimo; não temas, nem te espantes; porque o Senhor teu Deus é contigo, por onde quer que andares.'),
('Salmos 46:1', 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.'),
('Jeremias 29:11', 'Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais.'),
('Mateus 6:33', 'Mas buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas.'),
('1 Pedro 5:7', 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.'),
('Salmos 119:105', 'Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho.'),
('João 14:6', 'Disse-lhe Jesus: Eu sou o caminho, e a verdade, e a vida; ninguém vem ao Pai, senão por mim.'),
('Gálatas 5:22', 'Mas o fruto do Espírito é: amor, gozo, paz, longanimidade, benignidade, bondade, fé, mansidão, temperança.'),
('Hebreus 11:1', 'Ora, a fé é o firme fundamento das coisas que se esperam, e a prova das coisas que se não veem.'),
('Salmos 37:5', 'Entrega o teu caminho ao Senhor; confia nele, e ele tudo fará.'),
('Isaías 40:31', 'Mas os que esperam no Senhor renovarão as suas forças; subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.'),
('Romanos 12:2', 'E não vos conformeis com este mundo, mas transformai-vos pela renovação do vosso entendimento.'),
('1 Tessalonicenses 5:17', 'Orai sem cessar.'),
('Filipenses 4:6', 'Não estejais inquietos por coisa alguma; antes as vossas petições sejam em tudo conhecidas diante de Deus pela oração e súplica, com ação de graças.'),
('Tiago 5:16', 'Confessai as vossas culpas uns aos outros, e orai uns pelos outros, para que sareis. A oração feita por um justo pode muito em seus efeitos.'),
('Mateus 18:20', 'Porque, onde estiverem dois ou três reunidos em meu nome, aí estou eu no meio deles.'),
('Atos 2:46', 'E, perseverando unânimes todos os dias no templo, e partindo o pão em casa, comiam juntos com alegria e singeleza de coração.'),
('Hebreus 10:24', 'E consideremo-nos uns aos outros, para nos estimularmos ao amor e às boas obras.'),
('João 15:5', 'Eu sou a videira, vós as varas; quem está em mim, e eu nele, este dá muito fruto; porque sem mim nada podeis fazer.'),
('1 João 4:19', 'Nós o amamos a ele porque ele nos amou primeiro.'),
('Salmos 133:1', 'Oh! quão bom e quão suave é que os irmãos vivam em união.'),
('Eclesiastes 4:9', 'Melhor é serem dois do que um, porque têm melhor paga do seu trabalho.'),
('Colossenses 3:23', 'E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.'),
('Salmos 91:1', 'Aquele que habita no esconderijo do Altíssimo, à sombra do Onipotente descansará.'),
('Lamentações 3:22', 'As misericórdias do Senhor são a causa de não sermos consumidos, porque as suas misericórdias não têm fim.'),
('2 Coríntios 5:17', 'Assim que, se alguém está em Cristo, nova criatura é: as coisas velhas já passaram; eis que tudo se fez novo.'),
('Efésios 2:8', 'Porque pela graça sois salvos, por meio da fé; e isto não vem de vós, é dom de Deus.'),
('Miqueias 6:8', 'Ele te declarou, ó homem, o que é bom; e que é o que o Senhor pede de ti, senão que pratiques a justiça, e ames a beneficência, e andes humildemente com o teu Deus?'),
('Salmos 121:1-2', 'Levantarei os meus olhos para os montes, de onde vem o meu socorro. O meu socorro vem do Senhor, que fez o céu e a terra.'),
('Mateus 5:16', 'Assim resplandeça a vossa luz diante dos homens, para que vejam as vossas boas obras e glorifiquem o vosso Pai, que está nos céus.'),
('Romanos 15:13', 'Ora, o Deus de esperança vos encha de todo o gozo e paz em crença, para que abundeis em esperança pela virtude do Espírito Santo.'),
('João 16:33', 'No mundo tereis aflições, mas tende bom ânimo, eu venci o mundo.'),
('Salmos 34:8', 'Provai, e vede que o Senhor é bom; bem-aventurado o homem que nele confia.'),
('Provérbios 16:3', 'Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.'),
('Isaías 26:3', 'Tu conservarás em paz aquele cuja mente está firme em ti; porque ele confia em ti.'),
('2 Timóteo 1:7', 'Porque Deus não nos deu o espírito de temor, mas de fortaleza, e de amor, e de moderação.'),
('Salmos 55:22', 'Lança o teu cuidado sobre o Senhor, e ele te susterá.'),
('Mateus 7:7', 'Pedi, e dar-se-vos-á; buscai, e encontrareis; batei, e abrir-se-vos-á.'),
('1 Coríntios 13:4', 'O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.'),
('Romanos 5:8', 'Mas Deus prova o seu amor para conosco, em que Cristo morreu por nós, sendo nós ainda pecadores.'),
('Salmos 27:1', 'O Senhor é a minha luz e a minha salvação; a quem temerei?'),
('Sofonias 3:17', 'O Senhor teu Deus está no meio de ti, poderoso para te salvar; ele se deleitará em ti com alegria.'),
('João 13:35', 'Nisto todos conhecerão que sois meus discípulos, se vos amardes uns aos outros.'),
('Gálatas 6:2', 'Levai as cargas uns dos outros, e assim cumprireis a lei de Cristo.'),
('Salmos 145:18', 'Perto está o Senhor de todos os que o invocam, de todos os que o invocam em verdade.'),
('Jeremias 33:3', 'Clama a mim, e responder-te-ei, e anunciar-te-ei coisas grandes e firmes que não sabes.'),
('Efésios 4:32', 'Antes sede uns para com os outros benignos, misericordiosos, perdoando-vos uns aos outros, como também Deus vos perdoou em Cristo.'),
('Salmos 100:4', 'Entrai pelas portas dele com gratidão, e em seus átrios com louvor; louvai-o, e bendizei o seu nome.'),
('Deuteronômio 31:8', 'O Senhor, pois, é aquele que vai adiante de ti; ele será contigo, não te deixará, nem te desamparará; não temas, nem te espantes.'),
('Marcos 11:24', 'Por isso vos digo que tudo o que pedirdes, orando, crede que o recebereis, e tê-lo-eis.'),
('Salmos 16:11', 'Far-me-ás ver a vereda da vida; na tua presença há abundância de alegrias.'),
('Hebreus 13:8', 'Jesus Cristo é o mesmo, ontem, e hoje, e eternamente.'),
('Apocalipse 3:20', 'Eis que estou à porta, e bato; se alguém ouvir a minha voz, e abrir a porta, entrarei em sua casa, e com ele cearei, e ele comigo.');

-- Planos de leitura -----------------------------------------------------
do $$
declare pid uuid;
begin
  -- João em 21 dias (grátis)
  insert into public.reading_plans (title, description, is_premium)
  values ('João em 21 dias', 'Um capítulo por dia do Evangelho de João. Ótimo para ler junto com a célula.', false)
  returning id into pid;
  insert into public.reading_plan_days (plan_id, day, refs)
  select pid, d, 'João ' || d from generate_series(1, 21) d;

  -- Atos em 28 dias (grátis) — a igreja nas casas
  insert into public.reading_plans (title, description, is_premium)
  values ('Atos em 28 dias', 'A igreja primitiva, que se reunia de casa em casa.', false)
  returning id into pid;
  insert into public.reading_plan_days (plan_id, day, refs)
  select pid, d, 'Atos ' || d from generate_series(1, 28) d;

  -- Provérbios em 31 dias (premium)
  insert into public.reading_plans (title, description, is_premium)
  values ('Provérbios em 31 dias', 'Um capítulo de sabedoria para cada dia do mês.', true)
  returning id into pid;
  insert into public.reading_plan_days (plan_id, day, refs)
  select pid, d, 'Provérbios ' || d from generate_series(1, 31) d;

  -- Salmos em 50 dias (premium)
  insert into public.reading_plans (title, description, is_premium)
  values ('Salmos em 50 dias', 'Três salmos por dia para uma vida de oração.', true)
  returning id into pid;
  insert into public.reading_plan_days (plan_id, day, refs)
  select pid, d, 'Salmos ' || ((d-1)*3+1) || '–' || (d*3) from generate_series(1, 50) d;

  -- Novo Testamento em 260 dias (premium)
  insert into public.reading_plans (title, description, is_premium)
  values ('Novo Testamento em 260 dias', 'Um capítulo por dia, de segunda a sexta, por um ano.', true)
  returning id into pid;
  insert into public.reading_plan_days (plan_id, day, refs)
  select pid, row_number() over (order by ord, c), b || ' ' || c
  from (
    select b, c, ord from (values
      ('Mateus',28,1),('Marcos',16,2),('Lucas',24,3),('João',21,4),('Atos',28,5),('Romanos',16,6),
      ('1 Coríntios',16,7),('2 Coríntios',13,8),('Gálatas',6,9),('Efésios',6,10),('Filipenses',4,11),
      ('Colossenses',4,12),('1 Tessalonicenses',5,13),('2 Tessalonicenses',3,14),('1 Timóteo',6,15),
      ('2 Timóteo',4,16),('Tito',3,17),('Filemom',1,18),('Hebreus',13,19),('Tiago',5,20),('1 Pedro',5,21),
      ('2 Pedro',3,22),('1 João',5,23),('2 João',1,24),('3 João',1,25),('Judas',1,26),('Apocalipse',22,27)
    ) as books(b, n, ord), generate_series(1, books.n) c
  ) x;
end $$;
