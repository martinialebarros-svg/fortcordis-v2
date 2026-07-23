# Intent - assistente-ia-admin-gestao

Data: 2026-07-23
Responsavel: Martiniano + Codex
Status: completed

## Objetivo

Evoluir a Mente FortCordis de um chat administrativo com consultas e poucas acoes para um copiloto de gestao completo, ainda exclusivo do admin, capaz de consolidar a operacao, executar mudancas governadas, aprender preferencias aprovadas, consultar conhecimento interno e apoiar o trabalho clinico sem substituir a decisao humana.

## Resultado esperado

- resumo executivo diario carregado automaticamente com agenda, faturamento, vencidos, reservas e aprovacoes;
- caixa unica de aprovacoes para acoes propostas em qualquer conversa;
- remarcacao, cancelamento, bloqueio/liberacao de slots e atualizacao de WhatsApps com confirmacao, snapshot, expiracao e auditoria;
- bloqueios refletidos tanto na validacao de escrita quanto nas sugestoes de disponibilidade;
- memoria supervisionada: sugestoes da IA ficam pendentes e apenas conteudo aprovado orienta novas respostas;
- base de conhecimento interna administravel e pesquisavel por ferramentas delimitadas;
- rascunhos clinicos isolados, comparacao com laudos anteriores e alertas de completude, sem alterar ou finalizar o laudo oficial;
- feedback positivo/negativo, correcao esperada, tokens, latencia e suite versionada de casos de avaliacao;
- backend continua sem SQL livre, shell, credenciais ou escrita generica controlada pelo modelo.
- correcao explicita gera apenas sugestao pendente, revisavel pelo administrador;
- memoria aprovada possui versoes imutaveis, restauracao auditada e contrato de regressao automatico;
- laboratorio verifica roteamento e preservacao das memorias sem executar ferramenta real.
- mapa operacional vivo consolida cada clinica em uma visao 360 com agenda, faturamento, debitos, atividade, preferencias aprovadas e fontes;
- comparacao entre clinicas usa o mesmo contrato deterministico e permite aprofundar a analise na conversa da Mente.
- alertas do Clinicas 360 geram planos de acao rastreaveis, com missao de leitura, rascunho de contato e revisao operacional;
- a missao sugerida so nasce apos confirmacao explicita, o contato nao e enviado e qualquer escrita operacional continua governada pela caixa de aprovacoes.
- nomes de clinicas com pequenos erros de digitacao ou transcricao sao resolvidos quando existe um unico cadastro com alta confianca;
- comandos de voz em portugues podem preencher a conversa sem persistir o audio e sem contornar as confirmacoes operacionais.
- falhas observadas nas conversas reais viram ferramentas e casos de regressao para servicos realizados, deslocamento, funcionamento geral e vinculacao de paciente a reserva;
- uma falha temporaria do provedor preserva o comando para nova tentativa e nao duplica a mensagem sem resposta.

## Nao objetivos

- liberar a Mente para perfis diferentes de `admin`;
- executar alteracoes operacionais sem confirmacao explicita;
- finalizar, assinar, publicar ou diagnosticar automaticamente um laudo;
- ingerir silenciosamente todos os dados ou documentos do sistema;
- enviar WhatsApp automaticamente pela API da Meta;
- habilitar pesquisa aberta na internet.
- expor nomes, contatos ou outros dados de pacientes e tutores no mapa de clinicas;
- executar escrita ou comunicacao automaticamente a partir dos alertas do mapa.
- enviar automaticamente uma transcricao ou aprovar uma acao operacional pela voz.

## Riscos principais

- memoria incorreta passar a orientar respostas sem revisao;
- conflito de agenda entre a preparacao e a aprovacao;
- rascunho clinico ser confundido com documento oficial;
- base interna retornar contexto irrelevante ou excessivo;
- crescimento de custo/latencia sem telemetria e regressao continua.
- correcao isolada ser generalizada de forma indevida para toda a gestao;
- restauracao apagar contexto historico ou deixar contrato de regressao obsoleto.
- somar ordens de servico e contas a receber como se fossem dividas distintas quando elas puderem representar o mesmo debito;
- apresentar indicador sem periodo, fonte ou atualizacao, levando a uma conclusao gerencial sem rastreabilidade.
- uma sugestao de plano ser confundida com decisao executada, contato enviado ou autorizacao para alterar a operacao.
- uma aproximacao de nome selecionar a clinica errada quando houver cadastros semelhantes;
- audio sensivel ser persistido, exceder limites ou ser enviado sem revisao consciente do administrador.
- uma soma de servicos realizados ser confundida com recebimentos financeiros ou incluir OS cancelada;
- vinculacao de paciente alterar silenciosamente horario, status ou reserva sem revalidacao e aprovacao.
