# Verify - atendimento-anexo-upload-multiplo

Data: 2026-08-30
Responsavel: Equipe FortCordis
Status: aprovado para stage (validacao manual em stage pendente)

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | teste automatizado: chip por arquivo + rotulo "Enviar 2 arquivos" | ok |
| CA-002 | aceitacao | teste automatizado: `uploadArquivosAnexoGeral` chamado com a lista completa de arquivos | ok |
| CA-003 | aceitacao | teste automatizado: remover chip tira o arquivo da selecao | ok |
| CA-004 | aceitacao | leitura de codigo: `uploadArquivosAnexoGeral` reaproveita a logica de parada/():contagem de `uploadArquivosResultadoExame` | ok |
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
- [ ] Nao executado nesta sessao. O ambiente local exige login (usuario/senha) para abrir um atendimento existente; a ferramenta de automacao usada nesta sessao bloqueia por politica qualquer acao que envie credenciais (mesmo de um usuario de teste local), entao a verificacao ponta-a-ponta no navegador nao foi feita aqui.
- Mitigacao aplicada: cobertura via teste de componente (`AtendimentoDocumentosSection.test.tsx`) simulando selecao de multiplos arquivos, remocao de item e clique no botao de envio, mais leitura de codigo confirmando reuso do caminho de upload ja validado em producao (`uploadAnexoArquivo`, usado hoje pelo fluxo de anexos de exame).

- Stage:
- [ ] Selecionar 2+ PDFs no bloco "Novo anexo" de um atendimento real e confirmar que todos aparecem nos anexos apos o envio.
- [ ] Remover um arquivo da selecao antes de enviar e confirmar que ele nao foi enviado.
- [ ] Forcar falha no meio do lote (ex.: arquivo > 25MB) e confirmar a mensagem de arquivos nao tentados.

- Producao:
- [ ] Smoke test apos promocao para `main`.

## 4) Regressao e riscos residuais

- Risco residual 1: validacao manual ponta-a-ponta (upload real contra o backend) ainda nao foi feita; fica como bloqueio para a promocao `stage -> main` ate ser executada em stage.
- Risco residual 2: como o upload continua sequencial e client-side, lotes grandes (muitos arquivos grandes) deixam a tela "Enviando..." por mais tempo; nao ha indicador de "arquivo X de N" no lote, apenas o progresso do arquivo atual.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao (pendente checklist manual em stage).
- [ ] Nao aprovado.

Motivo atual:
- Mudanca reaproveita integralmente o caminho de upload ja usado em producao (mesma validacao, mesmo endpoint, mesmo dedupe); risco tecnico e baixo. Falta apenas a validacao manual ponta-a-ponta em stage, que nao pode ser feita nesta sessao por restricao de automacao de login.
