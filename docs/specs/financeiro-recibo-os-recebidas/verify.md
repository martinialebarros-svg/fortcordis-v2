# Verify - financeiro-recibo-os-recebidas

Data: 2026-06-08  
Responsavel: Martiniano + Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | botao `Recibo` por linha paga em `frontend/app/financeiro/page.tsx` + endpoint `/ordens-servico/relatorios/recibos/pdf` | ok |
| CA-002 | aceitacao | selecao multipla + `Gerar recibo agrupado` | ok |
| CA-003 | aceitacao | selecao multipla + `Gerar recibo` com paginas sequenciais | ok |
| CA-004 | aceitacao | checkbox desabilitado fora de `Pago` e validacao backend em `OrdemServico.status == "Pago"` | ok |
| CA-005 | aceitacao | PDF consulta `ordens_servico_pagamentos` e `creditos_financeiros` | ok |
| CA-006 | aceitacao | acoes `WhatsApp` e `E-mail` tentam `navigator.share(files)` e fazem fallback para download + canal com mensagem pronta | ok |
| CA-007 | aceitacao | modal de revisao abre antes do envio com mensagem editavel e campos do canal | ok |
| CA-008 | aceitacao | PDF adiciona assinatura do emissor com fallback da assinatura padrao do sistema | ok |
| CA-009 | aceitacao | modelos distintos de mensagem para recibo individual e agrupado na tela Financeiro | ok |
| CA-010 | aceitacao | botao `Previa` abre modal do PDF sem exigir download imediato | ok |
| CA-011 | aceitacao | previa usa renderer compativel com Safari e oferece `Abrir em nova aba` como alternativa explicita | ok |
| CA-012 | aceitacao | previa de varias OS renderiza todas as paginas do PDF em sequencia no modal | ok |
| CA-013 | aceitacao | recibo agrupado evita sobreposicao de colunas com layout em paisagem e quebra de linha nas celulas | ok |
| HOTFIX-001 | regressao | endpoint de recibo volta a carregar `configuracao_usuario` antes de usar assinatura/CRMV | ok |
| HOTFIX-002 | regressao | frontend tenta ler `detail` quando erro vem como `blob` | ok |
| HOTFIX-003 | regressao | preview do recibo deixa de depender apenas de `iframe` e passa a usar fallback compativel com Safari | ok |
| HOTFIX-004 | regressao | modal passa a renderizar o PDF via `pdfjs-dist`, eliminando area em branco do viewer inline | ok |
| HOTFIX-005 | regressao | tabela do recibo agrupado usa paisagem e `Paragraph` nas celulas para acomodar textos longos | ok |

## 2) Testes automatizados executados

Comandos executados:

```bash
cd backend && python3 -m py_compile app/api/v1/endpoints/ordens_servico.py
cd frontend && npx eslint app/financeiro/page.tsx
```

Resumo:
- `python3 -m py_compile backend/app/api/v1/endpoints/ordens_servico.py`: ok
- `npx eslint app/financeiro/page.tsx`: ok
- `npx tsc --noEmit`: ok
- `pytest -q backend/tests/test_sdd_guardrail.py`: ok (`5 passed`)
- `gh run view 27164936912 --log`: falha identificada como `sdd-guardrail` por ausencia de mudanca em `spec.md` + `verify.md` no ciclo do hotfix; alinhamento documental aplicado neste commit.
- `gh run view 27170677717 --log`: falha identificada como `sdd-guardrail` apos hotfix da previa porque apenas `frontend/app/financeiro/page.tsx` mudou sem atualizar artefatos SDD; alinhamento documental reaplicado neste commit.

## 3) Smoke manual recomendado

- Receber uma OS e gerar o recibo individual.
- Selecionar 2 OS recebidas da mesma clinica e gerar recibo agrupado.
- Selecionar 2 OS recebidas de clinicas diferentes e validar consolidado.
- Tentar selecionar OS pendente e confirmar que a UI nao permite.
- Em navegador com Web Share API, validar compartilhamento do PDF por WhatsApp/e-mail.
- Em navegador sem share de arquivos, validar fallback com download do PDF e abertura do canal com mensagem pronta.
- Editar assunto/mensagem/destinatario no modal e confirmar que o canal abre com os dados revisados.
- Com assinatura pessoal cadastrada, gerar recibo e validar assinatura/nome/CRMV no PDF.
- Alterar os dois modelos base e validar que individual e agrupado abrem com textos diferentes.
- Abrir a previa do recibo individual e do agrupado antes do download e validar renderizacao do PDF.
- Repetir a previa no Safari e validar abertura inline ou pela acao `Abrir em nova aba`.
- Selecionar varias OS pagas e validar que a previa do modal renderiza todas as paginas do arquivo em sequencia.
- Gerar recibo agrupado com formas de pagamento longas e validar ausencia de sobreposicao entre colunas.
- Gerar recibo apos o hotfix de stage e confirmar ausencia de erro generico anterior.

## 4) Riscos residuais

- O recibo agrupado consolida OS selecionadas mesmo quando pertencem a clinicas diferentes; isso e util para conferencia interna, mas pode nao ser o formato ideal para envio externo sem filtro adicional.
- Em selecoes com varias clinicas, o compartilhamento abre sem destinatario unico predefinido quando nao houver um contato consolidado.
- Se nao houver assinatura pessoal nem assinatura padrao habilitada, o recibo segue apenas com identificacao textual do emissor.
- Hotfix de stage sem alinhamento de SDD volta a falhar no workflow `sdd-guardrail`; por isso `spec.md` e `verify.md` foram atualizados no mesmo ciclo.
