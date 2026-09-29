# Verify - Persistencia dos documentos clinicos

Data: 2026-09-29. Validacao local; sem publicacao. Base isolada: `19134e1ef58968307dc47d9af6b6298a4cf80aed`, branch `codex/documentos-persistencia`.

## Diagnostico

[Diagnostico e cronologia](diagnostico.md): documento real investigado removido por DELETE 200 e confirmado pela auditoria, antes do PUT posterior do atendimento. Arquivo preservado identico ao corpo auditado por SHA-256. Nao restaurado nem reemitido em producao.

## Testes

- Backend: `DOCUMENT_TEST_POSTGRES_URL=postgresql://document_test@127.0.0.1:55469/document_test backend/venv/bin/python -m pytest backend/tests/test_atendimento* -q`: **200 passed**. PostgreSQL 16 descartavel local, schema aleatorio removido ao fim de cada teste.
- Inclui criacao, PUT do atendimento com lista antiga/vazia, nova sessao SQL, download HTTP real, PDF reaberto por pypdf, arquivo/restauracao de emitido, ID de atendimento errado, precondicao ausente 428, conflito 409, bloqueio da exclusao do pai e rollback com falha injetada na auditoria.
- Concorrencia PostgreSQL real: duas threads/conexoes precarregam o documento e entram juntas; update/update e update/archive resultam em exatamente um 200 e um 409, um evento auditado e registro preservado.
- Frontend: **13 testes passaram** nos dois arquivos focados. Os testes do helper e componente cobrem lista sem ID (sem sucesso ficticio), preservacao no merge do atendimento, UTC para Fortaleza, PDF invalido/vazio, download, arquivado/restaurar, links de abertura/download, emissao sem alegar entrega e digitacao durante save.
- TypeScript, ESLint dos arquivos alterados e `git diff --check`: sem erros.

## Prova na interface real

Next.js do worktree em `127.0.0.1:3069`, API do router real em `127.0.0.1:8069`, autenticacao/branding de teste e banco SQLite descartavel. Nenhum servidor de producao usado na prova de escrita. Dados sinteticos, sem historia clinica real.

Chrome headless instalado no Mac, duas browser contexts independentes:

1. Criou documento pela interface, salvou o atendimento, baixou arquivo via evento real `download` e confirmou ausencia de erro no download.
2. Clicou Abrir PDF; nova aba abriu o visualizador PDF do Chrome. Screenshot inspecionado.
3. Recarregou a pagina e abriu outra sessao; ambas mostraram o mesmo ID e titulo.
4. Retardou PUT pelo roteamento de teste; digitou durante a requisicao. Texto adicional permaneceu apos o 200.
5. Outra sessao tentou salvar versao antiga: 409 e texto local preservado.
6. Atualizou lista, arquivou com confirmacao explicita; apos reload o documento permaneceu em Arquivados. Restaurou com o mesmo ID, corpo e status emitido.
7. Documento novo emitido diretamente por Gerar PDF recebeu versao atualizada, permitindo edicao e save posterior sem conflito artificial.

## Artefato PDF

Artefatos sinteticos e diagnostico completo estao na pasta local privada de evidencias do chat; nenhum conteudo clinico real foi incluido no repositorio.

- `documento-sintetico-baixado.pdf`: 2702 bytes, 1 pagina. SHA-256 `8f519e6d9e767a991271c7e80e9779e7ca43d49d3eb82876dff707a7b775447d`.
- Reaberto com pypdf: paciente/tutora sinteticos, titulo, texto e rodape de teste conferidos.
- Renderizado com Poppler e pagina inspecionada: sem cortes, sobreposicoes ou caracteres quebrados. Aviso local de Fontconfig nao impediu a renderizacao.
- `pdf-aberto-browser.png`, `documento-download-interface.png`, `conflito-editor-preservado.png`, `browser-evidence.json`, `browser-concurrency.json` registram a verificacao.

## Limites

- Safari nao foi automatizado; a prova de download/abertura foi feita em Chrome. API e sessoes independentes foram verificadas separadamente.
- PDF original do documento real investigado: download/abertura continuam sem comprovacao historica. Nao se confunde o arquivo sintetico com o parecer original.
- Identidade da conta no DELETE nao identifica aba, gesto ou pessoa que originou a acao.
- Nenhuma migracao necessaria. Abas antigas precisam recarregar apos futura publicacao para enviar a precondicao de versao.
- Os avisos de depreciacao Pydantic/SQLAlchemy/passlib ja existentes nao falharam os testes.

## Gate final

**Aprovado localmente:** build Next.js concluido com codigo 0, TypeScript, ESLint dos arquivos alterados, diff check e guardrail SDD aprovados. O build avisou apenas sobre base Browserslist antiga.

Servicos locais de teste e PostgreSQL descartavel encerrados. Worktree preservado para revisao. Em continuidade autorizada, preparar commit e PR com base em stage; merge e deploy nao fazem parte dessa preparacao.

## Preparacao de PR

A base remota stage `db028844f3dcdd63ef54cb16fc5c0d09a809c791` possui a mesma arvore de arquivos da base validada `19134e1e`. O PR mantem apenas a correcao e a SDD; cronologia detalhada e identificadores do caso ficam locais porque o repositorio e publico.

## Integracao do gate de deploy

O PR #264 foi integrado em stage no SHA `aaae16b8a771b2a234092c89fa92a41ec1716352`. O workflow `36638283650` bloqueou o deploy antes de acessar o VPS: a descoberta unittest importou os dois modulos pytest, mas o runner instalava somente requirements de runtime. Foram 1471 testes descobertos, dois erros de importacao por dependencia ausente. Frontend CI e Migration CI passaram.

Correcao do gate: dependencia pytest fixada em requirements de teste; execucao explicita das regressoes de persistencia e concorrencia PostgreSQL, alem da suite unittest. Aplicada aos dois workflows para manter a futura promocao compativel; isso nao executa nem autoriza publicacao em producao.

Validacao da correcao do gate: suite unittest completa aprovada (1469 testes, 8 skips); 7 regressoes pytest aprovadas, incluindo PostgreSQL 16 local descartavel. YAML dos dois workflows e diff check aprovados.
