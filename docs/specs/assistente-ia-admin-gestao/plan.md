# Plan - assistente-ia-admin-gestao

Data: 2026-07-22
Responsavel: Martiniano + Codex
Status: completed

## Fase 1 - Fundacao persistente

1. Expandir mensagens com tokens, latencia, status e identificador do provedor.
2. Criar memoria, documentos internos, feedback, rascunhos clinicos e bloqueios de agenda.
3. Entregar migration `20260721_53` idempotente em SQLite e PostgreSQL.

Rollback: desabilitar a Mente; as tabelas novas sao isoladas. Bloqueios podem ser desativados sem remover registros.

## Fase 2 - Inteligencia e operacao governada

1. Adicionar resumo executivo, conhecimento, memoria e contexto clinico como ferramentas estritas.
2. Adicionar remarcacao, cancelamento, bloqueio/liberacao e WhatsApps como acoes pendentes.
3. Revalidar snapshots e chamar fluxos oficiais de agenda e clinicas na aprovacao.
4. Fazer bloqueios participarem da validacao de slot e do motor de sugestoes.

Rollback: retirar as novas definicoes de ferramentas; as funcoes existentes continuam independentes.

## Fase 3 - Experiencia administrativa

1. Organizar `/assistente-ia` em conversa, resumo, aprovacoes, memoria, conhecimento e rascunhos.
2. Carregar resumo e indicadores ao abrir a pagina.
3. Adicionar avaliacao util/nao util e correcao esperada em cada resposta.
4. Manter cartoes antes/depois para qualquer escrita operacional.

Rollback: manter apenas a aba de conversa, sem afetar os endpoints.

## Fase 4 - Qualidade

1. Cobrir autorizacao, memoria aprovada, busca interna, bloqueios, feedback e migrations.
2. Versionar casos de avaliacao de intencao e fronteiras clinicas.
3. Executar testes focais, suite completa, migration CI, lint, TypeScript e build.
4. Atualizar `verify.md` com evidencias reais antes de qualquer publicacao.

## Fase 5 - Aprendizado continuo supervisionado

1. Transformar correcao explicita de feedback em sugestao pendente, sem mutacao automatica da memoria.
2. Permitir revisao, aprovacao e rejeicao de criacoes ou ajustes direcionados de memoria.
3. Versionar todas as mudancas, restaurando versoes antigas apenas como uma nova versao auditada.
4. Criar e executar contratos de regressao para o estado vigente de cada memoria aprovada.
5. Entregar fila administrativa, edicao, contadores, origem, contratos e historico na interface.
6. Validar migration idempotente, testes focais, suite completa, frontend e release guardado stage/producao.

Rollback: desabilitar as novas superficies de aprendizado e conservar a ultima memoria aprovada. As tabelas sao aditivas; nenhum dado operacional depende delas.

## Fase 6 - Mapa operacional vivo de clinicas

1. Consolidar ao vivo cadastro institucional, agenda, transacoes recebidas, ordens de servico, contas a receber e memorias aprovadas, sem nova persistencia.
2. Calcular periodo atual e anterior equivalente, alertas e rankings por regras deterministicas e explicitas.
3. Expor listagem, perfil e comparacao em rotas exclusivas do admin, sem dados de pacientes ou tutores.
4. Adicionar as ferramentas estritas `consultar_clinica_360` e `comparar_clinicas_360` ao roteamento da Mente.
5. Entregar a area `Clinicas 360`, com busca, selecao comparativa, aprofundamento por clinica e fontes visiveis.
6. Ampliar dataset, testes, validacao local e release guardado em stage e producao.

Rollback: retirar as rotas, ferramentas e aba `Clinicas 360`; nenhuma tabela ou dado operacional novo precisa ser removido.
