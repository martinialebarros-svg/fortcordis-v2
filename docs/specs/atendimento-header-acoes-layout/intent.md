# Intent - atendimento-header-acoes-layout

Data: 2026-08-02
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

Revisao visual ao vivo (stage, viewport 1440x900, sessao autenticada) mostrou
que a barra de acoes do cabecalho do Atendimento Clinico (Novo atendimento /
Laudar / Salvar / Finalizar) quebra em ate 3 linhas separadas mesmo em
desktop largo, com espaco vazio visivel ao lado de cada linha - nao e falta
de espaco real, e uma restricao artificial de CSS.

Causa raiz: `.fc-care-header-actions` (`frontend/app/globals.css`) tem
`lg:max-w-xl` (576px), que capa a caixa de acoes bem abaixo do que o
cabecalho realmente tem disponivel a partir de 1024px de largura.

## 2) Objetivo

Deixar a caixa de acoes usar o espaco real disponivel no cabecalho, reduzindo
quantas linhas ela ocupa em telas largas, sem quebrar o empilhamento em
coluna unica ja usado em mobile (`max-width: 639px`).

## 3) Nao objetivos

- Redesenhar o cabecalho ou os botoes em si (cores, icones, textos).
- Mudar o comportamento em mobile (`.fc-care-header-actions > * { width:
  full }` abaixo de 640px), que ja funciona bem.
- Resolver outros achados da mesma revisao visual (badge de documentacao
  incompleta nao confirmado visualmente, etc.) - fora de escopo aqui.

## 4) Contexto e restricoes

- Mudanca isolada em CSS (`app/globals.css`), sem tocar JSX nem logica.
- Verificado visualmente contra o stage real (sessao ja autenticada),
  comparando antes/depois do ajuste.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao abrir qualquer atendimento em tela
  larga (desktop).
- Modulos impactados: apenas a pagina `/atendimento` (classe CSS
  compartilhada, mas usada so nesse cabecalho).
- Risco de regressao: minimo - remove um teto de largura, nao adiciona
  comportamento novo.

## 6) Riscos iniciais

- Risco 1: em telas MUITO largas (ultrawide), a caixa de acoes poderia ficar
  desproporcionalmente larga sem nenhum teto. Mitigado pelo proprio
  `flex-wrap` e pela largura do `.fc-care-header` (que tem seu proprio
  container/max-width da pagina) continuarem limitando o total.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
