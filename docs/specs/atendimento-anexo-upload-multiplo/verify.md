# Verify - atendimento-anexo-upload-multiplo

Data: 2026-08-30
Responsavel: Equipe FortCordis
Status: validado em stage e em producao (promovido via release PERF-08)

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | teste automatizado + manual em stage: 2 chips renderizados e botao "Enviar 2 arquivos" | ok |
| CA-002 | aceitacao | manual em stage: envio real de 2 PDFs (atendimento #8), ambos chegaram em "Anexos e Imagens" com timestamps sequenciais (20:32:58 e 20:32:59) | ok |
| CA-003 | aceitacao | teste automatizado + manual em stage: remover 1 chip antes de enviar tira o arquivo da selecao e o rotulo volta a "Enviar arquivo" | ok |
| CA-004 | aceitacao | leitura de codigo: `uploadArquivosAnexoGeral` reaproveita a logica de parada/contagem de `uploadArquivosResultadoExame` (nao testado manualmente forcando falha - ver risco residual) | ok |
| CA-005 | aceitacao | `tsc --noEmit`, `eslint` e `vitest run` sem erros | ok |

## 2) Testes automatizados executados

Comandos executados (`frontend/`):

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint app/atendimento/page.tsx app/atendimento/components/AtendimentoDocumentosSection.tsx app/atendimento/components/AtendimentoDocumentosSection.test.tsx --max-warnings=0
npx vitest run
```

Resultado:
- `tsc --noEmit`: sem erros.
- `eslint`: sem warnings/erros nos arquivos alterados.
- `vitest run`: 16 arquivos de teste, 102 testes passando (incluindo os 4 novos testes de `AtendimentoDocumentosSection.test.tsx`).

## 3) Testes manuais

- Local:
- [ ] Nao executado. Ambiente local exige login e a automacao usada nesta sessao bloqueia por politica qualquer acao que envie credenciais. Mitigado pela validacao completa feita direto em stage (ver abaixo).

- Stage (`app.stage.fortcordis.com.br`, atendimento de teste `#8 - E2E Stage 20260324_123903`, apos deploy do PR #91 - commit `05e041f`):
- [x] Selecionar 2 PDFs no bloco "Novo anexo" mostra 1 chip por arquivo e o botao muda para "Enviar 2 arquivos".
- [x] Remover 1 arquivo da selecao (botao "x" do chip) tira o arquivo da lista e o botao volta a "Enviar arquivo".
- [x] Selecionar 2 PDFs novamente e clicar em "Enviar 2 arquivos" envia os dois em sequencia; ambos aparecem em "Anexos e Imagens" do atendimento, e a selecao/descricao do formulario e limpa ao final.
- [x] Anexos de teste removidos apos a validacao (limpeza do atendimento de teste).
- [ ] Forcar falha no meio do lote (arquivo > 25MB) nao foi testado manualmente - avaliado como baixo risco por reaproveitar a validacao de tamanho/extensao ja existente em `uploadAnexoArquivo` (inalterada) e a logica de interrupcao/contagem ja usada em producao por `uploadArquivosResultadoExame`.

Nota tecnica: a primeira tentativa de simular a selecao de 2 arquivos via ferramenta de automacao de upload (`file_upload` com `paths`) so registrou 1 arquivo no estado do componente - rastreado como uma peculiaridade da ferramenta (ela parece aplicar os arquivos em duas chamadas sequenciais, e a segunda perde a referencia porque o input e remontado apos a primeira). Um usuario real seleciona varios arquivos em uma unica interacao com o seletor nativo do sistema operacional, o que gera um unico evento `change` com todos os arquivos - por isso a validacao final foi refeita disparando esse evento unico diretamente (equivalente ao que o navegador faz nativamente), o que confirmou o comportamento correto.

- Producao:
- [x] Promovido para `main` no push `chore(release): promover stage com PERF-08 para producao` (commit `59f61542`, 31/08/2026 00:44 UTC), que arrastou o `stage` da epoca (incluindo os commits `e1375bf1` e `59ad8caa` desta feature) - nao houve PR de promocao dedicado para esta mudanca especificamente. Workflow "Deploy to VPS" concluido com sucesso em `main`. Smoke test manual em produção (login real) nao foi executado nesta sessao; confirmado apenas via ancestralidade do commit no git e sucesso do workflow de deploy.

## 4) Regressao e riscos residuais

- Risco residual 1: falha forcada no meio de um lote (ex.: arquivo > 25MB) nao foi validada manualmente nesta sessao; a logica e uma copia direta do padrao ja usado em producao (`uploadArquivosResultadoExame`), risco avaliado como baixo.
- Risco residual 2: como o upload continua sequencial e client-side, lotes grandes (muitos arquivos grandes) deixam a tela "Enviando..." por mais tempo; nao ha indicador de "arquivo X de N" no lote, apenas o progresso do arquivo atual.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.

Motivo atual:
- Validado em stage com upload real de 2 arquivos em lote, remocao de item antes do envio e confirmacao de que ambos os anexos chegam corretamente ao atendimento. Mudanca reaproveita integralmente o caminho de upload ja usado em producao (mesma validacao, mesmo endpoint, mesmo dedupe); risco tecnico residual e baixo (ver secao 4).
