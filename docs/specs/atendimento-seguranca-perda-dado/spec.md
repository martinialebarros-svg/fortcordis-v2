# Spec - atendimento-seguranca-perda-dado

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Cinco correcoes independentes de seguranca e perda de dado no modulo de
Atendimento Clinico, escolhidas por prioridade a partir da auditoria
multi-dimensao (`docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`).

## 2) Requisitos funcionais (RF)

### Item A - SSRF + vazamento de token (achado #7 da auditoria)

- RF-A1: `backend/app/services/attachment_download_service.py` passa a
  resolver o hostname de qualquer URL remota (`_hostname_resolves_to_public_address`)
  e rejeitar (`_normalize_remote_url` devolve `None`) quando algum IP
  resolvido for privado, loopback, link-local, multicast, reservado ou
  unspecified.
- RF-A2: nova config `PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS` (string,
  hosts separados por virgula, default vazio); `_build_remote_headers`
  passa a receber a URL e so anexa `PORTAL_REMOTE_STORAGE_AUTH_TOKEN`
  quando o hostname da URL estiver nessa allowlist.
- RF-A3: o cliente HTTP do download remoto (`_build_remote_download_response`)
  passa a usar `follow_redirects=False`; uma resposta 3xx e tratada como
  erro (502), nunca seguida automaticamente.

### Item B - `laudo_id` sem validar propriedade (achado #8)

- RF-B1: em `_sync_exames`, quando `payload.laudo_id` for informado E
  diferente do `laudo_id` ja gravado no exame, o backend so aceita o novo
  valor se existir um `Laudo` com esse id E `paciente_id` igual ao do
  atendimento; caso contrario, mantem o `laudo_id` atual do exame (ignora a
  tentativa de vinculo invalido, sem erro 4xx - e um round-trip do payload,
  nao uma acao explicita do usuario).
- NFR-B1: reenviar o MESMO `laudo_id` ja vinculado (round-trip normal do
  frontend) continua funcionando sem nenhuma query extra ao `Laudo`.

### Item C - Recuperacao de rascunho local sobrescrevendo dados frescos (achado #1)

- RF-C1: em `abrirAtendimento`, ao montar o `candidato` a partir do backup
  local, os campos `especie`, `evolucoes`, `anexos` e `documentos` do
  backup sao descartados antes do merge - o candidato final sempre usa
  esses 4 campos do `hydrated` (servidor), independente do que estiver no
  backup local.
- NFR-C1: os demais campos cobertos por `buildAtendimentoPayload` (queixa,
  anamnese, exame fisico, dados clinicos, triagem, exames, prescricao,
  diagnostico, etc.) continuam podendo vir do backup local, exatamente como
  hoje.

### Item D - Observacoes do exame apagadas ao liberar no portal (achado #2)

- RF-D1: novo campo `Exame.observacoes_pre_portal` (nullable), com
  migration aditiva.
- RF-D2: `liberar_exame_no_portal` grava o valor ATUAL de
  `exame.observacoes` em `exame.observacoes_pre_portal` antes de
  sobrescrever com a mensagem fixa de liberacao.
- RF-D3: `revogar_liberacao_exame_no_portal` restaura
  `exame.observacoes = exame.observacoes_pre_portal or ""` (em vez de
  sempre zerar) quando o valor atual ainda for a mensagem fixa, e limpa
  `observacoes_pre_portal` apos restaurar.

### Item E - Exclusao de anexo sem confirmacao/guard (achado #3)

- RF-E1: frontend (`excluirAnexo`) passa a exigir `window.confirm` antes de
  chamar `DELETE /anexos/{id}`, seguindo o mesmo padrao ja usado por
  `removerExame`.
- RF-E2: backend (`excluir_anexo`) bloqueia (409) a exclusao de um anexo
  PDF quando ele for o UNICO PDF vinculado a um exame com status liberado
  no portal - mesma logica de "motivo de bloqueio" ja usada para a exclusao
  do exame inteiro (`_motivo_bloqueio_exclusao_exame`), aplicada aqui ao
  anexo isolado.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (compatibilidade): nenhuma mudanca de contrato de API existente -
  todas as correcoes sao aditivas ou apertam validacao server-side sem
  mudar o formato de request/response dos endpoints tocados.
- NFR-B (seguranca por padrao): `PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS` vazio
  por default significa que o token NUNCA e enviado a nenhum host ate ser
  explicitamente configurado - falha segura.

## 4) Contratos tecnicos

- Nova migration `20260804_62`: `ALTER TABLE exames ADD COLUMN
  observacoes_pre_portal TEXT` (aditiva, nullable).
- Nova config `PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS` em `Settings`.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - migration aditiva; validacoes novas so
  rejeitam entradas que ja eram invalidas/exploraveis (nenhum uso legitimo
  conhecido depende do comportamento antigo).
- Rollback: reverter o commit por item ou o pacote inteiro; a coluna nova
  fica para tras sem quebrar nada (nao e referenciada por codigo antigo).

## 6) Criterios de aceitacao (CA)

- CA-A1: `POST /anexos` com URL apontando para IP privado/loopback/
  link-local/metadata cloud, seguido de `GET /anexos/{id}/arquivo`, resulta
  em 404 (a URL nunca e considerada uma fonte de download valida).
- CA-A2: o token de storage remoto so e enviado quando o host da URL
  estiver na allowlist configurada; sem allowlist configurada, nunca e
  enviado.
- CA-A3: uma resposta 3xx do storage remoto retorna 502 ao cliente, sem
  seguir o redirect.
- CA-B1: `payload.laudo_id` apontando para um Laudo de outro paciente (ou
  inexistente) e ignorado - o exame mantem o `laudo_id` anterior.
- CA-B2: `payload.laudo_id` apontando para um Laudo do MESMO paciente e
  aceito normalmente.
- CA-C1: registrar uma evolucao clinica e reabrir o mesmo atendimento (com
  um backup local desatualizado presente) preserva a evolucao recem
  registrada na tela.
- CA-D1: liberar um exame com observacoes preenchidas e depois revogar
  restaura o texto original exato.
- CA-E1: excluir o unico PDF de um exame liberado no portal retorna 409 e
  nao remove o anexo; excluir um PDF quando ha outro PDF no mesmo exame, ou
  de um exame nao liberado, funciona normalmente.
- CA-F: `cd backend && ./venv/bin/python -m pytest tests/ -q --no-header`
  aprovado (baseline 579 + 21 testes novos = 600 passed).
- CA-G: `cd frontend && npm run build` aprovado.

## 7) Casos de borda

- CB-A1: hostname que nao resolve (DNS falha) - tratado como invalido, 404.
- CB-B1: exame novo (sem `laudo_id` anterior) recebendo um `laudo_id`
  valido do mesmo paciente - aceito normalmente (mesmo caminho de CA-B2).
- CB-D1: exame liberado no portal ANTES deste pacote (sem
  `observacoes_pre_portal` gravado) - ao revogar, `observacoes_pre_portal`
  e `None`, restaura para string vazia (mesmo comportamento de antes do
  fix, sem erro).
- CB-E1: anexo nao vinculado a nenhum exame (`exame_id is None`) - guard
  nao se aplica, exclusao segue normal.

## 8) Fora de escopo

- Os demais 24 achados da auditoria (ver `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`).
- Cache de resolucao de DNS para a validacao anti-SSRF.
- Revalidacao de host a cada hop de redirect (redirects sao simplesmente
  desabilitados, nao seguidos com revalidacao).
