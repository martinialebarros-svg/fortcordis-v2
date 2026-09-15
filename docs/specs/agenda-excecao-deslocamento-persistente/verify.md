# Verify - agenda-excecao-deslocamento-persistente

Data: 2026-08-23
Status: verificacao automatizada concluida; validacao manual em stage pendente

## 1) Testes automatizados

`backend/tests/test_agenda_excecao_deslocamento_persistente.py` (11 casos), com
`_obter_duracao_deslocamento_operacional` mockado em 75 min (acima do limite de
45) e um vizinho as 10:00 para o agendamento alvo das 11:00:

| Teste | CA coberto |
| --- | --- |
| `test_bloqueia_sem_excecao_e_sinaliza_concessao_quando_admin_confirma` | CA-001, CA-002 |
| `test_excecao_persistida_libera_validacao_sem_nova_confirmacao` | CA-003 |
| `test_excecao_perde_validade_quando_horario_ou_destino_muda` | CA-005 |
| `test_excecao_sobrevive_ao_preenchimento_de_paciente_e_tutor` | CA-003, CB-006 |
| `test_excecao_domiciliar_invalida_quando_tutor_muda` | CA-005 |
| `test_reativacao_de_expirado_e_bloqueada_sem_excecao` | CA-001 |
| `test_nao_admin_nao_pode_confirmar_conflito_na_troca_de_status` | CA-004 |
| `test_admin_confirma_conflito_e_excecao_fica_persistida` | CA-002 |
| `test_excecao_concedida_antes_libera_nova_reativacao_sem_confirmar` | CA-003 |
| `test_reabilitar_reserva_respeita_excecao_ja_concedida` | CA-003 |
| `test_reabilitar_reserva_sem_excecao_continua_bloqueada` | CA-001 |

Comandos executados (2026-08-23, local):

```bash
cd backend && venv/bin/python -m pytest tests/test_agenda_excecao_deslocamento_persistente.py -q
```
Resultado: `11 passed`.

```bash
cd backend && venv/bin/python -m pytest tests/ -q
```
Resultado: `857 passed, 41 subtests passed` (nenhuma regressao).

```bash
cd frontend && npx tsc --noEmit -p tsconfig.json && npm run lint && npm test
```
Resultado: typecheck sem erros, eslint sem warnings, `14 arquivos / 85 testes`
vitest + `9` testes node passando.

## 2) Verificacao manual pendente (stage)

Cenario reportado, na tela `/agenda` (lista) e em `/agenda/fullcalendar`:

1. Como admin, criar agendamento em clinica distante confirmando o conflito de
   rota. Esperado: salva e `excecao_deslocamento_ativa=true` no GET do
   agendamento.
2. Deixar a reserva expirar (ou expirar manualmente em stage) e usar
   "Agendar após confirmação tardia". Esperado: **passa sem novo bloqueio de
   deslocamento** e evento `AGENDA_EXCECAO_DESLOCAMENTO_APLICADA` na auditoria.
3. Em um agendamento com conflito e **sem** excecao, trocar o status como admin.
   Esperado: dialogo "Conflito de deslocamento na rota"; ao confirmar, a acao
   conclui e o evento `AGENDA_EXCECAO_DESLOCAMENTO_CONCEDIDA` e gravado.
4. Repetir o passo 3 com usuario nao-admin. Esperado: mensagem de erro do
   backend, sem dialogo de excecao.
5. Remarcar o agendamento com excecao para outro horario conflitante.
   Esperado: bloqueio volta a aparecer (excecao invalidada).
6. "Reabilitar reserva" em agendamento expirado com excecao valida.
   Esperado: reabilita sem pedir confirmacao de rota.

## 3) Checagens de banco

```sql
-- Colunas criadas pela migracao 20260823_75
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'agendamentos' AND column_name LIKE 'excecao_deslocamento%';

-- Trilha de auditoria da excecao
SELECT created_at, acao, usuario_nome, entidade_id, detalhes_json
  FROM auditoria_eventos
 WHERE acao LIKE 'AGENDA_EXCECAO_DESLOCAMENTO%'
 ORDER BY id DESC LIMIT 20;
```

## 4) Observacoes

- A excecao nao cobre mudanca de **vizinhos** de rota (CB-005): um conflito
  novo criado por outro agendamento na mesma rota aprovada continua sendo
  liberado. O evento `..._APLICADA` a cada reuso e a mitigacao escolhida;
  reavaliar se aparecer caso real.
- Nenhuma alteracao foi aplicada em producao: o fluxo do projeto e stage-first
  e a promocao para `main` depende de confirmacao explicita.
