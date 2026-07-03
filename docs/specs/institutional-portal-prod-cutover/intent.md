# Intent - institutional-portal-prod-cutover

Data: 2026-07-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O frontend de producao ja reconhece `fortcordis.com` e `www.fortcordis.com` como hosts institucionais, mas a VPS ainda nao possui server block dedicado para esses dominios. Alem disso, o DNS publico segue apontando para Squarespace, impedindo o uso do portal institucional na infraestrutura atual.

## 2) Objetivo

Preparar um fluxo operacional reproduzivel para publicar o host institucional na VPS de producao com Nginx, deixando a etapa HTTP pronta antes do corte de DNS e permitindo uma segunda execucao controlada para TLS via Certbot depois da propagacao.

## 3) Nao objetivos

- Trocar o DNS do provedor externo automaticamente.
- Fazer a revisao juridica/comercial do conteudo institucional.
- Alterar as rotas internas do app ou o comportamento do middleware.

## 4) Contexto e restricoes

- Restricoes tecnicas: o acesso local atual e por `fcadmin`, sem `sudo` sem senha; a automacao deve usar os secrets existentes do GitHub Actions.
- Restricoes de prazo: o host precisa ficar pronto para corte assim que o DNS for ajustado.
- Restricoes regulatorio/operacional: o app interno permanece em `app.fortcordis.com.br`.

## 5) Impacto esperado

- Usuarios impactados: tutores, clinicas parceiras e equipe comercial que divulgar o portal institucional.
- Modulos impactados: Nginx de producao, workflow operacional manual, script de infraestrutura.
- Risco de regressao: baixo para o app interno, moderado para a camada Nginx se a configuracao for invalida.

## 6) Riscos iniciais

- Risco 1: emitir TLS antes do DNS apontar para a VPS falha no challenge do Certbot.
- Risco 2: executar o workflow em paralelo com deploys de stage/prod pode causar contencao operacional na VPS.

## 7) Perguntas abertas

- Pergunta 1: quando o DNS de `fortcordis.com` sera trocado do Squarespace para a VPS?
- Pergunta 2: o mesmo workflow deve ser reutilizado depois para renovar/forcar o TLS do host?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
