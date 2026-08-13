# Intent - meta-app-publication

Data: 2026-08-12
Responsavel: Martiniano + Codex

## Contexto

O app Meta FortZap precisa ser publicado para receber webhooks reais do WhatsApp Business. A configuracao
basica do app exige URLs publicas de politica de privacidade, termos de uso e instrucoes de exclusao de dados.
O FortCordis ainda nao possui essas rotas.

## Objetivo

Disponibilizar documentos publicos, claros e responsivos que expliquem o tratamento de dados no FortCordis e
no WhatsApp Business, estabelecam regras de uso e oferecam um procedimento seguro para solicitacoes de
titulares.

## Usuarios afetados

- tutores e contatos que recebem mensagens da Fort Cordis;
- clinicas parceiras e usuarios dos portais;
- equipe Fort Cordis responsavel por privacidade e atendimento;
- revisores automatizados e humanos da Meta.

## Resultado esperado

- as tres URLs respondem anonimamente por HTTPS;
- o conteudo identifica a Fort Cordis e um canal de contato valido;
- nenhuma pagina solicita senha, token, codigo de autenticacao ou dado clinico;
- a Meta consegue usar as URLs na configuracao de publicacao do FortZap.

## Limites

- esta entrega nao substitui revisao juridica especializada;
- nao cria um fluxo automatico de exclusao nem remove dados sem validacao de identidade;
- nao publica o restante da integracao WhatsApp em producao.
