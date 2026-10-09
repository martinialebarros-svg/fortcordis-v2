# Verify — Preferências e compactação da Agenda

Data: 2026-10-04
Status: publicado e validado em produção

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
real de produtividade. As publicações e verificações em stage e produção estão
registradas abaixo.

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

## Publicação e validação em produção — 2026-10-04

- PR documental [#300](https://github.com/martinialebarros-svg/fortcordis-v2/pull/300)
  incorporou as evidências de stage e fechou três registros históricos do
  assistente administrativo com provas de deploy/ancestralidade e viewport live,
  sem label de exceção. Não alterou código executável.
- Stage final `7068aac3162c89ac525a9540f24f6df68998f430`: deploy `37219016435`
  aprovado, com canary e restore drill. O código permaneceu idêntico a `a44b3de0`.
- Promoção direta e protegida pelo PR
  [#301](https://github.com/martinialebarros-svg/fortcordis-v2/pull/301), após os
  12 checks passarem. O guard de fluxo rodou novamente após atualização da
  descrição; o merge aguardou seu sucesso, sem bypass.
- Produção: `fa9781901ab7fa9f2939551a01d06bec6def38c4`. A árvore do merge é
  idêntica à de stage (`83fdfa52f8ed2e0041c5e2d111aac9df164b3e17`).
- [Deploy 37219848127](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37219848127):
  quality-gate, SDD e deploy concluídos com sucesso. Frontend CI `37219848075`
  e Migration CI `37219848088` também passaram.
- HEAD instalado conferido por SSH e pelo log de deploy. Serviços backend e
  frontend ativos. Nenhuma nova migration, dependência ou mudança de workflow.
- Logs confirmam `Preserved runtime file` e `Restored runtime file` para SQLite
  e os cinco arquivos de frases/patologias; canary autenticado e restore drill
  aprovados. HTTP/2 já estava configurado, sem alteração nesse passo.
- Canary Agenda: 5/5 amostras, p50 89,71 ms e p95 413,48 ms, limite 1.200 ms.
  O indicador é do endpoint de leitura, não um benchmark do motor de sugestões.

### Smoke público e consulta autenticada

- Cinco domínios aprovados: `app.fortcordis.com.br`, `fortcordis.com.br`,
  `www.fortcordis.com.br`, `fortcordis.com` e `www.fortcordis.com`.
- Raiz e Agenda com status final 200; aliases da Agenda redirecionam ao
  canônico. API da Agenda sem credenciais retorna 401 nos cinco domínios.
- Todos os 18 chunks retornam 200 e contêm os marcadores de preferências,
  próxima semana e transição no mesmo local.
- Consulta funcional na API instalada com autenticação efêmera do helper
  oficial de canary, mantida em memória. Foram dez consultas HTTP, sem
  criação/reserva/remarcação ou envio de mensagens de teste.
- Animal Care / Ecocardiograma: catálogo real de 40 minutos preservado.
  Manhã: 05/10, 09:00–09:40. Tarde: 08/10, 13:00–13:40, 13:15–13:55 e
  13:30–14:10. Todas as opções cabem integralmente nas preferências enviadas.
- Datas de tarde sem encaixe retornaram vazio. Consultar uma data fora do
  intervalo declarado também retornou vazio, e o par incompleto de datas foi
  rejeitado com HTTP 422.
- Apenas contagens, horários e duração foram registrados; nenhum payload de
  paciente, tutor, vizinho ou credencial foi impresso. A consulta pode atualizar
  cache/métricas de deslocamento e logs normais, sem alterar os agendamentos.
- O fluxo visual autenticado foi validado em stage; em produção, a comprovação
  foi feita por consulta autenticada da API, canary e versão servida nos bundles.

Evidências locais: `/tmp/fortcordis-agenda-prod-deploy.log`,
`/tmp/fortcordis-agenda-prod-http-smoke.json` e
`/tmp/fortcordis-agenda-prod-functional-smoke.jsonl`. O resultado também foi
registrado no PR #301; esta seção posterior ao deploy foi incorporada ao
versionamento junto das verificações complementares autorizadas pelo usuário.

## Complemento: interface autenticada em produção — 2026-10-04

Conferência na sessão existente do Safari em `app.fortcordis.com.br/agenda`,
aproximadamente 22:05–22:11 em Fortaleza. Animal Care / Ecocardiograma, sem
selecionar tutor ou paciente, sem aceitar oferta e sem salvar agendamento.

| Cenário | Resultado observado |
| --- | --- |
| Catálogo e preferência antes da busca | Ecocardiograma com 40 minutos; controles de período/turno visíveis antes de gerar |
| Próxima semana + tarde | Período explícito 05–11/10; ofertas 09/10 12:00–12:40 e 12:15–12:55 |
| Troca para manhã | Ofertas da tarde removidas imediatamente, antes da nova geração |
| Nova geração de manhã | Seis ofertas em 05, 06 e 09/10, todas com 40 minutos e término até 12h; inclui 09/10 11:20–12:00 |
| Faixa personalizada incompleta | Geração desabilitada e indicação de início/fim obrigatórios |
| Faixa 16:00–16:15 | Nenhuma oferta; mensagem para ajustar a preferência, sem ampliar automaticamente |
| Encerramento | Formulário cancelado e aba de verificação fechada; nenhum aceite, reserva, envio ou salvamento |

A imagem da interface e a árvore de acessibilidade confirmaram os controles e
resultados. Consultas podem atualizar cache/métricas de deslocamento e logs.
Os horários diferem do smoke anterior porque disponibilidade e ranking são
dinâmicos; ambos preservaram as restrições. Este complemento encerra a lacuna
de conferência visual autenticada em produção registrada na seção anterior.

## Complemento: alias de stage — DNS e TLS corrigidos

O diagnóstico inicial encontrou NXDOMAIN nas duas autoridades Cloudflare e
certificado apenas com stage/app.stage. O vhost já contemplava o alias.
Após login do usuário, o CNAME `www.stage` → `stage.fortcordis.com.br` foi
salvo com DNS only/TTL 300 e confirmado nas duas autoridades e em dois DNS
públicos. O certificado foi renovado para os três nomes de stage.

O PR #304 incorporou o coletor, os registros finais da publicação da Agenda e
o reparo TLS manual restrito. O procedimento está em [stage-alias.md](stage-alias.md);
a evidência da execução fica em [verify do alias](../stage-alias-tls/verify.md).
Foram aprovados os 11 blocos Bash do runbook e os 14 testes do reparo.
O primeiro dispatch foi cancelado ainda na fila para corrigir o jitter do
Certbot instalado, antes de qualquer job ou mutação de certificados. Após o
PR #305 e o deploy `37253117384`, o run manual `37253410573` terminou em
`success`: emitiu o certificado de stage com os três SANs, aprovou renovação
de teste e preservou os oito hashes protegidos. Smoke público estrito passou
nos três domínios de stage e nos cinco de produção; API anônima manteve 401.

## Complemento: medição operacional reproduzível

- Coletor: `scripts/agenda_efficiency_metrics.py`; método, comando e limitações
  em [metrics.md](metrics.md). A coleta não importa o runtime da aplicação.
- Coleta final em 04/10/2026 às 22:19:43 Fortaleza, via stdin na VPS, sem gravar
  arquivos remotos, em PostgreSQL com `read_only=on` e `repeatable read`.
- Evidência sem nomes, contatos, observações ou identificadores:
  [metrics-baseline-2026-10-04.json](evidence/metrics-baseline-2026-10-04.json).
- Setembro: 177 registros, 143 realizados, 24 dias ativos, 29 pares na mesma
  clínica, dos quais nove com intervalo negativo. As lacunas não negativas
  somam 315 minutos; excesso fragmentado acima de cinco minutos soma 235.
- A medida mais rigorosa exclui todos os eventos envolvidos em sobreposição e
  desconta as transições dentro de cada bloco: 195 minutos de folga teórica,
  tanto por duração persistida quanto na sensibilidade ao catálogo atual.
  Não equivale a capacidade adicional garantida e não altera o histórico.
- Comparação definida: pré 31/08–27/09 e pós 05/10–01/11. No snapshot existem
  zero semanas pós completas: `INSUFFICIENT_SAMPLE`, sem diferença calculada
  ou ganho causal. Registros futuros permanecem em seção separada.
- Vinte testes aprovados, incluindo sobreposições aninhadas, lacunas/durações
  ausentes, reservas expiradas, coortes de criação, semanas incompletas,
  catálogo como sensibilidade, privacidade e rejeição de banco/transação
  incompatíveis. Sintaxe Python e `git diff --check` aprovados.
- Revisão independente confirmou os testes e a separação entre duração
  persistida principal e catálogo atual; não restou achado acionável no coletor.

A preparação e a primeira coleta estão concluídas. A medição de diferença
observada requer o decurso da janela pós, completa a partir de 02/11/2026 em
Fortaleza; mesmo então a comparação será descritiva, sem prova causal. Não foi
criada automação nem instrumentação adicional no runtime.

## Evolução local: horário inicial aberto — 2026-10-05

- Causa reproduzida em agenda sintética livre, jornada 08:00–18:00 e exame de
  40 minutos: sem filtro, as oito ofertas incluem um horário antes de 09:00; o
  assistente reduz a apresentação a duas por data. O contrato anterior rejeitava
  `hora_inicio` sem `hora_fim`, embora houvesse candidatos após 09:00.
- O modal agora oferece "A partir de" com apenas o horário inicial; a faixa
  personalizada fechada continua exigindo ambos. Para 16/10/2026 e 09:00,
  envia data específica e `hora_inicio` antes de gerar, sem `hora_fim` fictício.
  Alterar o filtro invalida ofertas e aceite anteriores; limpar as preferências
  amplia a busca somente por ação explícita.
- O backend aceita início isolado, intersecta com turno e jornada antes do
  ranking e exige que o exame inteiro caiba. Fim isolado, horário inválido e
  restrição incompatível continuam rejeitados; janela 17:30–18:00 para exame
  de 40 minutos retorna vazio. O teste do motor usa 16/10/2099 para continuar
  futuro em execuções posteriores; o teste do modal cobre 16/10/2026. Uma
  execução sintética adicional com 16/10/2026 retornou oito opções, incluindo
  09:00 e nenhuma anterior, na janela 09:00–18:00, sem consultar produção.
- Testes focados do backend: 16/16 aprovados, incluindo orquestrador restrito
  à data explícita e primeiras ofertas a partir de 09:00. Frontend completo:
  72 arquivos/501 testes Vitest e 9 testes Node aprovados; ESLint, TypeScript
  e build Next.js aprovados. Revisão independente não encontrou P1/P2 no fluxo.
- A ferramenta administrativa de disponibilidade teve seu contrato descritivo
  alinhado ao início isolado. Seu teste confirma propagação do limite ao motor,
  consulta somente da data declarada e descarte de slots fora da janela; fim
  isolado e turno incompatível seguem inválidos. Suíte completa do backend:
  1.527 testes processados, 7 ignorados, `OK` em 52,238 s com SQLite temporário
  e Python 3.11. Sintaxe Python, `git diff --check` e guardrail SDD aprovados.
- O produtor de pedidos WhatsApp ainda encaminha a expressão textual livre
  "16/10 depois das 9h" para revisão humana; a importação no modal funciona
  quando o pedido contém a preferência estruturada. Nenhum WhatsApp real foi
  enviado e nenhuma agenda de produção foi modificada para este teste.

Esta seção registra a validação local e sintética; a comprovação posterior
em stage está na seção abaixo.

## Integração com stage atual — 2026-10-08

- A feature foi integrada sobre `origin/stage` `5be2cf82`, que inclui a regra
  posterior de primeira saída. Ela muda a ordem do ranking em um dia livre;
  por isso o teste passou a exigir que nenhuma oferta filtrada anteceda 09:00
  e que 09:00 permaneça disponível, sem pressupor ser o primeiro item.
- Com dados inteiramente sintéticos em 16/10/2026, a busca devolveu oito
  opções, todas a partir de 09:00 e uma delas exatamente às 09:00, na janela
  09:00–18:00. O modal revalida o aceite assíncrono segundo o contrato atual.
- O stage anterior falhou no quality gate do [run 37639399301](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37639399301):
  oito testes antigos de duração/reserva simulavam rota mas não configuravam
  endereço da base depois da remoção do default. As duas fixtures agora
  fornecem base sintética mantendo as regras reais do banco. A regra
  operacional de primeira saída não foi afrouxada.
- Revalidação local após integração: 80 testes focados do backend; suíte
  completa com 1.582 testes processados, 7 ignorados, `OK` em 58,470 s.
  Frontend: 77 arquivos/540 testes Vitest e 9 testes Node aprovados, além de
  ESLint, TypeScript e build Next.js. `git diff --check` aprovado.

Nenhuma consulta ou alteração de agendamento em produção foi necessária.

## Evolução `A partir de`: publicação em stage — 2026-10-08

- O PR [#326](https://github.com/martinialebarros-svg/fortcordis-v2/pull/326)
  integrou a evolução no commit `22941f3a` de stage. O
  [deploy 37874486908](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/37874486908)
  terminou com quality gate, SDD e implantação aprovados, incluindo canário
  autenticado e exercício de restauração.
- `/agenda` respondeu 200 nos três domínios de stage; todos os 18 chunks
  referenciados pelo HTML responderam 200 e um deles contém o controle
  `A partir de`. A API de agenda anônima retornou 401.
- Em stage, um smoke autenticado para **16/10/2026**, após confirmar que não
  havia registros de agendamento na data, enviou a preferência com
  `hora_inicio: 09:00` e sem `hora_fim`. Animal Care recebeu oito opções;
  a mais cedo foi **09:00** e nenhuma antecedeu esse limite. A mesma consulta
  verificou a regra de primeira saída em Caucaia, com mínimo calculado às
  08:33, primeira oferta às 08:45 e rejeição de oferta inviável na revalidação.
  Não houve criação de reserva/agendamento nem exposição de dados de pacientes.

Esta evolução ainda aguarda promoção protegida e validação em produção.
