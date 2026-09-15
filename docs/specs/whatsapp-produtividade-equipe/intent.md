# Intent - whatsapp-produtividade-equipe

## Contexto

- Solicitação: analisar e melhorar o módulo WhatsApp para facilitar o uso,
  agilizar o atendimento e apoiar a produtividade da equipe.
- Baseline analisada: `origin/stage` em `1dd7680e`.
- Worktree isolada: `/Users/martiniano/.codex/worktrees/whatsapp-produtividade`.
- Superfície principal: `frontend/app/whatsapp-stage/page.tsx` e o serviço
  `whatsapp-stage-backend`.

## Problemas observados na baseline

1. O texto do compositor é um estado global da página e acompanha a troca de
   conversa; o arquivo selecionado é descartado. O sucesso de um envio pode
   apagar texto editado enquanto a requisição estava pendente. O envio humano
   não dispõe de trava de submissão nem de tratamento completo de falhas de
   rede.
2. A central solicita somente a página 1 de 50 mensagens, enquanto a consulta
   ordena mensagens da mais antiga para a mais recente. Conversas longas não
   mostram as mensagens recentes nem oferecem navegação pelo restante do
   histórico.
3. A lista de conversas não se atualiza periodicamente. Não há filtro por
   atendente específico ou por mensagens não lidas. O indicador de conversas
   sem responsável considera somente os registros da página visível.
4. Uma resposta de busca atrasada pode substituir uma busca mais recente.
   Filtrar ou paginar a lista pode trocar automaticamente a conversa em
   atendimento.
5. O efeito que inicializa o responsável depende do próprio campo editável e
   restaura o responsável anterior após uma tentativa de transferência.
6. Respostas rápidas substituem o texto já digitado. O estado do copiloto da
   conversa anterior permanece visível durante o carregamento da seguinte, e
   o polling pode sobrescrever a edição de uma sugestão.

Esses fatos foram observados no código, sem envio de mensagens externas. As
consequências operacionais são riscos inferidos: retrabalho, dificuldade de
triagem, perda de contexto e resposta destinada à conversa errada. Não foram
medidos tempos de atendimento, volume de retrabalho ou ganhos de produtividade.

## Objetivo

Permitir que a equipe encontre e distribua atendimentos com menos interações,
consulte o histórico recente e preserve o trabalho em andamento ao alternar
entre conversas. Requisições concorrentes devem manter o contexto do contato e
do rascunho aos quais pertencem.

## Escopo

- Resumo global da fila, filtros por responsável e não lidas, e busca por
  telefone com formatação.
- Atualização periódica da caixa de entrada, busca após pausa na digitação e
  descarte de respostas obsoletas.
- Preservação da seleção ao filtrar ou paginar a lista.
- Últimas mensagens ao abrir uma conversa e carregamento cumulativo do
  histórico anterior.
- Rascunhos de texto e arquivo por conversa, somente em memória da página;
  trava de envio e tratamento de falhas.
- Respostas rápidas acrescentadas ao texto; transferência de responsável
  estável; estado e edição do copiloto isolados por conversa.
- Testes locais e artefatos SDD alinhados.

## Limites

- A entrega é local e não inclui publicação, alteração de callback,
  configuração Meta, credenciais ou envio real de mensagens.
- A janela de 24 horas, os fluxos de modelos aprovados, os controles do
  copiloto e a separação entre reenvio humano e rascunho revisado permanecem
  critérios de segurança.
- Rascunhos não serão gravados em `localStorage`, `sessionStorage`, banco de
  dados ou serviço externo. O conteúdo se perde ao desmontar/recarregar a
  página; a retenção solicitada é entre conversas durante a mesma abertura da
  central.
- Não há mudança de conteúdo clínico, cadastros de domínio ou modo automático
  do bot. Ganhos de produtividade são objetivos, sujeitos a medição posterior.
