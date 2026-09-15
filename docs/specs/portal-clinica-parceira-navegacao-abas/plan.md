# Plan - portal-clinica-parceira-navegacao-abas

Data: 2026-08-16
Responsavel: Claude (pareado com Martiniano)
Status: implementado

## 1) Sequencia de fases

- Fase 1: estado de aba ativa + barra de abas (sem mover conteudo
  ainda) - so a navegacao, seguindo o padrao ARIA ja usado em
  `frontend/app/atendimento/page.tsx`.
- Fase 2: mover cada secao existente para dentro da aba correspondente
  (JSX puro, sem tocar na logica interna de cada secao).
- Fase 3: lazy-load de Agenda/Financeiro (RF-9) - disparar
  `loadAgendamentos`/`loadFinanceiro` na primeira abertura da aba, nao
  no mount.
- Fase 4: verificacao (lint/typecheck/build/testes + manual nos 2
  modos e mobile).

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Estado `abaAtiva` (`"visao-geral" | "laudos" | "agenda" |
  "financeiro"`, default `"visao-geral"`) em `PortalClinicaWorkspace.tsx`.
- [x] T1.2 Barra de abas logo abaixo do hero/card de sessao -
  `role="tablist"`, cada botao `role="tab"` + `aria-selected`,
  paineis com `role="tabpanel"`. "Agenda"/"Financeiro" só renderizam
  quando `!isAdminPreview`.
- [x] T1.3 Rolagem horizontal da barra em telas estreitas (sem quebrar
  layout, sem overflow da pagina).

### Fase 2

- [x] T2.1 Aba "Visao geral": "Aguardando liberacao" + "Resumo da
  unidade" + "Atividade recente da unidade", sem alterar a logica
  interna de cada bloco.
- [x] T2.2 Aba "Laudos": "Filtros de busca" + "Exames liberados".
- [x] T2.3 Aba "Agenda": "Agendamentos ativos da unidade".
- [x] T2.4 Aba "Financeiro": "Financeiro da unidade".
- [x] T2.5 Nenhuma secao ficou orfa - as 6 secoes originais tem um lar
  em alguma das 4 abas.

### Fase 3

- [x] T3.1 `loadAgendamentos`/`loadFinanceiro` nao rodam mais no mount
  incondicional - passaram para um `useEffect` proprio que dispara na
  primeira vez que `abaAtiva` entra em `"agenda"`/`"financeiro"`
  (flags `agendamentosSolicitados`/`financeiroSolicitado`, sem refetch
  automatico depois - so via botao "Atualizar" ja existente).
- [x] T3.2 "Visao geral" e "Laudos" continuam carregando no mount via
  `loadDashboard` (unico carregamento removido do bloco sequencial foi
  agenda/financeiro).

### Fase 4

- [x] T4.1 `npx tsc --noEmit`, `npx eslint
  components/portal/PortalClinicaWorkspace.tsx`, `npm run build` - sem
  erros.
- [x] T4.2 Nao existe suite de testes automatizados para
  `PortalClinicaWorkspace.tsx` (nenhum arquivo de teste prévio para
  este componente) - decisao: em vez de criar um harness do zero so
  pra esta mudanca de apresentacao, a cobertura de CA-3/CA-4/CA-7 foi
  feita via verificacao manual real (T4.3), com o backend local de
  verdade (nao mockado) e inspecao das requisicoes de rede.
- [x] T4.3 Verificacao manual em ambiente local (backend+frontend
  dev, nao stage): sessao `admin_preview` real via
  `/clinicas/portal/espelho?clinica=11` (clinica "casa do caralho",
  login `admin@fortcordis.com`) confirmando so 2 abas
  (Visao geral/Laudos) e persistencia de filtro entre trocas de aba;
  sessao REAL de clinica parceira criada via convite+ativacao local
  (mesmo fluxo real do produto, clinica 11) confirmando as 4 abas,
  lazy-load de Agenda (1 request ao abrir, 0 ao reabrir) e Financeiro
  (idem, com dado real de OS pendentes/pagas renderizado
  corretamente); viewport 375px sem overflow horizontal
  (`document.documentElement.scrollWidth === window.innerWidth`).
  Conta de teste local removida ao final.

## 3) Dependencias e bloqueios

- Dependencia 1: nenhuma - sem migracao, sem mudanca de backend, sem
  servico externo novo.
- Dependencia 2: acesso a uma sessao real de clinica parceira com dado
  em Agenda/Financeiro para a verificacao manual (ja disponivel -
  Clinica #8 em stage).

## 4) Checklist para iniciar execucao

- [x] `intent.md` escrito.
- [x] `spec.md` escrito.
- [ ] `intent.md`/`spec.md` aprovados por Martiniano.
- [ ] Fases e rollback revisados.
