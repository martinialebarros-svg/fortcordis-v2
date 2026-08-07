# Spec - atendimento-exame-guard-liberacao-conteudo

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`liberar_exame_no_portal` passa a exigir `attachment_has_download_source`
alem de `_anexo_eh_pdf`. `_sync_exames` passa a proteger
`resultado`/`valor_referencia`/`unidade` (alem de `observacoes`, ja
protegido) contra sobrescrita enquanto o exame estiver liberado no portal.

## 2) Requisitos funcionais (RF)

- RF-001: o guard de `liberar_exame_no_portal` passa a ser
  `_anexo_eh_pdf(anexo) and attachment_has_download_source(anexo)` (ambas
  as condicoes, nao so a primeira).
- RF-002: `attachment_has_download_source` e importado de
  `app.services.attachment_download_service` (ja existente, sem
  modificacao).
- RF-003: dentro de `_sync_exames`, quando `is_portal_released_status(exame.status)`
  (apos a derivacao do status, que preserva a liberacao), os campos
  `resultado`, `valor_referencia`, `unidade` e `observacoes` NAO sao
  atualizados a partir do payload - todos os 4 dentro do mesmo `if not
  is_portal_released_status(...)`.
- RF-004: `exame.valor` (campo de preco/faturamento, nao conteudo clinico)
  continua sendo atualizado incondicionalmente - fora do escopo do achado
  #25, que trata especificamente de conteudo clinico exibido no portal.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): elimina o caminho de liberar um exame no portal
  com um anexo "externo" cujo metadado (mime_type/nome) foi forjado sem
  upload real.
- NFR-002 (integridade): o conteudo que a clinica parceira/tutor ja
  visualizou no portal so muda por acao explicita de revogar + reeditar +
  liberar de novo, nunca por um save/autosave incidental.
- NFR-003 (raio de mudanca minimo): #20 e uma condicao AND adicional em um
  guard existente; #25 e mover 3 linhas para dentro de um bloco `if` que ja
  existia.

## 4) Contratos tecnicos

### API

- `POST /atendimentos/exames/{exame_id}/portal/liberar`: mesma resposta em
  caso de sucesso; o 422 existente ("Anexe o PDF do resultado antes de
  liberar no portal.") agora tambem cobre o caso de anexo com metadado
  falso (mesma mensagem, motivo mais amplo).
- `PUT /atendimentos/{id}` / `POST /atendimentos`: sem mudanca de contrato -
  o comportamento muda apenas quando o exame do payload esta liberado no
  portal (o cliente nao precisa saber disso, so continua enviando o que
  tem).

### Banco/migracoes

Nenhuma alteracao de schema.

### Frontend

Nenhuma alteracao. `AtendimentoExamesSection.tsx` ja nao tinha `disabled`
condicionado a `exameLiberadoNoPortal` nos campos de resultado/observacoes
(achado #25 original notava isso) - a UI continua permitindo a EDICAO
visual, mas o backend agora ignora a mudanca enquanto liberado; o usuario
pode digitar, mas o valor nao persiste ate revogar. Corrigir a UI para
refletir isso (desabilitar visualmente) fica como melhoria futura, fora do
escopo desta correcao de integridade de dado.

## 5) Compatibilidade e rollout

- Backward compatibility: total para #25 (protege dado que nao deveria
  mudar). Para #20, um cliente que dependesse do comportamento antigo
  (liberar com anexo sem download real) passa a receber 422 - comportamento
  antigo era o bug, nao um contrato a preservar.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura os dois
  comportamentos anteriores (com os bugs).

## 6) Criterios de aceitacao (CA)

- CA-001: anexo com metadado de PDF mas sem `caminho_arquivo` real nem URL
  remota valida e bloqueado (422) ao tentar liberar.
- CA-002: anexo com arquivo local real continua permitindo liberar
  normalmente.
- CA-003: anexo cujo `caminho_arquivo` aponta para um arquivo que nao
  existe mais no disco e bloqueado.
- CA-004: autosave/save manual com um exame liberado no portal NAO altera
  `resultado`/`valor_referencia`/`unidade` desse exame, mesmo que o payload
  traga valores diferentes.
- CA-005: exame SEM liberacao no portal continua aceitando edicao normal
  desses mesmos campos.
- CA-006: apos revogar a liberacao, os campos voltam a ser editaveis
  normalmente.

## 7) Casos de borda

- CB-001: exame com MULTIPLOS anexos, apenas um deles com download real -
  o guard de liberacao passa (existe pelo menos um PDF real), comportamento
  inalterado do `any(...)` original.
- CB-002: `exame.valor` (preco) continua mutavel mesmo com exame liberado -
  deliberado, ver RF-004.

## 8) Fora de escopo

- Allowlist de hosts para anexo "externo" na criacao.
- Desabilitar visualmente os campos de resultado/observacoes no frontend
  quando o exame esta liberado.
- Auditoria por campo da mudanca de conteudo (ja existe desde o pacote de
  auditoria).
