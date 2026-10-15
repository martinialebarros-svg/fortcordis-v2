# Verificação

Base: `upstream/stage` em `9d20e3e7`, consultada em 2026-10-15.
Worktree: `codex/outflow-sites-fix`, em
`/Users/martiniano/Documents/Codex/2026-10-15/task/outflow-worktree`.
O checkout original `/Users/martiniano/fortcordis-v2` foi preservado.
Não há `.agents/skills` ou `AGENTS.md` no checkout; `CLAUDE.md`, fluxo SDD
e habilidades locais Fort Cordis de entrega/revisão clínica foram lidos.

## Referência inspecionada

Library `libfile_e7de8119f0208191919b8cc413d698b9` materializada pelo fluxo
atual em `task/reference`, neste executor. Leitura com pypdf e renderização
PDFKit/Swift confirmadas (5 páginas); páginas 2, 4 e 5 inspecionadas visualmente.
Página 2: tabela VSVE 1,01 m/s e gradiente calculado 4,08 mmHg.
Página 5, imagem 7: aparelho VSVE 1,01 m/s e gradiente 4,11 mmHg.
Página 4, imagem 2: aparelho VSVD 0,80 m/s e 2,57 mmHg, enquanto a tabela
da página 2 os chama de pulmonar. As duas aquisições não justificam inferir
medida aórtica/pulmonar. Nenhum dado pessoal foi incorporado ao repo.

## Matriz de aceite

| ID | Estado | Evidência |
| --- | --- | --- |
| CA-01 | Aprovado local | XML v1/v2, job real, OCR/PDF, editor, prévia e PDF: quatro pares isolados/conjuntos |
| CA-02 | Aprovado local | 4,11 preservado com V 1,01; VSVD 0,80/2,57 separado; precisão adicional preservada |
| CA-03 | Aprovado local | Fallback somente ausente, no próprio local, origem calculado/fórmula; derivados acompanham V |
| CA-04 | Aprovado local | 6 testes + 14 subtestes de integração com SQLite real em memória, sessões novas, APIs/PDF reais |
| CA-05 | Aprovado local | Legado conserva chave/valor, origem incerta; sem migração/reatribuição em massa |
| CA-06 | Aprovado local | Testes e PDF sintético mantêm títulos qualitativos salvos dos quatro locais |
| CA-07 | Aprovado local | Checagens abaixo e PDF de 2 páginas renderizado/inspecionado sem cortes ou sobreposição |

Conflitos do mesmo campo têm marcador textual explícito, origem/rótulos
preservados e não viram ausência para cálculo. Rótulos anatômicos compostos
ambíguos não geram número. Duplicatas equivalentes não duplicam medida.
Cache XML parser v2, extração estudo v8 e renderizador PDF v23 impedem reuso
de interpretação antiga sem reescrever registros históricos.

## Testes efetivamente executados

Backend: `DATABASE_URL=sqlite:///:memory: PYTHONPATH=.`
com `/Users/martiniano/fortcordis-v2/backend/venv/bin/python -m pytest -q`
em `backend`, nos módulos:

- `tests/test_xml_outflow_measurements.py`
- `tests/test_xml_parser_feline_markers.py`
- `tests/test_xml_import_jobs.py`
- `tests/test_eco_study_extraction_service.py`
- `tests/test_eco_study_import_jobs.py`
- `tests/test_ai_echo_voice_assistant.py`
- `tests/test_ai_echo_reference_safety.py`
- `tests/test_ecocardiograma_medidas.py`
- `tests/test_pdf_laudo_outflow_provenance.py`
- `tests/test_pdf_laudo_echo_measurements.py`
- `tests/test_pdf_laudo_qualitativa.py`
- `tests/test_echo_outflow_roundtrip.py`
- `tests/test_laudos_ecocardiograma_estruturado.py`
- `tests/test_sdd_guardrail.py`

Resultado integrado final: **259 testes e 157 subtestes passaram**, 10,27 s.
Também passaram 71 testes do discover relacionado a PDF no ciclo da camada.
Integração usa SQLite real isolado, sem mocks, com criar/obter/atualizar,
fechar sessão/reabrir, prévia e render_laudo_pdf reais.
Avisos existentes de depreciação Pydantic/SQLAlchemy/passlib não são falhas.

Frontend:

- `./node_modules/.bin/vitest run --configLoader runner --no-cache`: **101 arquivos, 914 testes passaram**, 36,90 s.
- `node --test`: **23 passaram**.
- Vitest focado após último ajuste: **27 passaram**, outflow/editor/componente/hook.
- `tsc --noEmit --incremental false`: passou após corrigir fixture qualitativa.
- `npm run lint`: passou.
- `npm run build`: passou, 43 páginas geradas, checagem de tipos incluída.
- `git diff --check`: passou.
- Guardrail SDD aprovado com os arquivos modificados/novos reais; compilação Python passou em 19 arquivos.

Runner Vitest evita escrita temporária em node_modules compartilhado fora
do sandbox. Dependências existentes reutilizadas por link; nenhuma dependência
alterada. Avisos do Browserslist e navegação jsdom não causaram falha.

Revisão independente confirmou correção das reproduções de ambiguidade OCR e
conflitos XML. O limite do assistente para rótulos de origem foi separado do
limite numérico (2048/80 caracteres), com regressão usando XML real de conflito;
assim fontes longas não bloqueiam o fluxo de revisão. Checagens passaram.

## Evidência visual

`task/pdf-outflow-validation/outflow-synthetic.pdf`, duas páginas, e PNGs
1/2 inspecionados: quatro locais distintos, VSVE 4,11 e VSVD 2,57 preservados,
aorta derivada identificada, precisão pulmonar 0,7234/2,0932, nota de origem
incerta e títulos qualitativos preservados.

## Limites

As suítes automatizadas chamam APIs diretamente com persistência isolada;
o complemento abaixo exercitou também interface e autenticação HTTP reais.
Componentes/hook/prévia exercitados por Testing Library/Vitest.
Suíte inteira do backend não executada; somente módulos pertinentes.
PDF real inspecionado como referência, sem salvar
ou alterar seu laudo. Sem alteração de pacientes, históricos, banco ou cache de
produção. Nenhum commit, push, PR, merge ou deploy ocorreu na validação local.
Depois dessas verificações, o usuário autorizou a publicação em 2026-10-15.

## Complemento: navegador autenticado local

Em 2026-10-15, fluxo completo exercitado no Chrome com o build Next.js final,
API real e SQLite exclusivamente em memória. Harness fora do repositório em
`task/e2e-local/run_backend.py`, usando `StaticPool`, configuração local
suportada e `FORTCORDIS_PROCESS_ROLE=api`. Nenhum override de autenticação,
CSRF ou endpoints. Servidores somente em `127.0.0.1:8000` e `:18284`.
Usuário/bcrypt e chave JWT aleatórios existiram somente no processo de teste;
senha não foi salva no navegador. Integrações externas/agendadores desativados.

Percurso observado pela interface:

1. Login normal: `POST /api/v1/auth/login` 200 e dashboard com base vazia.
2. Laudos → Novo laudo estruturado → upload do XML sintético `four-sites.xml`.
   Job real XML e polling retornaram 200; editor exibiu quatro locais e fontes.
3. Preenchimento de paciente/tutor exclusivamente sintéticos, confirmação de
   ausência de qualitativa/imagens e salvar: `POST /api/v1/laudos` 201.
4. Listagem passou de 0 para 1 laudo. Edição reaberta pela listagem:
   `GET /api/v1/laudos/1` 200; oito valores e metadados preservados.
5. Voltar ao laudo abriu prévia HTML com oito linhas distintas, sem substituição
   de precisão: VSVE 1,01/4,11; aorta 1,205/5,817;
   VSVD 0,80/2,57; pulmonar 0,7234/2,0932.
6. Botão PDF iniciou job real; polling e download autenticados retornaram 200.
   Chrome confirmou download concluído de 3,7 KB. Arquivo baixado comparado
   byte a byte com o PDF gerado no servidor, todos os oito valores verificados
   com pypdf, sem 4,08 ou 2,56 calculados substituindo valores importados.
   PDF de uma página renderizado por PDFKit e inspecionado sem defeitos visuais.
7. Sair: `POST /api/v1/auth/logout` 200 e tela de login com campos vazios.
   Guia fechada e ambos servidores encerrados; portas sem listener. Banco,
   usuário e credenciais em memória destruídos.

Evidências locais, sem credenciais, em `task/e2e-local/`:

- `browser-evidence.json`: sequência HTTP e estado final em memória
  (1 paciente e 1 laudo sintéticos, 8 valores e proveniência importada).
- `editor-reopened.jpg`: captura dos quatro locais no editor reaberto.
- `preview-saved.jpg`: captura da prévia HTML do laudo salvo.
- `browser-downloaded.pdf` e `browser-downloaded.png`: download real e render.
- `pdf-browser-check.json`: valores exatos, comparação de bytes e SHA-256
  `80400590d1bd6eb297c20e8999c22989106a8672b79962667eca13cf049e7b22`.

Sem bloqueio restante neste percurso. O teste de navegador usa as quatro
aquisições importadas simultaneamente. Variantes de gradiente ausente/calculado,
conflitos e legado continuam cobertas pelas suítes automatizadas anteriores;
não foram repetidas integralmente pelo navegador. Nenhum código de aplicação
precisou mudar neste complemento; somente esta evidência SDD foi atualizada.

## Preparação de publicação

- Autorização do usuário: "publique", após a validação local e no navegador.
- Refs remotas conferidas pela integração GitHub: stage `9d20e3e7`, main `16dfb369`.
- Delta desta correção: 34 arquivos, sem migração, mudança de modelo de banco,
  dependências, arquivos de runtime ou scripts de deploy.
- Stage também contém a rotina fiscal #368, com escopo registrado somente stage
  e pendências de QA. Essa mudança e a migração 98 não pertencem a esta correção.
- Publicar esta correção em stage, aguardar workflows terminais e smoke.
  A rota para produção deve preservar o escopo clínico aprovado, conforme a
  exceção de hotfix do CLAUDE.md, sem usar `promocao-com-pendencia` para fiscal.
- Pré-push: lint, TypeScript e `git diff --check` repetidos e aprovados.
- Evidência terminal de PRs, deploy e smoke será registrada separadamente após
  execução; esta preparação não declara publicação concluída.

## Arquivos alterados

- `backend/app/schemas/ai_echo.py`
- `backend/app/services/ai_echo_context.py`
- `backend/app/services/ai_echo_prompt.py`
- `backend/app/services/eco_study_extraction_service.py`
- `backend/app/services/laudo_pdf_service.py`
- `backend/app/services/xml_import_jobs.py`
- `backend/app/utils/ecocardiograma_medidas.py`
- `backend/app/utils/pdf_laudo.py`
- `backend/app/utils/xml_outflow.py`
- `backend/app/utils/xml_parser.py`
- `backend/app/utils/xml_parser_v2.py`
- `backend/tests/test_ai_echo_voice_assistant.py`
- `backend/tests/test_echo_outflow_roundtrip.py`
- `backend/tests/test_eco_study_extraction_service.py`
- `backend/tests/test_ecocardiograma_medidas.py`
- `backend/tests/test_pdf_laudo_echo_measurements.py`
- `backend/tests/test_pdf_laudo_outflow_provenance.py`
- `backend/tests/test_xml_import_jobs.py`
- `backend/tests/test_xml_outflow_measurements.py`
- `docs/specs/eco-outflow-provenance/intent.md`
- `docs/specs/eco-outflow-provenance/plan.md`
- `docs/specs/eco-outflow-provenance/spec.md`
- `docs/specs/eco-outflow-provenance/verify.md`
- `frontend/app/laudos/[id]/editar/page.tsx`
- `frontend/app/laudos/components/EchoOutflowMeasurements.test.tsx`
- `frontend/app/laudos/components/EchoOutflowMeasurements.tsx`
- `frontend/app/laudos/hooks/useEchoMeasurements.ts`
- `frontend/app/laudos/novo/page.tsx`
- `frontend/lib/echo-derived-measurements.ts`
- `frontend/lib/echo-outflow-editor.test.ts`
- `frontend/lib/echo-outflow-editor.ts`
- `frontend/lib/echo-outflow.test.ts`
- `frontend/lib/echo-outflow.ts`
- `frontend/lib/echo-report-presentation.ts`
