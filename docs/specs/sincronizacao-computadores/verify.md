# Verificacao

## Evidencias iniciais

- Atualizacao Samsung: `stage` avancou de `f54a8956` para `77f65b3d` (1322 commits).
- `main` local avancou por ancestralidade ate `112b789d`.
- SHA-256 de `backend/fortcordis.db`, `backend/.env` e
  `whatsapp-stage-backend/.env` identicos antes e depois.
- O exemplo `whatsapp-stage-backend/.env.example` recebeu a versao atual do Git;
  o exemplo anterior foi copiado para o backup externo.

## Validacao da ferramenta (2026-10-17)

Comando: `node --test scripts/tests/sync-project.test.mjs`.
Resultado: **13 testes passaram, zero falhas**, em repositorios temporarios com
remoto bare e duas copias, sem acesso a bancos ou remotos reais da aplicacao.

| Criterio | Evidencia |
| --- | --- |
| CA-001 | Alias executado de subpasta com espacos; instalacao permanece funcional em branch sem o script. |
| CA-002 | Envio com mensagem e sem mensagem; recebimento do mesmo SHA na segunda copia; publicacao e abertura de branch nova. |
| CA-003 | Arvore suja, remoto avancado com trabalho pendente, divergencia, commits nao enviados e flags assume-unchanged/skip-worktree bloqueados; mensagem com acento, aspas, crases e `$()` preservada. |
| CA-004 | Envios em main/stage bloqueados antes do commit; merge pendente e HEAD destacado bloqueados. |
| CA-005 | `.env` e `.db` ignorados preservados; colisao com arquivo ignorado bloqueada em fast-forward e troca de branch. |
| CA-006 | Contagens `stage...origin/stage` e `main...origin/main`: `0 0`; alias instalado no Samsung; distribuicao pela branch `codex/sincronizacao-computadores`. |

Validacoes adicionais: `node --check` nos dois arquivos JavaScript,
`git diff --cached --check` e guardrail SDD aprovados. O alias real `git sync ajuda`
tambem foi executado no Samsung.

## Limites e escopo

- Testes executados no Windows; o MacBook nao esta acessivel nesta sessao. O mesmo
  script usa APIs portaveis de Node.js e os comandos Git suportados nos dois sistemas.
- Suites de backend/frontend nao foram executadas: nenhuma implementacao da
  aplicacao ou dependencia foi alterada por esta ferramenta.
- A instalacao inicial no MacBook deve seguir `docs/SINCRONIZACAO-COMPUTADORES.md`.
- Publicacao da ferramenta em branch de trabalho; nenhum deploy ou migracao
  faz parte desta tarefa.
