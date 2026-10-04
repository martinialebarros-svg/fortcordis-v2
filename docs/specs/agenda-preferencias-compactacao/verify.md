# Verify — Preferências e compactação da Agenda

Data: 2026-10-04
Status: validado localmente; publicação pendente

## Evidências de origem

- Produção consultada em transação PostgreSQL read-only, snapshot e67f6a27.
- Caso sintético derivado apenas de durações/horários, sem pacientes ou tutores.
- Implementação isolada em `codex/agenda-preferencias-encaixes`, base 3764bfbd.
- Nenhuma migration, envio real, edição de agenda ou publicação nesta etapa.

## Cobertura

- Backend: contratos de preferências, bordas dos turnos, limite de datas,
  orquestração sem fuga de período, âncora fora do turno, compactação 40/5/30,
  transição zero, viagens, bloqueios, reservas e concorrência.
- Canais: parsing de semanas, referência temporal, revalidação da escolha,
  privacidade do WhatsApp e limites da consulta administrativa.
- Frontend: resolução de datas, filtros no payload, importação de pedido,
  invalidação de oferta/aceite e resposta tardia, configuração de transição.
- Regressão: testes relevantes, TypeScript, ESLint, build e guardrail SDD.

## Resultados backend

- Núcleo da Agenda: 86 testes focados aprovados, incluindo 13 novos casos no
  módulo `test_agenda_preferencias_encaixes.py`.
- WhatsApp e ferramenta administrativa: 84 testes focados aprovados e um teste
  dependente de PostgreSQL ignorado neste ambiente local.
- Suíte completa: `python -m unittest discover -s backend/tests -p 'test_*.py'`
  aprovada em 51,879 s; 1.521 testes processados, dos quais 7 ignorados.
- Execução com Python 3.11, banco SQLite temporário exclusivo,
  `FORTCORDIS_PROCESS_ROLE=api` e sem credenciais de produção.
- Log completo: `/tmp/fortcordis-agenda-preferencias-backend-full-final.log`.
- Uma execução anterior falhou no novo teste de relógio simulado porque o mock
  não reconhecia datetimes devolvidos pelo SQLite. O relógio de teste foi
  corrigido, e a suíte completa acima foi repetida com os arquivos estabilizados.
- Sintaxe dos arquivos Python alterados, `git diff --check` e guardrail SDD
  aprovados. As verificações PostgreSQL ignoradas não são consideradas validadas.

## Resultados frontend

- `npm test`: 69 arquivos, 493 testes Vitest e 9 testes Node aprovados.
- `npm run lint` completo e `tsc --noEmit`: aprovados.
- `npm run build`: aprovado no snapshot final do frontend.
- Logs locais: `/tmp/fortcordis-agenda-preferencias-frontend-final.log` e
  `/tmp/fortcordis-agenda-preferencias-build-final.log`.
- Os testes de componente comprovam preferência importada antes do botão de
  geração, payload restrito, interseção de turno/faixa, intervalo de 31 dias,
  domingo em Fortaleza, descarte de resposta antiga após filtro/fechamento e
  preservação do filtro de edição após carregamento do catálogo de pacientes.

## Revisão independente

Dois casos adicionais foram encontrados e corrigidos: a validação de adjacência
agora independe da grade visual, e limites exatos de hoje são preservados antes
do arredondamento da grade regular. Ambos possuem regressão automatizada.

A revisão final não identificou novos P1/P2. Foram conferidos o contrato,
restrições antes do ranking, datas ancoradas, revalidação, descarte de respostas
antigas e ausência de expansão silenciosa. O orquestrador ainda pode recalcular
dias entre proximidade e panorama, limitado a 31 dias; não houve benchmark de
latência em produção nesta etapa.

Não há evidência de deploy ou de ganho real de produtividade; o cenário de
capacidade é apenas uma simulação. A interface foi validada por testes de
componente, tipos, lint e build; smoke de navegador em stage fica para a etapa
de publicação.
