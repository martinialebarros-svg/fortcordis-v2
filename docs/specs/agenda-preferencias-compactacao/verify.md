# Verify — Preferências e compactação da Agenda

Data: 2026-10-04
Status: validado localmente e publicado em stage; produção pendente

## Evidências de origem

- Produção consultada em transação PostgreSQL read-only, snapshot e67f6a27.
- Caso sintético derivado apenas de durações/horários, sem pacientes ou tutores.
- Implementação isolada em `codex/agenda-preferencias-encaixes`, base 3764bfbd.
- A etapa local não executou migration, envio real, edição de agenda ou publicação.

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

O cenário de capacidade continua sendo uma simulação; não há medição de ganho
real de produtividade. A publicação em stage e o smoke de navegador estão
registrados abaixo. Não houve promoção para produção.

## Publicação e validação em stage — 2026-10-04

- PR [#299](https://github.com/martinialebarros-svg/fortcordis-v2/pull/299), base
  `stage`, mergeado após todos os checks obrigatórios passarem.
- Feature `d5ea6db0517c5a27e8d09e71491b75c9f0e0f974`; merge e HEAD instalado na
  VPS `a44b3de01cbd9d06d0ff04dd2877b4e412d2bd69`, com árvores idênticas.
- [Deploy 37206192732](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37206192732)
  concluído com sucesso em `quality-gate`, `sdd-guardrail` e `deploy-stage`.
- Frontend CI `37206192731` e Migration CI `37206192733`: sucesso no commit
  integrado. O quality-gate incluiu persistência/concorrência PostgreSQL e
  testes de integração WhatsApp com banco isolado.
- Logs confirmam preservação e restauração de SQLite e cinco arquivos de
  runtime, `Authenticated canary smoke OK` e `Backup restore drill OK`.
- Canary da Agenda: 5/5 amostras, p50 130,47 ms, p95 446,73 ms, limite 1.200 ms.
  Isso mede o endpoint de leitura do canary, não latência das novas sugestões.
- HTTP/2: o deploy confirmou que a diretiva já estava presente nos vhosts,
  sem necessidade de alteração nesse passo.
- Produção permaneceu em `bc80e26bf93f19fd3e0105701a1fdf980fae462a` na
  conferência de encerramento. Nenhum PR de promoção foi aberto nesta etapa.

### Smoke HTTP e versão servida

- `app.stage.fortcordis.com.br`: raiz e `/agenda` 200; `/api/v1/agenda` sem
  credenciais 401.
- `stage.fortcordis.com.br`: raiz 200; `/agenda` redireciona ao domínio canônico
  e retorna 200; API sem credenciais 401.
- Os 18 chunks referenciados pela página retornaram 200. Marcadores
  `Preferências deste atendimento` e `Próxima semana` em
  `9344-f4aa74b3ba7ce8fe.js`; `same_location_transition_min` em
  `9947-42c315bcf0cec5bc.js`.
- Ressalva separada: `www.stage.fortcordis.com.br` não resolveu DNS nas três
  rotas. O alias não é considerado aprovado; os dois domínios acima passaram.

### Smoke funcional autenticado

Sessão de navegador existente, Animal Care, Ecocardiograma, sem tutor/paciente
selecionado. O catálogo de stage informa 30 minutos para esse serviço; não foi
alterado para reproduzir a duração de 40 minutos encontrada em produção.

| Cenário | Evidência observada | Resultado |
| --- | --- | --- |
| Preferência antes da geração | Controles exibidos antes de Gerar melhor oferta; nenhuma oferta inicial | aprovado |
| Próxima semana, tarde | Intervalo 05–11/10; ofertas 05/10 12:00–12:30 e 12:15–12:45 | aprovado |
| Troca para manhã | Ofertas anteriores removidas; nova geração 05/10 08:00–08:30 e 08:15–08:45 | aprovado |
| Faixa incompleta | Geração desabilitada até preencher ambos os horários | aprovado |
| Faixa 16:00–16:15 para serviço de 30 min | Nenhum horário; mensagem pede ajustar preferência, sem ampliar o período | aprovado |
| Encerramento | Modal cancelado, sem aceite ou salvamento de agendamento | aprovado |

A compactação 40+5 permanece comprovada pelos testes automatizados; não foram
criados quatro agendamentos no ambiente compartilhado para o smoke. Consultas
do assistente podem registrar auditoria/cache. O deploy padrão também executa
seus registros sintéticos de smoke WhatsApp; não houve envio real deliberado
nem confirmação de atendimento nesta validação.

Evidências locais: `/tmp/fortcordis-agenda-stage-deploy.log` e
`/tmp/fortcordis-agenda-stage-http-smoke.json`. Este registro posterior ao deploy
foi incorporado por atualização documental de preparação da promoção; o
resultado também acompanha a descrição do PR #299.
