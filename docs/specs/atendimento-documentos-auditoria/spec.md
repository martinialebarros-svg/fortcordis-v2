# Spec - atendimento-documentos-auditoria

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`atualizar_documento_atendimento` e `excluir_documento_atendimento`
(`document_crud_service.py`) passam a receber `current_user`/`request` e
registrar auditoria via `registrar_auditoria`. Os endpoints correspondentes
em `atendimento.py` parem de descartar `current_user` e passam a receber
`request`.

## 2) Requisitos funcionais (RF)

- RF-001: `atualizar_documento_atendimento` captura um snapshot
  (`titulo`, `corpo`, `status`) ANTES de aplicar as mudancas do payload.
- RF-002: apos o commit, compara o snapshot anterior com o estado novo;
  se houver QUALQUER diferenca em `titulo`/`corpo`/`status`, registra
  auditoria `DOCUMENTO_ATENDIMENTO_ATUALIZADO` com `detalhes.alteracoes`
  contendo, para cada campo alterado, `{antes, depois}`.
- RF-003: se NAO houver diferenca (payload igual ao estado atual), NAO
  registra auditoria (evita ruido).
- RF-004: `excluir_documento_atendimento` captura o snapshot do documento
  ANTES de deletar, e registra auditoria
  `DOCUMENTO_ATENDIMENTO_EXCLUIDO` com `detalhes.conteudo_excluido`
  (titulo, corpo, status) SEMPRE (nao condicional, já que e uma exclusao).
- RF-005: ambas as funcoes de service passam a exigir `current_user`
  (keyword-only) e aceitar `request` opcional (keyword-only, default
  `None`), seguindo o padrao de `registrar_auditoria`.
- RF-006: os endpoints `PUT`/`DELETE /atendimentos/{id}/documentos/{id}`
  em `atendimento.py` ganham parametro `request: Request` e parem de
  fazer `_ = current_user` - repassam ambos para o service.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (auditoria best-effort): falha ao registrar auditoria nao pode
  impedir a edicao/exclusao do documento - `registrar_auditoria` ja e
  best-effort por design (abre `SessionLocal()` propria).
- NFR-002 (consistencia com o modulo): mesmo padrao de
  modulo="atendimento", entidade="documento_atendimento" usado por outras
  entidades do mesmo modulo (`atendimento_clinico`, `alerta_clinico`,
  `exame`).

## 4) Contratos tecnicos

### API

- `PUT /atendimentos/{atendimento_id}/documentos/{documento_id}`: mesmo
  payload/resposta; `request: Request` agora obrigatorio na assinatura do
  handler (FastAPI injeta automaticamente em toda chamada HTTP real - sem
  impacto em clientes).
- `DELETE /atendimentos/{atendimento_id}/documentos/{documento_id}`: mesma
  coisa.

### Banco/migracoes

Nenhuma alteracao de schema - reusa `AuditoriaEvento`, ja existente.

### Frontend

Nenhuma alteracao necessaria - os endpoints continuam com o mesmo
contrato de request/response.

## 5) Compatibilidade e rollout

- Backward compatibility: total para clientes HTTP (FastAPI injeta
  `Request` automaticamente). Para chamadores DIRETOS das funcoes de
  service em Python (fora de rota HTTP), a assinatura mudou
  (`current_user` passa a ser obrigatorio) - confirmado que nao ha nenhum
  chamador desse tipo na base alem dos proprios endpoints.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (sem auditoria).

## 6) Criterios de aceitacao (CA)

- CA-001: atualizar um documento com mudanca real gera auditoria com
  antes/depois do(s) campo(s) alterado(s).
- CA-002: atualizar um documento SEM mudanca (payload igual ao atual) nao
  gera auditoria.
- CA-003: excluir um documento gera auditoria com o conteudo excluido e o
  usuario responsavel, e o documento realmente deixa de existir no banco.

## 7) Casos de borda

- CB-001: atualizar apenas UM dos 3 campos (ex.: so `corpo`) gera
  auditoria contendo APENAS esse campo em `alteracoes`, nao os 3.
- CB-002: `payload.model_dump(exclude_unset=True)` continua determinando
  quais campos sao considerados "enviados" - um campo omitido no payload
  nunca entra no snapshot de comparacao (comportamento pre-existente,
  inalterado).

## 8) Fora de escopo

- Versionamento completo (restaurar versao anterior).
- Soft-delete de documento.
- Auditoria por documento na exclusao em cascata do atendimento inteiro.
