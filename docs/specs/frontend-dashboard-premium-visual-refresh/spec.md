# Spec - frontend-dashboard-premium-visual-refresh

Responsavel: Equipe FortCordis
Data: 2026-07-11

## 1) Sumario

Refresh visual e funcional do dashboard operacional Fort Cordis para uma experiencia mais premium, escaneavel e coerente com SaaS B2B de cardiologia veterinaria. A entrega preserva rotas, chamadas de API, autenticacao, dados e regras de negocio existentes.

Em 2026-07-11, a fase 2 ampliou o mesmo sistema visual para as principais superficies internas e externas do frontend. A extensao cobre agenda, atendimento, cadastros, servicos, laudos, financeiro, fiscal, logistica, relatorios, configuracoes, portais e login, preservando os contratos funcionais existentes.

## 2) Requisitos funcionais

- RF-001: O dashboard deve manter os mesmos dados operacionais de agenda, pacientes, clinicas e servicos.
- RF-002: O cabecalho deve exibir identidade Fort Cordis, data local, status operacional, ECG e indicadores de confirmados, pendentes e clinicas sem dominar a tela.
- RF-003: Os cards principais devem seguir estrutura padronizada de icone, numero, titulo, detalhe e sinal visual.
- RF-004: A agenda de hoje deve exibir timeline quando houver agendamentos e empty state mais claro quando nao houver.
- RF-005: As acoes rapidas devem incluir a acao prioritaria de criar agendamento e manter acesso a agenda, pacientes, clinicas e servicos.
- RF-006: A sidebar deve organizar navegacao por grupos funcionais e manter item ativo tambem em subrotas.
- RF-007: O nome da empresa/clinica na sidebar deve aparecer completo com quebra de linha, sem truncamento visual.
- RF-008: Quando nao houver sessao autenticada, o dashboard nao deve gerar erro 401 ruidoso no console antes do redirecionamento para login.
- RF-009: As telas operacionais devem compartilhar hierarquia de cabecalho, filtros, metricas, abas, paineis, tabelas e estados vazios sem alterar os fluxos existentes.
- RF-010: Agenda, FullCalendar, Atendimento, Pacientes, Clinicas, Servicos, Laudos, Referencias Eco, Logistica, Financeiro, Frota, Fiscal, Relatorios, WhatsApp Stage e Configuracoes devem usar a identidade Fort Cordis de forma consistente.
- RF-011: Listagens e formularios devem preservar buscas, filtros, paginacao, acoes, IDs operacionais, vinculos e payloads preexistentes.
- RF-012: O portal do tutor e o portal da clinica parceira devem manter os fluxos reais de autenticacao e exames, com marca e fotografia Fort Cordis no primeiro viewport.
- RF-013: Ativacao e recuperacao de senha da clinica parceira devem compartilhar o shell visual dos portais e exibir erro seguro quando o backend retornar mensagem tecnica generica.
- RF-014: O login interno deve manter o endpoint `/api/v1/auth/login`, a persistencia temporaria de sessao e o redirecionamento para `/dashboard`, adicionando controle acessivel de visibilidade da senha.
- RF-015: O frontend deve oferecer estados globais coerentes para carregamento, erro e rota nao encontrada.
- RF-016: Relatorios financeiros devem apresentar resumo derivado dos dados carregados, filtros de periodo e abas para categorias, comparativo e evolucao grafica.
- RF-017: Complexos ECG/QRS e graficos devem manter conteudo integral dentro de containers responsivos, sem cortes incoerentes.

## 3) Requisitos nao funcionais

- NFR-001: A interface deve preservar a paleta Fort Cordis: vinho, vermelho, verde-petroleo, branco e tons neutros.
- NFR-002: Componentes interativos devem ter hover/focus visiveis e acessiveis.
- NFR-003: O layout deve ser responsivo para notebook, desktop amplo, tablet e mobile.
- NFR-004: O QRS do ECG no empty state nao pode ser cortado pelo container.
- NFR-005: A entrega nao deve adicionar dependencias novas.
- NFR-006: Build, lint e typecheck do frontend devem permanecer verdes.
- NFR-007: A pagina nao deve criar overflow horizontal em viewport mobile de 390 px; tabelas, abas e graficos podem rolar apenas dentro do proprio painel.
- NFR-008: Botoes de icone devem manter nome acessivel por `aria-label`, `title` ou texto visivel aplicavel.
- NFR-009: A interface deve respeitar `prefers-reduced-motion` nas animacoes existentes do Fortinho.
- NFR-010: A fase 2 nao deve adicionar dependencia, migracao ou mudanca de contrato backend.
- NFR-011: A landing, o login e os portais devem usar assets locais versionados em `frontend/public/brand/`.
- NFR-012: Textos alterados nao devem conter mojibake ou caracteres de substituicao.

## 4) Arquivos afetados

- `frontend/app/dashboard/page.tsx`
- `frontend/app/layout-dashboard.tsx`
- `frontend/app/globals.css`
- `frontend/tailwind.config.ts`
- `frontend/next.config.js`
- `frontend/app/page-client.tsx`
- `frontend/app/loading.tsx`
- `frontend/app/error.tsx`
- `frontend/app/not-found.tsx`
- `frontend/app/agenda/`
- `frontend/app/atendimento/`
- `frontend/app/pacientes/`
- `frontend/app/clinicas/`
- `frontend/app/servicos/`
- `frontend/app/laudos/`
- `frontend/app/ultrassonografia-abdominal/`
- `frontend/app/referencias-eco/`
- `frontend/app/logistica/`
- `frontend/app/financeiro/`
- `frontend/app/fiscal/`
- `frontend/app/relatorios/`
- `frontend/app/configuracoes/`
- `frontend/app/whatsapp-stage/`
- `frontend/app/area-pacientes/`
- `frontend/app/clinica-parceira/`
- `frontend/components/portal/`
- `frontend/components/system/FortCordisStateShell.tsx`

## 5) Criterios de aceitacao

- CA-001: `npm run lint` conclui sem erros.
- CA-002: `npx tsc --noEmit --pretty false` conclui sem erros.
- CA-003: `npm run build` conclui sem erros.
- CA-004: `git diff --check` nao encontra whitespace invalido.
- CA-005: O dashboard responde localmente via Next em `/dashboard`.
- CA-006: O SDD guardrail aprova a release por incluir `spec.md` e `verify.md` deste ciclo.
- CA-007: As 27 rotas estaticas auditadas respondem localmente com o status HTTP esperado.
- CA-008: Login, portais, relatorios financeiros e superficies operacionais representativas nao geram overflow em 1280x720 nem 390x844.
- CA-009: As abas de ultrassonografia e relatorios financeiros alternam conteudo sem alterar dados.
- CA-010: O controle de senha do login alterna entre `password` e `text` com nome acessivel atualizado.
- CA-011: A rota inexistente usa o estado global 404 com retorno ao inicio e acesso ao dashboard.
- CA-012: A varredura dos arquivos alterados nao encontra mojibake.
- CA-013: `spec.md`, `plan.md` e `verify.md` descrevem a fase 2 no mesmo ciclo do codigo.
