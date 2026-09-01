# Plano colaborativo de melhoria de desempenho e carregamento

Data de abertura: 2026-08-26

Status: em andamento

Responsavel pela coordenacao inicial: Codex / equipe FortCordis

Branch inicial: `codex/performance-phase-1`

PR colaborativo da Fase 1: [#77 - plano colaborativo e resiliencia do Financeiro](https://github.com/martinialebarros-svg/fortcordis-v2/pull/77)

Branch da entrega PERF-07: `codex/performance-phase-2-perf07`

PR colaborativo do PERF-07: [#89 - carregar dados por aba ativa](https://github.com/martinialebarros-svg/fortcordis-v2/pull/89)

## 1. Objetivo

Eliminar telas que permanecem carregando indefinidamente e reduzir o tempo percebido nas rotas autenticadas, sem alterar regras clinicas, financeiras ou de autorizacao. Este documento e o ponto de coordenacao para contribuidores: cada tarefa deve gerar uma entrega pequena, testavel e rastreavel por PR.

## 2. Linha de base autenticada

Medicao somente leitura realizada em producao em 2026-08-26:

| Rota | Tempo ate estabilizar | Resultado |
| --- | ---: | --- |
| `/dashboard` | 6,1 s | concluiu |
| `/agenda` | 15,4 s | concluiu lentamente |
| `/atendimento` | aproximadamente 30 s | excedeu 10 s antes de concluir |
| `/financeiro` | acima de 60 s | permaneceu em `Carregando...` |
| `/financeiro` apos atualizar | acima de 30 s | permaneceu em `Carregando...` |
| `/laudos` | 4,8 s | concluiu |

Nenhuma dessas navegacoes registrou erro no console. A evidencia aponta para requisicoes pendentes/lentas e estados de UI dependentes do lote completo, e nao para uma excecao JavaScript explicita.

## 3. Principios de execucao

- Preservar contratos de API e regras de negocio em entregas de resiliencia.
- Nenhuma tela pode aguardar uma leitura HTTP indefinidamente.
- Falha de uma secao nao deve esconder dados carregados por outras secoes.
- Requisicoes obsoletas devem ser canceladas para evitar corrida e consumo duplicado.
- Mutacoes nao recebem retry automatico: um timeout nao prova que o servidor deixou de processar a operacao.
- Medicoes autenticadas nao devem registrar nomes, dados clinicos ou payloads financeiros.
- Mudancas de codigo exigem `intent.md`, `plan.md`, `spec.md` e `verify.md` no mesmo ciclo.

## 4. Roadmap e tarefas independentes

### Fase 1 - carregamento limitado e recuperavel

Objetivo: impedir espera infinita e recuperar o Financeiro, rota mais critica da linha de base.

| ID | Tarefa | Estado | Criterio de conclusao |
| --- | --- | --- | --- |
| PERF-01 | Aplicar timeout padrao somente a leituras JSON idempotentes | concluido em producao | GET/HEAD JSON sem override encerram em ate 15 s; blobs e mutacoes preservam comportamento |
| PERF-02 | Cancelar carga anterior do Financeiro ao trocar filtros ou desmontar a tela | concluido em producao | resposta obsoleta nao atualiza o estado |
| PERF-03 | Separar estados de carga de transacoes e ordens | concluido em producao | uma secao bem-sucedida aparece mesmo se outra falhar |
| PERF-04 | Exibir aviso com secoes indisponiveis e acao `Tentar novamente` | concluido em producao | falha deixa de parecer lista vazia ou spinner infinito |
| PERF-05 | Cobrir politica de timeout e orquestracao de secoes com testes | concluido em producao | testes, lint, build e SDD guardrail verdes |

### Fase 2 - reduzir trabalho no frontend

| ID | Tarefa | Estado | Criterio de conclusao |
| --- | --- | --- | --- |
| PERF-06 | Criar layout persistente da area autenticada | concluido em producao | auth, branding, push e alertas nao remontam em cada rota |
| PERF-07 | Financeiro carregar apenas dados da aba ativa | concluido em producao | aba de transacoes nao baixa OS/clinicas/servicos na entrada |
| PERF-08 | Agenda substituir listas de 1000/2000 itens por lotes/IDs visiveis | concluido em producao | carga inicial nao baixa catalogos completos sem uso imediato |
| PERF-09 | Atendimento paginar pacientes, medicamentos e frases | concluido em producao | dados secundarios sao carregados sob demanda |
| PERF-10 | Adotar cache com validade para catalogos estaveis | concluido em producao | navegacao nao repete catalogos ainda validos |

### Fase 3 - consultas e banco

| ID | Tarefa | Estado | Criterio de conclusao |
| --- | --- | --- | --- |
| PERF-11 | Remover N+1 do resumo financeiro da Agenda | concluido em producao | quantidade de queries constante por pagina |
| PERF-12 | Paginar a fila de Laudos no banco | concluido em producao | nenhuma montagem integral seguida de slice em memoria |
| PERF-13 | Revisar indices com `EXPLAIN ANALYZE` | em desenvolvimento | plano e ganho anexados ao PR, sem indice especulativo |
| PERF-14 | Configurar pool, `pre_ping`, reciclagem e timeouts de conexao | pendente | conexoes degradadas falham de modo limitado e observavel |

### Fase 4 - infraestrutura e observabilidade

| ID | Tarefa | Estado | Criterio de conclusao |
| --- | --- | --- | --- |
| PERF-15 | Separar API web e workers periodicos | pendente | workers nao competem no mesmo processo da API |
| PERF-16 | Habilitar e validar HTTP/2 no Nginx | pendente | `curl --http2` negocia HTTP/2 no host canonico |
| PERF-17 | Persistir p50/p95/p99, tempo de banco e espera de pool | pendente | painel permite localizar endpoint lento por release |
| PERF-18 | Tornar o gate autenticado e sensivel a latencia | pendente | 401/403 nao contam como sucesso e p95 excedido bloqueia release |

## 5. Metas de aceitacao

- Nenhuma tela permanece em carregamento sem limite ou acao de recuperacao.
- Shell e navegacao visivel: p95 abaixo de 1 s apos a sessao estar ativa.
- Dados essenciais da rota: p95 abaixo de 2 s; dados secundarios abaixo de 3 s.
- APIs de listagem: meta inicial p95 abaixo de 1,2 s, evoluindo para 800 ms.
- Erros e timeouts abaixo de 1% em janela operacional representativa.
- Nenhuma carga inicial baixa mais de 500 registros sem justificativa registrada.

As metas devem ser recalibradas depois que a telemetria persistente estiver disponivel.

## 6. Como colaborar

1. Escolha um ID `PERF-*` sem outro responsavel ativo.
2. Crie uma branch curta a partir do `origin/stage` atualizado.
3. Atualize ou crie a feature SDD correspondente antes da implementacao.
4. Nao misture refatoracao ampla, regra de negocio e performance no mesmo PR.
5. Inclua no PR: linha de base, resultado posterior, comandos executados, risco e rollback.
6. Abra PR para `stage`; producao exige promocao separada do snapshot validado.
7. Marque a tarefa neste documento somente quando houver evidencia reproduzivel.

## 7. Dependencias e bloqueios conhecidos

- Em 2026-08-29, `origin/main` e `origin/stage` possuem historicos divergentes. PRs para `stage` podem seguir, mas qualquer promocao desta trilha exige reconciliacao e nova prova de ancestralidade.
- As medicoes detalhadas de endpoint ainda dependem de telemetria autenticada/persistente; o navegador integrado forneceu tempos de estabilizacao da tela, mas nao exportou o waterfall de rede.
- Alteracoes de Nginx, processos e banco exigem validacao em stage antes de producao.

## 8. Referencias existentes

- `docs/NEXTJS-PERFORMANCE-CHECKLIST.md`
- `docs/specs/api-04-telemetria-p95-p99-for30/`
- `docs/specs/agenda-performance-quality-for47/`
- `docs/specs/agenda-financial-summary-resilience/`
- `docs/specs/admin-runtime-observability/`
