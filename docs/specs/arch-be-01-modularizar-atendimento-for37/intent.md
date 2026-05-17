# FOR-37 ARCH-BE-01 Modularizar atendimento.py

## Problema
`backend/app/api/v1/endpoints/atendimento.py` concentra múltiplas responsabilidades e cresce com alto acoplamento, dificultando manutenção e revisão segura.

## Objetivo
Extrair blocos coesos para services dedicados mantendo os contratos HTTP existentes.

## Resultado esperado
- endpoints preservados
- redução de complexidade do arquivo principal
- base preparada para próximas extrações por domínio
