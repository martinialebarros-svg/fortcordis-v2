# Spec - atendimento-feedback-erros-frontend

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`carregarCadastroComplementar` e `carregarFrasesClinicas` ganham
tratamento de erro (`catch` + `setErro`). `abrirAnexo` troca o extrator
sincrono de erro pelo assincrono no caminho de blob. `uploadArquivosResultadoExame`
passa a contar e avisar quantos arquivos do lote nao chegaram a ser
tentados apos uma falha no meio.

## 2) Requisitos funcionais (RF)

- RF-001: `carregarCadastroComplementar` ganha um `catch (e: any)` no
  nivel externo (ao redor da chamada principal `api.get('/pacientes/${id}')`
  e do processamento subsequente), chamando
  `setErro(extractApiErrorMessageSync(e, "Nao foi possivel carregar o cadastro complementar."))`
  - apenas quando o `requestId` capturado no inicio da chamada ainda for o
  atual (mesmo guard de staleness ja usado no `then`/`finally`).
- RF-002: `carregarFrasesClinicas` ganha `try { ... } catch (e: any) { setErro(...) }`
  em torno da chamada `api.get(...)`, mesmo padrao de
  `carregarMedicamentosBanco`.
- RF-003: no catch de `abrirAnexo` (ramo `anexo.download_url`, resposta
  blob), `extractApiErrorMessageSync` e substituido por
  `await extractApiErrorMessage(e, "Erro ao abrir anexo.")`.
- RF-004: `uploadArquivosResultadoExame` conta `enviados` (incrementado a
  cada `uploadAnexoArquivo` retornando `true`); apos o loop, calcula
  `naoTentados = arquivosValidos.length - enviados - 1` (o `-1` exclui o
  proprio arquivo que falhou, que ja tem sua mensagem especifica); se
  `naoTentados > 0`, adiciona ao `erro` atual (via `setErro` com updater
  funcional) uma nota `"(N de M arquivo(s) do lote nao chegaram a ser enviados.)"`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (nao regressao de sucesso): nenhum caminho de sucesso
  (`setSucesso`, `mergeUploadedAnexo`, `aplicarCadastroComplementar`,
  `setClinicalPhrases`) e alterado - apenas os caminhos de erro/aviso
  agregado.
- NFR-002 (consistencia de padrao): as 4 correcoes reusam padroes ja
  presentes no mesmo arquivo (`extractApiErrorMessageSync`/
  `extractApiErrorMessage`/`setErro`), sem introduzir mecanismo novo.

## 4) Contratos tecnicos

### API

Sem mudanca - as 4 correcoes sao inteiramente do lado do cliente
(interpretacao de erros ja retornados pela API existente).

### Banco/migracoes

Nao aplicavel.

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx` (funcoes internas).
- Estados de UI: nenhum estado novo - reusa `erro`/`setErro` (`useState<string>`
  ja existente) em todos os 4 casos.
- Regras de exibicao/erro: `erro` passa a ser preenchido em 2 caminhos que
  antes falhavam silenciosamente (#26, #27); a MENSAGEM de erro de anexo
  passa a ser a real, nao a generica do axios (#28); a mensagem de erro de
  upload de lote passa a incluir uma nota agregada quando aplicavel (#29).

## 5) Compatibilidade e rollout

- Backward compatibility: total.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura os 4 comportamentos
  anteriores (silenciosos/imprecisos).

## 6) Criterios de aceitacao (CA)

- CA-001: falha em `carregarCadastroComplementar` (ex.: 500/timeout)
  resulta em `erro` preenchido com mensagem legivel, nao em unhandled
  rejection.
- CA-002: falha em `carregarFrasesClinicas` resulta em `erro` preenchido.
- CA-003: falha ao abrir um anexo (blob) exibe o `detail` real do backend,
  nao a mensagem tecnica generica do axios.
- CA-004: lote de 5 arquivos onde o 2o falha resulta em `erro` contendo a
  mensagem especifica da falha MAIS uma nota "(3 de 5 arquivo(s)...)".
- CA-005: lote onde TODOS os arquivos sao enviados com sucesso nao gera
  nenhuma nota agregada.

## 7) Casos de borda

- CB-001 (#26): requestId obsoleto (usuario ja trocou de paciente de novo
  antes da rejeicao chegar) nao aplica o `setErro` - mesmo guard de
  staleness que ja protege o caminho de sucesso.
- CB-002 (#29): lote de 1 arquivo que falha imediatamente nao gera nota
  agregada (`naoTentados = 1 - 0 - 1 = 0`, nao dispara) - a mensagem
  especifica da falha já é suficiente quando so havia 1 arquivo.

## 8) Fora de escopo

- Handler global de `unhandledrejection`.
- Retry automatico de upload.
