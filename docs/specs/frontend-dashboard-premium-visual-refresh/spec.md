# Spec - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-10

## 1) Sumario

Refresh visual e funcional do dashboard operacional Fort Cordis para uma experiencia mais premium, escaneavel e coerente com SaaS B2B de cardiologia veterinaria. A entrega preserva rotas, chamadas de API, autenticacao, dados e regras de negocio existentes.

## 2) Requisitos funcionais

- RF-001: O dashboard deve manter os mesmos dados operacionais de agenda, pacientes, clinicas e servicos.
- RF-002: O cabecalho deve exibir identidade Fort Cordis, data local, status operacional, ECG e indicadores de confirmados, pendentes e clinicas sem dominar a tela.
- RF-003: Os cards principais devem seguir estrutura padronizada de icone, numero, titulo, detalhe e sinal visual.
- RF-004: A agenda de hoje deve exibir timeline quando houver agendamentos e empty state mais claro quando nao houver.
- RF-005: As acoes rapidas devem incluir a acao prioritaria de criar agendamento e manter acesso a agenda, pacientes, clinicas e servicos.
- RF-006: A sidebar deve organizar navegacao por grupos funcionais e manter item ativo tambem em subrotas.
- RF-007: O nome da empresa/clinica na sidebar deve aparecer completo com quebra de linha, sem truncamento visual.
- RF-008: Quando nao houver sessao autenticada, o dashboard nao deve gerar erro 401 ruidoso no console antes do redirecionamento para login.

## 3) Requisitos nao funcionais

- NFR-001: A interface deve preservar a paleta Fort Cordis: vinho, vermelho, verde-petroleo, branco e tons neutros.
- NFR-002: Componentes interativos devem ter hover/focus visiveis e acessiveis.
- NFR-003: O layout deve ser responsivo para notebook, desktop amplo, tablet e mobile.
- NFR-004: O QRS do ECG no empty state nao pode ser cortado pelo container.
- NFR-005: A entrega nao deve adicionar dependencias novas.
- NFR-006: Build, lint e typecheck do frontend devem permanecer verdes.

## 4) Arquivos afetados

- `frontend/app/dashboard/page.tsx`
- `frontend/app/layout-dashboard.tsx`
- `frontend/app/globals.css`
- `frontend/tailwind.config.ts`
- `frontend/next.config.js`

## 5) Criterios de aceitacao

- CA-001: `npm run lint` conclui sem erros.
- CA-002: `npx tsc --noEmit --pretty false` conclui sem erros.
- CA-003: `npm run build` conclui sem erros.
- CA-004: `git diff --check` nao encontra whitespace invalido.
- CA-005: O dashboard responde localmente via Next em `/dashboard`.
- CA-006: O SDD guardrail aprova a release por incluir `spec.md` e `verify.md` deste ciclo.
