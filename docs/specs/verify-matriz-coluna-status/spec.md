# Spec - verify-matriz-coluna-status

Data: 2026-09-16
Responsavel: Martiniano
Status: done

## 1) Objetivo

Deixar toda matriz de aceitacao existente legivel pelo gate de promocao, sem
alterar nenhum resultado registrado, e impedir por CI que o formato volte a
divergir do template.

## 2) Requisitos funcionais (RF)

- RF-001: as matrizes de aceitacao que hoje usam outro cabecalho passam a usar
  `| ID | Tipo | Evidencia | Status |`, o formato do template e o dominante no
  repo (139 das 195 tabelas ja compativeis).
- RF-002: a conversao preserva o conteudo celula a celula -- identificador,
  texto de evidencia e texto de resultado seguem verbatim. `Tipo` e a unica
  coluna nova, derivada do prefixo do ID (`CA` -> `aceitacao`,
  `RF` -> `funcional`, `NFR` -> `nao funcional`).
- RF-003: o texto do resultado NAO e remapeado. Um `pendente` continua
  `pendente`; e o remapeamento que transformaria pendencia em aprovacao.
- RF-004: so sao convertidas tabelas que sao de fato matriz de aceitacao --
  primeira coluna com identificador `CA-`/`RF-`/`NFR-`. Tabelas de cobertura
  (`Teste | CA coberto`), de medicao (`Cenario | Tempo | Plano`), de
  configuracao (`Chave | name | metaId`) e de etapas ficam intactas: dar coluna
  `Status` a elas criaria criterio que nunca existiu.
- RF-005: nada fora das matrizes muda -- prosa, secoes e demais tabelas ficam
  byte a byte iguais.
- RF-006: `scripts/ci/check_verify_matrix_format.py` reprova `verify.md`
  adicionado ou modificado no diff que nao tenha nenhuma tabela com coluna
  `Status`.
- RF-007: o lint olha apenas os `verify.md` do diff, nao o repo inteiro. Assim
  nao reprova PR alheio por spec legada, e o passivo diminui sozinho.
- RF-008: `docs/specs/templates/` e ignorado pelo lint.
- RF-009: o lint reusa o parser de tabela do proprio gate
  (`_celulas`, `_e_separador`, `_normalizar`), importado por caminho. Parser
  proprio seria o jeito mais facil de o lint aprovar arquivo que o gate nao le.
- RF-010: o lint roda em `sdd-guardrail.yml`, que ja dispara em PR para `stage`
  e para `main`. O gate de promocao roda so em PR para `main`, tarde demais
  para corrigir formato de documento.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: a conversao nao pode apagar pendencia. Auditoria automatica compara
  antes (`origin/stage`) e depois por identificador.
- NFR-002: o lint nao depende de rede nem de credencial, como os demais gates.

## 4) Criterios de aceitacao (CA)

- CA-001: as 20 matrizes com cabecalho divergente (19 arquivos) passam a ser
  lidas pelo gate; a contagem de `verify.md` com coluna `Status` sobe de 195
  para 214.
- CA-002: auditoria antes/depois nao acusa divergencia em nenhuma das 127
  linhas de criterio convertidas.
- CA-003: nenhum status pendente vira nao-pendente na conversao.
- CA-004: o texto fora das tabelas fica identico nos 19 arquivos.
- CA-005: as tabelas que nao sao matriz de aceitacao seguem sem coluna `Status`.
- CA-006: o lint reprova `| Criterio | Evidencia | Resultado |` e aprova
  `| ID | Tipo | Evidencia | Status |`.
- CA-007: o lint dispensa diff sem `verify.md` e ignora `docs/specs/templates/`.
- CA-008: o gate de promocao roda sobre esta entrega sem apontar pendencia e
  nomeando as features convertidas como promovidas.
- CA-009: a suite de testes do gate continua verde apos a mudanca.
