# Plan - assistente-ia-admin-gestao

Data: 2026-07-23
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

## Fase 7 - Planos de acao supervisionados por clinica

1. Transformar cada alerta deterministico do perfil completo em plano de acao com evidencia, objetivo, prioridade e passos tipados.
2. Propor uma missao recorrente `clinic_360`, estritamente de leitura, com clinica e periodo validados.
3. Separar rascunho de contato sem envio e revisao operacional que apenas leva um pedido delimitado para a conversa.
4. Exigir uma confirmacao adicional visivel antes de criar a missao sugerida e conservar a caixa de aprovacoes para qualquer escrita real.
5. Manter o portfolio e a comparacao leves, devolvendo apenas a quantidade de planos; o conteudo completo fica no perfil focal.
6. Ampliar dataset, testes, interface e SDD sem nova migration.

Rollback: remover `action_plan` do perfil, o tipo de missao `clinic_360` e o painel de planos; nenhuma tabela ou dado de negocio precisa ser revertido.

## Fase 8 - Recuperacao de falhas, nomes tolerantes e voz

1. Auditar as conversas reais do administrador e transformar falhas reproduziveis em regras de roteamento, ferramentas ou casos de regressao.
2. Resolver erros evidentes em nomes de clinicas por similaridade conservadora, preservando desambiguacao quando dois cadastros forem proximos.
3. Adicionar transcricao de audio no backend com idioma portugues, vocabulario FortCordis, limite de tamanho, formatos permitidos e zero persistencia do arquivo.
4. Entregar um controle de microfone com gravacao limitada, parada, transcricao e revisao antes do envio.
5. Garantir que pedidos por voz percorram o chat e a caixa de aprovacoes existentes sem qualquer atalho para escrita.
6. Adicionar consultas estritas para OS realizadas no periodo, deslocamento entre clinicas e funcionamento geral da agenda.
7. Vincular paciente e tutor a reserva existente por acao pendente, preservando horario e revalidando alvo e referencias na aprovacao.
8. Reutilizar a ultima mensagem identica sem resposta em uma nova tentativa e devolver o identificador da conversa quando o provedor falhar.
9. Ampliar dataset, testes, SDD, frontend e smokes autenticados antes da promocao.

Rollback: ocultar o controle de voz e retirar a rota de transcricao e o matching aproximado; texto, ferramentas e confirmacoes atuais continuam funcionando sem migration.
