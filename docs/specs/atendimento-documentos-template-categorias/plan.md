# Plan - atendimento-documentos-template-categorias

Data: 2026-08-13
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Sequencia de fases

- Fase 1 (DB/migracoes): nao se aplica.
- Fase 2 (backend/API): nao se aplica.
- Fase 3 (frontend): agrupamento de `templatesAtivos` por `tipo`;
  reestruturacao do `<select>` com `<optgroup>`.
- Fase 4 (integracao/observabilidade): tsc/build, preview local (dados
  reais + um template extra inserido para testar agrupamento com 2+
  itens do mesmo tipo), revisao adversarial.

## 2) Tarefas por fase

### Fase 3

- [x] T3.1 Adicionar `templatesPorTipo` logo apos `templatesAtivos`,
  usando `reduce()` (mesmo estilo do restante do arquivo, sem `useMemo`).
- [x] T3.2 Reestruturar o `.map()` do select: iterar
  `Object.entries(templatesPorTipo)`, renderizando um `<optgroup
  label={tipo}>` por grupo, mantendo o `.map()` interno das `<option>`
  identico ao original (mesmo `key`, `value`, texto).
- Criterio de conclusao: `tsc --noEmit` aprovado, JSX valido.
- Risco: colisao/perda de opcoes ao reagrupar - mitigado por preservar
  exatamente os mesmos `key`/`value`/texto de antes, so mudando o
  elemento pai de cada option.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 `npx tsc --noEmit` e `npm run build` no worktree isolado.
- [x] T4.2 Preview local (backend + frontend do worktree, portas
  dedicadas `8132`/`3112`), autenticacao via `fetch()`/`localStorage`.
- [x] T4.3 Inspecionado o banco copiado: 6 templates seed, cada um com
  `tipo` distinto ("parecer", "atestado", "declaracao", "encaminhamento",
  "autorizacao", "orientacoes"). Inserido um 7o template ("Atestado de
  repouso", `tipo: "atestado"`) diretamente no banco copiado (nunca
  commitado) para testar o cenario de 2+ templates do mesmo tipo.
- [x] T4.4 Confirmado via JS (`querySelectorAll('optgroup')`): 6
  `<optgroup>` no total, com o grupo `"atestado"` contendo corretamente
  as 2 opcoes ("Atestado de saude" e "Atestado de repouso"), e os demais
  5 grupos com 1 opcao cada - ordem dos grupos identica a ordem de
  `ordem` no backend.
- [x] T4.5 Selecionado programaticamente a opcao "Atestado de repouso"
  (dentro do grupo "atestado") e confirmado que `select.value` atualizou
  corretamente para o `id` certo (7).
- [x] T4.6 Checado console/rede: unico erro e o pre-existente
  `/api/v1/alertas-internos` (mesma causa documentada nos pacotes
  anteriores); `GET /atendimentos/documentos/templates?include_inactive=1`
  retornou 200 OK.
- [x] T4.7 Revisao adversarial via agente, focada em: corretude do
  agrupamento; preservacao de `value`/selecao; ausencia de regressao no
  botao "Criar"; corretude da chave de fallback "Outros".
- Criterio de conclusao: tsc/build limpos, agrupamento confirmado
  estruturalmente com dados reais (incluindo um grupo com 2+ itens), sem
  achados nao tratados na revisao adversarial.
- Risco: nenhum residual conhecido apos a verificacao.
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes automatizados: nao aplicavel (sem suite de testes de componente
  React no projeto para este modulo).
- Verificacao tipo/build: `tsc --noEmit`, `npm run build`.
- Verificacao funcional: preview local com um template extra inserido no
  banco copiado especificamente para exercitar o cenario de agrupamento
  com 2+ itens do mesmo tipo (nao presente nos dados seed originais).
- Revisao adversarial: agente dedicado lendo o diff final.

## 4) Dependencias e bloqueios

- Dependencia: campo `tipo` em `DocumentoAtendimentoTemplate` -
  **atendida**, ja existente e retornado pela API, inalterado por este
  pacote.
- Sem bloqueios de infraestrutura conhecidos (sem migration, sem mudanca
  de API).
- Nota (nao-bloqueante): o preview local acusou 500 em
  `/api/v1/alertas-internos` (drift de schema pre-existente no snapshot
  do banco copiado), sem relacao com este pacote.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido: worktree isolado + preview local com
  banco copiado (gitignored, removido ao final) + template extra
  inserido so no banco copiado para teste de agrupamento.
