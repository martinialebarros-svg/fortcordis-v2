# FOR-36 WPP-03 Redacao de logs sensiveis

## Problema
Logs operacionais ainda podiam carregar dados sensiveis (tokens/assinaturas/payloads) em metadados de erro e debug.

## Objetivo
Aplicar redacao centralizada e trilha de auditoria minima para evitar vazamento de dados sensiveis.

## Resultado esperado
- logs sem token/secret/signature/payload bruto
- auditoria de contatos com payload minimo
