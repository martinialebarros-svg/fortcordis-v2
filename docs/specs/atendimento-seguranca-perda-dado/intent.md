# Intent - atendimento-seguranca-perda-dado

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

Uma auditoria multi-dimensao do modulo de Atendimento Clinico (workflow com
7 investigadores independentes + verificacao adversarial de cada achado,
documentada em `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`) encontrou
29 achados confirmados. Este pacote cobre os 5 de maior risco imediato
(seguranca + perda de dado irreversivel), escolhidos com o usuario entre as
opcoes de priorizacao apresentadas:

1. **SSRF + vazamento de token via URL livre em anexo "externo"** -
   `POST /{atendimento_id}/anexos` aceita qualquer `url` sem validacao; o
   download (`GET /anexos/{id}/arquivo`) faz um GET server-side para essa
   URL com `PORTAL_REMOTE_STORAGE_AUTH_TOKEN` anexado, sem checar se o host
   e privado/interno nem se e o storage legitimo. Um usuario autenticado
   pode apontar para `169.254.169.254` (metadata cloud) ou para um servidor
   proprio e vazar o token de storage.
2. **`Exame.laudo_id` aceito sem validar propriedade** - `_sync_exames`
   grava `payload.laudo_id` no exame sem checar se o Laudo existe ou
   pertence ao mesmo paciente, permitindo que um exame do Paciente A seja
   exposto no portal via o status de liberacao de um laudo do Paciente B
   (vazamento de dado clinico confidencial entre pacientes/clinicas).
3. **Recuperacao de rascunho local sobrescreve evolucoes/anexos/documentos
   frescos** - ao reabrir um atendimento, se existir um backup local
   (localStorage) diferente do servidor, o codigo substitui o form INTEIRO
   pelo backup, incluindo campos (`evolucoes`, `anexos`, `documentos`,
   `especie`) que nao fazem parte da comparacao de diferenca nem do payload
   de save - uma evolucao/anexo registrado entre o ultimo autosave e a
   reabertura pode "desaparecer" da tela (ainda existe no banco, mas some da
   UI) e ser revertido no proximo autosave.
4. **Liberar exame no portal apaga permanentemente as observacoes** -
   `liberar_exame_no_portal` sobrescreve `exame.observacoes` com uma
   mensagem fixa, sem guardar o texto original; `revogar_liberacao_exame_no_portal`
   so zera o campo, nunca restaura o texto clinico que o veterinario tinha
   escrito.
5. **Exclusao de anexo individual sem confirmacao nem guard** -
   `DELETE /anexos/{id}` remove o unico PDF que sustenta um exame liberado
   no portal, sem confirmacao no frontend e sem nenhum guard de consistencia
   (ao contrario da exclusao do exame inteiro, que ja bloqueia nesse caso).

## 2) Objetivo

Fechar os 5 riscos acima sem alterar contratos ja homologados (finalizacao
transacional, guardas ja existentes dos pacotes anteriores desta serie).

## 3) Nao objetivos

- Os demais 24 achados da auditoria (raca conditions residuais, auditoria
  ausente em alertas/documentos/exames, consistencia Laudo↔Exame↔Portal,
  performance, tratamento de erros) ficam para pacotes seguintes - ver
  `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`.
- Nao criar allowlist populada de hosts de storage confiavel (a variavel
  `PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS` fica com default vazio - configurar
  o host real de producao, se houver, e uma decisao operacional separada,
  fora do escopo deste pacote de codigo).
- Nao mudar o formato/endpoint de `/historico` do paciente.

## 4) Contexto e restricoes

- Trabalho em worktree isolado (`atendimento-seguranca-perda-dado`, baseado
  em `origin/stage` apos os pacotes `atendimento-integridade-prontuario`,
  `atendimento-persistencia-e-fluidez`, `atendimento-herdar-dados-anteriores`
  e um fix nao relacionado de imagens Vivid IQ).
- Migrations novas entram apos a `20260804_61` (mg/kg), assinatura
  `upgrade(connection, dialect)`.
- A allowlist de hosts confiaveis para o token de storage remoto e nova
  (`PORTAL_REMOTE_STORAGE_TRUSTED_HOSTS`, default vazio) - por padrao, NENHUM
  host recebe o token ate ser explicitamente configurado, o que e o
  comportamento mais seguro possivel (nunca vazar por omissao).

## 5) Impacto esperado

- Usuarios impactados: qualquer usuario do modulo de Atendimento (todos os
  5 itens tocam fluxos de uso comum: reabrir atendimento, liberar exame no
  portal, excluir anexo, salvar exame com laudo vinculado, anexar link
  externo).
- Modulos impactados: `frontend/app/atendimento/page.tsx`,
  `backend/app/api/v1/endpoints/atendimento.py`,
  `backend/app/services/attachment_download_service.py`,
  `backend/app/core/config.py`, `backend/app/models/laudo.py`, nova
  migration.
- Risco de regressao: baixo a moderado - a validacao anti-SSRF (resolucao de
  DNS) so afeta anexos com `origem="externo"` (URL livre), nao anexos
  enviados por upload (que usam `caminho_arquivo`, resolvido antes e sem
  tocar rede).

## 6) Riscos iniciais

- Risco 1: a validacao de host publico (resolucao de DNS + checagem de
  faixa de IP) adiciona uma chamada de rede sincrona (`socket.getaddrinfo`)
  no caminho de `resolve_attachment_download_source`, tambem usada em
  listagens do portal (`attachment_has_download_source`) - custo aceito
  deliberadamente (unico para anexos com URL externa, nao para uploads
  locais) dado o ganho de seguranca; sem cache implementado neste pacote.
- Risco 2: desabilitar `follow_redirects` no cliente HTTP do download quebra
  qualquer host de storage legitimo que dependa de redirecionamento (ex.:
  URLs assinadas de alguns provedores) - nenhum uso real de redirecionamento
  foi identificado hoje; se necessario, endereçar em pacote futuro com
  revalidacao por hop.
- Risco 3: a correcao do `laudo_id` e defensiva (backend nunca aceita um
  vinculo invalido), mas nao investiga/limpa vinculos JA gravados
  incorretamente em producao antes deste pacote - avaliar separadamente se
  necessario (fora de escopo aqui, mudanca e so preventiva).

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros (5 itens, cada um com evidencia da
  auditoria e re-confirmado por leitura direta do codigo atual).
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
