# Smoke Test: Dashboard Shell Lazy Load

## Objetivo

Validar se a modularizacao lazy do shell compartilhado nao quebrou:

- autenticacao e logout
- carregamento do layout protegido
- Fortinho
- bootstrap de notificacoes push
- tratamento de `push_snooze` via query string
- limpeza de overlays orfaos

## Pre-condicoes

- frontend ativo em `http://localhost:3002`
- backend ativo em `http://127.0.0.1:8000`
- credenciais validas
- navegador com DevTools disponivel

## Smoke Test

### 1. Login e shell base

1. Acesse `/`.
2. Faça login.
3. Confirme redirecionamento para uma rota protegida.
4. Navegue para `/dashboard`, `/agenda`, `/agenda/fullcalendar` e `/atendimento`.
5. Confirme que header, sidebar e conteudo principal aparecem sem tela branca.

Esperado:

- sessao carregada normalmente
- sidebar funcional em desktop e mobile
- sem redirecionamento indevido para login

### 2. Navegacao e menu lateral

1. No mobile ou viewport reduzido, abra o menu hamburguer.
2. Feche o menu pelo botao `X`.
3. Abra novamente e navegue para outra rota protegida.
4. Em desktop, clique em itens diferentes da sidebar.

Esperado:

- menu abre e fecha corretamente
- ao navegar, a sidebar mobile fecha
- item ativo continua destacado

### 3. Fortinho

1. Abra `/agenda/fullcalendar`.
2. Execute uma acao que ja use o `Fortinho`, como abrir o fluxo de novo agendamento e validar um caso de aviso/confirmacao.
3. Clique em `Ocultar Fortinho`.
4. Clique em `Mostrar Fortinho`.

Esperado:

- Fortinho aparece quando necessario
- botoes `Ocultar` e `Mostrar` funcionam
- avisos e confirmacoes continuam operando

### 4. Push notifications

1. Faça login em ambiente que tenha configuracao de push habilitada.
2. Observe se nao ha erro visivel ao carregar a pagina protegida.
3. Abra o DevTools em `Console` e `Network`.
4. Navegue entre duas ou tres rotas protegidas.

Esperado:

- sem erro vermelho relacionado a `serviceWorker`, `push`, `Notification` ou `subscribe`
- sem loop de requisicoes de push
- se push estiver desabilitado no navegador/servidor, a app continua normal

### 5. Query string `push_snooze`

1. Abra manualmente uma URL protegida com query de soneca, por exemplo:
   `http://localhost:3002/dashboard?push_snooze=1&push_snooze_minutes=15&push_snooze_title=Teste&push_snooze_body=Teste&push_snooze_url=%2Ffinanceiro&push_snooze_module=financeiro&push_snooze_action=payment_pending`
2. Aguarde o processamento.

Esperado:

- a requisicao de soneca acontece uma vez
- aparece feedback de sucesso ou erro
- a query string de `push_snooze` e removida da URL depois do processamento
- nao entra em loop ao recarregar a pagina

### 6. Overlays orfaos

1. Em rotas com modal, abra e feche modais algumas vezes.
2. Repita em `/agenda/fullcalendar` e `/atendimento`.
3. Navegue para outra rota logo depois de fechar um modal.

Esperado:

- nao fica backdrop escuro preso sobre a tela
- nao sobra camada invisivel bloqueando clique
- pagina continua clicavel apos fechar modal ou navegar

### 7. Logout

1. Clique em `Sair`.
2. Tente voltar para uma rota protegida pelo historico do navegador.

Esperado:

- token e usuario sao limpos
- app redireciona para login
- rota protegida nao reabre com sessao invalida

## Verificacao no DevTools

### Network

Observar:

- chunks lazy carregando sob demanda, sem `404`
- nenhuma falha repetitiva em `push`
- nenhuma chamada em loop apos login

### Console

Observar ausencia de:

- `ChunkLoadError`
- erros de hidratacao
- erros de `serviceWorker`
- erros de `Notification`

## Sinais de quebra

- tela branca em rota protegida
- sidebar sem resposta
- logout nao limpa sessao
- Fortinho nao aparece quando deveria
- `push_snooze` dispara varias vezes
- backdrop escuro preso na tela
- erro de chunk no console
