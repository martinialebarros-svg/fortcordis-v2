# Intent - portal-access-ui

Data: 2026-07-21
Responsavel: Equipe FortCordis
Status: done

## 1) Problema atual

O backend do portal seguro ja oferece desafio temporario, verificacao de codigo, listagem de exames e download autenticado. As paginas publicas de tutor e clinica parceira, porem, ainda nao consomem esses endpoints, o que impede validar a experiencia ponta a ponta do portal institucional.

## 2) Objetivo

Conectar o frontend institucional do portal Fort Cordis aos endpoints seguros ja criados no backend. Esta iteracao deve permitir:
- solicitar codigo temporario como tutor;
- solicitar codigo temporario como clinica parceira;
- validar a sessao do portal com codigo curto;
- listar exames autorizados;
- disparar download autenticado dos anexos liberados.

## 3) Nao objetivos

- Enviar codigo real por provider externo.
- Criar cadastro nominal por colaborador dentro da mesma clinica.
- Misturar sessao do portal com o login administrativo interno.
- Liberar escopo de dados alem da unidade autenticada.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - Reusar os endpoints `/api/v1/portal` sem depender do `axios` administrativo atual.
  - Persistir a sessao do portal apenas no navegador e separada por perfil de acesso.
  - Manter o login administrativo e os cookies internos sem alteracao.
- Restricoes de prazo:
  - Entregar UI funcional, SDD e validacao local na mesma iteracao.
- Restricoes regulatorio/operacional:
  - Continuar evitando anexos em notificacoes.
  - Manter linguagem coerente com LGPD, escopo minimo e auditoria.

## 5) Impacto esperado

- Usuarios impactados:
  - Tutores e clinicas parceiras em ambiente institucional/local.
- Modulos impactados:
  - `frontend/app/area-pacientes/page.tsx`
  - `frontend/app/clinica-parceira/page.tsx`
  - `frontend/components/portal`
  - `frontend/lib/portal-api.ts`
- Risco de regressao:
  - Baixo para o app administrativo, desde que a integracao continue isolada das rotas e do storage de auth interno.

## 6) Riscos iniciais

- Risco 1: a UI reaproveitar storage do app administrativo e causar logout ou conflito de sessao.
- Risco 2: tutor e clinica conseguirem navegar, mas falharem no download por uso incorreto do token curto.
- Risco 3: validacao parcial da UX mascarar erro de build ou de rota proxy para o backend.

## 7) Perguntas abertas

- O tutor final vai entrar apenas por ID + contato ou tambem por protocolo/CPF em iteracao futura?
- A clinica parceira precisara filtrar por mais de uma unidade no mesmo login?
- Havera preview inline de PDF/imagem no portal ou somente download?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Refinamento de 2026-07-21 - gestao administrativa do portal

### Problema complementar

Depois da ativacao do fluxo das clinicas parceiras, faltava uma visao operacional unica para acompanhar:
- quais clinicas ja receberam convite;
- quais concluiram cadastro com email e senha;
- quais ainda precisam informar email;
- quais estao usando o portal com downloads recentes;
- quais acessos precisam ser revogados ou revisitados.

### Objetivo complementar

Expandir `portal-access-ui` para incluir um cockpit administrativo dentro do app interno, sem quebrar o isolamento entre o login administrativo e a sessao do portal. Esta extensao deve permitir:
- visualizar o panorama das clinicas por status de acesso;
- reenviar ou gerar convite a partir de uma tela central;
- encerrar sessoes ou revogar contas com confirmacao;
- acompanhar auditoria de downloads da clinica;
- exportar a visao filtrada para CSV e medir adesao/inatividade.

### Refinamento complementar desta leva

Na operacao real, o cockpit ainda precisava responder melhor a tres perguntas:
- quais clinicas ja deram o primeiro sinal concreto de adesao ao portal;
- quais clinicas ativas esfriaram e estao sem acesso ha muitos dias;
- qual foi a sequencia recente de eventos de cada clinica sem abrir telas paralelas.

Por isso, esta iteracao adiciona:
- alerta visual para clinicas ativas sem acesso ha 30 dias ou mais;
- reenvio rapido de convite direto na lista quando email institucional e WhatsApp ja estao conhecidos;
- filtro explicito para clinicas com primeiro download concluido;
- linha do tempo resumida por clinica com convite, ativacao, revogacoes e downloads;
- exportacao CSV mais analitica com primeiro download, ultimo acesso e dias sem atividade.

### Nao objetivos complementares

- Implementar multiusuario por clinica.
- Criar analytics financeiros ou dashboards executivos fora do escopo do portal.
- Automatizar contato ativo com clinicas inativas via WhatsApp ou email.

### Refinamento de autorizacao operacional de 2026-08-04

O convite para clinica parceira ja existia, mas estava protegido exclusivamente pelo papel `admin`. Na base operacional, a colaboradora de secretaria esta cadastrada como `recepcao`; por isso ela conseguia chegar ao cockpit, mas recebia `403` ao consultar ou gerar o convite.

O objetivo deste refinamento e permitir que `recepcao` e as variantes de `secretaria` consultem o estado necessario e gerem ou reenviem convites. Revogar convite, conta ou sessoes continua sendo uma decisao administrativa e permanece restrito a `admin`.
