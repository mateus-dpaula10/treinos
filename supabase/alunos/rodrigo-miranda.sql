-- Fichas do Rodrigo Miranda (A, B, C, D) para o banco do Supabase.
-- 1. Cadastre o Rodrigo pelo app (Alunos → Novo aluno): é isso que cria o login dele.
-- 2. Troque o e-mail em v_aluno abaixo e rode este arquivo no SQL Editor.
-- Rodar de novo não duplica: se ele já tiver uma ficha com o mesmo nome, ela é pulada.
-- Descanso: 60 s em tudo (não veio no treino passado); ajuste pelo app, na ficha.
do $$
declare
  v_aluno text := 'TROQUE-PELO-EMAIL-DO-RODRIGO';
  v_faltando text;
begin
  if not exists (select 1 from treinos.membros where email = v_aluno and papel = 'aluno') then
    raise exception 'Cadastre o aluno % pelo app antes (Alunos → Novo aluno).', v_aluno;
  end if;

  create temp table fichas_rodrigo (letra text, nome text, ordem int) on commit drop;
  insert into fichas_rodrigo values
    ('A', 'Treino A · Peito e tríceps', 0),
    ('B', 'Treino B · Costas e bíceps', 1),
    ('C', 'Treino C · Ombros', 2),
    ('D', 'Treino D · Pernas', 3);

  create temp table itens_rodrigo (letra text, pos int, exercicio text, reps text, obs text) on commit drop;
  insert into itens_rodrigo values
    ('A', 1, 'Supino reto com barra', '8', ''),
    ('A', 2, 'Supino inclinado com halteres', '8', ''),
    ('A', 3, 'Crossover no cabo', '8', ''),
    ('A', 4, 'Crucifixo na máquina (peck deck)', '8', ''),
    ('A', 5, 'Tríceps testa', '8', ''),
    ('A', 6, 'Tríceps na polia com corda', '8', ''),
    ('A', 7, 'Tríceps francês unilateral', '8', ''),
    ('B', 1, 'Puxada frontal (pulldown)', '8', 'Pegada aberta.'),
    ('B', 2, 'Remada curvada com barra', '8', ''),
    ('B', 3, 'Remada baixa no cabo', '8', ''),
    ('B', 4, 'Puxada neutra', '8', ''),
    ('B', 5, 'Rosca direta com barra', '8', ''),
    ('B', 6, 'Rosca alternada com halteres', '8', ''),
    ('B', 7, 'Rosca martelo', '8', ''),
    ('C', 1, 'Desenvolvimento com halteres', '8', ''),
    ('C', 2, 'Desenvolvimento na máquina', '8', ''),
    ('C', 3, 'Elevação lateral', '8', ''),
    ('C', 4, 'Elevação lateral unilateral na polia', '8', ''),
    ('C', 5, 'Crucifixo inverso na máquina', '8', ''),
    ('C', 6, 'Face pull', '8', ''),
    ('C', 7, 'Encolhimento', '8', ''),
    ('D', 1, 'Agachamento livre', '8', ''),
    ('D', 2, 'Leg press 45°', '10', ''),
    ('D', 3, 'Cadeira extensora', '12', ''),
    ('D', 4, 'Stiff com barra', '8', ''),
    ('D', 5, 'Mesa flexora', '10', ''),
    ('D', 6, 'Panturrilha em pé', '12', ''),
    ('D', 7, 'Panturrilha sentado', '15', '');

  -- Todo exercício precisa existir na biblioteca (pelo nome exato).
  select string_agg(distinct i.exercicio, ', ') into v_faltando
    from itens_rodrigo i left join treinos.exercicios e on e.nome = i.exercicio
   where e.id is null;
  if v_faltando is not null then
    raise exception 'Faltam na biblioteca (Exercícios no app): %', v_faltando;
  end if;

  insert into treinos.treinos (aluno, nome, ordem, ativo, observacoes, itens, criado_por)
  select v_aluno, f.nome, f.ordem, true, '',
         (select jsonb_agg(jsonb_build_object(
                    'id', gen_random_uuid(), 'exercicio_id', e.id, 'series', 4, 'reps', i.reps,
                    'carga', '', 'descanso_s', 60, 'obs', i.obs) order by i.pos)
            from itens_rodrigo i
            join lateral (select x.id from treinos.exercicios x where x.nome = i.exercicio order by x.criado_em limit 1) e on true
           where i.letra = f.letra),
         'importado'
    from fichas_rodrigo f
   where not exists (select 1 from treinos.treinos t where t.aluno = v_aluno and t.nome = f.nome);
end $$;
