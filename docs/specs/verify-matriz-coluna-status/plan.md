# Plan - verify-matriz-coluna-status

Data: 2026-09-16
Responsavel: Martiniano

## T1 Levantar o passivo

- [x] T1.1 Varrer os 251 `docs/specs/*/verify.md` reusando o parser do proprio
      gate, e nao um regex novo: a pergunta e "o gate le esta tabela?", entao a
      resposta tem que vir do codigo do gate.
- [x] T1.2 Separar o que parece matriz do que nao e. 56 arquivos sem coluna
      `Status` em tabela nenhuma, mas so 19 deles (20 tabelas, 127 linhas) tem
      matriz de aceitacao de verdade; 34 registram verificacao so em prosa e 3
      so tem tabela de cobertura, medicao ou etapas.
- [x] T1.3 Checar se o ponto cego ja esconde pendencia real hoje. Varredura do
      vocabulario de resultado em toda tabela invisivel ao gate: 3 celulas
      casaram com marcador de pendencia, todas as 3 falso positivo da varredura
      (duas em `promocao-bloqueia-criterio-pendente`, que documenta a saida do
      proprio gate; uma em tabela de diagnostico antes/depois de
      `whatsapp-chatbot-atendimento`). Nenhuma pendencia real escondida no
      momento -- o risco e estrutural, nao um incendio em curso.
- [x] T1.4 Conferir o cabecalho dominante antes de escolher o alvo:
      `| ID | Tipo | Evidencia | Status |`, 139 ocorrencias.

## T2 Converter

- [x] T2.1 Conversor que enderaca (arquivo, linha do cabecalho) explicitamente,
      em vez de casar cabecalho por regex no repo todo: a lista de alvos foi
      revisada arquivo a arquivo em T1.2 e nao deve ser reconstruida por
      heuristica na hora de escrever.
- [x] T2.2 Status verbatim, `Tipo` derivada do prefixo do ID. Nenhuma outra
      celula tocada.
- [x] T2.3 Asserts no conversor (3 colunas por linha, ID casa o padrao) para
      falhar alto em vez de escrever tabela torta.

## T3 Auditar a conversao

- [x] T3.1 Comparar `origin/stage` com a arvore por identificador: mesmo
      conjunto de IDs, mesma evidencia, mesmo status.
- [x] T3.2 Assertiva especifica de que nenhum status pendente virou
      nao-pendente.
- [x] T3.3 Comparar as linhas fora de tabela antes e depois.

## T4 Impedir a divergencia futura

- [x] T4.1 `scripts/ci/check_verify_matrix_format.py`, CLI igual a dos gates
      vizinhos (`--base-sha`, `--head-sha`, `--repo-root`).
- [x] T4.2 Escopo no diff, nao no repo. Lista de excecao para as 34 specs em
      prosa envelheceria no repo e ninguem a limparia.
- [x] T4.3 Plugar em `sdd-guardrail.yml` como passo novo, nao em workflow
      proprio: mesmo checkout, mesmo range de diff, e ja roda nos PRs certos.
- [x] T4.4 `backend/tests/test_verify_matrix_format.py`, no padrao
      `sys.modules[SPEC.name]` de `test_promotion_verify_pending.py`.

## Risco residual

O lint garante que existe tabela com coluna `Status`, nao que ela seja a matriz
de aceitacao da feature. Um `verify.md` cujo unico `Status` esteja numa tabela
de etapas passa no lint e segue invisivel para o gate na parte que importa.
Checar isso exigiria julgar qual tabela e a matriz, que e justamente o julgamento
que RF-004 do gate se recusa a fazer.

Os 34 `verify.md` so com prosa continuam fora do alcance do gate ate alguem
encostar neles. Estao listados no `verify.md` desta spec para nao virarem
passivo invisivel.
