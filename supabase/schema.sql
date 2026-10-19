-- Treinos: banco no Supabase (plano gratuito).
-- Rode este arquivo inteiro no SQL Editor do projeto (Database → SQL Editor → New query → Run).
-- Pode rodar de novo sem quebrar nada: tudo usa "if not exists" / "or replace" / "on conflict".
--
-- Tudo fica no schema "treinos", separado do "public": o app divide o projeto do Supabase com o painel de
-- Criativos (o plano grátis só permite 2 projetos ativos). Nada aqui toca nas tabelas ou funções do public.
-- O login (auth.users) é o mesmo do projeto, mas o acesso ao Treinos depende só da tabela treinos.membros.
-- Depois de rodar: Project Settings → Data API → Exposed schemas → adicionar "treinos" (senão o app não enxerga).
--
-- Papéis (tabela "membros", pelo e-mail da conta já confirmado):
--  - admin: vê e mexe em tudo, cadastra personais;
--  - personal: monta treinos e acompanha SÓ os alunos dele (membros.personal = e-mail do personal);
--  - aluno: vê só os próprios treinos e registra as próprias sessões.
-- Quem só criou conta, sem ter sido cadastrado, não vê nada.

create schema if not exists treinos;
grant usage on schema treinos to authenticated, service_role;
revoke all on schema treinos from anon;

-- ---------- Pessoas ----------
create table if not exists treinos.membros (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  nome text not null default '' check (length(nome) <= 80),
  papel text not null default 'aluno' check (papel in ('admin', 'personal', 'aluno')),
  personal text references treinos.membros (email) on update cascade on delete set null,
  objetivo text not null default '' check (length(objetivo) <= 200),
  notas text not null default '' check (length(notas) <= 4000),
  telefone text not null default '' check (length(telefone) <= 30),
  criado_em timestamptz not null default now()
);
create index if not exists membros_personal_idx on treinos.membros (personal);

create or replace function treinos.email_atual() returns text
language sql stable set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function treinos.meu_papel() returns text
language sql stable security definer set search_path = '' as $$
  select m.papel from treinos.membros m where m.email = treinos.email_atual();
$$;

create or replace function treinos.eh_membro() returns boolean
language sql stable security definer set search_path = '' as $$
  select treinos.meu_papel() is not null;
$$;

create or replace function treinos.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(treinos.meu_papel() = 'admin', false);
$$;

-- Quem monta treino: admin ou personal.
create or replace function treinos.eh_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(treinos.meu_papel() in ('admin', 'personal'), false);
$$;

-- O personal de quem está logado (para o aluno ver o nome de quem cuida dele).
create or replace function treinos.meu_personal() returns text
language sql stable security definer set search_path = '' as $$
  select m.personal from treinos.membros m where m.email = treinos.email_atual();
$$;

-- Pode ver os treinos e o histórico desse aluno: o próprio aluno, o personal dele ou um admin.
create or replace function treinos.pode_ver_aluno(p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_email = treinos.email_atual()
      or treinos.eh_admin()
      or (treinos.eh_staff() and exists (
            select 1 from treinos.membros m where m.email = p_email and m.personal = treinos.email_atual()));
$$;

-- Permissão explícita (funciona mesmo com "Automatically expose new tables" desligado no projeto).
revoke execute on function treinos.email_atual(), treinos.meu_papel(), treinos.eh_membro(), treinos.eh_admin(),
  treinos.eh_staff(), treinos.meu_personal(), treinos.pode_ver_aluno(text) from public, anon;
grant execute on function treinos.email_atual(), treinos.meu_papel(), treinos.eh_membro(), treinos.eh_admin(),
  treinos.eh_staff(), treinos.meu_personal(), treinos.pode_ver_aluno(text) to authenticated;

create or replace function treinos.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------- Biblioteca de exercícios (com vídeo de demonstração por link) ----------
create table if not exists treinos.exercicios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(nome) between 1 and 120),
  grupo text not null default 'corpo'
    check (grupo in ('peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco', 'quadriceps', 'posterior',
                     'gluteos', 'panturrilha', 'abdomen', 'cardio', 'mobilidade', 'corpo')),
  equipamento text not null default '' check (length(equipamento) <= 60),
  video_url text not null default '' check (video_url = '' or (video_url ~* '^https://' and length(video_url) <= 500)),
  instrucoes text not null default '' check (length(instrucoes) <= 4000),
  criado_por text default treinos.email_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists exercicios_grupo_idx on treinos.exercicios (grupo);
drop trigger if exists exercicios_atualizado_em on treinos.exercicios;
create trigger exercicios_atualizado_em before update on treinos.exercicios
  for each row execute function treinos.tocar_atualizado_em();

-- ---------- Treinos (fichas). aluno vazio = modelo do personal, para copiar para vários alunos ----------
-- itens: [{ id, exercicio_id, series, reps, carga, descanso_s, obs }]
create table if not exists treinos.treinos (
  id uuid primary key default gen_random_uuid(),
  aluno text references treinos.membros (email) on update cascade on delete cascade,
  nome text not null check (length(nome) between 1 and 80),
  observacoes text not null default '' check (length(observacoes) <= 4000),
  ordem integer not null default 0,
  ativo boolean not null default true,
  validade date,
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array'),
  criado_por text default treinos.email_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists treinos_aluno_idx on treinos.treinos (aluno, ordem);
drop trigger if exists treinos_atualizado_em on treinos.treinos;
create trigger treinos_atualizado_em before update on treinos.treinos
  for each row execute function treinos.tocar_atualizado_em();

-- ---------- Sessões (cada vez que o aluno faz um treino) ----------
-- registros: [{ item_id, exercicio_id, nome, grupo, reps_alvo, descanso_s, series: [{ carga, reps, feita, em }] }]
-- O id vem do aparelho: a sessão feita sem internet é reenviada depois sem duplicar.
create table if not exists treinos.sessoes (
  id uuid primary key default gen_random_uuid(),
  aluno text not null default treinos.email_atual() references treinos.membros (email) on update cascade on delete cascade,
  treino_id uuid references treinos.treinos (id) on delete set null,
  nome_treino text not null default '' check (length(nome_treino) <= 80),
  inicio timestamptz not null,
  fim timestamptz not null,
  duracao_s integer not null default 0 check (duracao_s >= 0),
  registros jsonb not null default '[]'::jsonb check (jsonb_typeof(registros) = 'array'),
  series_feitas integer not null default 0 check (series_feitas >= 0),
  volume_kg numeric(12, 2) not null default 0 check (volume_kg >= 0),
  esforco smallint check (esforco between 1 and 5),
  nota text not null default '' check (length(nota) <= 2000),
  comentario_personal text not null default '' check (length(comentario_personal) <= 2000),
  criado_em timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists sessoes_aluno_idx on treinos.sessoes (aluno, inicio desc);
create index if not exists sessoes_inicio_idx on treinos.sessoes (inicio);

-- O aluno não escreve o comentário do personal (nem o personal muda o que o aluno anotou).
create or replace function treinos.proteger_sessao() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not treinos.eh_staff() then
    new.comentario_personal := coalesce(old.comentario_personal, '');
  elsif new.aluno <> treinos.email_atual() then
    new.nota := old.nota;
    new.esforco := old.esforco;
    new.registros := old.registros;
  end if;
  return new;
end;
$$;
drop trigger if exists sessoes_proteger on treinos.sessoes;
create trigger sessoes_proteger before update on treinos.sessoes
  for each row execute function treinos.proteger_sessao();

-- ---------- Permissões (RLS) ----------
alter table treinos.membros enable row level security;
alter table treinos.exercicios enable row level security;
alter table treinos.treinos enable row level security;
alter table treinos.sessoes enable row level security;

revoke all on treinos.membros, treinos.exercicios, treinos.treinos, treinos.sessoes from anon;
grant select, insert, update, delete on treinos.membros, treinos.exercicios, treinos.treinos, treinos.sessoes to authenticated;
-- A Edge Function "contas" usa a chave de administrador (service_role) para conferir se o e-mail já está cadastrado.
grant all on treinos.membros, treinos.exercicios, treinos.treinos, treinos.sessoes to service_role;

-- Pessoas: cada um se vê; o aluno vê o próprio personal; o personal vê a equipe e os alunos dele; admin vê todos.
drop policy if exists membros_ler on treinos.membros;
create policy membros_ler on treinos.membros for select to authenticated using (
  email = treinos.email_atual()
  or treinos.eh_admin()
  or (treinos.eh_staff() and (papel <> 'aluno' or personal = treinos.email_atual()))
  or email = treinos.meu_personal()
);
-- Admin cadastra qualquer um; o personal só cadastra/edita/remove aluno dele (não promove ninguém).
drop policy if exists membros_criar on treinos.membros;
create policy membros_criar on treinos.membros for insert to authenticated with check (
  treinos.eh_admin() or (treinos.eh_staff() and papel = 'aluno' and personal = treinos.email_atual())
);
drop policy if exists membros_editar on treinos.membros;
create policy membros_editar on treinos.membros for update to authenticated
  using (treinos.eh_admin() or (treinos.eh_staff() and papel = 'aluno' and personal = treinos.email_atual()))
  with check (treinos.eh_admin() or (treinos.eh_staff() and papel = 'aluno' and personal = treinos.email_atual()));
drop policy if exists membros_apagar on treinos.membros;
create policy membros_apagar on treinos.membros for delete to authenticated
  using (treinos.eh_admin() or (treinos.eh_staff() and papel = 'aluno' and personal = treinos.email_atual()));

-- Exercícios: todos leem (o aluno precisa do vídeo); só admin/personal mexem.
drop policy if exists exercicios_ler on treinos.exercicios;
create policy exercicios_ler on treinos.exercicios for select to authenticated using (treinos.eh_membro());
drop policy if exists exercicios_gravar on treinos.exercicios;
create policy exercicios_gravar on treinos.exercicios for all to authenticated
  using (treinos.eh_staff()) with check (treinos.eh_staff());

-- Treinos: o aluno lê os dele; o personal lê e monta os dos alunos dele e os próprios modelos.
drop policy if exists treinos_ler on treinos.treinos;
create policy treinos_ler on treinos.treinos for select to authenticated using (
  (aluno is null and treinos.eh_staff()) or (aluno is not null and treinos.pode_ver_aluno(aluno))
);
drop policy if exists treinos_gravar on treinos.treinos;
create policy treinos_gravar on treinos.treinos for all to authenticated
  using (treinos.eh_staff() and (aluno is null or treinos.pode_ver_aluno(aluno)))
  with check (treinos.eh_staff() and (aluno is null or treinos.pode_ver_aluno(aluno)));

-- Sessões: o aluno registra as dele; o personal acompanha (e comenta) as dos alunos dele.
drop policy if exists sessoes_ler on treinos.sessoes;
create policy sessoes_ler on treinos.sessoes for select to authenticated using (treinos.pode_ver_aluno(aluno));
drop policy if exists sessoes_criar on treinos.sessoes;
create policy sessoes_criar on treinos.sessoes for insert to authenticated with check (
  (aluno = treinos.email_atual() and treinos.eh_membro()) or (treinos.eh_staff() and treinos.pode_ver_aluno(aluno))
);
drop policy if exists sessoes_editar on treinos.sessoes;
create policy sessoes_editar on treinos.sessoes for update to authenticated
  using ((aluno = treinos.email_atual() and treinos.eh_membro()) or (treinos.eh_staff() and treinos.pode_ver_aluno(aluno)))
  with check ((aluno = treinos.email_atual() and treinos.eh_membro()) or (treinos.eh_staff() and treinos.pode_ver_aluno(aluno)));
drop policy if exists sessoes_apagar on treinos.sessoes;
create policy sessoes_apagar on treinos.sessoes for delete to authenticated
  using (aluno = treinos.email_atual() or treinos.eh_admin());

-- ---------- Tempo real (o aluno vê o treino novo na hora; o personal vê quem acabou de treinar) ----------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'treinos' and tablename = 'treinos') then
    alter publication supabase_realtime add table treinos.treinos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'treinos' and tablename = 'sessoes') then
    alter publication supabase_realtime add table treinos.sessoes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'treinos' and tablename = 'exercicios') then
    alter publication supabase_realtime add table treinos.exercicios;
  end if;
end $$;

-- ---------- Biblioteca inicial (só entra se a tabela estiver vazia) ----------
-- O vídeo é um link do YouTube ou do Vimeo; troque ou complete pelo app, em Exercícios.
insert into treinos.exercicios (nome, grupo, equipamento, instrucoes, video_url, criado_por)
select v.nome, v.grupo, v.equipamento, v.instrucoes, v.video_url, 'biblioteca'
  from (values
-- BIBLIOTECA (gerado de js/biblioteca.js por: node scripts/biblioteca-sql.mjs)
    ('Supino reto com barra', 'peito', 'Barra e banco', 'Deitado, pés firmes no chão e escápulas encaixadas. Desça a barra controlando até a linha do peito, cotovelos a uns 45° do tronco, e empurre sem tirar o quadril do banco.', 'https://www.youtube.com/watch?v=EZMYCLKuGow'),
    ('Supino inclinado com halteres', 'peito', 'Halteres e banco inclinado', 'Banco entre 30° e 45°. Desça os halteres ao lado do peito com os punhos alinhados aos cotovelos e suba aproximando-os, sem bater um no outro.', 'https://www.youtube.com/watch?v=RGeSgQmO1EU'),
    ('Crucifixo na máquina (peck deck)', 'peito', 'Máquina', 'Ajuste o banco para as mãos ficarem na altura do peito. Feche os braços com os cotovelos levemente flexionados e volte devagar até sentir o peito alongar.', 'https://www.youtube.com/watch?v=FzCnfD0gOXo'),
    ('Flexão de braço', 'peito', 'Peso corporal', 'Mãos um pouco além da largura dos ombros, corpo em linha reta do calcanhar à cabeça. Desça até o peito quase tocar o chão e empurre sem deixar o quadril cair.', ''),
    ('Crossover no cabo', 'peito', 'Polia', 'Polias altas, um pé à frente. Traga as mãos para baixo e para a frente, cruzando à frente do quadril, e volte controlando.', ''),
    ('Puxada frontal (pulldown)', 'costas', 'Polia alta', 'Pegada um pouco além dos ombros. Puxe a barra até a parte de cima do peito levando os cotovelos para baixo, peito aberto, sem jogar o tronco para trás.', 'https://www.youtube.com/watch?v=7cCiQUdIXWw'),
    ('Puxada neutra', 'costas', 'Polia alta e triângulo', 'Pegada neutra (palmas viradas uma para a outra). Puxe até a parte de cima do peito levando os cotovelos para baixo e junto ao corpo, sem jogar o tronco para trás.', ''),
    ('Remada baixa no cabo', 'costas', 'Polia baixa', 'Coluna neutra e joelhos levemente flexionados. Puxe o triângulo até o abdômen juntando as escápulas e volte estendendo os braços sem arredondar as costas.', 'https://www.youtube.com/watch?v=f8AVh4VBbos'),
    ('Remada curvada com barra', 'costas', 'Barra', 'Tronco inclinado à frente, coluna neutra, joelhos destravados. Puxe a barra em direção ao umbigo e desça controlando.', 'https://www.youtube.com/watch?v=mxvS-iwm53o'),
    ('Remada unilateral com halter (serrote)', 'costas', 'Halter e banco', 'Joelho e mão apoiados no banco, costas retas. Puxe o halter em direção ao quadril, cotovelo junto ao corpo, e desça até estender o braço.', ''),
    ('Barra fixa', 'costas', 'Barra fixa', 'Pendurado com pegada pronada, puxe até o queixo passar a barra, sem balançar. Desça até estender os braços.', ''),
    ('Levantamento terra', 'costas', 'Barra', 'Barra encostada na canela, coluna neutra e abdômen firme. Empurre o chão com as pernas e estenda o quadril mantendo a barra rente ao corpo. Desça pelo mesmo caminho.', 'https://www.youtube.com/watch?v=50AkPBZwACQ'),
    ('Desenvolvimento com halteres', 'ombros', 'Halteres e banco', 'Sentado com as costas apoiadas, halteres na altura das orelhas. Empurre para cima sem arquear a lombar e desça até os cotovelos ficarem um pouco abaixo dos ombros.', 'https://www.youtube.com/watch?v=eufDL9MmF8A'),
    ('Desenvolvimento na máquina', 'ombros', 'Máquina', 'Ajuste o banco para as pegadas ficarem na altura dos ombros. Empurre para cima sem travar os cotovelos e sem tirar as costas do encosto; desça controlando.', ''),
    ('Elevação lateral', 'ombros', 'Halteres', 'Cotovelos levemente flexionados. Eleve os braços pelas laterais até a altura dos ombros, sem impulso do tronco, e desça devagar.', 'https://www.youtube.com/watch?v=ulVCkRXXuWQ'),
    ('Elevação lateral unilateral na polia', 'ombros', 'Polia baixa', 'De lado para a polia, segure o cabo com a mão do lado oposto. Eleve o braço pela lateral até a altura do ombro, cotovelo levemente flexionado, e desça devagar. Faça um lado e troque.', ''),
    ('Elevação frontal', 'ombros', 'Halteres ou anilha', 'Eleve os braços à frente até a altura dos ombros, sem balançar o corpo, e desça controlando.', ''),
    ('Crucifixo inverso na máquina', 'ombros', 'Máquina', 'De frente para a máquina, abra os braços para trás com os cotovelos levemente flexionados, focando na parte de trás do ombro.', ''),
    ('Face pull', 'ombros', 'Polia alta e corda', 'Corda na altura do rosto. Puxe em direção à testa abrindo as mãos e levando os cotovelos para trás e para cima, juntando as escápulas. Volte controlando.', ''),
    ('Encolhimento', 'ombros', 'Halteres ou barra', 'Em pé, braços estendidos ao lado do corpo. Suba os ombros em direção às orelhas sem dobrar os cotovelos, segure um instante e desça devagar, sem girar os ombros.', ''),
    ('Rosca direta com barra', 'biceps', 'Barra', 'Cotovelos colados ao corpo. Suba a barra flexionando só o cotovelo, sem jogar o tronco, e desça até quase estender.', 'https://www.youtube.com/watch?v=Q8TqfD8E7BU'),
    ('Rosca alternada com halteres', 'biceps', 'Halteres', 'Um braço de cada vez, girando o punho para cima durante a subida. Cotovelo parado ao lado do corpo.', ''),
    ('Rosca martelo', 'biceps', 'Halteres', 'Pegada neutra (palmas viradas uma para a outra). Suba sem girar o punho e sem afastar o cotovelo do corpo.', 'https://www.youtube.com/watch?v=OnNmaG_tZM4'),
    ('Rosca Scott', 'biceps', 'Banco Scott', 'Braços apoiados no banco. Suba a barra e desça devagar até quase estender, sem tirar o cotovelo do apoio.', ''),
    ('Tríceps na polia com corda', 'triceps', 'Polia alta', 'Cotovelos colados ao corpo. Estenda os braços para baixo abrindo a corda no final e volte só até o antebraço passar da horizontal.', 'https://www.youtube.com/watch?v=KhK5HWJfsrQ'),
    ('Tríceps testa', 'triceps', 'Barra W e banco', 'Deitado, braços apontando para o teto. Desça a barra em direção à testa flexionando só o cotovelo e estenda de volta.', 'https://www.youtube.com/watch?v=zznCYBVZOVA'),
    ('Tríceps francês com halter', 'triceps', 'Halter', 'Halter seguro com as duas mãos atrás da cabeça. Estenda os braços para cima mantendo os cotovelos apontados para a frente.', ''),
    ('Tríceps francês unilateral', 'triceps', 'Halter', 'Halter em uma mão atrás da cabeça. Estenda o braço para cima mantendo o cotovelo apontado para a frente e perto da cabeça. Faça todas as repetições de um lado e troque.', ''),
    ('Mergulho no banco', 'triceps', 'Banco', 'Mãos no banco atrás do corpo. Desça flexionando os cotovelos até uns 90° e empurre de volta, com as costas perto do banco.', ''),
    ('Agachamento livre', 'quadriceps', 'Barra e rack', 'Pés na largura dos ombros, barra apoiada no trapézio. Desça sentando para trás, joelhos na direção dos pés e coluna neutra, até onde mantiver a postura. Suba empurrando o chão.', 'https://www.youtube.com/watch?v=s7i94Okznns'),
    ('Leg press 45°', 'quadriceps', 'Máquina', 'Lombar e quadril apoiados o tempo todo. Desça a plataforma até uns 90° nos joelhos e empurre sem travar os joelhos no final.', 'https://www.youtube.com/watch?v=VZqwnwcqNe8'),
    ('Cadeira extensora', 'quadriceps', 'Máquina', 'Joelho alinhado ao eixo da máquina. Estenda as pernas, segure um instante em cima e desça devagar.', 'https://www.youtube.com/watch?v=el3oHblB5DM'),
    ('Afundo com halteres', 'quadriceps', 'Halteres', 'Um passo largo à frente. Desça até os dois joelhos ficarem perto de 90°, tronco reto, e volte empurrando com a perna da frente.', ''),
    ('Agachamento búlgaro', 'quadriceps', 'Banco e halteres', 'Pé de trás apoiado no banco. Desça na vertical até a coxa da frente ficar paralela ao chão e suba empurrando com o calcanhar da frente.', ''),
    ('Mesa flexora', 'posterior', 'Máquina', 'Deitado de bruços, quadril colado no banco. Flexione os joelhos trazendo o rolo em direção ao glúteo e desça devagar.', 'https://www.youtube.com/watch?v=2-ULaRrQa7c'),
    ('Cadeira flexora', 'posterior', 'Máquina', 'Sentado, joelho alinhado ao eixo. Flexione as pernas puxando o rolo para baixo e volte controlando.', ''),
    ('Stiff com barra', 'posterior', 'Barra', 'Joelhos levemente flexionados e fixos. Desça a barra rente às pernas levando o quadril para trás, coluna neutra, até sentir o posterior alongar. Suba estendendo o quadril.', 'https://www.youtube.com/watch?v=b5f-gnHBRvY'),
    ('Elevação pélvica (hip thrust)', 'gluteos', 'Barra e banco', 'Costas apoiadas no banco, barra sobre o quadril. Suba o quadril até o tronco ficar alinhado às coxas, contraia o glúteo em cima e desça.', 'https://www.youtube.com/watch?v=wpN_gUfSXTg'),
    ('Cadeira abdutora', 'gluteos', 'Máquina', 'Abra as pernas contra a resistência sem tirar o quadril do banco e volte devagar.', ''),
    ('Glúteo no cabo (coice)', 'gluteos', 'Polia baixa', 'Tornozeleira presa à polia. Leve a perna para trás estendendo o quadril, sem arquear a lombar.', ''),
    ('Panturrilha em pé', 'panturrilha', 'Máquina ou degrau', 'Ponta dos pés no apoio. Suba o máximo que conseguir, segure um instante e desça até alongar bem.', 'https://www.youtube.com/watch?v=of5Z7yj-HqY'),
    ('Panturrilha sentado', 'panturrilha', 'Máquina', 'Joelhos a 90° sob o apoio. Suba os calcanhares o máximo e desça devagar até alongar.', ''),
    ('Prancha', 'abdomen', 'Peso corporal', 'Apoio nos antebraços e pontas dos pés, corpo em linha reta. Contraia abdômen e glúteos e mantenha o tempo pedido sem deixar o quadril cair. Nas reps, anote os segundos.', 'https://www.youtube.com/watch?v=qNRqGqESAWU'),
    ('Abdominal supra (crunch)', 'abdomen', 'Peso corporal', 'Deitado, joelhos flexionados. Tire as escápulas do chão contraindo o abdômen, sem puxar o pescoço com as mãos.', 'https://www.youtube.com/watch?v=fR_KzGyKW3w'),
    ('Elevação de pernas', 'abdomen', 'Banco ou barra fixa', 'Eleve as pernas até uns 90° do tronco e desça devagar, sem deixar a lombar descolar (no banco) ou sem balançar (na barra).', ''),
    ('Abdominal na polia', 'abdomen', 'Polia alta e corda', 'Ajoelhado, corda junto à cabeça. Flexione o tronco levando os cotovelos em direção aos joelhos e volte devagar.', ''),
    ('Esteira', 'cardio', 'Esteira', 'Use as reps como minutos. Comece com 5 minutos de caminhada e ajuste velocidade e inclinação conforme a ficha.', ''),
    ('Bicicleta ergométrica', 'cardio', 'Bicicleta', 'Banco na altura do quadril, joelho quase estendido no ponto mais baixo. Use as reps como minutos.', ''),
    ('Corda naval', 'cardio', 'Corda naval', 'Joelhos semiflexionados, ondas alternadas e rápidas com os braços. Use as reps como segundos.', ''),
    ('Alongamento de posterior', 'mobilidade', '', 'Perna estendida apoiada, incline o tronco à frente com a coluna reta até sentir alongar. Use as reps como segundos.', '')
-- /BIBLIOTECA
  ) as v (nome, grupo, equipamento, instrucoes, video_url)
 where not exists (select 1 from treinos.exercicios);

-- ---------- Primeiro admin ----------
-- Troque pelo e-mail de quem administra (os personais e alunos são cadastrados pelo próprio app).
insert into treinos.membros (email, nome, papel) values ('mateus.dpaula10@gmail.com', 'Mateus', 'admin')
on conflict (email) do nothing;
