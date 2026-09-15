# Spec - financeiro-resumo-recarga-desnecessaria

Data: 2026-09-13  
Responsavel: Martiniano Barros  
Status: implementado

## 1) Escopo

Frontend. `frontend/lib/financeiro-loading.ts` e o trecho de carga de
`frontend/app/financeiro/page.tsx`. Sem mudanca de backend, contrato ou calculo.

## 2) Requisitos funcionais

- RF-001: trocar de pagina em Transacoes nao dispara `/financeiro/resumo`.
- RF-002: trocar filtro, busca ou aba tambem nao dispara.
- RF-003: trocar o periodo dispara.
- RF-004: a primeira carga da tela dispara.
- RF-005: recarga explicita (botoes "Recarregar") e recarga pos-mutacao sempre
  disparam, mesmo com o periodo inalterado.
- RF-006: o valor exibido continua vindo de `/financeiro/resumo`, nunca da soma
  da pagina.

## 3) Requisitos tecnicos

- RT-001: a decisao sai de `page.tsx` para `deveRecarregarResumo` em
  `frontend/lib/financeiro-loading.ts`, onde e testavel sem renderizar a pagina.
- RT-002: `carregarDados` ganha o parametro `origem: FinanceiroLoadOrigin` com
  **default `"manual"`**, para que ponto de chamada nao migrado siga
  recarregando. So o efeito passa `"efeito"`.
- RT-003: o periodo carregado vive num `useRef` e e gravado **dentro do
  `onSuccess`**, nunca antes da resposta.
- RT-004: nenhum `onClick` pode receber `carregarDados` diretamente, sob pena de
  o `MouseEvent` ocupar o parametro `origem`.

## 4) Criterios de aceitacao

- CA-001: `deveRecarregarResumo({origem:"efeito", periodoAtual:"mes", periodoCarregado:"mes"})` e `false`.
- CA-002: com `periodoCarregado` diferente, e `true`.
- CA-003: com `periodoCarregado: null` (primeira carga), e `true`.
- CA-004: com `origem:"manual"` e periodo igual, e `true`.
- CA-005: `npx tsc --noEmit`, `npx vitest run`, `npm run lint` e `npm run build`
  limpos.
- CA-006: em stage, trocar filtro em Transacoes nao aumenta a contagem de
  chamadas a `/financeiro/resumo`; trocar o periodo aumenta.

## 5) Fora de escopo

- Paginacao de Ordens e Cobrancas.
- Qualquer outra carga orquestrada por `carregarDados`.

## 6) Nota sobre verificacao em stage

CA-006 usa **troca de filtro**, nao paginacao. Stage tem 23 transacoes para uma
pagina de 100, entao nao ha pagina 2 (limitacao ja registrada em
`financeiro-transacoes-pagination`). O defeito nao e especifico de paginacao:
qualquer reexecucao do efeito o disparava, e trocar filtro exercita o mesmo
caminho.
