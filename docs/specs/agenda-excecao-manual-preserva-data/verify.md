# Verify - agenda-excecao-manual-preserva-data

Data: 2026-09-09  
Responsavel: Martiniano Barros  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `NovoAgendamentoModal.excecao-manual.test.tsx` - "mantem motivo e horario liberados ao trocar a data depois da excecao concedida" (assert `inputHora.disabled === false` apos trocar a data) | ok |
| CA-002 | aceitacao | mesmo teste: textarea do motivo preserva o texto e "Excecao concedida por admin" segue no DOM | ok |
| CA-003 | aceitacao | mesmo teste: "Oferta 1:" sai do DOM e aparece "Data ajustada sob excecao concedida" | ok |
| CA-004 | aceitacao | `NovoAgendamentoModal.excecao-manual.test.tsx` - "mantem o bloqueio guiado sem excecao..." (data e hora `disabled` com panorama gerado e apos recusar todas) | ok |
| CA-005 | aceitacao | mesmo teste: apos "Revogar excecao", data e hora voltam a `disabled` | ok |
| RF-001..RF-005 | funcional | `agenda-assistente-excecao.test.ts` (8 casos) + testes de componente acima | ok |
| RF-006 | funcional | guarda `if (excecaoManualAtiva) return;` antes do cooldown/popup em `buscarSugestaoProximidade`; revisao de codigo | ok |
| NFR-002 | nao funcional | `excecaoManualEstaLiberada` exige `isAdmin`, `decisaoAssistente === "sem_opcao"` e `excecaoConcedida`; payload de `POST /agenda` inalterado | ok |
| Regressao | teste negativo | com o `handleDataChange` antigo (`if (!isEditando) resetFluxoAssistente()`), o teste de CA-001 falha em `expect(inputHora.disabled).toBe(false)` | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npm run lint
npx vitest run
```

Resumo dos resultados:
- Backend: nao aplicavel (nenhum arquivo de `backend/` alterado).
- Frontend: `tsc` sem erros; `eslint --max-warnings=0` limpo;
  `vitest run` com 37 arquivos e 249 testes passando (inclui os 8 casos do
  helper e os 2 casos de componente novos).

## 3) Testes manuais

Executados em producao pelo responsavel em 2026-09-10, com resultado positivo.

- Cenario 1 (ok): novo agendamento em clinica georreferenciada, gerar melhor
  oferta, recusar todas, registrar motivo, conceder excecao, trocar a data e
  conferir que hora continua editavel e o motivo permanece. Confirmado pelo
  responsavel: o fluxo deixou de exigir a repeticao do ciclo.
- Cenario 2 (nao reportado individualmente): conferir nas observacoes do
  agendamento salvo as linhas `[Assistente agenda] sem opcao aderente para o
  cliente.`, o motivo informado e `[Assistente agenda] excecao manual concedida
  por admin.` Nao houve mudanca nesse trecho do codigo, entao nao bloqueia a
  aprovacao.
- Cenario 3 (nao reportado individualmente): usuario nao admin recusando todas
  as ofertas continua sem liberar data/hora e mantendo o caminho de solicitar
  excecao ao admin. Coberto pelos testes automatizados (`isAdmin` falso em
  `agenda-assistente-excecao.test.ts` e bloqueio guiado no teste de componente).

## 4) Regressao e riscos residuais

- Risco residual 1: apos trocar a data sob excecao, o panorama operacional da
  nova data nao e consultado automaticamente. E o comportamento pretendido da
  excecao (escolha manual), mas o admin deixa de ver ofertas da nova data a
  menos que clique em "Gerar melhor oferta" - o que reinicia o desfecho.
- Risco residual 2: o teste de componente depende da estrutura do DOM do modal
  (label "Clínica", placeholder do motivo, rotulos dos botoes); mudancas de
  texto nesses pontos exigem ajuste no teste.

## 5) Itens fora de escopo entregues

- Supressao do popup de sugestao de proximidade enquanto a excecao esta ativa
  (RF-006). Entrou porque a mesma troca de data disparava o popup "Posso
  aplicar esse horario?" logo depois de o admin ter decidido pelo horario
  manual.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado (descrever motivo).

Observacao: o codigo chegou a producao antes da validacao manual (ver secao 7).
A aprovacao foi marcada depois, em 2026-09-10, quando o responsavel executou o
cenario 1 em producao e confirmou o comportamento corrigido.

## 7) Registro de promocao

| Etapa | Commit | Data (local) | Como |
| --- | --- | --- | --- |
| Merge em `stage` | `0434ff36` | 2026-09-09 21:41 | squash do PR #101, com `sdd-guardrail` e `migration-tests` verdes |
| Chegada em `main` | `04863ec2` | 2026-09-09 21:55 | push direto de `04863ec2` para `main` e `stage`, que carregou junto o `0434ff36` |
| Validacao em producao | - | 2026-09-10 | cenario 1 executado pelo responsavel, com resultado positivo; "Aprovado para producao" marcado na secao 6 |

Detalhes:

- `origin/main` e `origin/stage` ficaram no mesmo commit (`04863ec2`), com zero
  commits de diferenca nos dois sentidos.
- A promocao nao passou pelo PR `stage -> main` nem por
  `scripts/promote_stage_to_main.sh`. O commit `04863ec2`
  (`feat(whatsapp): simplify request flow and verify appointment identities`)
  foi para as duas branches 14 minutos depois do merge do PR #101 e levou esta
  correcao junto.
- Como `main` faz deploy automatico, a correcao entrou em producao nesse push,
  sem a validacao manual da secao 3.
- A validacao manual acabou acontecendo direto em producao, em 2026-09-10, e
  passou. Nao ha acao pendente nesta feature.
