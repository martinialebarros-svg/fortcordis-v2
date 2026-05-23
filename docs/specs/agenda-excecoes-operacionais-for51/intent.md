# Intent - agenda-excecoes-operacionais-for51

Data: 2026-05-21
Responsavel: Martiniano + Codex
Status: in-progress

## Problema

Quando o assistente guiado nao encontra oferta aderente, o fluxo atual permite ajuste manual para qualquer perfil sem trilha estruturada de desfecho.

## Objetivo

Introduzir desfecho operacional estruturado com permissao por papel:

- `admin` pode conceder excecao e liberar horario manual.
- perfis nao-admin nao podem conceder excecao; apenas solicitam e encerram.
- quando nao houver agendamento, motivo deve ser obrigatorio e persistido em trilha auditavel.
