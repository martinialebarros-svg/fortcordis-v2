# Verificacao

## Testes automatizados
- `whatsapp-stage-backend/scripts/test-auth-policy.ts`

## Criterios
1. Producao + auth desabilitada => erro.
2. Producao sem override explicito => auth habilitada por default.
3. Stage com auth desabilitada => permitido.
