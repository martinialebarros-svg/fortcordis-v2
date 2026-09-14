# Verify - ci-frontend-gates-sem-paths

Data: 2026-09-14  
Responsavel: Martiniano Barros  
Status: verificado por inspecao; CA-002 e CA-003 se provam no PR desta entrega

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001, RF-002 / CA-001 | tecnico | `yaml.safe_load`: `on.pull_request` e `on.push` ficam com `branches` apenas, sem `paths` | ok |
| RF-003 | tecnico | jobs seguem `tipos-devem-compilar` e `testes-devem-passar`; o diff nao toca os nomes | ok |
| RF-004 | tecnico | o diff remove seis linhas de `paths` e acrescenta comentario; nada mais | ok |
| RT-001 | tecnico | idem | ok |
| RT-002 | tecnico | cabecalho do workflow explica a ausencia do filtro | ok |
| CA-002, CA-003 | aceitacao | os dois checks no PR desta entrega | ver secao 3 |

## 2) O que exatamente mudou

```yaml
 on:
   pull_request:
     branches: [stage, main]
-    paths:
-      - "frontend/**"
-      - ".github/workflows/frontend-ci.yml"
   push:
     branches: [stage, main]
-    paths:
-      - "frontend/**"
-      - ".github/workflows/frontend-ci.yml"
```

Mais o comentario de cabecalho registrando o porque.

## 3) A prova esta neste PR

O diff desta entrega toca `.github/` e `docs/` -- **nao toca `frontend/`**.

Com o filtro antigo, o workflow ainda rodaria, porque o proprio arquivo dele
estava listado nos `paths`. Sem o filtro, ele roda por nao haver condicao
nenhuma. As duas situacoes dariam check verde aqui, entao **este PR sozinho nao
distingue** as duas versoes.

A distincao aparece no primeiro PR seguinte que mexer so em `docs/`: com o
filtro, os checks nao apareceriam; sem ele, aparecem. E exatamente o caso que
travaria se fossem obrigatorios.

Registrado assim, e nao como "provado", porque a evidencia deste PR e mais fraca
do que parece a primeira vista.

## 4) Por que o filtro existia, e por que sai

Ele foi posto para poupar CI em PR so de documentacao, e o repo produz muitos --
dez so entre 13 e 14 de setembro. Enquanto os checks eram informativos, a
economia era gratuita.

Vira problema no instante em que forem marcados como obrigatorios: check
obrigatorio que nao roda deixa o PR em *"Expected -- waiting for status to be
reported"*, sem erro e sem vermelho. O PR simplesmente nao fecha.

Custo de tirar, medido nos runs de hoje: `tipos-devem-compilar` entre 35s e 41s,
`testes-devem-passar` entre 48s e 59s, em paralelo -- cerca de 1 min por PR.

## 5) Nao coberto aqui

Marcar os checks como obrigatorios exige admin do repositorio e e acao na
interface do GitHub. Este diff so torna isso **seguro**; nao faz.

Fica o alerta para quem for montar a ruleset: `base-deve-ser-promocao` e
`criterios-devem-estar-fechados` rodam so em PR para `main`. Marcados como
obrigatorios numa ruleset que cubra `stage`, travariam todo PR de feature pelo
mesmo mecanismo. O jeito certo e uma ruleset por branch.
