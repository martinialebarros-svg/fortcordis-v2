# Verify - atendimento-continuidade-pos-alta

Data: 2026-09-10  
Responsavel: Martiniano Barros  
Status: fases 1 e 2 implementadas; fase 3 (frontend) e verificacao em stage pendentes

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
| RF-020 a RF-024 | funcional | frontend - fase 3 | pendente |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/ -q
```

Resumo dos resultados:
- Backend: 1266 passed, 5 skipped, 278 subtests passed. Sao 13 testes novos; a
  suite estava em 1253 passed antes da entrega.
- Frontend: nao aplicavel nesta fase (nenhum arquivo de `frontend/` alterado).
- Teste negativo: descrito na ultima linha da matriz, executado removendo
  temporariamente o alvo explicito de `_sync_prescricao`.

Ajuste em teste existente: `tests/test_atendimento_upload_endpoint.py` passou a
informar `evolucao_id=None` nas 9 chamadas diretas a `upload_anexo`. Chamando o
endpoint fora do FastAPI, o default `Form(None)` chega como objeto do
framework, nao como `None`.

## 3) Testes manuais

A executar em stage depois da fase 3. O fluxo de API ja pode ser conferido sem
interface:

- Cenario 1: atender um paciente agendado, solicitar um exame, finalizar o
  atendimento. Esperado: OS gerada, agendamento "Realizado", exame solicitado
  sem arquivo.
- Cenario 2 (fase 3): dias depois, abrir o mesmo atendimento. Esperado: banner
  de concluido com a data e acao "Adicionar adendo".
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

## 4) Regressao e riscos residuais

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
- Fase 3 pendente: enquanto a UI nao expoe adendo e receita complementar, o
  caminho novo so existe via API. Nada do comportamento atual mudou para quem
  usa a tela - `prescricao` e o PDF legado seguem identicos.
