# Intent - frontend-typecheck-fila-agendamento

Data: 2026-09-10
Responsavel: Martiniano Barros
Status: done

## 1) Problema atual

`npx tsc --noEmit` falha em `stage` com tres erros TS2322 em
`frontend/app/whatsapp-stage/AppointmentQueue.test.tsx` (linhas 9 e 15):
`Type '{ acao: string; em: string; ... }' is not assignable to type 'never'`.

A fixture `item` do teste declara `historico: []` sem anotacao. O TypeScript
infere `never[]` para esse literal vazio e, como o parametro `itens` de
`response()` tira seu tipo do default `[item]`, todo o array de fixtures fica
preso em `historico: never[]`. Os testes que passam historico real
(`complemento_cliente` com `horario_preferido`/`observacao`) nao compilam.

Os erros entraram com os commits recentes de WhatsApp em stage (6ac515e7,
c532ed45, 31e1bb30). Nenhum workflow de PR roda tsc, lint ou vitest do
frontend, entao o typecheck quebrado chegou em stage sem sinal de CI.

## 2) Objetivo

Restaurar `tsc --noEmit` limpo preservando a intencao dos testes, e amarrar a
fixture ao tipo real do componente para que divergencias futuras entre fixture
e contrato apareçam no typecheck em vez de passarem silenciosamente.

## 3) Nao objetivos

- Alterar comportamento de runtime do componente ou dos testes.
- Enfraquecer a tipagem com `as any`, `as unknown` ou `@ts-expect-error`.
- Redefinir o tipo `Item` duplicando-o no arquivo de teste.
- Implementar o gate de CI de frontend nesta entrega (apenas proposto; ver
  `spec.md`, secao 5).

## 4) Contexto e restricoes

- Restricoes tecnicas: `Item` estava privado em `AppointmentQueue.tsx`; exportar
  tipo de arquivo `"use client"` e seguro (tipos sao apagados na compilacao) e
  ja e idioma do repositorio (`app/atendimento/page.tsx:339`,
  `components/FortinhoMascot.tsx:3`).
- Restricoes de prazo: stage esta com typecheck vermelho; correcao e curta.
- Restricoes regulatorio/operacional: nenhuma. Sem dado de paciente ou tutor.

## 5) Impacto esperado

- Usuarios impactados: nenhum (mudanca de tipagem e teste, sem efeito em runtime).
- Modulos impactados: `frontend/app/whatsapp-stage/AppointmentQueue.tsx`
  (uma palavra-chave `export`) e seu arquivo de teste.
- Risco de regressao: baixo. Nenhuma expressao de runtime foi alterada.

## 6) Riscos iniciais

- Risco 1: anotar a fixture com `Item` revelar outros campos obrigatorios
  faltando. Mitigado: `tsc` limpo confirma que a fixture ja satisfazia o contrato.
- Risco 2: o mesmo padrao `never[]` reaparecer em outras fixtures sem gate de
  CI que rode tsc em PR. Tratado como proposta em `spec.md`, secao 5.

## 7) Perguntas abertas

- Adotar o gate de frontend (tsc + lint + vitest) em PRs para `stage` e `main`?
  Proposta com YAML pronto na descricao do PR; decisao do responsavel.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
