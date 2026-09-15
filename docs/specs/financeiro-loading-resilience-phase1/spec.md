# Spec - financeiro-loading-resilience-phase1

Data: 2026-08-26

Responsavel: Codex / equipe FortCordis

Status: done

## 1) Escopo funcional

Tornar o carregamento inicial do Financeiro limitado, cancelavel e parcial. O cliente compartilhado limita apenas leituras JSON idempotentes sem timeout explicito. O Financeiro deixa de usar sucesso tudo-ou-nada, mostra transacoes e ordens conforme cada chamada termina e apresenta aviso recuperavel para as secoes indisponiveis.

## 2) Requisitos funcionais

- RF-001: transacoes devem aparecer quando sua API concluir, mesmo se outra API falhar ou expirar.
- RF-002: ordens/cobrancas devem aparecer quando a API de OS concluir, independentemente da API de transacoes.
- RF-003: secoes que falharem devem ser identificadas em aviso visivel.
- RF-004: o aviso deve oferecer `Tentar novamente` sem recarregar o documento inteiro.
- RF-005: mudanca de filtros deve cancelar a carga anterior antes de iniciar outra.

## 3) Requisitos nao funcionais

- NFR-001 (performance): leitura JSON idempotente sem override deve ter timeout de 15 s.
- NFR-002 (seguranca): nenhuma permissao, payload ou regra financeira sera alterada.
- NFR-003 (integridade): resposta obsoleta/cancelada nao pode sobrescrever a carga atual.
- NFR-004 (compatibilidade): downloads binarios e mutacoes preservam o comportamento anterior.
- NFR-005 (observabilidade): falha tecnica continua registrada no console com o nome da secao, sem payload.

## 4) Contratos tecnicos

### API

- Endpoints: contratos atuais de Financeiro, OS, clinicas e servicos.
- Metodos: apenas leituras existentes; nenhuma nova rota.
- Payload/resposta: inalterados.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Migracao necessaria: nao.

### Frontend

- Arquivos: `frontend/lib/axios.ts`, helper de carga e `frontend/app/financeiro/page.tsx`.
- Estados: carregando transacoes, carregando ordens, carregando meios de pagamento, falhas por secao.
- Regra de erro: preservar dados bem-sucedidos, listar secoes indisponiveis e permitir nova tentativa.

## 5) Compatibilidade e rollout

- Backward compatibility: preservada.
- Feature flag: nao.
- Rollback: reverter a entrega da fase, sem rollback de banco.
- Rollout: PR para `stage`, validacao autenticada em stage e somente depois promocao separada.

## 6) Criterios de aceitacao

- CA-001: timeout e aplicado a leitura JSON segura sem configuracao explicita.
- CA-002: timeout nao e aplicado automaticamente a mutacao ou resposta binaria.
- CA-003: helper distingue sucesso, falha e cancelamento e suprime callbacks apos abort.
- CA-004: Financeiro nao usa mais um `Promise.all` tudo-ou-nada para as sete leituras.
- CA-005: transacoes e ordens possuem indicadores independentes.
- CA-006: falha parcial gera aviso com nova tentativa.
- CA-007: testes, lint, build e guardrail SDD passam.

## 7) Casos de borda

- CB-001: filtro alterado enquanto a carga anterior ainda esta pendente.
- CB-002: apenas uma das APIs de meios de pagamento falha.
- CB-003: resposta chega depois do abort.
- CB-004: usuario tenta novamente enquanto outra carga ainda esta ativa.
- CB-005: erro 401 continua seguindo o fluxo central de encerramento da sessao.

## 8) Fora de escopo

- Cache de catalogos.
- Carga somente da aba ativa.
- Otimizacao de SQL/indices.
- Retry automatico.
- Mudancas de infraestrutura.
