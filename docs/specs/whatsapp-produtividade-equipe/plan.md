# Plan - whatsapp-produtividade-equipe

## Base de trabalho

Partir de `origin/stage` em `1dd7680e`, na worktree isolada
`/Users/martiniano/.codex/worktrees/whatsapp-produtividade`, preservando alterações
alheias na checkout principal. Validar localmente antes de qualquer decisão de
publicação.

## Fase 1 - contratos e consulta

1. Acrescentar resumo global com `total`, `unread`, `unassigned`, `open`,
   `pending`, `closed` e `mine` quando houver `agent_id` de referência.
2. Aplicar `agent_id` e `unread` na consulta da lista, sem transformar o resumo
   em contagem apenas dos filtros ou da página carregada.
3. Normalizar a busca por telefone formatado, mantendo a busca por assunto e
   última mensagem e os filtros existentes.
4. Acrescentar `order=latest` ao histórico: selecionar primeiro as mensagens
   mais recentes e devolver cada página em ordem cronológica para a leitura.
5. Cobrir consultas e contratos com testes locais sem chamadas à Meta.

## Fase 2 - triagem e histórico

1. Integrar resumo global, filtros por responsável/não lidas e indicadores
   coerentes com a lista filtrada e o universo de atendimento.
2. Atualizar a caixa de entrada a cada 15 segundos quando a página estiver
   visível; aplicar busca após 300 ms sem nova digitação.
3. Invalidar respostas de consultas anteriores quando mudarem busca, filtros
   ou página, impedindo que dados obsoletos restaurem estado antigo.
4. Manter a conversa selecionada aberta quando ela sair dos filtros ou da
   página da lista.
5. Abrir com as últimas 50 mensagens e permitir carregar páginas anteriores,
   acumulando o histórico em ordem cronológica e deduplicando por ID.

## Fase 3 - compositor, equipe e copiloto

1. Integrar `useWhatsAppDrafts` com texto e `File` separados por ID de conversa.
2. Capturar o snapshot do rascunho no início do envio e limpar somente esse
   snapshot no sucesso, sem apagar edição posterior.
3. Impedir submissão repetida durante o envio e tratar erros de rede com
   liberação da trava e preservação do rascunho.
4. Acrescentar respostas rápidas ao texto atual.
5. Corrigir a inicialização do responsável para preservar uma escolha manual
   até a confirmação da transferência.
6. Limpar o estado do copiloto ao trocar de conversa, ignorar respostas
   atrasadas de outra conversa e preservar a edição do mesmo rascunho durante
   atualizações periódicas.

## Fase 4 - validação

1. Executar a matriz de aceitação em `verify.md`, incluindo atrasos de rede,
   troca de conversa durante envio, cliques repetidos e histórico com mais de
   50 mensagens.
2. Repetir testes existentes relacionados à janela de atendimento, aos anexos,
   ao contexto cadastral e ao reenvio revisado do bot.
3. Executar verificações de TypeScript, lint, build, contratos do serviço
   WhatsApp, `git diff --check` e guardrail SDD apropriadas à alteração.
4. Inspecionar a experiência visual e os controles de teclado com dados
   simulados. Registrar resultados efetivos, sem antecipar aprovação.

## Rollback e publicação

A alteração é planejada sobre consultas, estado de interface e testes, sem
migração de dados. O rollback consiste em reverter os arquivos desta entrega;
os rascunhos em memória desaparecem ao sair da página. Publicação em stage ou
produção exige solicitação separada e o fluxo de release correspondente.
