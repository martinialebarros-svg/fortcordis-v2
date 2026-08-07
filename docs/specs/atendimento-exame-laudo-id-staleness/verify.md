# Verify - atendimento-exame-laudo-id-staleness

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | test_laudo_id_de_outro_paciente_e_ignorado | ok |
| CA-002 | aceitacao | test_laudo_id_do_mesmo_paciente_e_aceito | ok |
| CA-003 | aceitacao | test_laudo_id_inexistente_e_ignorado | ok |
| CA-004 | aceitacao | test_reenviar_o_mesmo_laudo_id_ja_vinculado_preserva_o_vinculo | ok |
| CA-005 | aceitacao | test_payload_sem_laudo_id_nao_desvincula_laudo_ja_setado (novo) | ok |
| CA-006 | caso de borda | test_payload_sem_laudo_id_em_exame_sem_vinculo_continua_sem_vinculo (novo) | ok |
| CB-001 | caso de borda | cobertura por CA-006 (exame novo, model default None) | ok |
| CB-002 | caso de borda | garantido pela estrutura do loop de `_sync_exames` (cada `payload` da lista e um exame independente, sem estado compartilhado entre iteracoes) - nao adicionado teste dedicado por ser garantia estrutural do codigo existente, nao da mudanca desta feature | ok (por inspecao) |
| NFR-001 | correcao | os 4 testes pre-existentes continuam passando sem modificacao | ok |
| NFR-002 | raio de mudanca | diff de 9 linhas em `atendimento.py`, nenhuma mudanca de assinatura/schema | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
./venv/bin/python -m pytest tests/test_atendimento_exame_laudo_id_propriedade.py -v --no-header
./venv/bin/python -m pytest tests/ -q --no-header
```

Resumo dos resultados:
- Backend (arquivo da feature): 6 passed, 0 failed (4 existentes + 2 novos).
- Backend (suite completa): 657 passed, 0 failed. Baseline antes desta
  feature: 649 (o baseline local subiu para 657 nesta sessao por causa de
  um `git pull --ff-only origin main` que trouxe testes de outros pacotes
  ja promovidos por sessoes paralelas - nao relacionado a esta feature;
  649 + 2 novos = 651, mais 6 de outros pacotes trazidos pelo pull = 657).
- Frontend: nao aplicavel - nenhuma mudanca de frontend.

## 3) Testes manuais

Nao aplicavel. O cenario adversarial (duas abas/sessoes vinculando um
laudo enquanto o atendimento esta aberto com snapshot antigo) e
inteiramente determinístico e reproduzido fielmente por teste unitario
(duas chamadas sequenciais a `_sync_exames` simulando o estado do banco
antes/depois do vinculo criado por outra sessao) - nao depende de timing
de rede, autosave ou navegador.

## 4) Regressao e riscos residuais

- Risco residual 1: a peculiaridade de `mergeAutoSavedFormState`
  (`page.tsx:1320`, nunca atualiza `laudo_id` em memoria a partir da
  resposta do servidor) continua existindo no frontend, mas foi avaliada e
  descartada como inofensiva - `laudo_id` nunca e exibido em nenhum
  componente do atendimento, e a protecao do backend torna irrelevante
  qual valor desatualizado o cliente insiste em reenviar.
- Risco residual 2: `laudo_id` continua fora do rastreamento de
  `exame_ajustes` (auditoria) - se um vinculo for legitimamente alterado
  no futuro por algum caminho ainda nao existente, essa mudanca nao
  deixaria rastro na trilha de auditoria de exame. Fora do escopo desta
  correcao (que e sobre nao apagar, nao sobre auditar).

## 5) Itens fora de escopo entregues

- Nenhum item fora do escopo combinado foi entregue.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).
