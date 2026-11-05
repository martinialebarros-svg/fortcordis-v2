# Verificação — 04/11/2026

Implementação validada **somente localmente**, base `4c10932977da200f0a476d109e5cfbab04566730`, branch `codex/paciente-idade-nascimento`. Worktree gerenciado separado; checkout principal e trabalhos paralelos preservados. Sem commit, push, deploy, nova mutação de dados reais ou emissão/compartilhamento real nesta entrega de software.

| ID | Status | Evidência |
| --- | --- | --- |
| CA-01 | aprovado | `test_paciente_idade_fonte.py`, `test_tutores_rotina_agil.py`: APIs de cadastro/leitura/edição, fonte explícita, alternância, limpeza, preservação das observações e da data-base |
| CA-02 | aprovado | testes Python/TypeScript com datas fixas: meses completos, fevereiro, dias/semanas, ano isolado, idade histórica, entrada inválida/futura, legado e proteção pediátrica |
| CA-03 | aprovado | `test_echo_pdf_preview.py`: preview sem mutação, atualização transacional, nova leitura, renderer oficial e invalidação do cache após correção apenas do cadastro; PDFs de pressão e ultrassonografia; `test_atendimento_document_demographics.py`: idade histórica nos PDFs de receita e exames |
| CA-04 | aprovado localmente | componente compartilhado testado em React, integrado a pacientes, Agenda, Atendimento, laudos novos/edição, cadastro rápido de ECG e ultrassonografia abdominal. Importações conservam nascimento observado e só ancoram idade explícita, sem aniversário presumido |
| CA-05 | aprovado | migração aditiva/idempotente sem backfill em SQLite e PostgreSQL temporário; lint, TypeScript, build Next.js, diff check e guardrail SDD aprovados |

## Execuções

- Backend amplo: **129 passaram, 21 skips, 137 subtests** em resolução, PDF/prévia, editor, cadastro/identidade, importação, documentos de Atendimento, migrações, referência de IA e listagem. Os 21 skips pertencem à classe preexistente de testes de identidade que exige seu próprio PostgreSQL opt-in.
- Após os últimos ajustes de compatibilidade e cobertura das demais modalidades: **35 passaram, 17 subtests** em `test_paciente_idade_fonte.py` e `test_echo_pdf_preview.py`. Inclui criação sem copiar idade derivada para declaração e limpeza sem ressuscitar idade obsoleta.
- PostgreSQL 17 descartável, socket local e TCP desabilitado: migração executada duas vezes sobre tabela legada, valores originais intactos e colunas novas NULL; **4 testes** do editor concorrente/rollback passaram. Cluster próprio encerrado ao final. Nenhum banco remoto usado.
- Frontend completo: **149 arquivos / 2.609 testes** Vitest; **23 testes** Node. Após ajustes finais de payload/seleção de paciente: **34 testes** de idade e página de novo laudo passaram.
- ESLint sem warnings, `tsc --noEmit --incremental false`, `npm run build`, `git diff --check` e `evaluate_guardrail` sobre arquivos alterados e novos: aprovados. Avisos de depreciação de dependências Python e atualização Browserslist preexistentes não bloquearam os checks.
- Logs locais: `/tmp/fortcordis-age-backend-final2.log`, `/tmp/fortcordis-age-regression-final2.log`, `/tmp/fortcordis-age-postgres.log`, `/tmp/fortcordis-age-front-all-final.log`, `/tmp/fortcordis-age-last-front.log`, `/tmp/fortcordis-age-node-tests.log`, `/tmp/fortcordis-age-lint-final2.log`, `/tmp/fortcordis-age-types-final3.log`, `/tmp/fortcordis-age-build-verified.log`.

## Revisão clínica e limites

Idade informada avança como estimativa a partir de data-base preservada. Nascimento anual produz intervalo, sem dia/mês fictício; idade histórica usa data do exame/atendimento. Origem e alternativa ficam visíveis no formulário. Intervalos cruzando um ano mantêm a proteção pediátrica como desconhecida; menor de um ano permanece protegido. Nenhuma medida, diagnóstico, assinatura ou tratamento novo foi automatizado. Importação continua sujeita à revisão existente.

Cadastros legados não recebem fonte/data inferidas em massa. Salvamento alheio preserva valores legados; selecionar explicitamente nascimento passa a exigir valor válido. A migração deve preceder a instalação do backend. Rollback da aplicação conserva as colunas adicionais, sem exclusão de dados.

Publicação e homologação autenticada em Stage/produção permanecem fora desta implementação local. PDFs previamente emitidos/publicados não foram substituídos. A correção pontual de cadastro autorizada anteriormente no chat é uma intervenção separada; esta verificação não afirma emissão de novo PDF real.

## Preparação de publicação — 05/11/2026
Pedido explícito de publicação recebido. Baselines conferidas: main `6185b334`, Stage `cf647ead`; serviços ativos, cerca de 6,7 GiB disponíveis, trava local do backup livre. Ainda sem deploy desta funcionalidade neste ponto. Evidências de release separadas em `/Users/martiniano/Documents/Codex/2026-11-05/fortcordis-idade-release`.
