# Verify - atendimento-conclusao-confirmavel

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done (backend e build verificados; smoke manual de UI pendente)

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `test_finalizacao_vinculada_persiste_atendimento_agenda_e_os`, `test_conclusao_valida_normaliza_status_e_marca_consulta` (ja existentes, continuam passando sem mudanca de comportamento) | ok |
| CA-002 | aceitacao | `test_prontuario_incompleto_exige_confirmacao_nao_altera_agenda_nem_cria_os`, `test_primeira_transicao_vazia_para_concluido_exige_confirmacao_e_preserva_estado`, `test_criacao_vazia_como_concluida_exige_confirmacao_antes_de_gravar` | ok |
| CA-003 | aceitacao | `test_prontuario_incompleto_com_confirmacao_finaliza_e_audita`, `test_primeira_transicao_vazia_com_confirmacao_conclui_e_audita`, `test_criacao_vazia_como_concluida_com_confirmacao_e_gravada_e_auditada` | ok |
| CA-004 | aceitacao | mesmos testes acima cobrem os tres pontos de entrada: `finalizar_atendimento`, `atualizar_atendimento`, `criar_atendimento` | ok |
| CA-005 | aceitacao | `pytest tests/ -k atendimento`: 98 aprovados; suite completa: 561 aprovados, 0 falhas | ok |
| NFR-001 | nao funcional | `auditoria_mock.call_count == 1` com `acao=CONCLUIR_COM_PENDENCIAS` em todos os testes do caminho de confirmacao | ok |
| NFR-002 | nao funcional | sem o novo campo (`AtendimentoFinalizarPayload(tipo_horario=...)` sem `confirmar_conclusao_pendencias`), o bloqueio continua ocorrendo - so mudou o status HTTP (409 em vez de 422) | ok |
| NFR-003 | nao funcional | os tres call sites usam a mesma funcao `_validar_primeira_conclusao_atendimento` e o mesmo `codigo` | ok |
| CB-001 | borda | coberto por leitura de codigo: `_validar_primeira_conclusao_atendimento` so audita quando `pendencias` e nao-vazio, e o retorno vazio nao aciona `_auditar_conclusao_com_pendencias` nos tres call sites (`if pendencias_conclusao:`) | ok |
| CB-002 | borda | `_status_atendimento_concluido(status_atual)` early-return em `_validar_primeira_conclusao_atendimento` - coberto pelos testes existentes de "registro legado ja concluido continua editavel" | ok |
| CB-003 | borda | comportamento do `window.confirm` sem confirmar - verificado por leitura de codigo (`if (window.confirm(...)) { await finalizarAtendimento(true) }`, sem `else`, entao cancelar so encerra a funcao sem nova chamada) | pendente (nao testavel sem runner de frontend) |

## 2) Testes automatizados executados

```bash
cd backend
./venv/bin/python -m pytest tests/ -k atendimento -q --no-header
./venv/bin/python -m pytest tests/ -q --no-header

cd ../frontend
npx tsc --noEmit --pretty false
npx eslint app/atendimento/page.tsx
npm run build
```

Resumo dos resultados:

- **Backend, modulo Atendimento:** `98 passed, 463 deselected` (baseline antes
  deste pacote: 91). Os 7 testes novos/alterados:
  - `test_atendimento_clinical_lifecycle.py`: 2 testes renomeados
    (`test_criacao_vazia_como_concluida_exige_confirmacao_antes_de_gravar`,
    `test_primeira_transicao_vazia_para_concluido_exige_confirmacao_e_preserva_estado`)
    passam a esperar `409` confirmavel em vez de `422` incondicional; 2 testes
    novos verificam o caminho de confirmacao (criacao e atualizacao) com
    asserção de auditoria.
  - `test_atendimento_transactional_finalization.py`: 1 teste renomeado
    (`test_prontuario_incompleto_exige_confirmacao_nao_altera_agenda_nem_cria_os`)
    passa a esperar `409`; 1 teste novo cobre a finalizacao confirmada com
    pendencia, incluindo a auditoria.
- **Backend, suite completa:** `561 passed`, nenhuma falha (rodado num
  worktree limpo baseado em `origin/stage`, sem os arquivos untracked do
  pacote Portal que causam a falha do ciclo de migration em ambiente local de
  desenvolvimento).
- **TypeScript:** aprovado, sem diagnosticos.
- **ESLint:** aprovado no arquivo alterado.
- **Build Next.js:** aprovado.

## 3) Testes manuais

Sem runner de teste no frontend. Roteiro para validacao humana:

1. Abrir um atendimento sem diagnostico nem plano terapeutico preenchidos,
   clicar "Finalizar atendimento". *Esperado:* dialogo de confirmacao
   nativo listando o que falta ("Faltam preencher: diagnostico ou plano
   terapeutico...").
2. Cancelar o dialogo. *Esperado:* nada muda, sem mensagem de erro, o
   atendimento continua editavel.
3. Repetir e confirmar. *Esperado:* atendimento concluido normalmente (Agenda
   realizada e OS gerada, se vinculado).
4. Repetir com um atendimento que ja tem os tres grupos preenchidos.
   *Esperado:* finaliza direto, sem dialogo de confirmacao.

## 4) Regressao e riscos residuais

- **Risco residual 1:** conclusao com pendencias agora e possivel (antes era
  impossivel). Mitigado por auditoria (`CONCLUIR_COM_PENDENCIAS`), mas o
  volume real de uso dessa confirmacao deve ser observado depois do deploy -
  se virar rotina em vez de excecao, vale reconsiderar a decisao de manter a
  exigencia como esta.
- **Risco residual 2:** o smoke manual (secao 3) nao foi executado por um
  humano ainda.
- Nao ha bloqueio de infraestrutura conhecido para este pacote (sem
  migration).

## 5) Itens fora de escopo entregues

- Nenhum. O escopo desta rodada ficou estritamente dentro do que foi pedido:
  manter a exigencia, trocar o mecanismo de bloqueio por confirmacao.

## 6) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Pendente: aguarda o roteiro manual da secao 3 e autorizacao explicita
  para deploy (mesmo processo do pacote anterior: push para `origin/stage`
  validado pelos gates de CI, depois `scripts/promote_stage_to_main.sh`).
