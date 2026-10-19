// Testes das regras puras: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  embedVideo, fonteVideo, lerInicio, fmtCronometro, fmtDescanso, restante, repsAlvo, resumoTreino, proximoTreino, ultimaVez,
  textoSeries, novaSessao, proximaSerie, resumoSessao, marcarSerie, sessaoParaLinha, diasDesde, diasTreinados,
  evolucao, progressoCargas, copiarItens, fichasDoAluno, fmtKg, fmtDuracao,
} from '../js/domain.js';
import { BIBLIOTECA } from '../js/biblioteca.js';

test('vídeo do YouTube em todos os formatos de link', () => {
  const id = 'EZMYCLKuGow';
  for (const url of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&list=PL123&index=2`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube.com/live/${id}`,
  ]) {
    const v = embedVideo(url);
    assert.equal(v?.tipo, 'youtube', url);
    assert.equal(v.id, id, url);
    assert.ok(v.embed.startsWith(`https://www.youtube-nocookie.com/embed/${id}?`), url);
    assert.equal(v.vertical, false);
  }
  const short = embedVideo(`https://youtube.com/shorts/${id}`);
  assert.equal(short.vertical, true);
  assert.match(embedVideo(`https://youtu.be/${id}?t=1m30s`).embed, /start=90/);
  assert.match(embedVideo(`https://www.youtube.com/watch?v=${id}&t=45`).embed, /start=45/);
  assert.equal(embedVideo('https://www.youtube.com/watch?v=curto'), null, 'id inválido');
  assert.equal(embedVideo('https://www.youtube.com/@canal'), null);
});

test('vídeo do Vimeo (público e não listado) e links que não tocam no app', () => {
  assert.equal(embedVideo('https://vimeo.com/76979871').embed, 'https://player.vimeo.com/video/76979871?dnt=1&playsinline=1');
  assert.match(embedVideo('https://vimeo.com/76979871/abc123def4').embed, /h=abc123def4/);
  assert.equal(embedVideo('https://player.vimeo.com/video/76979871?h=ff00ff').id, '76979871');
  assert.equal(embedVideo('https://www.instagram.com/reel/abc/'), null);
  assert.equal(embedVideo('javascript:alert(1)'), null);
  assert.equal(embedVideo(''), null);
  assert.equal(embedVideo('não é link'), null);
});

test('GIF, imagem e MP4 direto (animação de boneco)', () => {
  const g = embedVideo('https://exemplo.com/anim/supino.gif');
  assert.equal(g.tipo, 'imagem');
  assert.equal(g.src, 'https://exemplo.com/anim/supino.gif');
  assert.equal(g.thumb, g.src, 'o próprio GIF serve de miniatura');
  assert.equal(g.embed, null);
  assert.equal(embedVideo('https://cdn.x.com/a/b.WEBP?v=2').tipo, 'imagem', 'extensão sem diferenciar maiúscula, com query');
  const m = embedVideo('https://exemplo.com/remada.mp4');
  assert.equal(m.tipo, 'arquivo');
  assert.equal(m.thumb, null);
  assert.equal(embedVideo('https://exemplo.com/pagina.html'), null);
  assert.equal(fonteVideo(embedVideo('https://youtu.be/EZMYCLKuGow')), 'YouTube');
});

test('tempo inicial do YouTube', () => {
  assert.equal(lerInicio('90'), 90);
  assert.equal(lerInicio('1m30s'), 90);
  assert.equal(lerInicio('1h2m3s'), 3723);
  assert.equal(lerInicio('abc'), 0);
  assert.equal(lerInicio(null), 0);
});

test('cronômetro, descanso e contagem pelo relógio', () => {
  assert.equal(fmtCronometro(0), '0:00');
  assert.equal(fmtCronometro(65.9), '1:05');
  assert.equal(fmtCronometro(3723), '1:02:03');
  assert.equal(fmtCronometro(-5), '0:00');
  assert.equal(fmtDuracao(20), 'menos de 1 min');
  assert.equal(fmtDuracao(2850), '48 min');
  assert.equal(fmtDuracao(3900), '1h05');
  assert.equal(fmtDescanso(45), '45s');
  assert.equal(fmtDescanso(60), '1min');
  assert.equal(fmtDescanso(90), '1min30');
  assert.equal(restante(10_000, 1_000), 9);
  assert.equal(restante(10_000, 9_001), 1, 'arredonda para cima: não mostra 0 antes da hora');
  assert.equal(restante(10_000, 20_000), 0);
});

test('alvo de repetições e resumo da ficha', () => {
  assert.equal(repsAlvo('10-12'), 10);
  assert.equal(repsAlvo('8 a 10'), 8);
  assert.equal(repsAlvo('30 s'), 30);
  assert.equal(repsAlvo('até a falha'), null);
  assert.deepEqual(resumoTreino([{ series: 3, descanso_s: 60 }, { series: 4, descanso_s: 90 }]), { exercicios: 2, series: 7, minutos: 14 });
  assert.deepEqual(resumoTreino([]), { exercicios: 0, series: 0, minutos: 0 });
});

const fichaA = { id: 'A', nome: 'Treino A', ordem: 0, ativo: true, aluno: 'ana@x', itens: [
  { id: 'i1', exercicio_id: 'supino', series: 3, reps: '10-12', carga: '30 kg', descanso_s: 90, obs: 'devagar' },
  { id: 'i2', exercicio_id: 'prancha', series: 2, reps: '30 s', carga: '', descanso_s: 30, obs: '' },
] };
const exercicios = new Map([['supino', { id: 'supino', nome: 'Supino', grupo: 'peito' }], ['prancha', { id: 'prancha', nome: 'Prancha', grupo: 'abdomen' }]]);

test('rodízio de fichas', () => {
  const fichas = [fichaA, { ...fichaA, id: 'B', ordem: 1 }, { ...fichaA, id: 'C', ordem: 2 }];
  assert.equal(proximoTreino(fichas, []).id, 'A');
  assert.equal(proximoTreino(fichas, [{ treino_id: 'A', inicio: '2026-10-01T10:00:00Z' }]).id, 'B');
  assert.equal(proximoTreino(fichas, [
    { treino_id: 'B', inicio: '2026-10-02T10:00:00Z' }, { treino_id: 'C', inicio: '2026-10-03T10:00:00Z' },
  ]).id, 'A', 'depois da última volta para a primeira');
  assert.equal(proximoTreino(fichas, [
    { treino_id: 'B', inicio: '2026-10-02T10:00:00Z' }, { treino_id: 'apagada', inicio: '2026-10-05T10:00:00Z' },
  ]).id, 'C', 'ficha apagada não conta');
  assert.equal(proximoTreino([], []), null);
  assert.deepEqual(fichasDoAluno([{ ...fichaA, id: 'X', ordem: 1 }, fichaA, { ...fichaA, id: 'Y', ativo: false }, { ...fichaA, id: 'Z', aluno: 'outro' }], 'ana@x').map((f) => f.id), ['A', 'X']);
});

test('sessão nova: carga da última vez ou da ficha', () => {
  const s0 = novaSessao({ treino: fichaA, exercicios, aluno: 'ana@x', agora: '2026-10-18T10:00:00.000Z' });
  assert.equal(s0.registros.length, 2);
  assert.deepEqual(s0.registros[0].series[0], { carga: 30, reps: 10, feita: false, em: null }, 'sem histórico: alvo da ficha');
  assert.equal(s0.registros[0].series.length, 3);
  assert.equal(s0.registros[1].series[0].carga, null);
  assert.equal(s0.registros[1].nome, 'Prancha');

  const hist = [{ inicio: '2026-10-15T10:00:00Z', registros: [{ exercicio_id: 'supino', series: [
    { carga: 32.5, reps: 10, feita: true }, { carga: 35, reps: 8, feita: true }, { carga: 99, reps: 1, feita: false },
  ] }] }];
  const s1 = novaSessao({ treino: fichaA, exercicios, historico: hist, aluno: 'ana@x' });
  assert.deepEqual(s1.registros[0].series.map((x) => x.carga), [32.5, 35, 35], 'série a série; a que sobra repete a última');
  assert.deepEqual(s1.registros[0].series.map((x) => x.reps), [10, 8, 8]);
  const semEx = novaSessao({ treino: { ...fichaA, itens: [{ id: 'z', exercicio_id: 'sumiu', series: 2, reps: '', descanso_s: 0 }] }, exercicios, aluno: 'a' });
  assert.equal(semEx.registros[0].nome, 'Exercício removido');
  assert.equal(semEx.registros[0].descanso_s, 60, 'descanso padrão');
});

test('marcar séries, onde o aluno está e resumo', () => {
  let s = novaSessao({ treino: fichaA, exercicios, aluno: 'ana@x' });
  assert.deepEqual(proximaSerie(s.registros), { ex: 0, serie: 0 });
  s.registros[0].series[0].carga = 40;
  s.registros = marcarSerie(s.registros, 0, 0, true, '2026-10-18T10:01:00Z');
  assert.equal(s.registros[0].series[0].feita, true);
  assert.equal(s.registros[0].series[0].em, '2026-10-18T10:01:00Z');
  assert.equal(s.registros[0].series[1].carga, 40, 'a próxima série herda a carga nova');
  assert.deepEqual(proximaSerie(s.registros), { ex: 0, serie: 1 });
  s.registros = marcarSerie(s.registros, 0, 1, true);
  s.registros = marcarSerie(s.registros, 0, 2, true);
  assert.deepEqual(proximaSerie(s.registros), { ex: 1, serie: 0 }, 'passa para o próximo exercício');
  s.registros = marcarSerie(s.registros, 0, 2, false);
  assert.equal(s.registros[0].series[2].em, null);
  assert.deepEqual(resumoSessao(s.registros), { feitas: 2, total: 5, volume: 800, exerciciosFeitos: 1 });
  s.registros = marcarSerie(s.registros, 0, 2, true);
  s.registros = marcarSerie(s.registros, 1, 0, true);
  s.registros = marcarSerie(s.registros, 1, 1, true);
  assert.equal(proximaSerie(s.registros), null);
  assert.equal(resumoSessao(s.registros).volume, 1200, 'prancha sem carga não soma volume');
});

test('linha da sessão para o banco', () => {
  let s = novaSessao({ treino: fichaA, exercicios, aluno: 'ana@x', agora: '2026-10-18T10:00:00.000Z' });
  s.registros = marcarSerie(s.registros, 0, 0, true);
  s.descanso = { fim: 1, total: 60 };
  const l = sessaoParaLinha(s, { fim: '2026-10-18T10:47:30.000Z', esforco: '4', nota: 'ok' });
  assert.equal(l.duracao_s, 2850);
  assert.equal(l.series_feitas, 1);
  assert.equal(l.volume_kg, 300);
  assert.equal(l.esforco, 4);
  assert.equal(l.id, s.id);
  assert.equal('descanso' in l, false, 'estado da tela não vai para o banco');
  assert.deepEqual(Object.keys(l.registros[0]).sort(), ['descanso_s', 'exercicio_id', 'grupo', 'item_id', 'nome', 'reps_alvo', 'series']);
  assert.equal(sessaoParaLinha(s, { fim: '2026-10-18T10:10:00.000Z' }).esforco, null);
});

test('última vez, texto das séries e evolução', () => {
  const sessoes = [
    { inicio: '2026-10-01T10:00:00Z', registros: [{ exercicio_id: 'supino', nome: 'Supino', series: [{ carga: 30, reps: 10, feita: true }, { carga: 30, reps: 10, feita: true }] }] },
    { inicio: '2026-10-08T10:00:00Z', registros: [{ exercicio_id: 'supino', nome: 'Supino', series: [{ carga: 32.5, reps: 10, feita: true }, { carga: 35, reps: 8, feita: true }] }] },
    { inicio: '2026-10-10T10:00:00Z', registros: [{ exercicio_id: 'supino', nome: 'Supino', series: [{ carga: 50, reps: 10, feita: false }] }] },
  ];
  assert.equal(ultimaVez('supino', sessoes).data, '2026-10-08T10:00:00Z', 'pula sessão sem série feita');
  assert.equal(ultimaVez('outro', sessoes), null);
  assert.equal(textoSeries(sessoes[0].registros[0].series), '2 × 10 · 30 kg');
  assert.equal(textoSeries(sessoes[1].registros[0].series), '2 séries (10/8) · 35 kg');
  assert.equal(textoSeries([{ carga: null, reps: 30 }]), '1 × 30');
  assert.deepEqual(evolucao('supino', sessoes).map((p) => p.carga), [30, 35]);
  const [p] = progressoCargas(sessoes);
  assert.deepEqual({ primeira: p.primeira, ultima: p.ultima, max: p.max, vezes: p.vezes }, { primeira: 30, ultima: 35, max: 35, vezes: 2 });
  assert.equal(fmtKg(32.5), '32,5');
  assert.equal(fmtKg(null), '—');
});

test('frequência e dias desde', () => {
  const hoje = '2026-10-18';
  assert.equal(diasDesde('2026-10-11', hoje), 7);
  assert.equal(diasDesde('2026-10-18', hoje), 0);
  assert.equal(diasDesde(null, hoje), null);
  const ts = (d) => new Date(2026, 9, d, 18, 0).toISOString();
  const sessoes = [ts(18), ts(18), ts(16), ts(12), ts(11)].map((inicio) => ({ inicio }));
  assert.equal(diasTreinados(sessoes, { n: 7, hoje }), 3, 'dois treinos no mesmo dia contam um; dia 11 fica fora');
  assert.equal(diasTreinados(sessoes, { n: 30, hoje }), 4);
});

test('copiar itens gera ids novos', () => {
  const c = copiarItens(fichaA.itens);
  assert.notEqual(c[0].id, fichaA.itens[0].id);
  assert.equal(c[0].exercicio_id, 'supino');
  assert.deepEqual(copiarItens(null), []);
});

test('biblioteca inicial: grupos válidos e vídeos que tocam no app', () => {
  const grupos = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'antebraco', 'quadriceps', 'posterior', 'gluteos', 'panturrilha', 'abdomen', 'cardio', 'mobilidade', 'corpo'];
  const nomes = new Set();
  for (const e of BIBLIOTECA) {
    assert.ok(grupos.includes(e.grupo), e.nome);
    assert.ok(!nomes.has(e.nome), `repetido: ${e.nome}`);
    nomes.add(e.nome);
    if (e.video) assert.ok(embedVideo(e.video), `vídeo não reconhecido: ${e.nome}`);
  }
});
