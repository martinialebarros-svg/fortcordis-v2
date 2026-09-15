# PERF-15 — Isolar API web e workers de segundo plano

## Intencao

Evitar que filas de importacao, limpeza e agendadores periodicos disputem CPU,
threads e conexoes com as requisicoes HTTP da aplicacao FortCordis.

## Resultado esperado

Em stage e producao, a unidade que atende HTTP executa somente o papel `api` e
uma unidade `systemd` separada executa o papel `worker`. Desenvolvimento e
testes locais mantem o papel `all` por padrao para nao exigir infraestrutura
adicional.

## Fora de escopo

- Alterar regras clinicas, financeiras, de Agenda ou de WhatsApp.
- Migrar filas para um broker externo.
- Alterar o contrato HTTP publico.
