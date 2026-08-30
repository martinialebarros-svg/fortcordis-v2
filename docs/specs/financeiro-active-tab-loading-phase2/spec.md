# Spec - financeiro-active-tab-loading-phase2

Data: 2026-08-29

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Escopo funcional

Implementar o PERF-07 no Financeiro: cada aba solicita apenas seu conjunto de dados, enquanto resumo e configuracoes compartilhadas continuam disponiveis para a pagina. A entrega reaproveita cancelamento, timeout e aviso parcial da Fase 1.

## 2) Requisitos funcionais

- RF-001: Transacoes deve carregar transacoes, sem solicitar OS, clinicas ou servicos.
- RF-002: Cobrancas e Ordens de Servico devem carregar OS, clinicas e servicos, sem solicitar transacoes.
- RF-003: resumo, formas de pagamento e bandeiras devem continuar carregados em qualquer aba.
- RF-004: `?aba=` e `?os_id=` devem ser resolvidos antes da primeira carga util.
- RF-005: troca de aba deve abortar a carga anterior e iniciar o escopo da aba nova.
- RF-006: contador de uma colecao ainda nao carregada deve ser exibido como desconhecido, nao como zero confirmado.
- RF-007: nova tentativa e recargas apos mutacao devem respeitar a aba ativa.

## 3) Requisitos nao funcionais

- NFR-001 (performance): entrada padrao elimina tres leituras volumosas nao utilizadas.
- NFR-002 (integridade): resposta cancelada nao atualiza dados ou falhas da aba atual.
- NFR-003 (compatibilidade): contratos, filtros e mutacoes permanecem inalterados.
- NFR-004 (seguranca): nenhuma permissao ou payload financeiro novo sera introduzido.
- NFR-005 (testabilidade): a decisao de secoes por aba deve ser uma funcao pura coberta por testes.

## 4) Contratos tecnicos

### API

- Transacoes: `GET /financeiro/transacoes` somente na aba `transacoes`.
- OS e catalogos: `GET /ordens-servico`, `GET /clinicas` e `GET /servicos` somente nas abas `cobrancas`/`ordens`.
- Compartilhados: resumo, formas de pagamento e bandeiras em qualquer aba.
- Metodos, parametros e respostas: inalterados.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: nao.

### Frontend

- `frontend/lib/financeiro-loading.ts`: plano puro de carga por aba.
- `frontend/app/financeiro/page.tsx`: resolucao inicial de rota, orquestracao condicional e contadores desconhecidos.
- A carga inativa deve ser representada por uma promessa resolvida/cancelada sem iniciar requisicao HTTP.

## 5) Compatibilidade e rollout

- Backward compatibility: preservada.
- Feature flag: nao.
- Rollback: reverter a entrega, sem rollback de banco.
- Rollout: PR para `stage`, aceite autenticado e promocao separada somente apos reconciliacao de branches.

## 6) Criterios de aceitacao

- CA-001: teste prova que `transacoes` habilita apenas a colecao de transacoes.
- CA-002: testes provam que `cobrancas` e `ordens` habilitam OS e seus catalogos.
- CA-003: codigo da pagina nao instancia chamadas de OS/clinicas/servicos no plano de Transacoes.
- CA-004: links diretos aguardam a resolucao dos parametros antes de carregar.
- CA-005: mudanca de aba participa das dependencias do efeito cancelavel.
- CA-006: contadores desconhecidos nao exibem zero confirmado.
- CA-007: testes, lint, build e guardrail SDD passam.

## 7) Casos de borda

- CB-001: entrada sem parametro usa Transacoes.
- CB-002: entrada com `?aba=cobrancas` ou `?aba=ordens`.
- CB-003: entrada com `?os_id=` forca Ordens e limpa filtros de OS.
- CB-004: usuario troca de aba antes da resposta atual.
- CB-005: primeira resposta valida e uma lista vazia; contador deve entao mostrar zero.

## 8) Fora de escopo

- Cache de catalogos, paginacao, SQL, indices, pool de banco e HTTP/2.
- Layout persistente da area autenticada.
- Alteracao de regras de negocio ou APIs.
