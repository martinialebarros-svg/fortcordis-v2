# Verificação — Painel de gestão

Base: origin/main `6d77526db9c5ebf9b7c6457362d153903c7cda7a`. Implementação isolada em `/Users/martiniano/.codex/worktrees/painel-gestao/fortcordis-v2`. Checkout original e trabalho clínico concorrente preservados. Entrega inicialmente validada localmente, antes da solicitação de publicação em stage.

## Evidência local

- **60 testes backend passaram**: `tests/test_gestao_api.py`, `tests/test_gestao_agenda.py`, `tests/test_gestao_financeira.py`, `tests/test_migration_ci_cycle.py`. Executados com SQLite sintético e segredo de teste, sem `.env` real.
- **17 testes frontend passaram**: `app/gestao/page.test.tsx`, `lib/host-routing.test.ts`, `lib/dashboard-shell-routes.test.ts`, via Vitest.
- TypeScript e ESLint focado passaram; `npm run build` completo passou, incluindo lint, tipos e página `/gestao`.
- `git diff --check` passou. Guardrail SDD foi avaliado com lista de arquivos modificados e não rastreados (sem fazer commit/stage), qualificando `painel-gestao`.
- Navegador Chrome em execução local, com API isolada em memória: seis indicadores renderizados, premissas simuladas e salvas, reload preservando valores, mudança de clínica limpando premissas de outro recorte. Sem exceções de página; viewport móvel 390×844 sem overflow horizontal.

## Casos cobertos

Permissão admin no servidor/UI, cálculo HTTP integrado sem escrita, campos vazios versus zero, valores inválidos/não finitos/booleanos, datas e período máximo, janela equivalente anterior sem vazamento de premissas, salvas com contexto, revisão concorrente 409, rollback se auditoria falha, migração idempotente e ciclo completo do runner.

Jornada, exceções, feriados, bloqueios sobrepostos, capacidade global sob filtros, falta de duração, estados desconhecidos, reservas vencidas, cancelamentos, reativações, reagendamentos, intervalos atravessando meia-noite e bordas do recorte, datas legadas/fuso, denominador vazio e ausência de dados sensíveis.

Competência, parciais, agrupados, duplicatas, estornos e novos recebimentos, crédito, legado sem comprovação, precedência OS/contas/transações, parcelas sem vínculo, vencidos, ausência de vencimento, clínicas inativas/ausentes, concentração sem denominador, taxas/líquidos/valores ausentes, recorrência mensal no dia 31, totais completos com 250 detalhes e ausência de N+1/escritas.

Na interface: erros recuperáveis, não admin, serviço de premissas indisponível com simulação mantida, conflito de revisão, respostas antigas, mudança de filtros, vazio e indicadores parciais. Middleware redireciona `/gestao` de domínio institucional para app, preservando filtros e exigindo login.

## Limitações e publicação

Validação exclusivamente local. Nenhuma instalação em stage/produção, consulta ao banco real, alteração de OS/pagamento/agendamento, mensagem, emissão fiscal ou movimentação financeira. A proteção PostgreSQL (RLS e revoke de privilégios) segue o padrão existente e foi revisada no código; sua execução real aguarda a etapa de publicação/homologação. Não houve ensaio de carga com a carteira real. Permanecem avisos de depreciação preexistentes de Pydantic/SQLAlchemy e aviso de catálogo Browserslist antigo, sem falha de build.

Após instalação autorizada, acesso por **Gestão → Gestão do negócio** (`/gestao`) com perfil administrador. O deploy deverá executar a migração `20261025_101`; se ela faltar, salvar/ler premissas apresenta erro recuperável, sem bloquear a consulta simulada. Para conferir visualmente esta entrega, a demonstração local usa apenas parceiros/valores fictícios e não compartilha a base operacional.

## Preparação stage — 26/10/2026

Publicação autorizada exclusivamente em stage. Base remota conferida: `9f9afe2e9d0be0e53552b9e1f23b9622098e2caa`; main observado: `1fb920c2711b5776f095bfb8e6d06d7f7ece76b5`. A maior migração remota é `20261025_100`; `20261025_101` permanece livre. Revisão de compatibilidade das fontes Agenda/Financeiro não encontrou mudanças conflitantes. A alteração de transporte Meta da PR #472 já está integrada e o deploy anterior de stage terminou com sucesso; nenhuma modificação desse transporte faz parte deste painel. A instalação e os testes remotos ainda serão confirmados. Artefatos de demonstração, servidores sintéticos e screenshots locais não integram o pacote publicado.

Revalidação após integração da base stage: 60 testes backend, 17 frontend, lint completo e TypeScript passaram. Pipeline stage passa a executar explicitamente os testes do painel. Pré-verificação remota somente leitura: stage instalado no SHA `9f9afe2e`, produção instalada no SHA `0561a168c449aeb5b763b0fc3b7699c594200654`; o sync felino já existente informou “Nenhuma alteração necessária”. Transporte Meta stage permanece desligado. Nenhum conteúdo ou segredo de produção foi copiado para stage.
