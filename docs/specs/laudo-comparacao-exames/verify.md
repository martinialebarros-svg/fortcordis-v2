# Verify — Comparação com exames anteriores

Implementação local em 28/10/2026, branch `codex/echo-previous-exam-comparison-20261027`, base `ccc3a6f7`. Sem commit, push, publicação, acesso a banco real ou alteração de PDF/paciente.

| Critério | Status | Evidência |
| --- | --- | --- |
| CA-001 | aprovado local | Serviço/rota real com autenticação e permissões, SQLite descartável; identidade homônima separada, ausência/404 genérico, whitelist sem PII e nenhuma escrita/autoflush. |
| CA-002 | aprovado local | Testes de data civil/fuso, ausência, futuro, mesmo dia, estados, modalidades, empate e seleção manual. |
| CA-003 | aprovado local | Testes frontend de diferenças, cm explícitos, ambiguidades com contexto de Ao/AE, M/2D/vistas e métodos AE/Ao distintos; entrada imutável. Adapter preserva última ocorrência retirada/inválida e limita leitura à primeira seção real. Prova independente do pipeline com 23 casos aprovados. |
| CA-004 | aprovado local | Componente: consulta sob demanda, timeout 8000 ms, erro/retry, fechar/desmontar, troca de rota/paciente e resposta antiga; página real mantém laudo disponível quando o histórico falha. |
| CA-005 | aprovado local | Probe independente de 24 espécies × 6 canais = 144 comparações frontend/backend/PDF sem divergência. Nenhuma chamada externa, DB real ou geração de PDF no probe. Testes de formulário/salvamento verificam aliases sem normalizar payload. |
| CA-006 | pendente visual | Integração testada na página real. Suite completa frontend: 135 módulos/2486 testes e 23 testes Node aprovados. Backend: 125 testes/565 subtestes. Lint global, TypeScript, build Next.js e guardrail SDD aprovados. A conferência visual no navegador não foi executada; motivo em CA-007. |
| CA-007 | pendente | Publicação em stage autorizada em 28/10/2026, aguardando execução e conferência autenticada. A tentativa de abrir a QA sintética no navegador retornou que o uso local do navegador está desabilitado nas configurações de Work. Não houve conferência visual; isso permanece para stage. |

## Comandos e limites

- Backend isolado da funcionalidade: `PYTHONDONTWRITEBYTECODE=1 /Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest -q -p no:cacheprovider tests/test_laudo_comparacao_anterior.py`: 24 testes e 22 subtestes aprovados. Suite focada ampliada com resolver, métodos, diastólica canina/felina e PDF quantitativo: 125 testes e 565 subtestes. Avisos existentes de depreciação Pydantic/SQLAlchemy/passlib.
- Frontend: `npx vitest run --maxWorkers=2`: 135 módulos/2486 testes aprovados; `node --test`: 23 testes aprovados. A validação cobre os componentes e as páginas reais com transporte simulado. As execuções intermediárias feitas enquanto novos casos eram adicionados foram substituídas pela execução final sobre fonte congelada.
- `npm run lint`, `npx tsc --noEmit --incremental false`, `npm run build` e `git diff --check`: aprovados. Avaliação de `scripts/ci/check_sdd_guardrail.py` sobre todos os caminhos alterados e novos, sem staging: aprovada.
- Probe temporário `/tmp/echo-species-independent-probe.py fixed`: 144/144 comparações concordantes.
- Revisão independente `/tmp/echo-comparison-final-pipeline-evidence.json`: 23 casos, 0 falhas; pipeline real do snapshot backend ao helper frontend, com imutabilidade e hashes das fontes.
- Evidências consolidadas em `/Users/martiniano/fortcordis-v2/output/qa/echo-previous-exam-20261028/`. A fixture temporária de QA não integra o produto e seu servidor foi encerrado após o bloqueio de navegador. Nenhuma configuração de segurança foi alterada para contorná-lo.
- Nenhuma evidência local equivale a deploy. O PDF existente não foi modificado e não recebeu a nova comparação.

## Publicação em stage — 28/10/2026

Autorizada pelo usuário após a validação local. Preflight remoto: `origin/stage` e base da feature iguais a `ccc3a6f7372b51ba3ecb380ba19bfbefc23ee906`; produção permanece em `9569b1113945c453108cfef247b7c70c985d879b`. Publicação, workflow final, SHA instalado e smoke serão registrados após a execução. Teste visual autenticado permanece pendente; nenhum resultado visual é presumido a partir de HTTP 200 ou de testes de componentes.
