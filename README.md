# Treinos

App de treino de academia: o **personal** monta a ficha de cada aluno e o **aluno** treina com o celular na mão,
marcando cada série, com o descanso cronometrado e o vídeo de como fazer cada exercício.
Mesmo padrão da Caderneta e dos Criativos: front em HTML/CSS/JS puro (sem build), back no Supabase (plano gratuito).

## O que faz

**Personal (e admin)**
- **Alunos**: cadastra o aluno com o e-mail; o app cria o login e entrega o acesso pronto para mandar no WhatsApp.
  Cada personal vê só os alunos dele; o admin vê todos e cadastra personais.
- **Fichas** (Treino A, B, C…): exercícios da biblioteca com séries, repetições, carga, descanso e observação.
  Reordena, copia para outro aluno, marca validade e desativa. Nada muda para o aluno até clicar em **Salvar ficha**.
- **Modelos**: fichas sem aluno (iniciante, ABC…) para copiar para cada aluno novo.
- **Acompanhamento**: quem treinou, quem sumiu há 7+ dias, fichas vencendo, histórico de cada aluno com carga e reps
  de cada série, evolução de carga e **comentário** em cada treino feito (o aluno vê).
- **Exercícios**: biblioteca com 50 exercícios iniciais (22 já com vídeo verificado) e o link do vídeo de demonstração.

**Aluno**
- **Hoje**: o próximo treino do rodízio (A → B → C → A…), as fichas e a frequência.
- **Treinando**: cada série com carga e reps (já vêm as da última vez), ✓ para marcar, destaque de **em qual série está**,
  "última vez" de cada exercício, + / − série.
- **Descanso**: começa sozinho ao marcar a série, com o tempo da ficha; −15 / +15 / Pular; bipe e vibração no fim.
  Conta pelo relógio, então continua certo com a tela apagada. A tela fica ligada durante o treino (onde o navegador permite).
- **Vídeo**: YouTube (inclusive Shorts e youtu.be) e Vimeo tocam dentro do app; outros links abrem em outra aba.
- **Sem internet**: o treino em andamento fica no aparelho (sobrevive a recarregar e a fechar o app). Ao concluir sem
  sinal, ele entra numa fila e é enviado sozinho quando a conexão volta, sem duplicar.
- **Histórico**: todos os treinos, comentários do personal e evolução de carga por exercício.

## Rodar

Com `js/config.js` vazio, o app abre em **modo local**: os dados ficam no navegador e vêm exemplos (um personal, uma
personal, três alunos com histórico). Em **Ajustes → Ver o app como** dá para trocar para um aluno e ver o outro lado.
Com o Laragon ligado, abra `http://localhost/treinos/`. Qualquer servidor estático serve.

## Ligar ao Supabase

O app usa o **mesmo projeto do painel de Criativos** (`hbdwyfjcbaddjknbnmej`), porque o plano grátis só permite
2 projetos ativos. As tabelas e funções do Treinos ficam no schema **`treinos`**, separado do `public` dos Criativos:
nada de um app mexe no outro. O login é compartilhado (mesma lista de usuários do projeto), mas cada app só libera
quem está na sua própria tabela `membros`. `js/config.js` já está preenchido; para voltar ao modo local, apague
`SUPABASE_URL` e `SUPABASE_KEY`.

1. **SQL Editor → New query**: cole e rode `supabase/schema.sql`. Ele cria o schema `treinos`, as tabelas, as regras
   de acesso e a biblioteca de 50 exercícios. No fim fica o e-mail do primeiro admin (troque antes, se for outro).
2. **Project Settings → Data API → Exposed schemas**: adicione `treinos` e salve. Sem isso o app mostra
   “O schema treinos ainda não foi liberado”.
3. **Authentication → URL Configuration → Redirect URLs**: adicione o endereço do Treinos (`http://localhost/treinos/`
   e, depois, o da Cloudflare). Não mexa no *Site URL*: ele é dos Criativos.
4. **Edge Functions → Deploy a new function → Via Editor**: nome `contas`, cole `supabase/functions/contas/index.ts`,
   publique e desligue a verificação de JWT (ela mesma confere o login).
5. Entre no app com o login do admin (o mesmo dos Criativos, se for a mesma pessoa). A partir daí: personais em
   **Ajustes → Equipe**, alunos em **Alunos → Novo aluno**.
6. Fichas prontas por SQL (ex.: `supabase/alunos/rodrigo-miranda.sql`): cadastre o aluno pelo app, troque o e-mail no
   topo do arquivo e rode no SQL Editor.

Os e-mails de confirmação e de troca de senha usam os modelos do projeto (os mesmos dos Criativos). Como o cadastro
pelo app já cria o login confirmado, o aluno normalmente não recebe e-mail nenhum.

Segurança: toda tabela tem RLS. O aluno lê só as fichas e os treinos dele; o personal só os dos alunos dele
(`membros.personal`); o admin tudo. O personal não cadastra personal nem promove ninguém. O aluno não escreve o
comentário do personal, e o personal não altera o que o aluno registrou. Ter login no projeto (ex.: alguém dos
Criativos) sem cadastro no Treinos não dá acesso a nada.

## Vídeos

Cole o link do YouTube ou do Vimeo no exercício (Exercícios → lápis). O app usa o `youtube-nocookie.com`.
Alguns vídeos têm a incorporação desligada pelo dono: nesses o player mostra o aviso do YouTube e o aluno usa
"Abrir no YouTube". Para conferir um link antes: `https://www.youtube.com/oembed?url=<link>&format=json` responde 200
quando o vídeo pode ser incorporado.

Os vídeos da biblioteca inicial são de canais públicos (Leandro Twin, FisioPrev, Laércio Refundini e outros) e foram
verificados em 18/10/2026. Para mudar a biblioteca inicial, edite `js/biblioteca.js` e rode
`node scripts/biblioteca-sql.mjs` (atualiza o `schema.sql`).

## App instalável (PWA)

Igual aos Criativos: instala no celular (Ajustes → Instalar app; no iPhone, Safari → Compartilhar → Adicionar à Tela
de Início). Atalho no ícone: **Continuar treino**. `sw.js` guarda a interface no aparelho e, a cada publicação na
Cloudflare, `scripts/versionar.mjs` carimba a versão e o app oferece "Atualizar". Não commite um `sw.js` carimbado.

Limites do navegador: no iPhone não há vibração pelo navegador, e o bipe só toca com o app aberto (o som é liberado
no primeiro toque do treino; no silencioso não toca).

## Publicar

Suba a pasta como está no Cloudflare (Workers com arquivos estáticos, `wrangler.jsonc`) ou em qualquer host estático.
Ficam de fora (`.assetsignore`): `tests/`, `scripts/`, `supabase/`, `docs/`, `package.json`.

## Testes

`npm test` testa as regras (links de vídeo, rodízio, sessão, séries, descanso, evolução, biblioteca). Node 18 ou mais novo.

## Estrutura

```
index.html, css/styles.css, icons/, manifest.webmanifest, sw.js
js/config.js      conexão (projeto dos Criativos, schema treinos; vazia = modo local)
js/api.js         Supabase ou localStorage, mesma interface; login; dados de exemplo
js/store.js       estado em memória + ações + tempo real
js/sessao.js      treino em andamento (no aparelho), fila de envio, descanso, bipe, tela ligada
js/descanso.js    barra do descanso (fica por cima de qualquer tela)
js/domain.js      regras puras (testadas)
js/biblioteca.js  exercícios iniciais
js/views/*.js     telas: inicio, treino (ficha/editor), treinar, sessao, historico, exercicios, alunos, aluno,
                  modelos, ajustes, pessoas (cadastro), entrar
supabase/schema.sql, supabase/functions/contas/index.ts
```
