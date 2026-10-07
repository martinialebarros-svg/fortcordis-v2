# Verify - agenda-lista-status-atual-acoes

Data: 2026-10-06
Status: verificado localmente; sem publicacao

## 1) Evidencia anterior a mudanca

- Captura fornecida pelo usuario: o card mostra `Agendado` no cabecalho e
  `Cancelado` como botao de transicao, ambos com icone, cor e borda.
- `frontend/app/agenda/page.tsx` renderiza o selo do estado atual a partir
  de `ag.status` e os botoes a partir de `obterProximosStatus(ag.status)`.
  Antes da mudanca, o texto normal de cada botao era `novoStatus`.
- `frontend/lib/agenda-shared-actions.ts` ja define rotulos verbais para
  as transicoes. `agenda-shared-actions.test.ts` cobre a ordem especial
  `Agendado` antes de `Confirmado` quando o estado atual e `Reservado`.

Esses itens confirmam a estrutura da interface; nao provam, isoladamente,
qual detalhe visual causou a interpretacao equivocada relatada.

## 2) Matriz de verificacao da entrega

Navegador local com API mock e agendamentos sinteticos, sem alterar
agendamentos reais:

| Criterio | Evidencia observada | Resultado |
| --- | --- | --- |
| CA-001 | O card `Agendado` mostrou `Status atual: Agendado` antes do grupo `Alterar status`; `Cancelar` apareceu como acao. `page.feedback.test.tsx` confirmou que o status nao e botao, que `Cancelado` nao e rotulo de botao e que `Cancelar` chama `/agenda/93/status?status=Cancelado`. | passou |
| CA-002 | O card `Reservado` foi visto no navegador; `agenda-shared-actions.test.ts` preserva `Agendado` antes de `Confirmado`. Revisao do diff confirmou que o clique ainda passa o mesmo `novoStatus` a `atualizarStatus`. | passou |
| CA-003 | Cards `Confirmado`, `Realizado` e `Expirado` foram vistos no navegador com rotulos verbais e contextuais; `Agendar apos confirmacao tardia` ocupa a largura toda do grupo em 375 px. | passou |
| CA-004 | Em 1440x900, 768x1024 e 375x812, o status veio antes das acoes, os botoes mediram 44 px ou mais e `document.scrollWidth == innerWidth`. Nao houve rolagem horizontal. | passou |
| CA-005 | Tab chegou a `Confirmar` com `:focus-visible` verdadeiro e anel azul visivel. O teste confirmou que o status atual e texto, nao botao; os botoes de transicao compartilham as mesmas classes de foco e a ordem do DOM. | passou por amostragem e revisao |
| CA-006 | Teste focado 5/5; `npm test`: 76 arquivos e 522 testes Vitest, alem de 9 testes Node; `npm run lint`, `npx tsc --noEmit` e `npm run build` passaram. | passou |
| CA-007 | `scripts/ci/check_sdd_guardrail.py::evaluate_guardrail` aplicado localmente aos dois arquivos frontend alterados e aos quatro artefatos SDD novos: `passed=True`, feature qualificada `agenda-lista-status-atual-acoes`. | passou em simulacao local |

## 3) Comandos e resultado

No diretorio `frontend`:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Todos passaram. O `npx tsc --noEmit` passou depois de corrigir o tipo do
fixture em `app/agenda/page.feedback.test.tsx`. O teste focado dessa pagina
passou 5/5 antes da suite completa.

O guardrail foi avaliado pela funcao `evaluate_guardrail` sobre arquivos
ainda nao commitados. Isso simula a regra do gate, mas nao equivale a
executar o comando de CI com `base_sha`/`head_sha` nem a um workflow remoto.

## 4) Limites da evidencia

O navegador local usou API mock e dados sinteticos; nao houve mudanca de
dados reais nem publicacao em stage ou producao. O teste de teclado
observou `Confirmar` diretamente e a revisao cobriu as classes comuns dos
demais botoes. A validacao visual comprova o layout nas tres viewports
testadas, mas nao mede a taxa de erro de leitura no uso cotidiano.
