# Intent - portal-clinica-parceira-navegacao-abas

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Problema atual

`frontend/components/portal/PortalClinicaWorkspace.tsx` (1624 linhas,
renderizado em `/clinica-parceira` para a clinica parceira real e
espelhado em `/clinicas/portal/espelho` para suporte administrativo)
empilha verticalmente 6 secoes independentes, cada uma entregue em um
momento diferente (`git log`):

1. Hero + card de sessao (714).
2. "Aguardando liberacao" (745) - destaque adicionado em
   `portal-clinica-parceira-redesign` (commit `c9ea5f89`).
3. "Resumo da unidade" (802) - 7 indicadores, tambem do redesign.
4. "Atividade recente da unidade" (827).
5. "Agendamentos ativos da unidade" (906, so em sessao real -
   `!isAdminPreview`) - `feat(portal): visualizar e cancelar
   agendamentos ativos da clinica` (commit `9bbd3e8e`).
6. "Financeiro da unidade" (1040, so em sessao real) - `feat(portal):
   visao financeira (OS pendentes/pagas) da clinica` (commit
   `941058dd`) + `feat(portal): baixar recibo de OS paga direto do
   portal da clinica` (commit `fb5ab527`).
7. "Filtros de busca" + "Exames liberados" (1179/1306) - lista paginada
   original, anterior a todo o resto.

Nenhuma dessas entregas foi feita pensando na composicao final: cada
uma so adicionou mais uma secao ao final da pilha. Confirmado com login
real de clinica parceira em 2026-08-16 (Clinica #8, apos o fix de
`portal-clinica-exame-created-at-fix`): para baixar um laudo ja
liberado e preciso rolar a pagina inteira (hero -> aguardando liberacao
-> resumo -> atividade recente -> agendamentos -> financeiro -> so
entao filtros + lista de laudos). No mobile o problema piora - a
largura estreita faz cada secao ocupar ainda mais altura, entao a
mesma jornada exige mais rolagem, nao menos.

## 2) Objetivo

Reorganizar as 6 secoes em abas (Visao geral / Laudos / Agenda /
Financeiro), sem remover nenhuma funcionalidade existente, para que a
tarefa mais comum da clinica (achar um laudo liberado) nao dependa de
rolar por secoes de outros assuntos.

## 3) Nao objetivos

- Nao mudar nenhuma regra de negocio, endpoint ou dado exposto - e
  reorganizacao de apresentacao, os mesmos componentes internos de
  cada secao sao reaproveitados.
- Nao mexer em `PortalPartnerWorkspace.tsx` (veterinario parceiro
  individual) - esse componente nao tem agenda/financeiro/agendamentos,
  o problema de empilhamento la e menor (ver
  `portal-clinica-parceira-redesign/intent.md` secao 1).
- Nao remover nem alterar o modo `admin_preview` (`/clinicas/portal/espelho`)
  - continua sem as abas "Agenda"/"Financeiro" (`!isAdminPreview` ja
  esconde essas secoes hoje).
- Nao e o escopo do app interno da Fortcordis (menu, dashboard,
  financeiro/relatorios) - isso continua em
  `docs/specs/portal-clinicas-ia-consolidacao/` (adiado). A ideia de
  abas pra agenda/financeiro no portal externo ja estava antecipada la
  (secao 9, "Extensao deliberada do PortalClinicaWorkspace... desenhada
  com abas separadas desde o inicio") - este intent so formaliza e
  executa essa parte especifica, que ja tem dado real justificando.
- Nao introduzir um componente `<Tabs>` compartilhado/generico - o app
  ja tem o padrao de aba resolvido ad-hoc em varias telas (ex.:
  `frontend/app/atendimento/page.tsx`); seguir o mesmo padrao local,
  sem criar abstracao nova.

## 4) Contexto e restricoes

- Stack: Next.js (App Router), Tailwind, `lucide-react`. Mesmo arquivo,
  sem nova rota - abas sao estado do componente, nao navegacao.
- "Aguardando liberacao" precisa continuar em destaque visual - era o
  ponto central do redesign anterior (checagem rapida de "o laudo que
  eu quero ja saiu?"). Vai para a aba "Visao geral" (default ao abrir),
  nao pode ficar escondida atras de um clique extra.
- Guardrail de SDD: mudanca de codigo em `frontend/` exige `spec.md` +
  `verify.md` atualizados no mesmo diff.

## 5) Impacto esperado

- Usuarios impactados: clinica parceira real (login com senha/MFA) e
  equipe interna via espelho administrativo (com menos abas, sem
  Agenda/Financeiro).
- Modulos impactados: so
  `frontend/components/portal/PortalClinicaWorkspace.tsx` (sem mudanca
  de backend).
- Risco de regressao: baixo-medio - e reorganizacao de apresentacao,
  mas precisa confirmar que nenhuma secao "some" visualmente e que o
  carregamento de dados (hoje tudo buscado no mount) continua correto
  se migrar pra lazy-load por aba.

## 6) Riscos iniciais

- Risco 1: mover "Aguardando liberacao" para dentro de uma aba (mesmo
  que a default) pode reduzir a visibilidade que o redesign anterior
  conquistou - mitigar mantendo-a como a aba que abre por padrao, sem
  clique extra.
- Risco 2 (decidido com o usuario, 2026-08-16): o carregamento de
  agendamentos/financeiro vira lazy (RF-9) - a clinica perde a
  visibilidade passiva que tem hoje (ex.: perceber sem querer que tem
  uma OS pendente vencida). Mitigacao aceita: "Aguardando liberacao"
  (o unico item que precisa desse tipo de aviso de verdade) continua
  eager na aba default. Um contador leve na propria aba ("Financeiro
  •1") foi cogitado como meio-termo, mas descartado por ora - repescar
  se fizer falta na pratica.
- Risco 3: quebrar o habito de quem ja usa a rolagem atual (a tela ja
  esta no ar ha um tempo) - mitigar com verificacao manual completa dos
  2 modos (real + espelho) antes de mesclar.
