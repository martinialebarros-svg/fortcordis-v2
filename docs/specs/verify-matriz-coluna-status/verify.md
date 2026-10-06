# Verify - verify-matriz-coluna-status

Data: 2026-09-16
Responsavel: Martiniano
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | varredura com o parser do gate: `verify.md` com coluna `Status` sobe de 195 para 214 (secao 3.1); 20 matrizes em 19 arquivos convertidas | ok |
| CA-002 | aceitacao | auditoria antes/depois por identificador nas 127 linhas: `19 arquivos auditados, 0 divergencia(s)` (secao 3.2) | ok |
| CA-003 | aceitacao | a mesma auditoria falha explicitamente se `status_e_pendente(antes)` e nao `status_e_pendente(depois)`; nenhum caso. O corpus convertido nao tinha pendencia: os 127 resultados eram `passou` (116), `ok` (4) e variantes de `passou (revisao de codigo)` | ok |
| CA-004 | aceitacao | a auditoria compara as linhas que nao comecam com `\|` antes e depois: identicas nos 19 arquivos | ok |
| CA-005 | aceitacao | `Teste \| CA coberto`, `Cenario \| Tempo \| Plano`, `Chave \| name \| metaId`, `Verificacao \| Resultado` e `etapa \| resultado` seguem sem coluna `Status` (secao 3.3) | ok |
| CA-006 | aceitacao | `test_cabecalho_legado_nao_e_legivel`, `test_cabecalho_canonico_e_legivel`, `test_status_acentuado_ou_maiusculo_ainda_e_legivel` | ok |
| CA-007 | aceitacao | `test_diff_sem_verify_dispensa_o_lint`, `test_so_olha_verify_de_spec` (cobre `docs/specs/templates/`) | ok |
| CA-008 | aceitacao | gate rodado sobre esta entrega, secao 3.4 | ok |
| CA-009 | aceitacao | `python3 -m pytest backend/tests/test_verify_matrix_format.py backend/tests/test_promotion_verify_pending.py` -> 20 passed | ok |
| RF-009 | funcional | `check_verify_matrix_format.py` importa o gate por caminho e usa `GATE._celulas`, `GATE._e_separador`, `GATE._normalizar`; nao ha parser proprio | ok |
| RF-010 | funcional | passo `Verificar formato da matriz do verify.md` em `.github/workflows/sdd-guardrail.yml`, que roda em PR para `stage` e para `main` | ok |
| NFR-001 | nao funcional | auditoria automatica antes/depois, nao revisao visual (secao 3.2) | ok |
| NFR-002 | nao funcional | o lint usa apenas `git diff` e leitura de arquivo | ok |

## 2) Testes automatizados executados

```bash
python3 -m pytest backend/tests/test_verify_matrix_format.py \
                  backend/tests/test_promotion_verify_pending.py -q
```

Resultado: `20 passed`.

Os testes do gate de promocao foram rodados junto de proposito: o lint novo
importa o gate, entao uma mudanca no parser quebraria os dois.

## 3) Evidencias

### 3.1 Levantamento

Varredura dos 251 `docs/specs/*/verify.md` com o parser do proprio gate:

| Grupo | Antes | Depois |
| --- | --- | --- |
| Com tabela de coluna `Status` | 195 | 214 |
| Sem coluna `Status` em tabela nenhuma | 56 | 37 |

Os 56 se dividiam em:

- 19 arquivos (20 tabelas, 127 linhas) com matriz de aceitacao de verdade --
  convertidos aqui. Cabecalhos de origem: `Criterio \| Evidencia \| Resultado`
  (17 tabelas), `ID \| Evidencia \| Estado`, `Requisitos \| Evidencia \|
  Resultado` e `Criterio \| Evidencia executada \| Resultado`;
- 34 arquivos que registram verificacao so em prosa, sem tabela nenhuma;
- 3 arquivos cujas unicas tabelas nao sao matriz de aceitacao
  (`agenda-excecao-deslocamento-persistente`,
  `laudos-pending-queue-index-performance`,
  `whatsapp-express-5-compatibilidade`).

Varredura do vocabulario de resultado em toda tabela invisivel ao gate, para
saber se o ponto cego ja escondia pendencia real: 3 celulas casaram com
marcador, todas falso positivo da varredura -- duas em
`promocao-bloqueia-criterio-pendente/verify.md`, que documenta a saida do
proprio gate (`FAILED`, aponta ... `pendente`), e uma em tabela de diagnostico
antes/depois de `whatsapp-chatbot-atendimento/verify.md`. Nenhuma pendencia
real estava escondida no momento da conversao: o risco corrigido e estrutural.

### 3.2 Auditoria da conversao

Comparacao `origin/stage` x arvore, por identificador, exigindo mesmo conjunto
de IDs, mesma evidencia, mesmo status, e nenhuma linha fora de tabela alterada:

```
19 arquivos auditados, 0 divergencia(s).
```

`git diff --stat`: `19 files changed, 167 insertions(+), 167 deletions(-)` --
simetrico, como esperado de uma conversao que nao adiciona nem remove linha.

### 3.3 Tabelas deixadas de fora

Continuam sem coluna `Status`, de proposito (RF-004): dar `Status` a elas
criaria criterio de aceitacao que nunca existiu.

| Arquivo | Tabela | Por que nao e matriz |
| --- | --- | --- |
| `agenda-excecao-deslocamento-persistente` | `Teste \| CA coberto` | mapa de cobertura teste -> CA; nao tem coluna de resultado |
| `laudos-pending-queue-index-performance` | `Cenario \| Tempo de execucao \| Plano de laudos` | medicao de benchmark |
| `whatsapp-express-5-compatibilidade` | `Verificacao \| Resultado` | lista de comandos executados, sem identificador de criterio |
| `whatsapp-portal-clinic-invite-template` | `Chave \| name \| metaId` | configuracao de template da Meta |
| `whatsapp-portal-clinic-invite-template` | `etapa \| resultado` | checklist de ambiente de stage |

### 3.4 Gate de promocao sobre esta entrega

Rodado sobre esta entrega (`--base-sha origin/main --head-sha HEAD`):

```
[promotion-verify] features promovidas: agenda-formalizacao-portal-clinicas,
  agenda-reserva-expirada-reabilitacao, agenda-reserva-formalizacao-dados-pendentes,
  laudo-whatsapp-liberacao-status, perf18-authenticated-latency-gate,
  verify-matriz-coluna-status, whatsapp-acesso-midia-recebida, [...]
[promotion-verify] 20 feature(s) no diff, nenhum criterio pendente.
[promotion-verify] PASSED
```

`PASSED` aqui nao prova nada sozinho: e exatamente a frase que o gate imprimia
quando nao conseguia ler a tabela. A prova e o A/B abaixo, com o MESMO criterio
marcado `pendente` nos dois formatos, em `perf18-authenticated-latency-gate`.

**A -- formato antigo** (`| ID | Evidencia | Estado |`, como estava em `stage`),
linha `| CA-001 | ... | pendente |`:

```
[promotion-verify] 20 feature(s) no diff, nenhum criterio pendente.
[promotion-verify] PASSED
```

**B -- formato convertido** (`| ID | Tipo | Evidencia | Status |`), mesmo
criterio, mesma palavra:

```
[promotion-verify] criterios pendentes:
    - CA-001: pendente
[promotion-verify] 1 criterio(s) de aceitacao ainda pendente(s) nas features promovidas.
[promotion-verify] FAILED
```

Mesma pendencia, mesmo gate, mesmo commit base: o que mudou foi so o cabecalho.

### 3.5 Lint sobre o diff deste PR

```
[verify-matrix] 20 verify.md no diff, todos com matriz legivel pelo gate.
[verify-matrix] PASSED
```

E o caso que ele existe para pegar -- spec nova com cabecalho legado e um
criterio `pendente`:

```
[verify-matrix] sem coluna `Status`:
  docs/specs/feature-nova-fake/verify.md
[verify-matrix] 1 verify.md sem tabela com coluna `Status`.
[verify-matrix] FAILED
```

No mesmo commit, o gate de promocao sobre essa spec nova respondia
`21 feature(s) no diff, nenhum criterio pendente. PASSED` -- cego para o
`pendente` dela. O lint reprova antes, no PR para `stage`.

## 4) Regressao e riscos residuais

- O lint garante que existe tabela com coluna `Status`, nao que ela seja a
  matriz da feature. Um `verify.md` cujo unico `Status` esteja numa tabela de
  etapas passa no lint. Distinguir exigiria julgar qual tabela e a matriz --
  o julgamento que RF-004 do gate se recusa a fazer.
- Os 34 `verify.md` so com prosa seguem invisiveis para o gate ate alguem
  encostar neles, quando o lint passa a exigir o formato canonico. Estao
  listados na secao 5 para nao virarem passivo invisivel.
- A conversao preservou `revisao de codigo` como status de uma linha de
  `whatsapp-produtividade-equipe`. O gate nao o trata como pendencia, e correto
  -- e um resultado registrado, nao um criterio aberto --, mas vale saber que
  agora ele esta visivel ao gate, onde antes a tabela inteira nao estava.

## 5) Specs que seguem sem matriz (passivo conhecido)

Registram verificacao so em prosa. Nao foram convertidas porque inventar `ID`,
`Evidencia` e `Status` a partir de texto corrido produziria status que ninguem
verificou. Entram no formato canonico quando alguem encostar nelas -- o lint
passa a exigir.

`agenda-admin-alteracao-servico-hoje`, `agenda-cliente-link-pet-tutor`,
`agenda-financial-summary-query-performance`, `agenda-modal-catalogo-racas`,
`agenda-performance-quality-for47`, `agenda-secretaria-exclusao`,
`agenda-waze-manual-pin`, `agenda-whatsapp-ultimo-usado`,
`arch-be-01-modularizar-atendimento-for37`,
`atendimento-exames-agrupar-categoria`, `atendimento-prescricao-editar-busca`,
`atendimento-prescricao-reordenar-duplicar`,
`atendimento-secondary-library-loading-phase2`,
`database-background-worker-isolation`, `database-connection-pool-performance`,
`eco-study-import`, `laudos-fila-query-pagination-performance`,
`nginx-http2-performance`, `ops-01-scheduler-lock-distribuido-for33`,
`ops-02-idempotencia-jobs-for32`, `rel-01-teste-carga-focado-for41`,
`rel-02-regressao-seguranca-for42`, `rel-03-runbooks-operacionais-for44`,
`rel-04-plano-proximo-ciclo-for43`, `runtime-latency-persistence-performance`,
`vps-ingress-diagnostics`, `whatsapp-continuidade-atendimento`,
`whatsapp-opcoes-agenda`, `whatsapp-retornos-programados`,
`whatsapp-stage-auth-acl-preflight`, `whatsapp-stage-delivery-status-refresh`,
`wpp-01-retencao-eventos-for34`, `wpp-02-auth-ambiente-for35`,
`wpp-03-redacao-logs-for36`.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
