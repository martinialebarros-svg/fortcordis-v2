# FOR-35 WPP-02 Revisao de auth por ambiente WhatsApp

## Problema
O backend WhatsApp permitia subir com auth desabilitada mesmo em ambiente de producao quando configurado explicitamente, abrindo risco operacional.

## Objetivo
Impedir startup inseguro em producao por default quando `WHATSAPP_API_AUTH_ENABLED=false`.

## Resultado esperado
- producao falha no startup com auth desabilitada
- stage/dev mantem flexibilidade de configuracao
