# Intent - atendimento-documentos-auditoria

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Achado #21 da auditoria completa (docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md):
documentos clinicos gerados (atestados, receituarios avulsos, declaracoes)
podiam ser editados ou apagados definitivamente sem NENHUM registro de
auditoria. `atualizar_documento_atendimento`/`excluir_documento_atendimento`
(em `document_crud_service.py`) sobrescreviam titulo/corpo/status ou faziam
`db.delete(documento)` direto, sem guardar a versao anterior nem chamar
`registrar_auditoria`. Pior: os dois endpoints em `atendimento.py` faziam
`_ = current_user` - descartando explicitamente a identidade do usuario
autenticado, entao nem seria possivel reconstituir "quem" fez a alteracao
mesmo que quisessem depois.

Cenario de falha: um veterinario gera um atestado recomendando 10 dias de
repouso, entrega/imprime, e depois edita o mesmo registro mudando o corpo
para "3 dias de repouso" (ou exclui o documento). Sem versionamento nem
log, se o conteudo original for contestado depois (ex.: disputa sobre a
orientacao dada), nao ha como reconstituir o que foi de fato emitido nem
quem alterou/apagou.

## 2) Objetivo

Toda edicao ou exclusao de documento clinico avulso deixa rastro auditavel:
quem fez, quando, e o conteudo antes/depois (edicao) ou o conteudo excluido
(exclusao).

## 3) Nao objetivos

- Nao inclui versionamento completo (guardar TODAS as versoes historicas
  de um documento, nao so a auditoria da ultima mudanca) - o padrao
  estabelecido no modulo (`PrescricaoItemAjuste`, `ExameAjuste`) e trilha
  de auditoria via `AuditoriaEvento`, nao um sistema de versoes com
  restauracao.
- Nao inclui soft-delete de documento (a exclusao continua fisica,
  `db.delete`) - a auditoria registra o CONTEUDO excluido antes de apagar,
  suficiente para reconstituir o que existia, sem manter o registro
  "fantasma" no banco.
- Nao inclui auditoria da exclusao EM CASCATA de documentos quando o
  atendimento inteiro e excluido (`DELETE /atendimentos/{id}`) - esse
  caminho ja gera o evento agregado `ATENDIMENTO_EXCLUIDO`; o achado #21 e
  especificamente sobre a exclusao AVULSA via
  `DELETE /atendimentos/{id}/documentos/{id}`, mantendo o atendimento
  aberto.

## 4) Contexto e restricoes

- Restricoes tecnicas: reusa `registrar_auditoria`
  (`app.services.auditoria_service`), ja usado extensivamente no mesmo
  modulo para acoes de sensibilidade comparavel (desvinculo de agendamento,
  finalizacao de atendimento, exclusao de atendimento).
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: documentos clinicos avulsos
  (atestados, receituarios) tem valor probatorio - a lacuna de auditoria
  era um risco de conformidade, nao so tecnico.

## 5) Impacto esperado

- Usuarios impactados: veterinarios editando/excluindo documentos clinicos
  avulsos.
- Modulos impactados: `backend/app/services/atendimento/document_crud_service.py`
  e os dois endpoints correspondentes em `atendimento.py`.
- Risco de regressao: baixo - a auditoria e aditiva (roda apos o
  `db.commit()` do dado principal); a mudanca de assinatura das funcoes de
  service (`current_user`, `request` como keyword-only) nao tem nenhum
  outro chamador na base (confirmado: nenhum teste existente chamava essas
  funcoes diretamente).

## 6) Riscos iniciais

- Risco 1 (mitigado): `registrar_auditoria` e "best-effort" (abre sua
  propria `SessionLocal()`, nao interrompe o fluxo principal se falhar) -
  uma falha na auditoria nao pode bloquear a edicao/exclusao do documento
  em si.
- Risco 2 (mitigado): comparar antes/depois exige capturar o snapshot
  ANTES de aplicar as mudancas - `_snapshot_documento` e chamado no inicio
  de `atualizar_documento_atendimento`, antes de qualquer `setattr`.

## 7) Perguntas abertas

Nenhuma - implementacao concluida e testada.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
