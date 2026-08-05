# Verify - atendimento-seguranca-perda-dado

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-A1 | aceitacao | `test_attachment_download_service_ssrf.py` (11 testes): IP privado/loopback/link-local/multicast/reservado/CGNAT literal e hostname que resolve para essas faixas sao rejeitados. | ok |
| CA-A2 | aceitacao | `test_build_remote_headers_*` (3 testes): token so enviado a host na allowlist; sem allowlist, nunca enviado. | ok |
| CA-A3 | aceitacao | `follow_redirects=False` + checagem de `is_redirect` antes de `raise_for_status`. Confirmado por leitura de codigo (revisao adversarial); sem teste de integracao dedicado (gap de cobertura documentado, secao 5). | ok (leitura de codigo) |
| CA-B1 | aceitacao | `test_atendimento_exame_laudo_id_propriedade.py` + `test_laudos_exame_laudo_id_propriedade.py` (8 testes no total): laudo_id de outro paciente ou inexistente e ignorado, tanto em `_sync_exames` quanto nos endpoints crus de `laudos.py` (gap encontrado na revisao, corrigido - secao 4). | ok |
| CA-B2 | aceitacao | Mesmos arquivos: laudo_id do mesmo paciente e aceito, em ambos os caminhos. | ok |
| CA-C1 | aceitacao | Correcao em `abrirAtendimento` (especie/evolucoes/anexos/documentos excluidos do backup local antes do merge). Confirmado por leitura de codigo linha a linha (revisao adversarial) - sem test runner de frontend. | ok (leitura de codigo) |
| CA-D1 | aceitacao | `test_atendimento_observacoes_portal_preservadas.py` (4 testes, 2 novos desta rodada): liberar+revogar isolado preserva o texto; autosave NO MEIO do ciclo tambem preserva (gap encontrado na revisao, corrigido); liberar duas vezes seguidas tambem preserva (gap encontrado, corrigido). | ok |
| CA-E1 | aceitacao | `test_atendimento_exclusao_anexo_guard.py` (3 testes) + `test_atendimento_delete_guard.py` (6 testes, 1 novo): exclusao do anexo isolado bloqueada; exclusao do ATENDIMENTO INTEIRO tambem bloqueada quando tem exame liberado no portal (gap encontrado na revisao, corrigido - secao 4). | ok |
| CA-F | aceitacao | `cd backend && ./venv/bin/python -m pytest tests/ -q --no-header` -> **608 passed** (baseline 579 + 29 testes novos). | ok |
| CA-G | aceitacao | `cd frontend && npm run build` -> compilado com sucesso. | ok |

## 2) Testes automatizados executados

```bash
cd backend && ./venv/bin/python -m pytest tests/ -q --no-header
# 608 passed, 25 warnings, 27 subtests passed

cd frontend && npm run build
# Compiled successfully
```

Testes novos (29 casos, 6 arquivos + 1 migration):
- `test_attachment_download_service_ssrf.py` (11) - item A, incluindo CGNAT e timeout de DNS (adicionados na revisao).
- `test_atendimento_exame_laudo_id_propriedade.py` (4) - item B, caminho `_sync_exames`.
- `test_laudos_exame_laudo_id_propriedade.py` (4, novo) - item B, caminho `laudos.py` (gap encontrado na revisao).
- `test_atendimento_observacoes_portal_preservadas.py` (4, 2 novos) - item D, incluindo autosave no meio do ciclo e liberar duplicado.
- `test_atendimento_exclusao_anexo_guard.py` (3) - item E, guard do anexo isolado.
- `test_atendimento_delete_guard.py` (6, 1 novo) - item E, guard do atendimento inteiro com exame liberado.
- `test_exame_observacoes_pre_portal_migration.py` (2) - migration `20260804_63`.

## 3) Testes manuais

Sem test runner de frontend. Item C (rascunho local) e a parte visual do item E
(confirm no frontend antes de excluir anexo) dependem de verificacao manual -
mesma limitacao de ambiente do Browser tool dos pacotes anteriores nesta
sessao. Roteiro planejado:

1. Registrar uma evolucao clinica logo apos digitar um campo (antes do
   autosave remoto disparar) - a evolucao deve permanecer visivel ao reabrir
   o atendimento.
2. Liberar um exame no portal com observacoes preenchidas, editar outro campo
   do atendimento (disparando autosave), depois revogar - o texto original
   das observacoes deve ser restaurado.
3. Tentar excluir o unico PDF de um exame liberado no portal - deve pedir
   confirmacao explicita e ser bloqueado no backend se a confirmacao for
   ignorada.

## 4) Revisao adversarial

Workflow com 5 revisores independentes (um por item), interrompido duas
vezes por limite de sessao e retomado (cache preservou os itens ja
concluidos). Resultado final, apos as correcoes desta secao:

| Item | Veredito inicial | Achado real | Resolucao |
| --- | --- | --- | --- |
| A (SSRF) | correto_com_ressalvas | Faixa CGNAT (100.64.0.0/10, ex.: metadata da Alibaba Cloud) classificada como publica pela combinacao manual de flags. | Corrigido: `_is_public_address` agora usa `ip.is_global` (mais abrangente) + `not ip.is_multicast` (que `is_global` sozinho nao cobre). |
| A (SSRF) | correto_com_ressalvas | Resolucao de DNS sincrona e SEM TIMEOUT em `_hostname_resolves_to_public_address`, chamada em 3 endpoints de listagem do portal para todo anexo com URL externa - vetor real de DoS (host com DNS deliberadamente lento trava uma thread do pool). | Corrigido: resolucao movida para uma `ThreadPoolExecutor` de 1 worker com timeout de 2s (`DNS_RESOLUTION_TIMEOUT_SECONDS`); NAO usa `socket.setdefaulttimeout` (seria global/process-wide e afetaria outras threads concorrentes). |
| A (SSRF) | (residual, nao corrigido) | Mitigacao de DNS rebinding e parcial: valida host->IP uma vez, mas o httpx faz uma resolucao SEPARADA no connect (TOCTOU classico, sem pinning do IP validado). | Documentado como risco residual (secao 5) - fixar exigiria um transport HTTP customizado com resolver proprio, mudanca mais invasiva; exige DNS proprio do atacante com timing preciso, fora do escopo deste pacote. |
| A (SSRF) | (residual, nao corrigido) | Nenhum teste exercita o caminho de rejeicao de redirect (3xx -> 502) - so a leitura de codigo confirma. | Documentado como gap de cobertura (secao 5) - a logica esta correta, mas uma regressao futura nao seria pega por teste. |
| B (laudo_id) | correto_com_ressalvas | Endpoints crus `POST /api/v1/exames` e `PUT /api/v1/exames/{id}` em `laudos.py` aceitam dict arbitrario e gravam `laudo_id` sem NENHUMA validacao de propriedade - contornam totalmente a correcao feita em `_sync_exames`. | Corrigido: mesma validacao (laudo precisa pertencer ao `paciente_id` do exame) aplicada nos dois endpoints. |
| C (rascunho local) | correto | Nenhum problema real - so uma observacao de baixa severidade (subcampo `anexos_resultado` dentro de `form.exames` nao esta na lista de exclusao, mas nao e enviado ao backend em nenhum payload, entao nao ha perda de dado real, so um contador cosmetico que pode ficar desatualizado). | Sem alteracao - documentado, nao bloqueante. |
| D (observacoes) | **incorreto** | Um autosave/save QUALQUER entre liberar e revogar sobrescrevia `exame.observacoes` incondicionalmente (a mesma protecao que ja existe para `status` nao existia para `observacoes`), perdendo o texto original definitivamente sem erro. | Corrigido: `_sync_exames` agora so escreve `observacoes` a partir do payload quando `not is_portal_released_status(exame.status)`. |
| D (observacoes) | **incorreto** | `liberar_exame_no_portal` nao era idempotente - chamar duas vezes seguidas (duplo clique, retry) sobrescrevia `observacoes_pre_portal` com a propria mensagem fixa, perdendo o texto original. | Corrigido: guard de idempotencia no inicio da funcao - se ja liberado, retorna o estado atual sem reprocessar. |
| E (exclusao anexo) | correto_com_ressalvas | `DELETE /atendimento/{id}` (exclusao do atendimento inteiro) apagava exames e anexos sem NENHUMA checagem de `is_portal_released_status`, contornando por completo o guard 409 recem-adicionado em `excluir_anexo`. | Corrigido: `excluir_atendimento` agora tambem exige confirmacao explicita quando o atendimento tem exame(s) liberado(s) no portal, alem do caso ja existente de status Concluido. |

## 5) Regressao e riscos residuais

- Suite completa (608 testes) sem nenhuma falha - nenhum dos itens ja
  corrigidos nos pacotes `atendimento-integridade-prontuario`,
  `atendimento-persistencia-e-fluidez` foi reaberto.
- Risco residual conhecido, nao corrigido (documentado, nao bloqueante):
  mitigacao de DNS rebinding e parcial (TOCTOU entre validacao e conexao
  real) - exigiria um transport HTTP customizado com IP pinning, fora de
  escopo deste pacote.
- Risco residual conhecido, nao corrigido: sem teste de integracao para o
  caminho de rejeicao de redirect (3xx -> 502) - a logica esta correta pela
  leitura de codigo, mas uma regressao futura nao seria detectada
  automaticamente.
- Risco residual conhecido, nao corrigido: dado legado - um `Exame.laudo_id`
  ja gravado incorretamente ANTES deste pacote (via os dois caminhos agora
  corrigidos) nao e limpo/sanitizado retroativamente; a correcao e so
  preventiva daqui para frente.
- Nenhuma migration destrutiva - a nova coluna `observacoes_pre_portal` e
  aditiva (`ADD COLUMN`).

## 6) Itens fora de escopo entregues

- Nenhum item alem dos 5 do pacote original e dos gaps encontrados pela
  propria revisao adversarial desses mesmos 5 itens (documentados na
  secao 4). Os demais 24 achados da auditoria permanecem para pacotes
  futuros - ver `docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md`.

## 7) Decisao de release

- [x] Aprovado para stage - `3690182e`, deploy-stage concluido com sucesso
  (quality-gate + sdd-guardrail + deploy-stage). Colisao de versao de
  migration com `origin/stage` (outro pacote concorrente tambem usou
  `20260804_62`) detectada e corrigida antes do push (renumerada para 63).
- [ ] Aprovado para producao.
