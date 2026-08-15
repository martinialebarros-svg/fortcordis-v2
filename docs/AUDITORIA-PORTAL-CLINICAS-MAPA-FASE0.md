# Auditoria do Portal de Clinicas / IA de Navegacao — Mapeamento (Fase 0)

> **Origem:** `docs/specs/portal-clinicas-ia-consolidacao/intent.md`, secao 10. Mapeamento executado por 3 agentes em paralelo (somente leitura, nenhum arquivo modificado), nesta sessao, em 2026-08-14.
> **Status:** Fase 0 (Mapear) concluida — 3/3 agentes. Fase 1 (redesenhar IA + refatorar) **nao iniciada**.
>
> Este mapeamento reflete o **estado do disco em 2026-08-14**. Se a working tree mudou desde entao, revalide os `arquivo:linha` antes de agir.
>
> Os itens em "pontos de atencao" / "suspeitas nao verificadas" de cada secao sao **observacoes nao confirmadas como bugs** — os agentes foram instruidos a nao afirmar isso. Confirme no codigo (e, quando indicado, no backend ou em runtime) antes de corrigir qualquer um.

## Indice

- [1. Menu, Dashboard e Agenda vs Calendario](#1-menu-dashboard-e-agenda-vs-calendario)
- [2. Financeiro, Relatorios e Fiscal](#2-financeiro-relatorios-e-fiscal)
- [3. Clinicas, Portal (admin e externo) e Laudos](#3-clinicas-portal-admin-e-externo-e-laudos)
- [4. Sintese cross-modulo](#4-sintese-cross-modulo)

---

## 1. Menu, Dashboard e Agenda vs Calendario

Escopo lido na integra: `frontend/app/layout-dashboard.tsx` (562 linhas), `frontend/app/dashboard/page.tsx` (560 linhas), `frontend/app/agenda/page.tsx` (3352 linhas), `frontend/app/agenda/fullcalendar/page.tsx` (3262 linhas), `frontend/app/agenda/fullcalendar/AgendaFullCalendarView.tsx` (111 linhas), `frontend/app/agenda/ClienteInfoModal.tsx` (579 linhas), `frontend/app/agenda/NovoAgendamentoModal.tsx` (4545 linhas — leitura estrutural completa + trechos-chave), mais `frontend/lib/agenda-config.ts`, `frontend/lib/agenda-shared-actions.ts` e `frontend/lib/racas.ts` como apoio.

### (a) Menu e permissoes

`frontend/app/layout-dashboard.tsx:59-99` define `menuGroups` com 4 grupos e 19 itens no total, todos na mesma sidebar sem nenhuma separacao por fluxo de trabalho:
- **"Comando"** (5 itens, linhas 62-68): Dashboard `/dashboard`, Mente FortCordis `/assistente-ia` (unico item com `adminOnly: true`), Agenda `/agenda`, Calendario `/agenda/fullcalendar`, Atendimento `/atendimento`.
- **"Clinica"** (7 itens, linhas 72-80): Pacientes, Clinicas, Portal Clinicas, Servicos, Laudos, Visualizador Vivid IQ, Referencias Eco.
- **"Gestao"** (5 itens, linhas 84-90): Logistica, Financeiro, Custos Frota, Exportacao Fiscal, Relatorios.
- **"Sistema"** (2 itens, linhas 94-97): WhatsApp Stage, Configuracoes.

`menuItems = menuGroups.flatMap(...)` (linha 101) achata os 4 grupos so para calcular o item ativo (`activeHref`, linhas 355-357: filtra por `pathname === item.href` ou `pathname.startsWith(item.href + "/")`, exceto `/dashboard`, e escolhe o href mais especifico).

Permissao: o tipo `MenuItem` (linhas 52-57) tem UM unico campo de controle de visibilidade, `adminOnly?`. `userIsAdmin` (linhas 345-353) le `user.papeis` (retornado por `GET /auth/me`, linha 242) e verifica se algum papel normalizado para minusculas e `"admin"`. Essa flag e usada em um unico ponto do arquivo: `group.items.filter((item) => !item.adminOnly || userIsAdmin)` na linha 489. Dos 19 itens, so 1 ("Mente FortCordis") e restrito a admin; os outros 18 — incluindo Financeiro, Custos Frota, Exportacao Fiscal e Configuracoes — aparecem para qualquer usuario autenticado, sem distincao de papel (recepcao, veterinario, financeiro etc). Nao ha nenhuma outra logica de role neste arquivo.

Resto do arquivo, sem relacao direta com agenda/dashboard alem de ser o layout que cada pagina importa manualmente (nao ha `layout.tsx` do App Router fazendo isso automaticamente — `agenda/page.tsx`, `agenda/fullcalendar/page.tsx` e `dashboard/page.tsx` chamam `<DashboardLayout>` cada um por conta propria): fluxo de auth via `/auth/me` (238-269) com redirect para `/` em erro (`redirecionarParaLogin`, 171-177); branding via `/configuracoes` e `/configuracoes/logomarca` (188-215); `FortinhoProvider` condicionado a `fortinho_habilitado` (557-561).

### (b) Dashboard

`frontend/app/dashboard/page.tsx` (560 linhas) NAO tem subpasta `components/` nem `hooks/` — so existe `page.tsx` ali. Todos os subcomponentes sao locais ao arquivo: `EcgTrace` (71-117, decoracao SVG), `MetricCard` (119-138), `QuickActionLink` (140-162), `DashboardLoadingState` (164-172), `DashboardErrorState` (174-194), `EmptyAgendaState` (196-218).

Chamadas de API, todas em `carregarDados()` (243-298):
- `GET /agenda?data_inicio=<hoje>T00:00:00&data_fim=<hoje>T23:59:59` (linha 250) — so o dia atual, sem filtro de clinica/status/origem/servico, sem `skip`/`limit`.
- `GET /pacientes`, `GET /clinicas`, `GET /servicos` em paralelo via `Promise.all` (254-258), so para os totais dos cards.

Existe widget "agenda de hoje": `agendamentosHoje` (estado na linha 230, populado em 274-286) pega os 5 primeiros agendamentos do dia ordenados por horario, mapeados para um shape local `AgendamentoHoje` (34-41) e renderizados como timeline em `fc-agenda-theater` (500-539). `confirmados`/`pendentes` (260-261) sao calculados com comparacao de string hardcoded direto no componente (`status === 'Confirmado'`, `status === 'Agendado' || status === 'Reservado'`), sem importar `AGENDA_STATUS_LIST` de `frontend/lib/agenda-shared-actions.ts:20-29` (a lista canonica de 8 status que `agenda/page.tsx:32` e `agenda/fullcalendar/page.tsx:24` importam). `getStatusIcon`/`getStatusColor` (300-318) so tratam explicitamente 4 dos 8 status canonicos (Confirmado, Cancelado, Agendado, Reservado) — "Em atendimento", "Realizado", "Faltou" e "Expirado" caem no fallback generico.

Essa logica NAO reusa nada do modulo de agenda: nenhum import de `@/lib/agenda-config`, `@/lib/agenda-shared-actions` ou `@/lib/useAgendaRealtime`; so `api` de `@/lib/axios` (linha 6) com chamadas inline. Duplica o CONCEITO de "carregar agenda do dia" que tambem existe nas duas rotas de agenda, mas o CODIGO nao e compartilhado — nao ha hook/service comum entre dashboard e agenda.

Sem tempo real: nao usa `useAgendaRealtime`, sem toast, sem auto-refresh; busca uma vez no mount (234-241, condicionado a `token` no localStorage) e so atualiza de novo por retry manual em erro (`DashboardErrorState.onRetry`, 490). Links do widget ("Abrir agenda" 508; "Criar agendamento"/"Ver agenda" em `quickActions` 381 e 389; link de `EmptyAgendaState` 211) apontam todos para `/agenda` — nenhum link do dashboard referencia `/agenda/fullcalendar`.

### (c) Agenda vs Calendario

Tamanho: `agenda/page.tsx` = 3352 linhas; `agenda/fullcalendar/page.tsx` = 3262 linhas; `AgendaFullCalendarView.tsx` = 111 linhas (wrapper fino do componente `<FullCalendar>` da lib `@fullcalendar/react`); `NovoAgendamentoModal.tsx` = 4545 linhas; `ClienteInfoModal.tsx` = 579 linhas.

Historico (git log): `agenda/page.tsx` existe desde o primeiro commit do repo (2026-02-16), 58 commits no total. `agenda/fullcalendar/page.tsx` foi introduzido depois, primeiro commit em 2026-03-06 ("feat: integrar agenda fullcalendar com realtime e ajustes operacionais"), 34 commits. O calendario nasceu como uma SEGUNDA visao sobre o mesmo dominio, ja saindo com realtime — compativel com o padrao de copiar a logica de carregamento/estado da lista ja madura em vez de extrair um hook compartilhado.

**Componentes genuinamente compartilhados (nao duplicados):** `NovoAgendamentoModal` e `ClienteInfoModal` sao o MESMO arquivo importado pelas duas rotas — `agenda/page.tsx:60-61` faz import estatico, `agenda/fullcalendar/page.tsx:78-79` faz import dinamico (`dynamic(() => import("../NovoAgendamentoModal"))` e `"../ClienteInfoModal"`) dos mesmos caminhos. Props equivalentes: `agenda/page.tsx:3327-3339` vs `fullcalendar/page.tsx:3236-3248` (mesma interface, 11 props); unica diferenca notada e `defaultDate` (`page.tsx:3332` cai para `filtroData || hojeLocal()`, `fullcalendar/page.tsx:3241` passa `slotSelecionado?.data` sem fallback). Ambas importam o mesmo conjunto de libs de dominio: `@/lib/coordinates`, `@/lib/agenda-realtime-toast`, `@/lib/useAgendaRealtime`, `@/lib/agenda-config`, `@/lib/laudos`, `@/lib/agenda-shared-actions`, `@/lib/agenda-route-rules`, `@/lib/credito-cliente`, `@/lib/waze` (`page.tsx:6-54`; `fullcalendar/page.tsx:18-67`).

**Duplicacao verificada no nivel da pagina** (funcoes com corpo identico ou quase identico, declaradas de forma independente nos dois arquivos, nao factoradas em hook/modulo comum):
- `toDateInput`: `page.tsx:162-167` vs `fullcalendar/page.tsx:219-224`.
- `parseApiDateTime`: `page.tsx:183-208` vs `fullcalendar/page.tsx:332-355`.
- `parseAgendamentoInicioLocal`/`parseInicioLocal`: `page.tsx:210-229` vs `fullcalendar/page.tsx:357-377`.
- `parseAgendamentoFimLocal`/`parseFimLocal`: `page.tsx:231-245` vs `fullcalendar/page.tsx:379-393`.
- `gerarPagamentoId`: `page.tsx:336-338` vs `fullcalendar/page.tsx:249`.
- `toMoneyInput`/`parseMoneyValue`: `page.tsx:340-350` vs `fullcalendar/page.tsx:251-261`.
- `usuarioEhAdmin` (decodifica JWT manualmente): `page.tsx:638-671` vs `fullcalendar/page.tsx:278-312` — mesmo corpo.
- `formatarMoedaBRL`: `page.tsx:1826-1832` vs `fullcalendar/page.tsx:405-411`.
- `SLOT_INTERVALO_PADRAO_MIN`: `page.tsx:352` vs `fullcalendar/page.tsx:263`.
- `carregarFormasPagamento`: `page.tsx:466-499` vs `fullcalendar/page.tsx:645-678`.
- `resumoPagamentoModal` (useMemo com taxa/desconto/credito/excedente): `page.tsx:1242-1309` vs `fullcalendar/page.tsx:684-747`.
- `atualizarLinhaPagamento`/`removerLinhaPagamento`/`adicionarLinhaPagamento`: `page.tsx:1311-1338` vs `fullcalendar/page.tsx:749-776`.
- `carregarClinicasComEndereco`: `page.tsx:1055-1100` vs `fullcalendar/page.tsx:867-912`.
- `carregarTutoresComEndereco`: `page.tsx:1102-1147` vs `fullcalendar/page.tsx:914-959`.
- `carregarLaudosVinculados`: `page.tsx:942-1001` vs `fullcalendar/page.tsx:1020-1079`.
- `carregarConfiguracaoAgenda` (com fallback 404 para `/configuracoes`): `page.tsx:673-704` vs `fullcalendar/page.tsx:1135-1164`.
- `agendarRefreshRealtime`/`mostrarToastRealtime`/`abrirAgendamentoDoToast`: `page.tsx:863-940` vs `fullcalendar/page.tsx:1166-1243`.
- Efeito de buscar saldo de credito ao abrir modal de pagamento: `page.tsx:512-551` vs `fullcalendar/page.tsx:577-616`.
- Interfaces identicas declaradas 2x sem tipo compartilhado (`Agendamento`, `ClinicaEndereco`, `TutorEndereco`, `OrdemServicoResumo`, `LaudoVinculado`, `LaudosVinculadosPorAgendamento`, `ToastRealtimeData`, `PagamentoRecebimentoItem`, `CarregarAgendamentosOptions`): `page.tsx:64-149` vs `fullcalendar/page.tsx:81-175`.
- Modal de "receber pagamento" com JSX essencialmente igual repetido: `page.tsx:3002-3284` e `fullcalendar/page.tsx:2897-3183`.

**Diferencas reais e verificadas** (funcionalidade presente em um arquivo, ausente no outro):

So em `agenda/page.tsx` (lista):
- Alternancia entre 3 visualizacoes construidas a mao NA MESMA rota: `modoVisualizacao` = lista / panoramica-dia / panoramica-semana (tipo linha 160, estado 359, abas 2121-2140, grade renderizada 2743-2902) — a rota de lista ja tem seu proprio mini-calendario em grade, independente do FullCalendar.
- Alerta de reserva perto de expirar: `obterEstadoPrazoReserva`/`ReservaPrazoEstado`/`reservasEmAlerta`/`existeReservaCritica` (301-333, 1799-1809), banner dedicado (2052-2116), destaque por linha (2404, 2416-2424) e por slot na grade (2824-2860). Zero ocorrencias dessas funcoes em `fullcalendar/page.tsx`.
- Cards de resumo financeiro admin-only "Realizado no dia/periodo" e "Previsao do agendado", de `GET /agenda/resumo-financeiro` (estado 406, `carregarResumoFinanceiro` 1149-1195, renderizado 1988-2040). Zero ocorrencias em `fullcalendar/page.tsx`.
- Filtros por nome de paciente/tutor, clinica e servico (2232-2271), mais faixa "Estado da agenda no periodo" com dias fechados/janelas especiais (`alertasAgendaLista`, 602-636, renderizado 2296-2338).

So em `agenda/fullcalendar/page.tsx` (calendario):
- Arrastar/redimensionar agendamento com validacao de conflito e horario de funcionamento, com opcao de recorrencia (a cada 7 dias / seg-sex / todos os dias ate uma data limite): `OPCOES_RECORRENCIA` (199-204), `movimentacaoPendente` (495), `handleEventDrop`/`handleEventResize` (2249-2281), `abrirFluxoRecorrenciaMovimentacao` (1864-1897), `confirmarRecorrenciaMovimentacao`/`gerarIniciosRecorrencia` (1908-2112), modal dedicado (2801-2895). Zero ocorrencias em `agenda/page.tsx`.
- Botao de abrir/fechar a agenda de um dia especifico na barra do calendario (`alternarAberturaAgendaDia`, 1432-1491, botao 2429-2449), gravando excecao via `PUT /configuracoes`. Zero ocorrencias em `agenda/page.tsx`.
- A grade do calendario vem da lib `@fullcalendar/react` (`AgendaFullCalendarView.tsx:64-109`), que ja embute troca de visao mes/semana/dia/lista no proprio `headerToolbar` (linhas 70-74, botao `listWeek`) — ou seja, o FullCalendar em si ja fornece uma TERCEIRA implementacao independente de "lista de agendamentos", alem da lista manual e da grade panoramica manual dentro de `agenda/page.tsx`.
- Painel "Detalhes do evento selecionado" (2541-2798) com dropdown de troca de status (`menuStatusAberto`, acoes de `obterAcoesStatusPorFluxo`); a lista usa botoes inline por linha (2527-2573) construidos de um Record local `icons`/`colors` (ver duplicacao abaixo).

Navegacao cruzada deliberada: `agenda/page.tsx:553-568` (`abrirAgendaFullCalendar`) leva a `/agenda/fullcalendar?data=...&status=...&origem_atendimento=...` (botao "Calendario completo", ~1921-1928); `fullcalendar/page.tsx:1635-1646` (`abrirAgendaLista`) leva de volta a `/agenda?data=...&visao=lista&status=...&origem_atendimento=...` (botao "Ver lista", 2392-2399); cada rota le esses parametros de volta no mount (`page.tsx:427-464`; `fullcalendar/page.tsx:617-643`). Isso mostra intencao de tratar as duas rotas como "a mesma agenda, duas lentes", mesmo sendo 2 arquivos de 3000+ linhas cada em vez de um arquivo com alternancia de visualizacao.

Divergencias de comportamento ja verificadas (nao suspeita) em logica que aparenta ser a mesma:
- `carregarOrdensServicoVinculadas`: em `fullcalendar/page.tsx:987-990` a OS com `status === "Cancelado"` e explicitamente pulada ao escolher a "OS mais recente" de um agendamento, e status ausente vira `"Pendente"` (linha 1003); em `agenda/page.tsx:1003-1053` nao ha esse filtro e status ausente vira string vazia. Mesma funcao nominal, resultado diferente se a OS de maior id de um agendamento for uma cancelada.
- Estrategia de busca em `carregarAgendamentos`: `fullcalendar/page.tsx:1086-1133` pagina explicitamente (paginas de 500, loop com `skip`/`total`); `agenda/page.tsx:792-861` faz um unico `GET /agenda?...` sem `skip`/`limit`, confiando que a resposta ja vem completa. Se isso causa truncamento real em periodos com muitos agendamentos depende do limite padrao de pagina do backend em `GET /agenda`, fora do escopo desta leitura (so frontend).
- Mapeamento status-para-visual existe de 3 formas independentes: `getStatusColor`/`getStatusIcon` em `agenda/page.tsx:1626-1652` (badge do status atual), um SEGUNDO Record `icons`/`colors` no mesmo arquivo dentro do loop de botoes de acao (`page.tsx:2530` e `2540`), e a constante `STATUS_CORES` em `fullcalendar/page.tsx:206-215` — nenhuma importa de paleta compartilhada.

### (d) Pontos de atencao / suspeitas

**Verificado** (fato observado diretamente no codigo):
1. **Inconsistencia no catalogo de racas** (relevante para o trabalho em andamento na branch atual): `ClienteInfoModal.tsx:14-19,85-87,454-466` usa `frontend/lib/racas.ts` (`getRacaOptions`/`loadRacasCustomPorEspecie`/`saveRacasCustomPorEspecie`/`addRacaCustomPorEspecie`) e renderiza raca como `<select>` com opcao de adicionar raca nova. `NovoAgendamentoModal.tsx` NAO importa `frontend/lib/racas.ts` (ausente da lista de imports, linhas 3-34) e renderiza o campo raca do sub-formulario "novo animal" como `<input type="text" placeholder="Raca">` livre, sem catalogo (linhas 4454-4461). As duas telas sao acessiveis a partir das mesmas rotas de agenda para o mesmo campo conceitual — quem cadastra um pet novo durante a criacao de um agendamento nao ve o mesmo catalogo que acabou de ser adicionado para edicao de paciente/tutor existente via ClienteInfoModal. Parece rollout parcial do catalogo de racas; nao verificado fora de `agenda/` (ex.: `frontend/app/pacientes/`).
2. `frontend/lib/racas.ts:96-97,144-176` guarda raca customizada em `localStorage` (chave `fortcordis:racas-custom-por-especie`), por navegador/maquina, sem chamada de persistencia no backend — uma raca adicionada num computador nao aparece para outro usuario/maquina. Nao verificado se existe endpoint de backend equivalente e simplesmente nao usado aqui.
3. `dashboard/page.tsx:300-318` so trata 4 dos 8 status canonicos de `frontend/lib/agenda-shared-actions.ts:20-29` e nao importa essa lista — se o conjunto de status mudar, o widget do dashboard nao acompanha automaticamente.
4. `NovoAgendamentoModal.tsx` tem 4545 linhas (o maior arquivo desta auditoria inteira) e concentra num unico arquivo: CRUD de agendamento, sub-formulario de tutor novo, sub-formulario de animal novo, consulta de saldo de credito, montagem/edicao de mensagem de WhatsApp, um assistente de sugestao de horario com maquina de estados propria (`decisaoAssistente`, `motivoSemOpcao`, `excecaoConcedida`, linhas 799-856) e mensagens de conflito de deslocamento entre clinicas.

**Suspeita** (observado, nao verificado contra o resto do repo/backend):
5. `frontend/app/agenda/page.tsx.backup.20260216_200104` (196 linhas) e uma versao antiga e bem mais simples da lista (sem realtime, laudos, financeiro ou panoramica), parada dentro da pasta da rota. O App Router so trata `page.tsx` como rota, entao esse arquivo nao e servido, mas fica como clutter ao lado do arquivo real; nao houve busca exaustiva por referencias a ele no resto do repo.
6. Dashboard nao usa `useAgendaRealtime` — o tile "Agenda de hoje" so reflete o estado do ultimo load/retry manual, diferente das duas rotas de agenda que tem indicador de tempo real. Pode ser lacuna ou decisao deliberada de manter o dashboard leve.
7. A duplicacao de calculo do modal de pagamento e do timer de reserva entre os dois arquivos de agenda e, hoje, consistente nos dois lados (mesmas formulas/constantes) — risco estrutural de manutencao (corrigir num lugar e esquecer o outro), nao um bug ja observado, EXCETO a divergencia do filtro "Cancelado" em `carregarOrdensServicoVinculadas`, essa sim ja confirmada acima.
8. Se `GET /agenda` no backend aplica limite de pagina padrao (o que tornaria a busca sem paginacao de `agenda/page.tsx:792-861` incompleta para periodos grandes) nao foi checado — fora do escopo desta leitura (so frontend).

---

## 2. Financeiro, Relatorios e Fiscal

Escopo lido na integra: `frontend/app/financeiro/page.tsx` (3339 linhas), `frontend/app/financeiro/relatorios/page.tsx` (350 linhas), `frontend/app/relatorios/page.tsx` + `components/` (incl. `views/`) + `hooks/useRelatoriosModule.ts` + `repositories/relatoriosRepository.ts` + `services/relatoriosViewModel.ts` + `types.ts` + `formatters.ts` + `constants.ts`, `frontend/app/financeiro/frota/page.tsx` (825 linhas), `frontend/app/fiscal/page.tsx` + `exportar/` + `nova/` + `components/ExportacaoDadosContabeisPage.tsx` (985 linhas).

### (a) financeiro/page.tsx (3339 linhas, export default unico `FinanceiroPage`, linha 336)

Arquivo client-side (`"use client"`, linha 1) que concentra 6 responsabilidades distintas sob uma unica rota `/financeiro`, com estado local unico (~30 `useState`, linhas 337-407) e nenhuma decomposicao em subcomponentes de dominio (so importa `TransacaoModal`, linha 7, e usa `DashboardLayout`, linha 5).

1. **KPI header / resumo periodo-nomeado** - estado `resumo` (interface `Resumo`, linhas 164-174: entradas, saidas, saldo, a_receber, a_pagar, pendente_entrada, pendente_saida, taxas_pagamento, creditos_gerados) alimentado por `GET /financeiro/resumo?periodo={dia|semana|mes|ano}` (linha 543, dentro do `Promise.all` de `carregarDados`, linhas 517-585). Renderizado em 6 cards de metrica (linhas 1813-1901). Selecao de periodo via botoes dia/semana/mes/ano (linhas 1800-1811).
2. **Cadastro de meios de pagamento** (master-data) - CRUD embutido de formas de pagamento e bandeiras de cartao: `cadastrarBandeiraRapido` -> `POST /financeiro/bandeiras-cartao` (798-816); `cadastrarFormaPagamentoRapido` -> `POST /financeiro/formas-pagamento` (818-860); `desativarFormaPagamento` -> `DELETE /financeiro/formas-pagamento/{id}` (862-872); `editarTaxasFormaPagamento` -> `PUT /financeiro/formas-pagamento/{id}` (874-912). Tabela nas linhas 1903-1984, usando `window.prompt` (sem modal proprio) para captura de dados.
3. **Aba "Transacoes"** (`abaAtiva === "transacoes"`, linhas 2192-2293) - lista/filtra transacoes (`transacoesFiltradas`, 1080-1092), `handleEditar`/`handleNova` abrem `TransacaoModal` (914-922, montado 2839-2844), `handleExcluir` -> `DELETE /financeiro/transacoes/{id}` (924-934), `handlePagar` -> `PATCH /financeiro/transacoes/{id}/pagar` (936-944).
4. **Aba "Cobrancas"** (2295-2492) - agrupa OS pendentes por destinatario (clinica ou tutor, conforme `origem_atendimento`) via `gruposCobrancaDestinatario` (1200-1235, 100% client-side sobre `ordensServico` ja carregado). Editor de template de mensagem com placeholders (`{{destinatario}}`, `{{data}}`, `{{lista_os}}`, `{{total_pendente}}`, 1469-1501, 2319-2352), envio via WhatsApp (`enviarCobrancaWhatsApp`, 1529-1540) ou copia de texto (`copiarMensagemCobranca`, 1542-1550), e **um gerador de PDF de pendencias** (`baixarRelatorioPendenciasPDF` -> `GET /ordens-servico/relatorios/pendencias/pdf`, 1551-1618) por grupo ou geral (botao 2310-2316) - relatorio embutido, dissociado das 2 telas dedicadas de "Relatorios".
5. **Aba "Ordens de Servico"** (2494-2795) - edicao de OS com recalculo de preco (`salvarEdicaoOS` -> `PUT /ordens-servico/{id}`, 1030-1064), recebimento com multiplas formas de pagamento e credito de cliente (`confirmarRecebimentoOS` -> `PATCH /ordens-servico/{id}/receber`, 980-1016, modal 3105-3336), desfazer recebimento (`PATCH /ordens-servico/{id}/desfazer-recebimento`, 1018-1028), exclusao (`DELETE /ordens-servico/{id}`, 1066-1077), e **geracao/preview/compartilhamento de recibo em PDF** individual ou agrupado (`obterReciboOSPDF` -> `GET /ordens-servico/relatorios/recibos/pdf`, 1634-1664; preview inline via `pdfjs-dist`, componente `ReciboPdfPreview` 212-334, renderizado 3067-3103; compartilhamento WhatsApp/e-mail com fallback de download, 1709-1746, modal 2963-3065) - segundo relatorio/artefato PDF embutido nesta tela.
6. **Bloco de atalhos estatico** (2797-2835, sempre visivel independente da aba ativa): 3 cards -> `href="/financeiro/relatorios"` (2799-2810, label "Relatorios", icone `BarChart3`), `href="/financeiro/dashboard"` (2811-2822, label "Dashboard"), `href="/financeiro/contas"` (2823-2834, label "Contas").

### (b) financeiro/relatorios/page.tsx (350 linhas, export default `RelatoriosFinanceirosPage`, linha 45)

Tela isolada com 3 abas locais (`ABAS_RELATORIO`, 37-41: `categorias`, `comparativo`, `grafico`; estado `abaAtiva`, linha 53 - mesmo nome de variavel de financeiro/page.tsx, semantica local diferente). `carregarRelatorios` (69-90) dispara 4 chamadas em paralelo: `GET /financeiro/relatorios/categorias?tipo=entrada&data_inicio=X&data_fim=Y` e `tipo=saida` (75-76), `GET /financeiro/relatorios/comparativo-mensal?meses=6` (77), `GET /financeiro/relatorios/dados-grafico?tipo=mensal&meses=6` (78). Nao chama `/financeiro/resumo` nem qualquer endpoint de OS/transacoes/contas a receber-pagar.

Resumo do topo (entradas/saidas/saldo/movimentacoes, cards 162-179) e **calculado no cliente** (`useMemo`, 121-135) somando os arrays de entradas/saidas - nao vem de endpoint agregado como `/financeiro/resumo` de (a). Aba "categorias" (233-283): entradas/saidas por categoria com barra de progresso e %. Aba "comparativo" (285-315): tabela mes a mes com variacao %. Aba "grafico" (317-345): bar chart entradas x saidas por mes com divs/style inline (sem lib de chart).

Sem DRE, fluxo de caixa, contas a receber/pagar, rentabilidade por clinica, alertas ou insights - escopo estritamente "categoria + comparativo mensal + grafico mensal", todos derivados de transacoes.

**Alcancabilidade** - `layout-dashboard.tsx:59-99` (menu principal) **nao** lista `/financeiro/relatorios`; so lista `/financeiro` (86), `/financeiro/frota` (87), `/fiscal` (88), `/relatorios` (89). Porem a rota **e alcancavel**: `financeiro/page.tsx:2800` tem `href="/financeiro/relatorios"` no bloco estatico sempre visivel (item 6 de (a)). A hipotese inicial de rota orfa/inalcancavel esta **parcialmente incorreta** - a tela existe, funciona e e alcancavel em 2 cliques (menu "Financeiro" -> card "Relatorios" no rodape de qualquer aba), so nao esta promovida ao menu principal.

### (c) relatorios/page.tsx + components/ + hooks/ + repositories/ + services/ (export default `RelatoriosControlePage`, linha 18)

Arquitetura em camadas (diferente de (a) e (b)): `page.tsx` (187 linhas) so composicao visual; `hooks/useRelatoriosModule.ts` (275 linhas) todo o estado/fetch; `repositories/relatoriosRepository.ts` (168 linhas) toda chamada HTTP; `types.ts` (425 linhas); `services/relatoriosViewModel.ts` (210 linhas) calculo derivado client-side; `formatters.ts` (26 linhas); `constants.ts` (31 linhas).

5 "dominios" navegaveis por abas (`DOMINIOS_RELATORIO`, constants.ts:3-9, page.tsx:107-123): `visao-geral`, `operacao`, `logistica`, `financeiro`, `rentabilidade`, roteados em `renderDominio()` (page.tsx:73-93) para 5 componentes View distintos.

**Fonte de dados** - `useRelatoriosModule.carregarRelatorios` (hooks/useRelatoriosModule.ts:149-174) dispara em paralelo `obterRelatorioControle(filtrosApi)` -> `GET /relatorios/controle` (relatoriosRepository.ts:84-90) - **um unico endpoint agregador de backend** retornando `RelatorioControleResponse` (types.ts:205-328: periodo, parametros, base_operacional, logistica, producao, financeiro, indicadores_extras, rentabilidade, alertas_operacionais, insights_avancados, sugestoes_relatorios) - e `obterContextoFinanceiro(filtrosApi)` (relatoriosRepository.ts:128-167) que dispara 6 chamadas paralelas adicionais: `GET /financeiro/relatorios/dre`, `GET /financeiro/relatorios/fluxo-caixa`, `GET /financeiro/relatorios/categorias?tipo=saida` (fixo), `GET /financeiro/relatorios/comparativo-mensal?meses=6` (linha 154 - **mesmo endpoint exato de (b) linha 77**), `GET /financeiro/contas-receber`, `GET /financeiro/contas-pagar` (144-156).

**Dominio "financeiro"** (`RelatoriosFinanceiroView.tsx`, 262 linhas) - 6 MetricCards (43-88: DRE lucro liquido, fluxo de caixa realizado, contas a receber consolidado [contas + OS pendentes, 33-35], contas a pagar, taxas de pagamento, creditos gerados), painel DRE gerencial detalhado (92-122), fluxo de caixa projetado 30 dias client-side via `montarProjecaoFluxo30d` (relatoriosViewModel.ts:79-117), inadimplencia % via `calcularInadimplenciaPercent` (relatoriosViewModel.ts:41-53), despesas por categoria (148-181 - **mesmo dado conceitual de (b) aba categorias, so lado saida**), competencia x caixa via `montarComparativoCompetenciaCaixa` (relatoriosViewModel.ts:55-77), tabelas de contas a receber/pagar (206-257).

**Dominio "visao-geral"** (`RelatoriosVisaoGeralView.tsx`, 254 linhas, aba default, `dominioAtivo` inicial em hooks/useRelatoriosModule.ts:42) - 9 MetricCards (53-114), `AlertasList` (116), grafico de evolucao mensal entradas x saidas (118-157, usa `financeiroContexto?.comparativo_mensal?.items` - **mesmo dado exato da aba "comparativo"/"grafico" de (b)**), pendencias de recebimento por clinica (160-198, usa `relatorio.insights_avancados.pendencias_recebimento`, tipo `PendenciaRecebimentoItem` so com `clinica_id`/`clinica_nome`/`valor_pendente`/`ordens_pendentes`, types.ts:198-203 - **sem quebra por tutor/domiciliar**, diferente do agrupamento de (a) que discrimina tutor quando `origem_atendimento === "domiciliar"`, financeiro/page.tsx:1159-1160), ranking resumido de rentabilidade (201-238), sugestoes de novos relatorios (240-250).

Demais dominios (`RelatoriosLogisticaView.tsx` 193, `RelatoriosOperacaoView.tsx` 223, `RelatoriosRentabilidadeView.tsx` 257) sao majoritariamente nao-financeiros, exceto `RelatoriosRentabilidadeView` que mostra despesa total/lucro liquido/margem por clinica (137-155) e referencia `custos_frota` do payload (22, 55-59) - unico ponto de contato com o modulo de frota (parte d).

Export configuravel por secao via `RelatoriosExportPanel.tsx` (141) e `RelatoriosFiltrosGlobais.tsx` (203): `baixarCsv`/`baixarPdf` (hooks/useRelatoriosModule.ts:180-223) -> `GET /relatorios/controle/export/{csv|pdf}` (relatoriosRepository.ts:92-117), secoes selecionaveis por dominio (`SECOES_POR_DOMINIO`, constants.ts:22-28).

### (d) Comparacao final + fiscal + frota + pontos de atencao

**Tabela comparativa das 3 telas de "relatorio financeiro":**

| Tela | Metricas/dados mostrados | Endpoint(s) principal(is) | Overlap com as outras 2 |
|---|---|---|---|
| **financeiro/page.tsx** (linha 336) | KPIs de topo (entradas/saidas/saldo/OS pendentes/taxas/creditos) por periodo nomeado; + 2 geradores de PDF ad-hoc (pendencias de cobranca, recibo de OS) | `GET /financeiro/resumo?periodo=X` (543); `GET /ordens-servico/relatorios/pendencias/pdf` (1591); `GET /ordens-servico/relatorios/recibos/pdf` (1645) | Parcial nos KPIs de topo com "visao-geral" de (c); os 2 PDFs sao exclusivos desta tela |
| **financeiro/relatorios/page.tsx** (linha 45) | Entradas/saidas por categoria; comparativo mensal (tabela); evolucao grafica mensal | `GET /financeiro/relatorios/categorias?tipo=X` (75-76); `GET /financeiro/relatorios/comparativo-mensal?meses=6` (77); `GET /financeiro/relatorios/dados-grafico?tipo=mensal&meses=6` (78) | **Overlap exato de fonte** com (c): mesmo endpoint `comparativo-mensal` alimenta o grafico de `RelatoriosVisaoGeralView.tsx:118-157`; despesas por categoria tambem consumidas por `RelatoriosFinanceiroView.tsx:148-181`. **Subconjunto estrito** de (c) |
| **relatorios/page.tsx** dominios "financeiro" + "visao-geral" | DRE completo; fluxo de caixa realizado + projetado 30d; contas a receber/pagar detalhadas; inadimplencia %; competencia x caixa; despesas por categoria; comparativo mensal; ticket medio; km/retorno por km; alertas operacionais; rentabilidade por clinica; sugestoes | `GET /relatorios/controle` (agregador) + `GET /financeiro/relatorios/{dre,fluxo-caixa,categorias,comparativo-mensal}` + `GET /financeiro/{contas-receber,contas-pagar}` | **Superset funcional** das outras 2 |

**Candidata a fonte de verdade**: `relatorios/page.tsx` (dominios visao-geral + financeiro) e a tela mais completa e a unica com DRE, fluxo de caixa, contas a receber/pagar detalhadas e exportacao configuravel - por volume de dados e arquitetura (camadas separadas) parece a mais recente das 3. `financeiro/relatorios/page.tsx` (arquivo monolitico, sem separacao de camadas, sem DRE) parece uma versao mais antiga do mesmo conceito, consistente com nao estar no menu principal e so ser alcancavel via 1 link secundario dentro de `financeiro/page.tsx:2800`.

**fiscal/page.tsx, fiscal/exportar/page.tsx, fiscal/nova/page.tsx**: `fiscal/page.tsx` (7 linhas) **nao e um redirect** - monta diretamente `<ExportacaoDadosContabeisPage />` (3-6). `fiscal/exportar/page.tsx` (8 linhas, 3-6) e `fiscal/nova/page.tsx` (8 linhas, 3-6) fazem **exatamente a mesma coisa**: montam o mesmo componente, sem props, sem diferenciacao por `pathname`. Ou seja, `/fiscal`, `/fiscal/exportar` e `/fiscal/nova` sao 3 rotas com conteudo **identico**. Menu principal so lista `/fiscal` (layout-dashboard.tsx:88); grep em todo `frontend/` nao encontrou nenhuma referencia interna a `"fiscal/exportar"` ou `"fiscal/nova"`.

`ExportacaoDadosContabeisPage.tsx` (985 linhas) e um modulo de emissao/exportacao contabil de OS por clinica (single/multi-clinica), consulta de CNPJ, autosave de dados fiscais e historico de emissoes - endpoints `/fiscal/relatorios-emissoes` (311), `/fiscal/clinicas-com-os` (401), `/fiscal/consulta-cnpj/{cnpj}` (501), `/fiscal/os-para-fiscal` (553), `/fiscal/os/exportar-lote` (629), alem de `PUT /clinicas/{id}` (454, 475). Tematicamente e um modulo de emissao de documento para contador, nao um relatorio financeiro gerencial - nao sobrepoe DRE/fluxo de caixa das 3 telas comparadas.

**financeiro/frota/page.tsx** (825 linhas, `CustosFrotaPage`): 4 abas locais (custos, veiculos, telemetria, config). Gerencia custos de frota por categoria e rateio (por_km/por_atendimento/fixo_mensal/hibrido). Nao mostra relatorio financeiro consolidado, mas seus dados aparentam alimentar `relatorio.rentabilidade.custos_frota` consumido em `RelatoriosRentabilidadeView.tsx:22,55-59` - **integracao de backend nao verificada nesta leitura**.

**Pontos de atencao - confirmados por leitura/grep direto** (nao sao suspeitas):
- `financeiro/page.tsx:2812` (`href="/financeiro/dashboard"`) - **rota inexistente** (sem pasta `financeiro/dashboard/`, sem rewrite em `next.config.js`, sem redirect em `middleware.ts`). **Link quebrado, 404 garantido.**
- `financeiro/page.tsx:2824` (`href="/financeiro/contas"`) - mesma situacao, **link quebrado**.
- `financeiro/relatorios/page.tsx` nao e orfao: alcancavel via `financeiro/page.tsx:2800`, ainda que ausente do menu principal.
- `relatorios/page.tsx` (menu, label "Relatorios", icone `BarChart3`) e o card dentro de `financeiro/page.tsx:2799-2810` (mesmo label, mesmo icone) apontam para **rotas diferentes** com dados parcialmente sobrepostos.

**Suspeitas nao verificadas** (exigiriam leitura de backend ou teste em runtime):
- `/fiscal/exportar` e `/fiscal/nova` - grep nao achou link interno, mas isso nao descarta acesso via URL direta/favorito salvo; suspeita de rota morta na pratica, nao confirmado.
- Divergencia numerica entre `financeiro/page.tsx` (`/financeiro/resumo?periodo=X`, janela nomeada) e o bloco `financeiro` do agregador `/relatorios/controle` (range arbitrario) - nao testado se os valores batem no "mesmo" mes.
- `relatorio.insights_avancados.pendencias_recebimento` (agrupado so por `clinica_id`) versus `gruposCobrancaDestinatario` de (a) (discrimina tutor em atendimento domiciliar) - possivel sub-representacao dessas pendencias na visao-geral de (c); inferencia sobre backend, nao verificada diretamente.
- Integracao `financeiro/frota` -> `relatorio.rentabilidade.custos_frota` - nao confirmada por leitura de backend.

---

## 3. Clinicas, Portal (admin e externo) e Laudos

Escopo lido na integra: `frontend/app/clinicas/portal/page.tsx` (1626), `frontend/app/clinicas/portal/parceiros/page.tsx` (1214), `frontend/app/clinicas/portal/espelho/page.tsx` (182), `frontend/components/portal/PortalClinicaWorkspace.tsx` (1245), `frontend/components/portal/PortalPartnerWorkspace.tsx` (954), `frontend/app/clinicas/[id]/page.tsx` (1092), `frontend/app/clinicas/novo/page.tsx` (953), `frontend/components/portal/PortalClinicaPageShell.tsx` (273), `frontend/components/portal/PortalPartnerPageShell.tsx` (251), `frontend/app/clinicas/components/ClinicaPortalAccessCard.tsx` (514); trechos de `frontend/app/layout-dashboard.tsx`, `frontend/middleware.ts` e do backend (`backend/app/api/v1/endpoints/portal_clinic_auth.py`, `backend/app/api/v1/endpoints/portal_partners.py`, `backend/app/models/portal_partner.py`) para fechar a pergunta de permissao/role.

### (a) Portal Clinicas — admin cockpit (frontend/app/clinicas/portal/page.tsx, 1626 linhas)

Arquivo unico, um so componente exportado (`PortalClinicManagementPage`, linha 271), sem subcomponentes internos alem de helpers puros (`TimelineIcon`, linha 222). Responsabilidades distintas identificadas:

1. **Fetch do painel geral** - `loadOverview()` (393-414), `GET /portal/admin/clinicas/acessos/painel`.
2. **Selecao de clinica ativa para o composer** - `selectedClinicId`/`selectedClinic` (281, 290-293), autoselect em `getSuggestedClinic` (261-269, 402-408).
3. **Composer de convite/reenvio** (form clinica/whatsapp/email/validade) - JSX 863-994, `handleGenerateInvite` (437-484).
4. **Exibicao do convite gerado** (link + mensagem pronta + copiar link/mensagem/abrir WhatsApp) - JSX 996-1062, `handleCopyLink` (486-496), `handleCopyMessage` (498-508), `handleOpenWhatsapp` (510-515).
5. **Convite rapido (1 clique) direto no card da clinica** - `handleQuickInvite` (524-571), botao 1536-1548. **E um atalho para o mesmo endpoint do item 3**; existe redundancia funcional entre "Editar convite" (botao 1549-1556, abre o composer) e o botao primario de convite rapido no mesmo card - dois caminhos para a mesma acao dentro do mesmo card.
6. **Fila de gestao / atalhos de priorizacao** (6 contadores clicaveis) - `managementQueue` memo (364-374), JSX 1086-1201. Tem interacao propria (filtra a lista abaixo), diferente dos itens 7 e 8.
7. **Metricas de adocao/recorrencia** - `adoptionMetrics` memo (376-391), JSX 1204-1221. **Fisicamente dentro do MESMO `<aside>` do item 6** (linha 1204 abre dentro do aside que comeca em 1076), sem interacao propria - card de KPI encaixado no meio de uma coluna de atalhos clicaveis.
8. **Feed de "ultimos downloads"** - JSX 1222-1272, usa `overview.recent_downloads` (fonte diferente da timeline por clinica do item 14). Tambem dentro do mesmo aside dos itens 6-7.
9. **Metricas gerais do painel** (8 cards no header) - JSX 788-861.
10. **Busca textual + filtro por status + checkbox "somente com primeiro download"** - JSX 1304-1340, logica em `filteredItems` (308-357). O checkbox `firstDownloadOnly` (280, aplicado 334-336) **se sobrepoe semanticamente ao quickView `"first_download_completed"`** (328-330): dois controles independentes filtrando pelo mesmo criterio, combinaveis ao mesmo tempo.
11. **Chips de quickView horizontais** - JSX 1342-1364. **Repetem, em outro formato visual, as MESMAS 6 opcoes ja clicaveis na "Fila de gestao" lateral** (item 6) - `quickView` controlado por dois blocos de UI diferentes (sidebar 1087-1201 e chips 1351-1364) em pontos opostos da tela. **Causa direta e verificavel da poluicao/redundancia visual relatada.**
12. **Reset de filtros** - `handleResetFilters` (517-522), botao 1365-1372.
13. **Exportacao CSV da lista filtrada** - `handleExportCsv` (573-649), botao 1292-1300.
14. **Lista/grid de clinicas**: identidade+localizacao, mini-cards contato/conta/convite, alerta de email pendente (1444-1448), alerta de inatividade via `getInactivityAlert` (123-150, 1450-1457), **timeline de eventos por clinica inline** (`buildTimelineToneClasses` 209-220, JSX 1459-1505), trio de stats downloads/sessoes/situacao (1508-1533) - repetido para CADA card. Maior candidata a virar visualizacao "drill-down" separada em vez de inline.
15. **Acoes de revogacao por clinica**: convite (`handleRevokeInvite` 651-675), sessoes (`handleRevokeSessions` 677-704), conta (`handleRevokeAccount` 706-737), cada uma com `window.confirm` proprio. Ver duplicacao com `ClinicaPortalAccessCard` em (e).
16. **Navegacao para telas relacionadas**: `/clinicas/portal/parceiros` (755-761), `/clinicas/portal/espelho` (762-768 e por card em 1557-1563), `/clinicas` (769-775), `/clinicas/${id}` (1564-1570 por card).

**Resumo**: 16 responsabilidades distintas em 1 arquivo/1 componente sem decomposicao interna alem de 1 helper visual. A redundancia mais concreta e verificavel esta nos itens 6/7/8 (3 conceitos empilhados no mesmo `<aside>`) e 10/11 (dois controles independentes disputando o mesmo estado/criterio de filtro).

### (b) Portal Clinicas/parceiros (frontend/app/clinicas/portal/parceiros/page.tsx, 1214 linhas)

Proposito confirmado por leitura completa: administra registros de `PortalPartnerProfile`, tipo `PortalPartnerType`, com **dois tipos** possiveis (botoes 607-624):
- `tipo: "veterinario"` - veterinario parceiro individual (atuacao volante/domiciliar/telemedicina), campos CRMV/CPF/area de atuacao (793-825).
- `tipo: "clinica"` - "clinica vinculada", associada a um `clinica_id` existente via select (630-657), preenchendo campos a partir do cadastro real da clinica (`fillFormFromClinic`, 276-288).

Confirmado no backend: `PORTAL_PARTNER_TYPE_CLINICA = "clinica"` / `PORTAL_PARTNER_TYPE_VETERINARIO = "veterinario"` (`backend/app/models/portal_partner.py:7-8`).

**Achado relevante e verificado**: mesmo permitindo cadastrar um parceiro `tipo: "clinica"` aqui, a geracao de convite/acesso (`handleGenerateInvite`, 416-462) **recusa explicitamente** parceiros do tipo clinica - linha 417-421: `if (partner.tipo !== "veterinario") { setError("O convite individual está disponível apenas para veterinários parceiros."); return; }`. O convite/acesso de uma "clinica vinculada" cadastrada aqui **nao acontece nesta tela** - acontece por outro caminho inteiro (o cockpit de (a) + `ClinicaPortalAccessCard`, usando `clinica_id` direto). O que exatamente o registro tipo="clinica" alimenta downstream (ex.: `PortalPartnerReleaseTarget`, `backend/app/models/portal_partner.py:32-46`) **nao foi verificado a fundo** - pergunta em aberto.

Relacao com (a): duas telas do mesmo dominio administrativo, **sem estado ou fetch compartilhado** - conectadas so por link de navegacao unidirecional (botao "Parceiros externos" em `portal/page.tsx:755-761`; botao "Voltar ao portal" em `parceiros/page.tsx:511-517`). Endpoints distintos: `parceiros/page.tsx:241-244` chama `GET /portal/parceiros` + `listarTodasClinicas()`; `portal/page.tsx:397-398` chama `GET /portal/admin/clinicas/acessos/painel`. Nao ha import cruzado de componentes.

### (c) PortalClinicaWorkspace.tsx (1245 linhas) vs PortalPartnerWorkspace.tsx (954 linhas)

Comparacao direta, linha a linha, dos dois arquivos completos.

**Duplicado quase byte-a-byte** (mesma logica/estrutura, cosmetica trocada):
- `ClinicExamFiltersState` (Clinica 65-76) vs `PartnerExamFiltersState` (Partner 52-63) - mesmos 8 campos + sort.
- `INITIAL_FILTERS` - identico (Clinica 78-89 vs Partner 65-76).
- `compactFilters()` - identico (Clinica 158-172 vs Partner 103-117).
- `examDateValue`/`examExecutionDateValue` - identico (Clinica 150-156 vs Partner 119-125).
- `formatFileSize` - identico (Clinica 117-128 vs Partner 127-138).
- `hydrateClinicSession` (Clinica 247-265) vs `hydratePartnerSession` (Partner 189-211) - mesma sequencia.
- `ensureClinicSession` (Clinica 267-276) vs `ensurePartnerSession` (Partner 213-224) - mesmo padrao (diferenca: threshold 30_000ms vs 60_000ms).
- Os 3 formularios de autenticacao (login, verificacao MFA, "esqueci senha") - quase identicos (Clinica 1071-1227 vs Partner 786-936). **Ambos envolvem esse bloco no MESMO par de classes CSS**: `aside className="fc-portal-workspace fc-portal-clinic-workspace ..."` - Clinica linha 1046 e **Partner linha 765**. O nome `fc-portal-clinic-workspace` esta reaproveitado literalmente dentro do componente do PARCEIRO (nao clinica) - **sobra de copy-paste verificada diretamente no texto do arquivo**, nao suspeita.
- Cards de KPI do dashboard autenticado - mesmos 4 indicadores/icones, `dashboardStats` memo quase identico (Clinica 227-245 vs Partner 169-187).
- Formulario de filtros e lista de exames - mesma marcacao/classes (Clinica 955-1036 vs Partner 680-755).
- Divergencia minima no seletor de ordenacao: Clinica oferece 6 opcoes incl. `especie:asc` (904-909); Partner oferece 5, sem `especie:asc` (634-639), apesar do campo de filtro por especie existir nos dois - inconsistencia minima, intencao nao verificada.

**Genuinamente diferente** (nao e so cosmetica):
- `mode` do componente: Clinica aceita `"embedded" | "standalone" | "admin_preview"` com objeto `adminPreview` (tipo, linhas 51-59). Partner aceita so `"embedded" | "standalone"` (43-47), **sem nenhum modo de espelhamento/preview administrativo**. **Diferenca estrutural mais relevante**: o recurso "ver como o parceiro ve" (usado por `/clinicas/portal/espelho`) existe hoje SO para clinica - nao ha `/clinicas/portal/parceiros/espelho` equivalente, confirmado pela ausencia de link desse tipo em `parceiros/page.tsx`.
- Bloco inteiro "Painel operacional da unidade" (realizados hoje/em laudo/aguardando liberacao/liberados hoje + SLA + fila operacional) - Clinica 655-790 (~135 linhas), **sem equivalente algum** em Partner.
- Estilo visual do header diverge de verdade: Clinica usa header sticky (539-579) + card de sessao simples (593-610); Partner usa header nao-sticky (422-450) + hero com gradiente vistoso (linha 453) que nao existe em Clinica.
- Partner mantem `partnerName`/`partnerTypeLabel` (161-162) para rotular o tipo do parceiro; Clinica nao tem conceito equivalente.
- Logout: em Clinica vira "Voltar a gestao" quando `isAdminPreview` (559-576); em Partner e sempre logout de verdade (440-448).
- Link "Recebeu um convite? Revisar orientacoes de acesso" existe no login de Clinica (1181-1187) mas **nao** no de Partner (888-895 so tem texto, sem link), embora exista landing publica equivalente (`veterinario-parceiro/page.tsx`).

Achado adicional (contexto de uso): `PortalPartnerPageShell.tsx` (251) duplica estruturalmente `PortalClinicaPageShell.tsx` (273) quase inteiro - mesmo `hydrate()`, mesmo `LoadingState()`, mesmo padrao de `PublicLanding()`, so trocando copy e o workspace renderizado. A duplicacao clinica-vs-parceiro se repete um nivel acima (nos Shells que envolvem os Workspaces).

**Conclusao objetiva**: ha bastante logica genuinamente identica (filtros, sessao, formularios de auth, KPIs, lista/cartao de exame) e uma parte estrutural real e distinta (preview admin so em Clinica; painel operacional so em Clinica; rotulo de tipo so em Partner). Os dois arquivos sao bons candidatos a compartilhar uma base comum, mas "painel operacional" e "admin_preview" nao sao triviais de generalizar - sao os dois blocos que realmente diferem por publico; o resto e replicado sem diferenca de fundo.

### (d) frontend/app/clinicas/[id]/page.tsx (1092) vs frontend/app/clinicas/novo/page.tsx (953)

Confirmado por leitura completa: os dois sao formularios de cadastro/edicao puros - 3 secoes (Informacoes Basicas, Tabela de Precos, Precos negociados por servico) + resumo + acoes. **Nenhum dos dois mistura dado de agenda, financeiro ou laudo.**

Duplicacao confirmada (nao suspeita), praticamente identica em logica e JSX:
- Constantes `ESTADOS`/`TABELAS_PRECO` - identicas ([id] 24-35 vs novo 20-31).
- `assinaturaGeocode`, `limparGeocodeCache`, `abrirMapaConfirmacao`, `aplicarPinManual`, `consultarCep`, `geocodificarEndereco`, `geocodificarNoBlur` - todas identicas entre os dois arquivos (ver linhas especificas no relatorio-fonte; blocos de 10-60 linhas cada, replicados 1:1).
- `sugerirTabelaPreco` - quase identica ([id] 319-341 vs novo 256-278); unica diferenca real: `[id]:334` so forca tabela 3 se `tabela_preco_id === 1`, `novo:271` forca sempre que a cidade nao e reconhecida (faz sentido: em edicao o usuario pode ja ter escolhido outra tabela de proposito).
- JSX de "Informacoes Basicas" - identico ([id] 510-810 vs novo 428-717; unica diferenca: card extra "ID da clinica" em [id] 517-525).
- JSX de "Tabela de Precos" - identico ([id] 813-931 vs novo 720-838).
- JSX de "Precos negociados por servico" - identico ([id] 934-997 vs novo 841-904; fonte dos dados diverge, ver abaixo).
- Aside "Resumo da Configuracao" e botoes de acao - identicos ([id] 1007-1021/1024-1041 vs novo 906-921/923-941).

Diferencas reais:
- `[id]` tem `carregarClinica()` (272-317) e botao+modal de exclusao (497-505, 1053-1088); `novo` nao tem nenhum dos dois.
- `[id]` embute `ClinicaPortalAccessCard` (999-1004); `novo` **nao** importa `ClinicaPortalAccessCard` em lugar nenhum (so `ManualPinModal` e `WhatsappNumbersField`, 16-17).
- Fonte dos precos negociados diverge por necessidade: `[id]:343-368` busca `GET /clinicas/${clinicaId}/precos-servicos` ja mesclado pelo backend; `novo` busca `GET /servicos?limit=1000` (294) e calcula preco base no cliente via `extrairPrecoBasePorTabela` (280-289, sem equivalente em [id]).
- `handleSalvar`: `[id]` faz `PUT /clinicas/${id}` + `PUT /clinicas/${id}/precos-servicos` (425-426); `novo` faz `POST /clinicas` e so entao `PUT /clinicas/${novoId}/precos-servicos` (365-376).

**Conclusao**: a fatia de codigo identica entre os dois arquivos cobre a maior parte das ~950-1090 linhas de cada um - duplicacao grande e verificada, nao suspeita.

### (e) Permissoes/roles + pontos de atencao

**Gates de permissao/role dentro dos 7 arquivos pedidos**: nenhum. Busca por `role|permiss|isAdmin|hasRole|recepcao|secretaria` so retornou usos de `isAdminPreview` (`PortalClinicaWorkspace.tsx:180,207,224,288,317,327,339,342,360,363,453,475,509,528,543,559,594,596`) - uma flag de **modo** vinda de prop, nao checagem de papel/permissao de usuario. Nenhum dos 7 arquivos le `user.papeis` ou similar.

**Unico mecanismo de gate no frontend proximo a esta fatia**: `layout-dashboard.tsx`. `MenuItem.adminOnly?` (linha 56), aplicado no filtro (linha 489); `userIsAdmin` (345-353). Dos itens do menu, so `/assistente-ia` tem `adminOnly: true` (linha 64). **O item `/clinicas/portal` (linha 75) nao tem `adminOnly`** - qualquer usuario interno autenticado, independente de papel, ve e navega ate `/clinicas/portal` e, por extensao dos links internos, ate `/clinicas/portal/parceiros` e `/clinicas/portal/espelho` (nenhuma tem entrada propria no menu). `/clinicas`, `/clinicas/[id]` e `/clinicas/novo` (grupo "Clinica") tambem sem `adminOnly`.

`getPortalAdminAuthHeaders()` (`frontend/lib/portal-clinic-admin.ts:3-10`), usado por `portal/page.tsx`, `parceiros/page.tsx` e `ClinicaPortalAccessCard.tsx`, so le o `token` puro do `localStorage` - mesmo token de qualquer usuario logado, sem checagem de papel. O nome ("admin") e convencao, nao gate.

**O gate real esta no backend** (fora dos 7 arquivos, citado para fechar a pergunta com precisao): `backend/app/api/v1/endpoints/portal_clinic_auth.py:119-125` define `PORTAL_INVITE_OPERATOR_ROLES = ("admin", "secretaria", "secretária", "recepcao", "recepção")`, via `_require_portal_invite_operator` (132-136), contra `_require_portal_admin` (128, so admin). Endpoints e gate real:
- `GET /admin/clinicas/{id}/acesso` (`ClinicaPortalAccessCard.tsx:117`) - invite-operator (645).
- `GET /admin/clinicas/acessos/painel` (`portal/page.tsx:397-398`, `espelho/page.tsx:53-54`) - invite-operator (751).
- `POST /admin/clinicas/{id}/convites` (`portal/page.tsx:456-457/539-540`, `ClinicaPortalAccessCard.tsx:137-138`) - invite-operator (913).
- `GET /admin/clinicas/{id}/espelho` (listagem real do modo espelho) - **so admin** (702).
- `POST /admin/clinicas/{id}/exames/{exame}/download-url` (download no espelho) - **so admin** (735).
- Revogar convite/conta/sessoes (`portal/page.tsx:664,690,723`, `ClinicaPortalAccessCard.tsx:199,218,240`) - **so admin** (1043, 1091, 1132).
- `GET/POST/PATCH /portal/parceiros` (`parceiros/page.tsx`) - **so admin** (`backend/.../portal_partners.py:305,409,427`, via `_require_portal_admin` = `require_papel("admin")`, linha 26).
- `GET /parceiros/veterinarios/opcoes` + um `POST` de criacao "no fluxo" (350, 392 do mesmo arquivo) liberados para qualquer usuario autenticado (`_require_portal_operational_user`, linha 30) - caminho mais permissivo, fora do escopo dos 7 arquivos mapeados aqui.

**Consequencia pratica** (verificada por leitura de codigo, nao testada em runtime): qualquer usuario interno nao-admin/nao-recepcao/nao-secretaria que navegue ate `/clinicas/portal` ve a tela inteira normalmente (nenhum botao escondido por papel), mas ao clicar em revogar convite/conta/sessoes, abrir o espelho de uma clinica, ou usar a tela de parceiros, deve receber 403 do backend - **o frontend nao antecipa isso em nenhum dos 7 arquivos.**

**Duplicacoes/possivel codigo morto - verificadas por leitura direta**:
- `ClinicaPortalAccessCard.tsx` (embutido em `[id]/page.tsx:999-1004`) **reimplementa, de forma independente, o mesmo conjunto de acoes de `portal/page.tsx` contra os mesmos endpoints**: gerar convite (`:137-138` vs `:456-457`), revogar convite (`:199` vs `:664`), revogar conta (`:218` vs `:723`), revogar sessoes (`:240` vs `:690`), cada uma com seu proprio `buildClinicInviteMessage`, estado de loading e mensagens de erro escritos duas vezes.
- `PortalClinicaPageShell.tsx` vs `PortalPartnerPageShell.tsx` - duplicacao estrutural quase total, ja detalhada em (c).
- `[id]/page.tsx` vs `novo/page.tsx` - duplicacao extensa, detalhada em (d).
- Import nao utilizado: `Users` em `PortalClinicaWorkspace.tsx:24` - so aparece na linha do import, confirmado por contagem exata.
- Classe CSS residual `fc-portal-clinic-workspace` usada dentro de `PortalPartnerWorkspace.tsx:765` - herdada por copy-paste.
- Dentro de `portal/page.tsx`: os dois controles de filtro sobrepostos (chips 1342-1364 vs sidebar 1086-1201 controlando o mesmo `quickView`; checkbox `firstDownloadOnly` 1331-1339 sobreposto ao quickView `first_download_completed` 1179-1193) - confirmados por leitura do estado/logica de `filteredItems`, nao suspeita.

**Suspeitas nao verificadas**:
- O real papel funcional de um `PortalPartnerProfile` tipo `"clinica"` cadastrado em `parceiros/page.tsx` - nao seguido a fundo (`PortalPartnerReleaseTarget`, rotas de laudos).
- Se a ausencia de `especie:asc` no seletor de ordenacao de `PortalPartnerWorkspace.tsx` e intencional ou esquecimento.
- Se a divergencia de `carregarPrecosServicos` entre `[id]` e `novo` produz diferenca real de valores em algum cenario de borda (nao testado em runtime).

---

## 4. Sintese cross-modulo

Padroes que se repetem nas 3 fatias mapeadas, e que devem orientar a priorizacao de `spec.md`:

1. **"Arquivo unico com N responsabilidades" e o padrao dominante, nao a excecao.** `financeiro/page.tsx` (6 responsabilidades, 3339 linhas), `clinicas/portal/page.tsx` (16 responsabilidades, 1626 linhas) e `NovoAgendamentoModal.tsx` (CRUD + 2 sub-formularios + credito + WhatsApp + assistente de horario, 4545 linhas — o maior arquivo de toda a auditoria) sao os 3 piores casos, mas o padrao aparece tambem em `PortalClinicaWorkspace`/`PortalPartnerWorkspace` e nos formularios de clinica. Isso confirma a leitura original do `intent.md`: o problema de "integridade de codigo" nao e um arquivo isolado, e sistemico.
2. **Pares quase-gemeos nao compartilham base, e cada par ja divergiu de forma sutil e ja verificada** (nao so suspeita): `agenda/page.tsx` vs `agenda/fullcalendar/page.tsx` (>15 funcoes/interfaces duplicadas, 1 divergencia real de comportamento no filtro de OS canceladas), `clinicas/[id]/page.tsx` vs `clinicas/novo/page.tsx` (helpers e JSX quase 100% duplicados), `PortalClinicaWorkspace.tsx` vs `PortalPartnerWorkspace.tsx` (filtros/sessao/auth/KPIs duplicados, com uma classe CSS `fc-portal-clinic-workspace` sobrando dentro do arquivo errado), `PortalClinicaPageShell.tsx` vs `PortalPartnerPageShell.tsx` (mesma duplicacao um nivel acima). Em todos os 4 pares, ha nucleo genuinamente compartilhavel + 1-2 blocos genuinamente especificos (ex.: drag-and-drop de recorrencia so no calendario; painel operacional so no workspace da clinica) - o que sugere que a extracao de uma base comum e viavel tecnicamente em todos os 4 casos, nao so teorica.
3. **Redundancia de "relatorio" nao e um caso isolado do financeiro** - o mesmo padrao (uma tela nova e mais completa nasce ao lado da antiga, sem substitui-la nem remove-la) aparece em financeiro (3 telas), em agenda (2 rotas completas + a 3a implementacao de lista embutida no proprio FullCalendar) e distribuido pelos "6 atalhos" avulsos de `financeiro/page.tsx` (2 dos quais - `/financeiro/dashboard` e `/financeiro/contas` - **sao links quebrados para rotas que nao existem**, achado novo desta fase).
4. **O controle de permissao no frontend e quase inexistente fora do menu** - de 19 itens de menu, so 1 e `adminOnly`. Isso significa que boa parte do que parece "acesso restrito" (revogar portal, gerenciar parceiros, ver DRE) na verdade so e barrado no backend (403 silencioso na hora do clique). Isso e relevante para qualquer redesenho de IA: nao basta reorganizar onde as coisas ficam, e preciso decidir se o frontend passa a esconder/desabilitar acoes que o usuario logado nao pode mesmo executar - hoje ele so descobre isso ao tentar.
5. **Achado com timing direto sobre o trabalho ja em andamento na branch atual** (catalogo de racas em agenda): o catalogo (`frontend/lib/racas.ts`) esta implementado e em uso em `ClienteInfoModal.tsx`, mas o sub-formulario de "novo animal" dentro de `NovoAgendamentoModal.tsx` ainda usa um `<input type="text">` livre para raca, sem o catalogo. E uma inconsistencia pequena, isolada e imediatamente acionavel - nao depende de nenhuma decisao do redesenho maior deste intent.

Nenhum destes pontos foi corrigido nesta fase (Fase 0 e so leitura). Servem de insumo direto para as perguntas abertas e riscos do `intent.md` e para a priorizacao de `spec.md`.
