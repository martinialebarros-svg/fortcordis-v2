# Plan - agenda-domiciliar-tutor-georreferenciado

Data: 2026-07-08
Responsavel: Martiniano + Codex
Status: in-progress

## Fase 1 - Tutor e georreferenciamento

- [x] Expor campos estruturados de endereco do tutor na API.
- [x] Adicionar endpoint de geocode do endereco do tutor.
- [x] Adicionar endpoint de panorama do tutor com pets vinculados.
- [x] Exibir status de georreferenciamento no fluxo da agenda.

## Fase 2 - Agenda domiciliar

- [x] Introduzir `origem_atendimento` em agendamentos.
- [x] Permitir salvar agendamento domiciliar sem clinica.
- [x] Bloquear save domiciliar sem tutor georreferenciado.
- [x] Resolver `tutor_id` legado a partir de `paciente.tutor_id` em lista/detalhe/realtime.
- [x] Usar endereco do tutor nas acoes de rota/mapa do domiciliar.

## Fase 3 - OS e financeiro

- [x] Propagar `origem_atendimento` para ordens de servico.
- [x] Permitir OS domiciliar sem clinica.
- [x] Recalcular preco domiciliar conforme tipo de horario.
- [x] Tratar tutor como destinatario operacional em listagens e relatorios.

## Fase 4 - Validacao e release

- [x] Adicionar testes focados de tutor/agendamento/OS domiciliar.
- [x] Adicionar teste de migration para backfill legado.
- [x] Atualizar `spec.md` e `verify.md` no mesmo ciclo.
- [x] Rodar suites backend e validacoes frontend focadas.
- [ ] Pushar branch e executar smoke final no ambiente alvo apos aplicacao das migrations.
