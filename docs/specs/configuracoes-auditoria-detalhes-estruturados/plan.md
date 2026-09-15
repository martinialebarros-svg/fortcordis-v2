# Plan - configuracoes-auditoria-detalhes-estruturados

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Sequencia de fases

- Fase 0 (investigacao): confirmar o que ja existe antes de implementar
  qualquer coisa nova.
- Fase 1/2 (DB/backend): nao aplicavel - endpoint ja existia e ja
  retornava `detalhes`.
- Fase 3 (frontend): renderizar `detalhes` na tabela existente.
- Fase 4 (integracao/observabilidade): validacao visual real com dados
  reais + suite completa.

## 2) Tarefas por fase

### Fase 0

- [x] T0.1 - Buscar `AuditoriaEvento`/`registrar_auditoria` no backend
  antes de assumir que nao existe UI - achado: endpoint
  `GET /admin/auditoria` completo ja existia.
- [x] T0.2 - Buscar "auditoria" no frontend - achado: UI completa (com
  filtros e paginacao) ja existia em `configuracoes/page.tsx`, so nao
  renderizava `detalhes`.
- [x] T0.3 - Ler todos os call sites de `registrar_auditoria` dos
  achados #9/#10/#12/#15/#21 para confirmar o formato exato de
  `detalhes` (2 padroes: `alteracoes` e chave-valor simples).

### Fase 3

- [x] T3.1 - Adicionar state `auditoriaExpandida`.
- [x] T3.2 - Adicionar `formatarValorAuditoria` +
  `renderizarDetalhesAuditoria` (generico, 2 padroes).
- [x] T3.3 - Adicionar coluna "Detalhes" + botao toggle + linha
  expansivel condicional (`Fragment` com `key` por item, já que o
  shorthand `<>` não aceita `key`).
- Criterio de conclusao: `tsc --noEmit` limpo.
- Risco: nenhum identificado.
- Rollback: reverter o commit.

### Fase 4

- [x] T4.1 - Subir backend+frontend locais, criar usuario de teste
  descartavel com papel admin (mesma tecnica de sessoes anteriores:
  email preenchido por mim, senha digitada pelo usuario - nunca digito
  senha em campo, mesmo de conta descartavel).
- [x] T4.2 - Login real, navegar `/configuracoes` > aba Usuarios >
  Auditoria de acoes - confirmar que os 372 registros reais carregam
  (endpoint generico, ja populado por sessoes anteriores).
- [x] T4.3 - Expandir um evento `ATENDIMENTO_CONTEUDO_CLINICO_ATUALIZADO`
  real (gerado pela sessao de teste de corrida anterior) e confirmar via
  DOM real (nao so screenshot) que Campo/Antes/Depois estao corretos:
  `queixa_principal | BASELINE-NOVO | BASELINE-NOVO RACE-FINAL`.
- [x] T4.4 - Descoberto durante o teste visual: a linha expandida ficava
  fora de vista quando a tabela principal estava rolada para a direita
  (onde fica o botao "Ver detalhes") - corrigido com `position: sticky`
  + ajuste de padding, validado de novo visualmente (melhora
  substancial; corte residual de 1-2 palavras documentado como risco
  menor, nao bloqueante).
- [x] T4.5 - Limpar usuario de teste do banco local (eventos de
  auditoria gerados por ele permanecem - sao historico legitimo, nao
  "lixo de teste" a apagar).
- [x] T4.6 - `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`,
  suite completa do backend (isolamento).
- Criterio de conclusao: todos os comandos verdes, funcionalidade
  confirmada com dados reais (nao mock).
- Risco: corte visual residual sob scroll horizontal extremo (ver
  verify.md).
- Rollback: reverter o commit.

## 3) Plano de testes

- Testes unitarios: nao aplicavel - a logica de renderizacao e
  puramente de apresentacao (sem calculo/transformacao de dados alem de
  `JSON.stringify`/desestruturacao simples); o valor da verificacao esta
  em confirmar visualmente contra dados reais, nao em testar a funcao
  isoladamente.
- Testes de integracao: `npx tsc --noEmit` + `npm run lint` + `npm test`
  + `npm run build` (gates do `quality-gate`) + suite completa do
  backend (isolamento).
- Testes manuais: EXECUTADOS nesta sessao (login real, navegacao real,
  expansao real de um evento real) - primeira vez nesta sessao inteira
  que uma feature de UI passa por confirmacao visual completa sem
  ressalva de "nao testado por limitacao de ambiente".

## 4) Dependencias e bloqueios

- Dependencia 1: `GET /api/v1/admin/auditoria` (ja existente,
  inalterado).
- Dependencia 2: papel "admin" no usuario logado (`require_papel`) -
  usuario de teste descartavel criado com esse papel especificamente
  para a validacao.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado (incluindo a correcao de premissa sobre o
  que ja existia).
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambiente de teste definido (backend+frontend locais, usuario
  admin descartavel, navegador real).
