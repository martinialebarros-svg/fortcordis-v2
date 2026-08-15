# Verify - atendimento-auditoria-ux-fluxo-lote-2026-08-15

Data: 2026-08-15
Responsavel: Claude (pareado com Martiniano)
Status: implementado, deploy em stage confirmado apos este spec

## 0) Por que este verify e retroativo

As fases 1-9 (issues #29, #24, #23, #35, #32, #49, #55, #25, #36, #56,
#45) foram implementadas, testadas e verificadas manualmente uma a uma
ao longo do dia, cada uma com sua propria rodada de `tsc`/`eslint`/
`vitest`/`pytest` e, quando aplicavel, verificacao no navegador com
dados semeados e limpos ao final. Nenhuma dessas fases criou artefato
em `docs/specs/<feature>/`, entao os dois pushes que as levaram a
`origin/stage` foram aceitos pelo git (e passaram no `Migration CI`),
mas o workflow `Deploy to Stage (VPS)` falhou no step "Run SDD
guardrail" (`scripts/ci/check_sdd_guardrail.py`) - runs `31912883579`/
`31912883579` (commit `4a05313c`) e `31915319521` (commit `a58c579a`),
ambos com a mensagem "Mudancas de codigo detectadas, mas nenhum
artefato SDD foi alterado em docs/specs/<feature>/.". O codigo esta
correto e testado (evidencias abaixo); faltava so a documentacao SDD
para o guardrail liberar o deploy. Este spec supre essa lacuna.

## 1) Matriz de rastreabilidade

| ID | Achado | Evidencia | Status |
| --- | --- | --- | --- |
| CA-29.1 | #29 | 6 testes em `ClinicalFieldCard.test.tsx` (botao desabilitado/habilitado, pre-preenchimento, sucesso, erro mantem form aberto, sem titulo bloqueia). Navegador: campo preenchido -> "Salvar como frase" -> mini-formulario com texto pre-preenchido -> salvo -> toast de sucesso -> chip aparece na hora. Titulo duplicado -> 409 -> toast de erro -> form mantido. | ok |
| CA-24.1 | #24 | Navegador: Consulta -> Exames -> clique em "Bibliotecas clinicas" -> botao muda para "Voltar para Exames" -> clique -> volta para o painel de Exames (nao Consulta). Repetido a partir da Prescricao via "Ver cadastro" de medicamento -> botao mostra "Voltar para Prescricao" -> confirmado. | ok |
| CA-23.1 | #23 | Navegador: secao "Jornada do atendimento" ausente da aba Consulta. Selo "Triagem concluida" aparece no card "Consulta" do menu superior ao marcar o checkbox de Triagem, e desaparece ao desmarcar. Navegacao entre as 4 abas seguiu normal. | ok |
| CA-35.1 | #35 | Simulacao de `dragenter`/`drop` via `DataTransfer` sintetico sobre um card de exame colapsado real (2 exames na lista, ambos colapsados via "Colapsar todos"): `dragenter` expandiu o card e aplicou o destaque azul; `drop` de 1 arquivo gerou `uploadDraft` ("resultado.pdf", 16 B, botao "Enviar agora") identico ao fluxo do card expandido. Segundo card da lista permaneceu intacto. | ok |
| CA-32.1 | #32 | 2 testes de reset (liberar/revogar zeram `visualizado_portal_em`), 2 testes de migration idempotente, teste HTTP completo confirmando que download por sessao de `clinica` marca o campo e download por sessao de `tutor` no mesmo exame **nao** marca. Verificacao end-to-end real: exame liberado com `visualizado_portal_em=None` -> selo "Ainda nao visto" no navegador -> autenticacao de clinica parceira via `/portal/clinicas/sessao-link` + `/portal/auth/verificar-codigo` (fluxo HTTP real, nao mockado) -> `GET /portal/anexos/{id}/arquivo` -> `visualizado_portal_em` gravado no banco -> navegador recarregado mostra "Visto em 15/08/2026, 18:42:38", timestamp identico ao gravado. | ok |
| CA-49.1 | #49 | Teste backend: histórico com 3 atendimentos (1 sem sinais vitais, 2 com valores distintos) retorna as 3 series ordenadas, excluindo o atendimento sem sinais. Navegador: paciente seedado com atendimento anterior (temp 38.7°C, FC 112, FR 26 em 10/05) -> novo atendimento do mesmo paciente -> 3 selos "Ultima: ..." aparecem corretos na Triagem. | ok |
| CA-55.1 | #55 | Navegador, `PainelExamesModal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` apontando para "Gerenciar paineis" confirmados via DOM; `document.activeElement` apos abrir e o botao "X" (primeiro elemento interativo do conteudo); Escape fecha; clique no overlay (`aria-label="Fechar"`) fecha. `AttachmentPreviewModal`: mesmos atributos confirmados (`aria-labelledby` aponta para o nome do arquivo); Escape e clique fora fecham sem erro de listener duplicado. 6 testes automatizados em `Modal.test.tsx`. | ok |
| CA-25.1 | #25 | Navegador: `outerHTML` do botao "Laudar" confirma `title="Abre o modulo de Laudos em outra tela"` e icone `lucide-arrow-up-right` apos o texto; `previousElementSibling` e o divisor (`span` com `bg-white/15`). | ok |
| CA-36.1 | #36 | Navegador: grid de resumo de exames mostra "NO PORTAL / 0" (depois de outros valores reais) ao lado de "INTERPRETADOS". | ok |
| CA-56.1 | #56 | Navegador: busca sem resultado em "Casos recentes" mostra "Nenhum atendimento encontrado para os filtros atuais." + botao "Limpar filtros"; clique recarrega a lista sem filtro. Filtro "Interpretados" sem exame correspondente mostra "Nenhum exame encontrado para o filtro \"Interpretados\"." + botao "Ver todos os exames"; clique remove o filtro. | ok |
| CA-45.1 | #45 | Navegador: barra de formatacao usada de verdade sobre o textarea real (negrito em "cardiomiopatia", italico em "Urgente", lista em 2 linhas de orientacoes) -> documento salvo (`POST .../documentos` 201) -> PDF gerado via `_gerar_pdf_documento_atendimento_bytes` direto (mesma funcao do endpoint) sem erro do ReportLab -> texto extraido do PDF resultante (`pypdf`) nao contem nenhum `**`/`*`/`- ` literal, confirmando conversao real para negrito/italico/bullet. 9 testes backend + 8 testes frontend cobrindo a funcao de conversao e a funcao de insercao na selecao. | ok |
| CA-guardrail.1 | SDD | Apos este spec ser commitado e pushado, `Deploy to Stage (VPS)` deve reavaliar o guardrail com `docs/specs/atendimento-auditoria-ux-fluxo-lote-2026-08-15/{spec.md,verify.md}` no diff e passar. Confirmar via `gh run list --branch stage --limit 3` apos o push. | pendente de confirmacao pos-push |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/ -q
# 735 passed, 25 warnings, 41 subtests passed

cd frontend && npx tsc --noEmit -p tsconfig.json
# sem saida (0 erros)

cd frontend && npx eslint app/atendimento/page.tsx \
  app/atendimento/components/*.tsx app/atendimento/components/*.test.ts*
# sem saida (0 erros)

cd frontend && npx vitest run
# Test Files  9 passed (9)
# Tests  48 passed (48)
```

## 3) Achado fora de escopo descoberto durante a verificacao do #55

Durante a verificacao manual do #55, o preview de PDF
(`AttachmentPreviewModal`, `<iframe src="blob:...">`) apresentou erro
de CSP no console (`frame-src` ausente em `next.config.js`, caindo no
fallback `default-src 'self'` que bloqueia framing de `blob:`).
Sinalizado como tarefa separada (fora do escopo do #55), corrigido via
PR #59 (`frame-src 'self' blob:` adicionado) e trazido para `stage`
via merge de `origin/main`. Verificado manualmente apos o merge:
login -> atendimento real -> anexo PDF -> "Visualizar" -> PDF
renderizado dentro do iframe sem erro de CSP no console (antes do fix,
o mesmo fluxo gerava o erro e deixava o preview em branco).
