# Intent - agenda-assistente-nox-readonly

Data: 2026-06-07
Responsavel: Martiniano + Codex
Status: in-progress

## Objetivo

Permitir que o assistente Nox/OpenClaw consulte apenas o contexto minimo da agenda do Fort Cordis, em modo read-only, para apoiar conversas de produtividade e sugestoes de horario sem acessar dados pessoais desnecessarios.

## Problema

O assistente externo precisa entender ocupacao, clinicas, servicos e regras do assistente de agendamento/guiado, mas nao deve receber telefone, tutor, observacoes, laudos, dados financeiros nem permissao de escrita.

## Resultado esperado

- Nox consulta uma janela curta de agenda por token dedicado.
- A resposta expõe regras operacionais normalizadas e ocupacao sanitizada.
- O assistente consegue explicar e preparar sugestoes aderentes ao fluxo guiado, sempre pedindo validacao humana antes de qualquer agendamento.
