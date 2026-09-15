# Intent - portal-clinica-parceira-redesign

Data: 2026-08-14
Responsavel: Martiniano Barros
Status: in-progress

## 1) Problema atual

Escopo corrigido em relacao ao intent irmao `portal-clinicas-ia-consolidacao`: "portal de clinicas" no pedido original do usuario se refere especificamente a tela que a **clinica parceira usa de verdade** - `frontend/components/portal/PortalClinicaWorkspace.tsx` (1245 linhas), renderizada em `/clinica-parceira` (real) e espelhada para a equipe interna em `/clinicas/portal/espelho` (suporte, prop `mode="admin_preview"`) - e nao o app interno da Fortcordis.

Confirmado por leitura linha a linha (`PortalClinicaWorkspace.tsx:538-940`; mapeamento completo em `docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md#3-clinicas-portal-admin-e-externo-e-laudos`) e por print da tela real (espelho da clinica "Pet Sus") que essa tela hoje **nao mistura financeiro/agenda** - e 100% laudos/exames. A poluicao e redundancia relatadas estao na propria estrutura da tela, empilhada assim:

1. Header fixo com nome da clinica (538-579).
2. Hero "Portal da unidade" + card de sessao/preview (582-611).
3. 4 cards de KPI - Exames encontrados / Pets no resultado / Arquivos disponiveis / Mais recente (613-653).
4. "Painel operacional da unidade" - mais 4 cards (Realizados hoje / Em laudo / Aguardando liberacao / Liberados hoje) + texto de SLA + uma **lista de "exames recentes" sem filtro** (655-790).
5. Busca + filtros (817-926).
6. Uma **segunda lista** de exames liberados, agora com filtro completo (927+).

Ou seja: **8 cards de contagem empilhados em 2 fileiras + 2 listas de exame diferentes** na mesma tela, antes/ao redor do que de fato importa pro usuario (ver o exame liberado). So o banner mais externo "Conferencia do Portal" (com seletor de clinica) e exclusivo da ferramenta interna de espelho - o resto (header, hero, KPIs, painel operacional, as 2 listas) e **identico ao que a clinica parceira real ve**.

Esse mesmo componente e ~70% duplicado com `frontend/components/portal/PortalPartnerWorkspace.tsx` (954 linhas, usado pelo veterinario parceiro individual em `/veterinario-parceiro`) - filtros, sessao, formularios de autenticacao e KPIs sao quase identicos entre os dois; so o "Painel operacional" e o modo `admin_preview` sao exclusivos do lado clinica. Ver comparacao completa em `docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md` secao 3(c).

**Confirmado com o usuario (2026-08-14):** das 4 metricas do painel operacional, so "Aguardando liberacao" interessa de fato pra clinica - e o exame ja realizado, esperando o laudo sair. O uso real da tela e simples: abrir o portal e checar rapido se o laudo que ela esta esperando ja saiu; se estiver procurando algo mais antigo, ai sim usa os filtros da lista completa. Ou seja, a fila operacional e a lista completa **nao sao redundantes** - servem necessidades diferentes (checagem rapida de pendencia vs. busca de historico) - mas a tela de hoje nao deixa essa diferenca clara e ainda expõe 3 metricas (Realizados hoje / Em laudo / Liberados hoje) que nao correspondem a nenhuma pergunta real da clinica, so ruido visual.

## 2) Objetivo

- Focar a tela em responder rapido a pergunta real da clinica - "o laudo que eu quero ja saiu?" - com "Aguardando liberacao" em destaque, em vez de 4 metricas operacionais de peso visual igual.
- Manter a lista completa com filtro como esta hoje pra busca de historico (nao e o ponto de dor relatado) - simplificar so o topo da tela (os 2 conjuntos de KPI + painel operacional).
- Consolidar os 2 conjuntos de 4 KPIs (dashboard + painel operacional) num bloco coerente, sem perder nenhuma contagem que a clinica de fato usa.
- Aproveitar a chance para extrair a base compartilhada com `PortalPartnerWorkspace` (filtros, sessao, auth, KPIs) onde fizer sentido, sem forcar unificacao do que e genuinamente diferente (painel operacional, modo admin_preview).

## 3) Nao objetivos

- Nao adicionar financeiro ou agenda a esta tela agora - e uma decisao separada e maior, tratada em `docs/specs/portal-clinicas-ia-consolidacao/intent.md` (pergunta aberta la, nao resolvida aqui).
- Nao mexer no app interno da Fortcordis (menu, dashboard, financeiro, relatorios) - fica para depois, coberto por `portal-clinicas-ia-consolidacao`.
- Nao alterar as regras de liberacao de laudo no portal (`core/portal_release.py`, backend) - so a apresentacao no frontend.
- Nao unificar `PortalClinicaWorkspace` e `PortalPartnerWorkspace` num componente so de forma forcada - so extrair o que for genuinamente compartilhavel; painel operacional e admin_preview continuam exclusivos da clinica ate haver pedido explicito de estende-los ao parceiro individual.
- Nao mudar o fluxo de autenticacao/sessao curta do portal - escopo de `portal-secure-access-foundation`/`portal-access-ui`.
- Nao construir a fila agrupada de "exames pendentes de emissao de laudo" para uso interno da Fortcordis - ideia do proprio usuario, mas explicitamente fora deste portal ("isso e coisa fora desse portal"). Ja registrada como sugestao em `docs/specs/portal-clinicas-ia-consolidacao/intent.md` secao 9.

## 4) Contexto e restricoes

- Restricoes tecnicas:
  - Mesma stack: Next.js, Tailwind, lucide-react, axios.
  - O componente e renderizado em 2 lugares com props diferentes: `frontend/app/clinica-parceira/page.tsx` (via `PortalClinicaPageShell`, sessao real) e `frontend/app/clinicas/portal/espelho/page.tsx` (`mode="admin_preview"`, suporte interno) - qualquer mudanca de layout precisa funcionar e ser testada nos dois modos.
  - Guardrail CI: mesma exigencia de `spec.md` + `verify.md` atualizados no mesmo diff.
- Restricoes de prazo: escopo pequeno o suficiente pra ser uma fase so (nao precisa do Fase 0 separado - o mapeamento ja existe em `docs/AUDITORIA-PORTAL-CLINICAS-MAPA-FASE0.md`).
- Restricoes regulatorio/operacional: manter o escopo minimo de dados por unidade autenticada (LGPD) - nenhuma mudanca de layout deve expor mais dado do que ja e mostrado hoje.

## 5) Impacto esperado

- Usuarios impactados: clinicas parceiras (usuarias diretas da tela real), equipe Fortcordis que usa `/clinicas/portal/espelho` pra dar suporte.
- Modulos impactados: `frontend/components/portal/PortalClinicaWorkspace.tsx` e, se a extracao de base comum avancar, `PortalPartnerWorkspace.tsx` e os Shells (`PortalClinicaPageShell.tsx`/`PortalPartnerPageShell.tsx`).
- Risco de regressao: baixo-medio - componente usado por clinicas reais e pelo staff; testar visualmente os dois modos (sessao real e admin_preview) antes de publicar, com atencao a responsivo (mobile e comum pra esse publico).

## 6) Riscos iniciais

- Risco 1: reduzir os 2 conjuntos de KPI pra 1 so pode esconder um numero que alguma clinica ja usa no dia a dia, sem avisar.
- Risco 2: se a fila operacional e a lista completa tiverem proposito realmente distinto (pergunta 7.1, ainda nao confirmada), remover uma delas por engano quebra um caso de uso real.
- Risco 3: extrair base comum com `PortalPartnerWorkspace` pode acoplar os dois indevidamente se o "painel operacional" ou o modo `admin_preview` vazar pra dentro do componente do parceiro individual sem necessidade.

## 7) Perguntas abertas

- Da pra mostrar nao so a CONTAGEM de "Aguardando liberacao" mas quais exames especificamente (ex: nome do pet), ja na primeira tela, sem exigir scroll ou clique extra? Parece o proximo nivel natural depois de confirmar que essa e a metrica que realmente importa.
- Vale estender esse redesenho pro `PortalPartnerWorkspace` na mesma leva, ja que ele compartilha quase tudo exceto painel operacional/preview, ou fica so pra clinica por agora e o parceiro individual entra depois?
- O card "Visao espelhada"/"Sessao ativa" (593-610) deveria sumir da visao real da clinica, ou ela usa essa informacao (validade da sessao, "acesso neste computador ate...")?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.

## 9) Sugestoes de novos recursos (para validar e priorizar, nao e compromisso)

- Notificacao proativa (WhatsApp/e-mail) quando um laudo novo e liberado, reaproveitando a integracao ja existente - reduz a dependencia de abrir o portal so pra conferir se saiu algo novo.
- Exportacao self-service (PDF/CSV) do historico de exames liberados por periodo, direto da lista unificada (hoje nao ha exportacao nesta tela).
- Se a pergunta 7.2 for "sim", a base compartilhada com `PortalPartnerWorkspace` reduz retrabalho ao evoluir qualquer um dos dois no futuro (ex.: a inconsistencia ja encontrada no seletor de ordenacao, que tem `especie:asc` num lado e nao no outro, seria resolvida de graca).
