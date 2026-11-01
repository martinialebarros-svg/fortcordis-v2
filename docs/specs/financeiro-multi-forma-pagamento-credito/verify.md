# Verify - financeiro-multi-forma-pagamento-credito

## Incremento local de 2026-10-31 — desconto e baixa sem contrapartida

Escopo: CA-012 a CA-014 e RF-012 a RF-016. Implementacao local, sem migracao,
sem lancamentos reais e sem publicacao em Stage/producao. A aprovacao historica
ao final deste documento nao se aplica automaticamente a este incremento.

- Backend: `tests/test_recebimento_desconto_baixa_credito.py` exercita HTTP com SQLite temporario, usuarios e cadastros sinteticos; notificacoes externas/auditoria global substituidas no teste. Cobre desconto R$ 340 - R$ 90, desconto integral, excedente real com credito preservado, baixa de cliente/clinica, saldo compartilhado pelo tutor, idempotencia, desfazer, permissoes, valores invalidos e reversao sem saldo negativo.
- Regressao: `tests/test_ordens_servico_domiciliar.py`.
- Frontend: `lib/recebimento-desconto.test.ts` e `components/financeiro/BaixaCredito.test.tsx`: sugestao versus valores manuais/divididos, valor/motivo, permissao, titular, repeticao apos timeout e desfazer.
- Contrato confirmado pelo usuario: baixa de credito ja existente, independente de OS ou devolucao. Usa lancamento negativo no historico; excedentes reais do recebimento mantem a geracao de credito existente. Consultas antigas continuam entendendo movimentos negativos e cancelados.
- Rollback: reverter UI/endpoints novos; dados sao compativeis com o ledger existente. Restauracao funcional de uma baixa usa `desfazer-baixa`, sem apagar historico. OS cujo credito foi usado/baixado exige reversao da dependencia antes de desfazer recebimento.
- Limite: testes locais SQLite nao demonstram concorrencia real em Postgres nem homologacao autenticada em ambiente publicado. O bloqueio por titular em Postgres precisa ser exercitado antes da promocao.

Validacao final local:

- Backend focado + regressao domiciliar: **21 passed**; inclui duas baixas simultaneas SQLite, com mesma chave (uma baixa) e chaves distintas acima do saldo combinado (uma rejeicao).
- Frontend focado: **8 passed**.
- ESLint dos arquivos afetados, TypeScript `--noEmit`, `npm run build`, compilacao Python, `git diff --check` e guardrail SDD sobre a lista de arquivos deste incremento: **PASS**.
- Permanecem apenas os avisos preexistentes de depreciacao Pydantic/SQLAlchemy nos testes backend.
- Sem homologacao visual/autenticada em Stage ou teste concorrente em Postgres nesta entrega local.

## Adendo 2026-10-31 — modal de Desfazer recebimento

Escopo: RF-011, NFR-005 e CA-011. Alteracao local de interface, sem operacoes em registros reais e sem publicacao em Stage/producao. O backend continua responsavel pela reversao; o modal utiliza o mesmo endpoint e nao presume sucesso antes da resposta.

Validacao local concluida em 31/10/2026 no worktree `financeiro-desfazer-modal`, base `c65081ae`, branch `codex/financeiro-desfazer-modal`:

- `npx vitest run app/financeiro/page.test.tsx`: 48/48 passaram, com 5 cenarios novos para abrir/cancelar e restaurar foco, Escape, ciclo Tab/Shift+Tab, envio unico com bloqueio durante processamento e sucesso/recarga, e erro da API sem falso sucesso. A API utiliza exclusivamente mocks e dados sinteticos.
- Os testes verificam ausencia de chamadas a `window.confirm` e `window.alert` no fluxo de Desfazer.
- `npx eslint app/financeiro/page.tsx app/financeiro/DesfazerRecebimentoModal.tsx app/financeiro/page.test.tsx --max-warnings=0`: passou.
- `npx tsc --noEmit`: passou. A verificacao inicial encontrou opcoes `exact` incompativeis nos testes novos; foram removidas antes da validacao final.
- `npm test`: 136 arquivos / 2.392 testes Vitest e 23 testes do runner Node passaram.
- `npm run build`: passou, incluindo lint e verificacao de tipos do Next.js. Aviso de base Browserslist desatualizada nao bloqueou a compilacao.
- Guardrail SDD: `evaluate_guardrail` executado sobre o diff de trabalho e arquivos novos aprovou `financeiro-multi-forma-pagamento-credito`.
- `git diff --check`: passou. Revisao independente do diff sem achados acionaveis.

Nao houve teste manual no Chrome do BOOK3, deploy, migracao ou operacao financeira real.

Risco/limite: indisponibilidade do controle do Chrome/Windows continua sendo uma condicao externa. O modal elimina a dependencia de dialogos nativos apenas neste fluxo; nao comprova a correcao do pagamento do Bonito nem a recuperacao do controle do BOOK3.

O checklist de release historico abaixo nao autoriza publicar este adendo.

### Publicacao solicitada em 31/10/2026

O usuario solicitou publicar esta entrega. PR #525 integrou o snapshot isolado em Stage, SHA `648678f8`. O run `41192856582` aprovou testes e build do modal, mas falhou em `npm audit --omit=dev` do servico WhatsApp por `follow-redirects` 1.16.1 (GHSA-mrwp-f3q8-3g9p). O job de instalacao foi pulado e producao permaneceu em `c65081ae`.

A remediacao de release e limitada ao patch 1.16.2 no lockfile, documentado em `agenda-whatsapp-cloud-api`. A promocao PR #526 continua sujeita a todos os gates, instalacao e smoke de Stage antes do merge. As funcionalidades exclusivas de Stage foram preservadas para restauracao posterior com esta entrega.

## Publicacao autorizada em 01/11/2026 — baixa de credito existente

O usuario solicitou publicar o incremento RF-012 a RF-016, NFR-006/007 e CA-012 a CA-014. O escopo confirmado e baixa de credito ja existente, sem devolucao/abatimento; nao inclui dispensa de excedentes novos.

Integracao isolada sobre producao `336a0e25837781edb8c5d928594e57836f790c16`. Snapshot de homologacao preservado em `0062f02d2d106aeec8d5f5c0ad8694d3bfefcdd5`; as funcionalidades exclusivas de Stage serao restauradas apos a promocao.

Validacoes da base atual em worktree isolada:

- 48 testes backend aprovados: contrato HTTP em SQLite e PostgreSQL descartavel local, concorrencia de baixas com mesma chave e chaves distintas, recebimentos em lote e regressao domiciliar. Schemas sinteticos removidos ao final.
- Suite completa frontend: 138 arquivos / 2.411 testes Vitest + 23 testes Node aprovados; lint focado, build e TypeScript aprovados.
- O job de CI de Stage inclui este contrato nos testes com PostgreSQL; producao inclui seus testes SQLite no gate. Nenhuma nova migracao ou configuracao de ambiente e necessaria.
- Nenhum lancamento operacional, envio WhatsApp ou alteracao clinica faz parte da validacao.
- Estado de publicacao sera registrado apos conclusao dos workflows e smoke; validacao local nao e prova de instalacao.

Data: 2026-05-25  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `PATCH /ordens-servico/{id}/receber` aceita `pagamentos[]` e UI com linhas multiplas nas telas de agenda e financeiro | ok |
| CA-002 | aceitacao | campos `taxa_percentual`, `taxa_fixa`, `valor_taxa` em `transacoes` + resumo de taxa por linha nos modais | ok |
| CA-003 | aceitacao | criacao de `creditos_financeiros` no excedente de recebimento com destino selecionado | ok |
| CA-004 | aceitacao | `desfazer-recebimento` cancela todas transacoes do marker e creditos ativos vinculados | ok |
| CA-005 | aceitacao | fluxo multipagamento presente em `agenda/page.tsx` e `agenda/fullcalendar/page.tsx` | ok |
| CA-006 | aceitacao | `resumo` e `relatorios/controle` expõem `taxas_pagamento` e `creditos_gerados` | ok |
| CA-007 | aceitacao | endpoints de cadastro usam `_require_admin` para mutacoes | ok |
| CA-008 | aceitacao | `PATCH /ordens-servico/{id}/receber` aceita `desconto` e recalcula cobertura no backend; modais da agenda exibem campo de desconto | ok |
| CA-009 | aceitacao | tela financeiro permite editar `taxa_percentual` e `taxa_fixa` por forma de pagamento via `PUT /financeiro/formas-pagamento/{id}` | ok |
| CA-010 | aceitacao | modal individual do Financeiro usa viewport limitada, formulario com rolagem propria e rodape fixo para manter `Confirmar Recebimento` acessivel com 2+ pagamentos | ok |
| NFR-001 | nao funcional | cancelamento em lote no desfazer recebimento | ok |
| NFR-002 | nao funcional | guardrail admin em `financeiro.py` para cadastro | ok |
| NFR-003 | nao funcional | retorno de recebimento com totais bruto/taxa/liquido/excedente | ok |

## 2) Testes automatizados executados

Comandos:

```bash
# Backend (sintaxe + ciclo de migracao)
cd backend
python3 -m py_compile app/api/v1/endpoints/ordens_servico.py \
  app/api/v1/endpoints/financeiro.py \
  app/api/v1/endpoints/relatorios.py \
  app/models/financeiro.py \
  app/schemas/financeiro.py \
  migrations/versions/20260525_41_financeiro_multiplos_pagamentos_credito.py

cd backend
source venv/bin/activate
pytest -q tests/test_migration_ci_cycle.py

# Frontend
cd frontend && npm run lint
cd frontend && npm run build
```

Resumo:
- `py_compile`: ok.
- `pytest tests/test_migration_ci_cycle.py`: ok (1 passed) no ambiente com `venv` ativado.
- `npm run lint`: ok.
- `npm run build`: ok.
- `npx eslint app/agenda/page.tsx app/agenda/fullcalendar/page.tsx app/financeiro/page.tsx`: ok (validacao focada nos arquivos alterados em 2026-05-29).
- `python -m compileall app/api/v1/endpoints/ordens_servico.py`: ok.

Observacao:
- Tentativa de `pytest` sem `venv` ativado falhou por dependencia ausente (`pydantic_settings`), resolvida ao executar com ambiente virtual do backend.

## 3) Smoke manual recomendado (stage/local)

- Cenario A: receber OS com 2 formas de pagamento (ex.: pix + cartao credito com taxa).
- Cenario B: receber OS com valor bruto maior que valor da OS e gerar credito para cliente.
- Cenario C: repetir Cenario B com destino clinica.
- Cenario D: desfazer recebimento e validar cancelamento de transacoes + credito.
- Cenario E: validar relatorio controle (CSV/PDF) com campos de taxa e credito no periodo.
- Cenario F: validar comportamento identico no modal da Agenda Lista e FullCalendar.
- Cenario G: no modal de recebimento da agenda, aplicar desconto e confirmar que o total a cobrir passa a ser o valor liquido da OS.
- Cenario H: no Financeiro > cadastro de meios, editar taxa percentual/fixa e validar reflexo na "taxa estimada" em novo recebimento.
- Cenario I: no Financeiro, abrir o recebimento individual de uma OS, adicionar 2+ formas de pagamento e confirmar que o formulario rola sem ocultar `Cancelar` e `Confirmar Recebimento`.

## 4) Riscos residuais

- Risco 1: cadastro rapido no front financeiro usa prompts para entrada de dados; pode exigir refinamento UX posterior.
- Risco 2: consumo de credito em OS futura ainda nao implementado (fora de escopo atual).

## 5) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
