# Especificacao

## Requisitos funcionais
- RF-01: em producao (`NODE_ENV/APP_ENV=production|prod`), auth deve permanecer habilitada por default.
- RF-02: se `WHATSAPP_API_AUTH_ENABLED=false` em producao e enforcement ativo, startup deve falhar.
- RF-03: em stage/dev, configuracao `WHATSAPP_API_AUTH_ENABLED=false` continua permitida.

## Requisitos nao funcionais
- RNF-01: erro de startup deve ser explicito para facilitar diagnostico.
- RNF-02: politica deve ser testavel via funcao pura de resolucao de ambiente.
