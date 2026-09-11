# Verify - atendimento-continuidade-pos-alta

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: verificado em stage; dois defeitos encontrados e corrigidos, cenarios 4 e 6 em revalidacao

## 1) Matriz de rastreabilidade

Evidencias automatizadas em `backend/tests/test_atendimento_continuidade_pos_alta.py`,
salvo indicacao contraria.

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 / RF-001, RF-004, RF-005, RF-006 | aceitacao | `test_adendo_anexa_exame_recebido_depois_sem_criar_atendimento` - adendo `resultado_exame` em atendimento finalizado, upload com `exame_id` + `evolucao_id`, exame vai de "Solicitado" a "Em andamento", contagem de atendimentos inalterada, auditoria `CRIAR_ADENDO_POS_CONCLUSAO` | ok |
| CA-002 / RF-011, RF-012 | aceitacao | `test_receita_complementar_preserva_a_receita_do_dia` - receita 2 copiada com ids novos; apos editar a 2, os itens da 1 sao comparados por id e seguem identicos | ok |
| CA-003 / RF-015, RF-016 | aceitacao | `test_pdf_da_receita_do_dia_nao_muda_depois_da_complementar` - argumentos passados ao gerador de PDF capturados antes e depois da receita 2; iguais. `emitida_em` gravado uma unica vez | ok |
| CA-004 / RF-013, RF-014 | aceitacao | `test_editar_receita_emitida_exige_confirmacao_e_audita` - 409 `CONFIRMACAO_EDICAO_RECEITA_EMITIDA` com item intacto; com `confirmar_edicao_receita_emitida`, dose muda e auditoria `EDITAR_RECEITA_EMITIDA` e emitida | ok |
| CA-005 / RF-003, NFR-002 | aceitacao | `test_adendo_e_receita_complementar_nao_geram_ordem_de_servico` - OS do agendamento continua 1, agendamento segue "Realizado", atendimento segue "Concluido" | ok |
| CA-006 / RF-008 | aceitacao | `test_timeline_mostra_adendo_no_mesmo_episodio` - evento de evolucao com `subtipo: resultado_exame` e `pos_conclusao: 1`; um unico evento de atendimento | ok |
| CA-008 / NFR-003, RF-017 | aceitacao | `test_contrato_legado_da_prescricao_preservado` - `prescricao` continua sendo a `sequencia = 1` e mantem as chaves atuais; `prescricoes` traz [1, 2]. O endpoint legado de PDF e exercitado em `test_pdf_da_receita_do_dia_nao_muda_depois_da_complementar` | ok |
| RF-002 | funcional | `test_pos_conclusao_e_derivado_no_backend` - atendimento em andamento gera adendo com `pos_conclusao = 0` e sem auditoria | ok |
| RF-007 | funcional | `adendos` presente no detalhe com anexos do adendo - coberto por CA-001 | ok |
| RF-010 | funcional | `test_sequencia_e_unica_por_atendimento` - segunda linha com `sequencia = 1` viola o indice unico | ok |
| RF-018 | funcional | `test_put_do_atendimento_continua_sincronizando_a_receita_do_dia` - o PUT legado altera a receita 1 e nao toca na 2 | ok |
| RF-019 | funcional | `test_exclusao_remove_todas_as_receitas_e_adendos` - 2 receitas antes, 0 receitas / 0 itens / 0 adendos depois | ok |
| NFR-001 | nao funcional | nenhum caminho remove item de receita emitida sem confirmacao - coberto por CA-004 | ok |
| NFR-004 | nao funcional | `test_detalhe_carrega_varias_receitas_sem_n_mais_1` - contagem de queries por tabela com 1 e com 4 receitas e identica; `prescricoes_itens` fica em 1 consulta | ok |
| NFR-005 | nao funcional | migracao `20260910_83` executada duas vezes seguidas sobre o schema antigo, em SQLite e em PostgreSQL 16: idempotente, `sequencia` NOT NULL com default 1 materializado nos registros existentes, indice unico ativo (duplicata rejeitada), e caso historico de duas receitas no mesmo atendimento renumerado para 1 e 2 | ok |
| Regressao | teste negativo | com `_sync_prescricao` sem o alvo explicito, CA-002 e CA-003 falham: o PDF da receita 1 passa a imprimir `(1, 'Conduta nova.', [('Furosemida', '3 mg/kg', '8/8h')])` no lugar de `(1, 'Repouso ate o resultado.', [('Furosemida', '2 mg/kg', '12/12h')])` - mesma receita, conteudo trocado | ok |
| CA-007 / RF-020 | aceitacao | banner de concluido em `page.tsx` substitui o aviso de registro historico, identifica o encontro pela data e oferece "Adicionar adendo"; formulario segue editavel | ok (revisao de codigo; sem teste de render da pagina) |
| CA-009 | aceitacao | `atendimento-receitas.test.ts` - `prescricaoEntraNoPayloadDoAtendimento({prescricao_alvo_id: 11})` e `false`, entao o PUT do atendimento nao carrega `prescricao` enquanto a complementar esta aberta | ok |
| RF-021 | funcional | `AtendimentoReceitasBar.test.tsx` - "distingue receita emitida de rascunho" | ok |
| RF-022 | funcional | `AtendimentoReceitasBar.test.tsx` - "cria receita complementar pelo botao dedicado"; `criarReceitaComplementar` copia da receita ativa | ok |
| RF-023 | funcional | `AtendimentoReceitasBar.test.tsx` - "oferece confirmar a edicao pendente com o texto vindo do backend" | ok |
| RF-024 | funcional | `AtendimentoAdendosSection.test.tsx` - "anexa arquivo ao adendo vinculando o exame escolhido" e "nao oferece vinculo de exame quando nao ha exame aguardando arquivo" | ok |
| CA-010 / RF-026 | aceitacao | `atendimento-receitas.test.ts` - `montarSnapshotDoAtendimento` muda quando a receita complementar muda, mesmo com o payload do atendimento identico | ok (revalidacao em stage pendente) |
| CA-011 / RF-027 | aceitacao | confirmacao passa a ser lida de `receitasEdicaoConfirmadaRef`, aplicada antes do save no mesmo tick | ok (revisao de codigo; revalidacao em stage pendente) |
| RF-025 | funcional | `AtendimentoAdendosSection.test.tsx` - "emite receita a partir de um adendo de receita complementar" e "mostra que o adendo ja tem receita vinculada" | ok |
| Alvo de receita | funcional | `atendimento-receitas.test.ts` - alvo inexistente volta para a receita do dia; a receita do dia nunca e tratada como alvo complementar | ok |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/ -q
```

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && npm run lint && npx vitest run && npm run build
```

Resumo dos resultados:
- Backend: 1266 passed, 5 skipped, 278 subtests passed. Sao 13 testes novos; a
  suite estava em 1253 passed antes da entrega.
- Frontend: `tsc` sem erros, `eslint --max-warnings=0` limpo, `vitest run` com
  41 arquivos e 277 testes passando (a suite estava em 38 arquivos e 255
  testes), e `next build` concluido.
- Teste negativo: descrito na linha de regressao da matriz, executado
  removendo temporariamente o alvo explicito de `_sync_prescricao`.

Ajuste em teste existente: `tests/test_atendimento_upload_endpoint.py` passou a
informar `evolucao_id=None` nas 9 chamadas diretas a `upload_anexo`. Chamando o
endpoint fora do FastAPI, o default `Form(None)` chega como objeto do
framework, nao como `None`.

## 3) Testes manuais

Executados em stage em 2026-09-10, pelo navegador, sobre o atendimento #16
(paciente Aberaldo, agendamento #83). Os sete cenarios passaram; dois defeitos
foram encontrados no caminho e corrigidos (secao 4).

| Cenario | Resultado |
| --- | --- |
| 1 - atender, solicitar exame, finalizar | ok - "Agenda #83 realizada e OS OS2026090001 gerada" |
| 2 - reabrir dias depois | ok - banner "ATENDIMENTO CONCLUIDO #16 - ENCONTRO EM 01/04/2026" |
| 3 - adendo + anexo do exame | ok - adendo com `pos_conclusao: 1`, anexo com `evolucao_id` e `exame_id`, exame de "Solicitado" para "Em andamento" |
| 4 - receita complementar | ok - item copiado com id novo (9), sem reaproveitar o id 8 da receita do dia |
| 5 - receita do dia preservada | ok - segue "1/2 comprimido" apos a complementar virar "1 comprimido" |
| 6 - editar receita emitida | ok - 409 com aviso do backend; servidor nao aplicou a edicao |
| 7 - Financeiro | ok - uma unica OS (OS2026090001, R$ 230,00) para o agendamento 83 |

Nota de metodo sobre o cenario 5: comparar o hash do PDF nao serve como
criterio. Duas geracoes seguidas do mesmo PDF ja produzem hashes diferentes
(o arquivo carrega timestamp), o que daria falso positivo. A comparacao foi
feita sobre o conteudo persistido que alimenta o PDF.

Nota de metodo sobre o cenario 3: o navegador interno nao dirige o seletor
nativo de arquivo, entao o PDF foi injetado no input com um evento `change`.
Do `onChange` em diante o caminho foi o real da aplicacao.

Roteiro original, para repeticao:

- Cenario 1: atender um paciente agendado, solicitar um exame, finalizar o
  atendimento. Esperado: OS gerada, agendamento "Realizado", exame solicitado
  sem arquivo.
- Cenario 2: dias depois, abrir o mesmo atendimento. Esperado: banner de
  concluido identificando o encontro e acao "Adicionar adendo".
- Cenario 3: `POST /atendimentos/{id}/adendos` com tipo `resultado_exame` e
  upload do PDF com `exame_id` e `evolucao_id`. Esperado: exame em "Em
  andamento", anexo dentro do adendo, nenhum atendimento novo.
- Cenario 4: `POST /atendimentos/{id}/prescricoes` com
  `copiar_de_prescricao_id`. Esperado: receita 2 pre-preenchida; editar a 2 nao
  altera a 1.
- Cenario 5: `GET /atendimentos/{id}/prescricao/pdf`. Esperado: conteudo e data
  originais da receita do dia.
- Cenario 6: `PUT` na receita 1 ja emitida. Esperado: 409 confirmavel.
- Cenario 7: conferir Financeiro. Esperado: uma unica OS para o agendamento.

## 4) Defeitos encontrados na verificacao em stage

Os dois passaram pelos testes automatizados porque a cobertura era de
componente isolado e de regra pura - nenhum dos dois exercita o ciclo real de
autosave da pagina.

**D-1: o autosave ficava cego a edicao da receita complementar.** A tela
informava "Sincronizado" e o servidor nao mudava; a alteracao so era gravada
com o "Salvar atendimento" manual, o que faria o vet perder o que digitou ao
sair da tela. Causa: `serializeAtendimentoSnapshot` era o proprio
`buildAtendimentoPayload`, de onde `prescricao` e removida enquanto ha uma
complementar aberta - sem a receita no snapshot, nada mudava e a deteccao de
alteracao nunca disparava. Correcao: `montarSnapshotDoAtendimento`
(`frontend/lib/atendimento-receitas.ts`) separa as duas decisoes e tem teste
de regressao proprio.

**D-2: "Confirmar e salvar" nao aplicava a edicao.** O segundo `PUT` voltava
409 igual ao primeiro. Causa: `confirmarEdicaoReceitaEmitida` atualizava o
estado e chamava o save no mesmo tick, e o save lia a lista de confirmacoes
pela closure anterior, sem o id. Correcao: a confirmacao passa por
`receitasEdicaoConfirmadaRef`, atualizado antes do save - mesmo padrao que o
arquivo ja usa com `formRef` e `selecionadoRef`.

## 5) Observacoes fora do escopo desta entrega

- Ao finalizar, o `status` retornado pelo backend nao chega ao formulario:
  `mergeAutoSavedFormState` mescla apenas `id`, `exames` e
  `prescricao_itens`, e o resto vem de `...current`. Por isso o banner de
  concluido so aparece ao reabrir o atendimento. E anterior a esta entrega e
  afeta tambem o rotulo "Confirmar sincronizacao", que ja existia.
- `emitida_em` chega ao frontend sem fuso e e exibido em UTC: o aviso mostrou
  "11/09/2026 01:48" para uma emissao feita as 22:48 locais. Os demais
  horarios do modulo passam por `_to_operational_iso`.

## 6) Regressao e riscos residuais

- A migracao foi validada sobre o schema antigo em SQLite e em PostgreSQL 16
  (instancia descartavel, duas execucoes seguidas), incluindo o caso de duas
  receitas para o mesmo atendimento. O `migration-tests` do CI roda apenas em
  SQLite (`DATABASE_URL: sqlite:///./fortcordis-ci.db`), entao a verificacao em
  Postgres foi feita fora dele. Risco residual: o dado real de stage pode ter
  formas que a instancia limpa nao reproduz.
- `_sync_prescricao` passou a aceitar o alvo explicito, mas o caminho legado do
  `PUT /atendimentos/{id}` continua resolvendo para `sequencia = 1`. Coberto por
  RF-018 e pela suite de prescricao que ja existia.
- O guard de receita emitida so dispara quando o payload muda conteudo
  (`_payload_altera_prescricao`). Sem isso, o autosave do prontuario passaria a
  falhar com 409 a cada digitacao depois que o PDF fosse gerado - risco coberto
  por `test_reenvio_sem_mudanca_nao_exige_confirmacao`.
- O dedupe de upload continua com escopo (atendimento, exame, bytes). Quando o
  mesmo arquivo ja existia solto e chega de novo por um adendo, o anexo
  existente e adotado pelo adendo em vez de o adendo ficar vazio.
- O ponto mais sensivel da fase 3 e o alvo da receita: com uma complementar
  aberta, `prescricao` sai do payload do atendimento e o editor passa a salvar
  pelo endpoint da receita. A regra esta isolada em
  `frontend/lib/atendimento-receitas.ts` com teste proprio justamente por ser
  a que, se errar, sobrescreve documento ja entregue.
- Trocar de receita salva antes de trocar e realinha
  `lastPersistedSnapshotRef`, para a troca em si nao marcar o formulario como
  sujo nem disparar save extra.
- O aviso de receita emitida e nao-bloqueante: o autosave reenvia a receita a
  cada save, e um modal no meio da digitacao pararia o prontuario. O 409 vira
  banner com acao "Confirmar e salvar", com o texto vindo do backend.
- CA-007 nao tem teste automatizado: renderizar `page.tsx` (mais de 8.000
  linhas, com `dynamic()` e roteador) exigiria um arranjo de mocks
  desproporcional. Fica coberto por revisao de codigo e pelo cenario 2 do
  teste manual em stage.
