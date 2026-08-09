# Spec - atendimento-verificar-pdf-real

Data: 2026-08-05
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Uma correcao aditiva: nova funcao `attachment_is_verified_pdf` em
`attachment_download_service.py`, usada em conjunto com
`attachment_has_download_source` no gate de `liberar_exame_no_portal`.

## 2) Requisitos funcionais (RF)

- RF-1: nova funcao `attachment_is_verified_pdf(attachment) -> bool`:
  resolve a fonte do anexo via `resolve_attachment_download_source`
  (ja existente, sem modificacao); para `local_file`, le os primeiros 1024
  bytes do arquivo real e confirma que comecam com `%PDF-` (apos descartar
  espacos/bytes nulos/quebras de linha iniciais); para `remote_url`, faz um
  GET com `Range: bytes=0-1023` (aceita status 200 ou 206) usando os mesmos
  headers/allowlist de `_build_remote_headers`, sem seguir redirect, e
  confirma os mesmos bytes magicos na resposta. Qualquer falha (arquivo
  ausente, erro de rede, redirect, conteudo sem os bytes magicos) retorna
  `False` (fail-closed).
- RF-2: `liberar_exame_no_portal` passa a exigir
  `_anexo_eh_pdf(anexo) and attachment_has_download_source(anexo) and attachment_is_verified_pdf(anexo)`
  para pelo menos um anexo (adiciona a nova checagem, preserva as duas
  existentes).

## 3) Requisitos nao funcionais (NFR)

- NFR-A (compatibilidade): nenhuma mudanca de contrato de API - o gate
  continua respondendo 422 com a mesma mensagem quando nao ha PDF valido.
- NFR-B (nao regressao): anexos que hoje passam pelas duas checagens
  existentes E cujo conteudo real e um PDF genuino continuam liberando
  normalmente.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - so estreita um caso que ja era bloqueado
  por engano incompleto (existencia sem conteudo).
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-1: anexo local com bytes magicos `%PDF-` reais e verificado (True).
- CA-2: anexo local cujo conteudo NAO comeca com `%PDF-` (ex.: `.txt`
  renomeado) e rejeitado (False), mesmo com `mime_type="application/pdf"`.
- CA-3: anexo local inexistente e rejeitado (False) - mesmo resultado que
  `attachment_has_download_source` ja daria, sem quebrar nada.
- CA-4: anexo remoto cujo conteudo comeca com `%PDF-` e verificado (True).
- CA-5: anexo remoto com conteudo diferente, ou que responde com redirect,
  ou que falha de rede, e rejeitado (False).
- CA-6: `liberar_exame_no_portal` com um anexo falso (mime informado como
  PDF, conteudo real diferente) retorna 422, mesma mensagem de hoje.
- CA-7: `liberar_exame_no_portal` com um PDF genuino continua liberando
  normalmente (sem regressao).
- CA-8: `cd backend && ./venv/bin/python -m pytest tests/ -q --no-header`
  aprovado.

## 7) Casos de borda

- CB-1: storage remoto que ignora `Range` e responde 200 completo -
  aceito, desde que os primeiros bytes ja lidos comecem com `%PDF-`.
- CB-2: exame ja liberado no portal ANTES deste pacote (com anexo falso)
  nao e revalidado retroativamente - `liberar_exame_no_portal` tem um
  curto-circuito de idempotencia que retorna cedo quando o exame ja esta
  liberado, sem invocar o gate de novo. Aceito por design (correcao e
  preventiva daqui para frente).

## 8) Fora de escopo

- Qualquer mudanca em `attachment_has_download_source`,
  `resolve_attachment_download_source`, ou nos outros 2 usos de
  `_anexo_eh_pdf`.
- Revalidacao retroativa de exames ja liberados.
