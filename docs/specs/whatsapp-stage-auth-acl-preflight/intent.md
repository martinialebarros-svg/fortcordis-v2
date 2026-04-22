# Intent - whatsapp-stage-auth-acl-preflight

## 1) Contexto

O backend WhatsApp de stage estava com endpoints de conversas/agentes sem autenticacao obrigatoria e sem checklist operacional padronizado.
Isso aumentava risco de acesso indevido e de deploy sem validacao minima.

## 2) Objetivo

Adicionar autenticacao e ACL no backend WhatsApp stage, alinhar frontend para envio de bearer token, endurecer deploy para defaults seguros e criar preflight operacional reutilizavel.

## 3) Resultado esperado

- Endpoints `/conversations*` e `/agents*` protegidos.
- Smoke stage com suporte a autenticacao.
- Deploy stage com defaults de ACL e token interno quando necessario.
- Runbook com passo de preflight explicito.

## 4) Fora de escopo

- Integracao definitiva do WhatsApp no modulo principal de atendimento.
- Novos tipos de mensagem outbound alem de texto.
