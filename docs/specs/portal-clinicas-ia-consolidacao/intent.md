# Intent - portal-clinicas-ia-consolidacao

Data: 2026-08-14
Responsavel: Martiniano Barros
Status: in-progress

> **Nota de escopo (2026-08-14):** o pedido original do usuario ("portal de clinicas poluido, financeiro/agenda/laudos misturado") mirava especificamente a tela que a clinica parceira usa de verdade (`PortalClinicaWorkspace`), confirmado apos revisao de print da tela real. Isso agora e tratado por um intent proprio, mais enxuto: [`docs/specs/portal-clinica-parceira-redesign/intent.md`](../portal-clinica-parceira-redesign/intent.md). Este intent aqui continua valido para a bagunca de IA do app **interno** da Fortcordis (menu, dashboard, financeiro/relatorios/fiscal, cockpit administrativo de portal) - um problema real e separado, confirmado pelo Fase 0, mas que sera atacado depois.

## 1) Problema atual

O uso diario do sistema tem visual poluido, informacao redundante e limites confusos entre agenda, financeiro e laudos - nao dentro de uma unica tela, mas espalhados pela arquitetura de navegacao e por componentes que cresceram demais:

- **Menu principal fragmenta o fluxo de uma clinica em 3 grupos distintos** (`frontend/app/layout-dashboard.tsx:59-96`): "Comando" (Dashboard, Agenda, Calendario, Atendimento), "Clinica" (Pacientes, Clinicas, Portal Clinicas, Servicos, Laudos), "Gestao" (Financeiro, Custos Frota, Exportacao Fiscal, Relatorios). Resolver uma pendencia de uma clinica especifica (agenda dela, laudo pendente, cobranca em aberto) exige transitar por 3 secoes do menu.
- **Agenda e Calendario sao duas entradas de menu separadas** para o mesmo dominio (`/agenda` e `/agenda/fullcalendar`), sem ficar claro quando usar uma ou outra.
- **Relatorios financeiros existem em pelo menos 3 lugares diferentes**: `frontend/app/relatorios/page.tsx` (visao geral com uma `RelatoriosFinanceiroView` propria), `frontend/app/financeiro/relatorios/page.tsx` (pagina propria, hoje fora do menu principal) e as abas internas de `frontend/app/financeiro/page.tsx` (`transacoes`/`cobrancas`/`ordens`, estado `abaAtiva` em `financeiro/page.tsx:366`). Nao fica claro qual e a fonte de verdade.
- **"Portal Clinicas" (`/clinicas/portal`, `frontend/app/clinicas/portal/page.tsx`, 1626 linhas) concentra convites, cadastro, downloads de laudos e auditoria de acesso em um unico arquivo/tela** - muitas responsabilidades diferentes competindo pelo mesmo espaco visual.
- **Varios componentes ja passaram de 1000 linhas**, sinal de integridade de codigo fragil (dificil revisar, testar e alterar com seguranca):
  - `frontend/app/financeiro/page.tsx` - 3339 linhas
  - `frontend/app/clinicas/portal/page.tsx` - 1626 linhas
  - `frontend/components/portal/PortalClinicaWorkspace.tsx` - 1245 linhas
  - `frontend/app/clinicas/portal/parceiros/page.tsx` - 1214 linhas
  - `frontend/app/clinicas/[id]/page.tsx` - 1092 linhas
  - `frontend/components/portal/PortalPartnerWorkspace.tsx` - 954 linhas
  - `frontend/app/clinicas/novo/page.tsx` - 953 linhas
- **O portal externo da clinica parceira (`PortalClinicaWorkspace`, usado em `/clinica-parceira` e espelhado internamente em `/clinicas/portal/espelho` para suporte)** hoje mostra somente exames/laudos liberados - nao ha financeiro nem agenda ainda. Se esses dados forem adicionados sem um plano de IA (o que esta sendo pedido agora), o risco e repetir no portal externo a mesma poluicao que ja incomoda no app interno.

## 2) Objetivo

Reorganizar a arquitetura de informacao e refatorar os componentes correspondentes para que:
- cada tipo de informacao (agenda, financeiro, laudos, acesso ao portal) tenha uma unica localizacao canonica, sem duplicidade;
- telas e componentes grandes sejam quebrados em unidades menores e coesas, mais faceis de revisar e testar;
- a experiencia de quem usa o sistema todo dia (equipe Fortcordis) e de quem acessa o portal externo (clinica parceira, veterinario parceiro, tutor) fique mais limpa e rapida para as tarefas do dia a dia;
- surjam candidatos concretos de novos recursos de produtividade, tanto para a operacao interna da Fortcordis quanto para quem usa o portal do lado da clinica.

## 3) Nao objetivos

- Nao redesenhar o layout interno do `PortalClinicaWorkspace`/`PortalPartnerWorkspace` (os 8 cards de KPI empilhados, as 2 listas de exame) - isso e tratado por `portal-clinica-parceira-redesign`, criado em 2026-08-14 apos confirmar que era o alvo real do pedido original. Este intent so cuida de decidir SE/QUANDO esse portal externo passa a mostrar financeiro/agenda (pergunta aberta 7.4), nao de como ele apresenta o que ja mostra hoje.
- Nao mexer na logica clinica interna do Atendimento - ja esta em auditoria separada (`docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`, skill `auditoria-atendimento-fases-2-4`). O achado sobre race condition entre "Salvar" manual e autosave (sem lock de versao no endpoint de atualizacao) e citado aqui so como referencia cruzada de divida tecnica - o estado atual deve ser conferido direto na auditoria, nao resolvido dentro deste escopo.
- Nao reintroduzir ditado por voz nas notas clinicas do atendimento como "recurso de produtividade" - ja foi pedido e descartado (fica estranho narrar em voz alta com o tutor na sala).
- Nao duplicar iniciativas ja em andamento - este intent deve **coordenar**, nao competir, com: `frontend-dashboard-premium-visual-refresh`, `frontend-dashboard-shell-lazy-load`, `arch-fe-01-modularizar-atendimento-for39`, `arch-fe-02-padronizar-cliente-api-erros-for40`, `clinical-scope-ui-priority`, `atendimento-header-acoes-layout`, `frontend-performance-agenda-atendimento`.
- Nao alterar regras de negocio de precificacao, calculo fiscal ou financeiro - apenas onde e como essa informacao e apresentada/organizada.
- Nao remover uma funcionalidade hoje em uso sem antes mapear para onde ela migra.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - Stack atual: Next.js (App Router), Tailwind, `lucide-react`, `axios` (`frontend/lib/axios.ts`). Manter.
  - Qualquer mudanca de menu (`layout-dashboard.tsx`) precisa preservar os gates de permissao existentes (ex.: itens `adminOnly`, e o historico de acesso `recepcao`/`secretaria` documentado em `docs/specs/portal-access-ui/intent.md`).
  - Guardrail CI obrigatorio (`docs/specs/README.md`): qualquer mudanca em `backend/`, `frontend/` ou `scripts/` exige, no mesmo diff, `spec.md` e `verify.md` atualizados, e a feature precisa ter os 4 arquivos (`intent.md`, `spec.md`, `plan.md`, `verify.md`).
- Restricoes de prazo:
  - Esforco grande - iniciar por uma fase 0 de auditoria/mapeamento (sem mudar codigo) antes de qualquer refatoracao, seguindo o mesmo padrao ja usado em `auditoria-atendimento-fases-2-4`. Resultado da fase 0: `docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md`.
- Restricoes regulatorio/operacional:
  - Qualquer novo dado exposto no portal externo (financeiro/agenda) deve manter o escopo minimo por unidade autenticada e a postura de LGPD ja definida em `docs/specs/portal-access-ui/intent.md` e `docs/specs/portal-secure-access-foundation/`.

## 5) Impacto esperado

- Usuarios impactados: equipe interna Fortcordis (veterinarios, secretaria/recepcao, admin), clinicas parceiras, veterinarios parceiros, tutores (`area-pacientes`).
- Modulos impactados: `frontend/app/layout-dashboard.tsx`, `frontend/app/dashboard`, `frontend/app/financeiro` (+ `relatorios`, `frota`), `frontend/app/relatorios`, `frontend/app/clinicas` (+ `portal`, `portal/espelho`, `portal/parceiros`, `[id]`, `novo`), `frontend/app/laudos`, `frontend/app/agenda` (+ `fullcalendar`), `frontend/components/portal/*`.
- Risco de regressao: medio-alto - muitos pontos de entrada e papeis de acesso diferentes. Cada fase precisa de `verify.md` proprio e teste manual por papel (admin, recepcao/secretaria, clinica parceira) antes de mesclar ou remover qualquer entrada de menu.

## 6) Riscos iniciais

- Risco 1: fundir ou renomear itens de menu quebra o habito de navegacao de quem usa o sistema todos os dias.
- Risco 2: consolidar as 3 telas de relatorios financeiros em uma so perder um filtro/visao que alguem depende hoje sem perceber.
- Risco 3: quebrar componentes grandes (>1000 linhas) em pedacos menores sem cobertura de teste pode introduzir regressao silenciosa - priorizar extracao incremental com verificacao a cada fase.
- Risco 4: ampliar o portal externo (`PortalClinicaWorkspace`) com financeiro/agenda pode reabrir a discussao de escopo minimo de dados que `portal-access-ui` ja tinha fechado como "nao objetivo" - validar deliberadamente antes de implementar.
- Risco 5 (confirmado na Fase 0): o frontend quase nao esconde acao por papel - de 19 itens de menu so 1 e `adminOnly`, e nenhum dos 7 arquivos do dominio Clinicas/Portal checa `user.papeis`. Varias acoes (revogar convite/conta/sessoes, `/clinicas/portal/parceiros`, espelho de clinica) so sao barradas no backend (403 no clique). Qualquer redesenho de IA precisa decidir se passa a esconder/desabilitar essas acoes no frontend, senao herda o mesmo problema na tela nova.
- Risco 6 (confirmado na Fase 0): ja existem 2 links quebrados em producao (`financeiro/page.tsx:2812` -> `/financeiro/dashboard` e `financeiro/page.tsx:2824` -> `/financeiro/contas`, nenhuma das duas rotas existe). Corrigir isso e independente do redesenho maior e pode ser feito antes, sem esperar o `spec.md`.

## 7) Perguntas abertas

- Agenda e Calendario devem virar uma unica entrada de menu com alternancia de visao, ou atendem fluxos realmente diferentes? Fase 0 achou uso real e diferenciado nos dois (reserva/financeiro admin so na lista; drag-drop com recorrencia so no calendario) - a decisao nao e trivial, ver `docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md#1-menu-dashboard-e-agenda-vs-calendario`.
- Qual das 3 telas de relatorio financeiro deve virar a fonte de verdade? Fase 0 aponta `relatorios/page.tsx` (dominios visao-geral + financeiro) como candidata forte - e a unica com DRE, fluxo de caixa e contas a receber/pagar, e ja e um superset funcional das outras 2. `financeiro/relatorios/page.tsx` parece a versao mais antiga do mesmo conceito. Decisao final e criterio de migracao ficam para `spec.md`.
- O item de menu "Portal Clinicas" deveria ser renomeado para nao se confundir com o portal que a propria clinica acessa externamente (mesmo nome, publicos diferentes)?
- Ate onde o portal externo da clinica deve mesmo incorporar agenda/financeiro, dado que isso foi explicitamente marcado como fora de escopo na iteracao anterior do portal (`portal-access-ui`)?
- Nova pergunta (Fase 0): `clinicas/portal/parceiros` cadastra parceiros tipo "clinica" mas recusa gerar convite para esse tipo (so "veterinario") - o que exatamente esse registro tipo "clinica" alimenta hoje? Precisa de confirmacao antes de decidir se essa tela fica ou e absorvida pelo cockpit principal.
- Nova pergunta (Fase 0): o frontend deve passar a esconder/desabilitar acoes que o papel do usuario logado nao pode executar (hoje so o backend barra com 403), ou isso fica para uma iniciativa separada de permissoes?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

**Produtividade interna (Fortcordis)**
- "Clinica 360": uma unica tela por clinica reunindo proxima agenda, laudos pendentes, financeiro em aberto e status de acesso ao portal - hoje isso exige abrir 4 telas separadas.
- **Confirmado pelo usuario (2026-08-14)**: uma visao agrupada, so de uso interno, dos exames pendentes de emissao de laudo ("aguardando liberacao" visto do lado de quem laude, nao do lado da clinica) - pedido explicitamente como "um campo pra mim". Pode virar o nucleo de uma fila maior de pendencias do dia (cross-modulo): exames aguardando laudo + agendamentos a confirmar + cobrancas vencidas + convites de portal parados em "aguardando e-mail" - mas o pedido concreto e especificamente a fila de laudos pendentes, essa e a prioridade.
- Linha do tempo por caso: agendamento -> atendimento -> laudo liberado -> cobranca gerada, como um pipeline visual unico (o dado ja existe espalhado; so nao esta conectado na tela).
- Reaproveitar o componente de auditoria estruturada "antes/depois" que acabou de ser feito em Configuracoes (`configuracoes-auditoria-detalhes-estruturados`) para os eventos do Portal Clinicas (convites, revogacoes, downloads), que hoje tem sua propria timeline separada.

**Produtividade da clinica parceira (portal externo)**
- Extensao deliberada do `PortalClinicaWorkspace` com uma aba de agenda da propria unidade e um indicador financeiro simplificado ("em dia" / "pendencia"), sem detalhe contabil sensivel - desenhada com abas separadas desde o inicio, para nao repetir a poluicao do app interno.
- Notificacao proativa (WhatsApp/e-mail, reaproveitando a integracao ja existente) quando um laudo novo e liberado, em vez de a clinica precisar checar o portal manualmente.
- Exportacao self-service (PDF/CSV) do historico de exames liberados por periodo.

## 10) Fase 0 - Auditoria/mapeamento

- Status: **concluida** em 2026-08-14 (3/3 agentes).
- Objetivo desta fase: mapear com precisao (arquivo:linha) o estado atual de cada area citada no problema, sem propor solucao ainda - mesmo espirito de `docs/AUDITORIA-ATENDIMENTO-MAPA-FASE1.md`.
- Entregavel: [`docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md`](../../AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md).
- Escopo do mapeamento (todo confirmado por leitura completa dos arquivos, nao so grep):
  1. Agenda + Dashboard + navegacao principal.
  2. Financeiro + Relatorios + Fiscal - confirmada a triplicacao de relatorios financeiros; `relatorios/page.tsx` e superset das outras 2; achados novos: 2 links quebrados em `financeiro/page.tsx` (`/financeiro/dashboard`, `/financeiro/contas`) e `/fiscal`, `/fiscal/exportar`, `/fiscal/nova` renderizam conteudo identico.
  3. Clinicas + Portal (admin e externo) + Laudos - `clinicas/portal/page.tsx` concentra 16 responsabilidades; confirmada duplicacao pesada entre `PortalClinicaWorkspace`/`PortalPartnerWorkspace`, entre `PortalClinicaPageShell`/`PortalPartnerPageShell`, entre `clinicas/[id]`/`clinicas/novo`, e dentro do proprio `ClinicaPortalAccessCard` (reimplementa acoes que ja existem em `portal/page.tsx`); confirmado que nenhum dos 7 arquivos checa papel do usuario no frontend (gate e so backend).
  4. Achado lateral relevante para o trabalho em curso: `NovoAgendamentoModal.tsx` (sub-formulario de novo animal) ainda nao usa o catalogo de racas (`frontend/lib/racas.ts`) que `ClienteInfoModal.tsx` ja usa - inconsistencia pequena e imediatamente acionavel, independente deste intent.
- Proximo passo: usar a secao 4 ("Sintese cross-modulo") do documento de auditoria para fechar as perguntas abertas (secao 7) e avancar para `spec.md`.
