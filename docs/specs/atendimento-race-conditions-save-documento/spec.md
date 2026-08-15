# Spec - atendimento-race-conditions-save-documento

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

O branch manual de `executarSaveAtendimento` passa a mesclar a resposta do
servidor com o estado atual do formulario (mesmo mecanismo do autosave).
`salvarDocumentoClinico` e `criarDocumentoClinicoDeTemplate` passam a ter um
guard sincrono (`useRef`) que bloqueia reentrancia antes de qualquer `await`.

## 2) Requisitos funcionais (RF)

- RF-001: apos o `await api.put/post` no branch `mode === "manual"`, o
  formulario e atualizado via `setForm((current) => mergeAutoSavedFormState({...current, exames: ...}, hydrated))`,
  removendo exames marcados `_destroy` e garantindo pelo menos um exame
  vazio - identico ao pos-processamento que o branch de autosave ja faz.
- RF-002: `hydratingFormRef` continua sendo setado em torno do `setForm`
  (guard existente, inalterado) - so a FORMA de aplicar `hydrated` mudou
  (merge em vez de overwrite).
- RF-003: `criarDocumentoClinicoDeTemplate` e `salvarDocumentoClinico`
  verificam `documentoClinicoEmVooRef.current` como primeira instrucao (antes
  de qualquer `await`, inclusive antes do `await obterAtendimentoIdParaDocumento()`);
  se `true`, retornam `null` imediatamente sem efeito colateral.
- RF-004: ambas as funcoes setam `documentoClinicoEmVooRef.current = true`
  IMEDIATAMENTE apos passar pelo guard (ainda sincrono, antes do primeiro
  `await`), e resetam para `false` no `finally` (roda em sucesso e em erro).
- RF-005: `setSalvandoDocumentoClinico(true)` (o estado que desabilita os
  botoes na UI) passa a ser setado no mesmo ponto sincrono, nao apenas
  depois do primeiro `await` - reforco visual, o guard real e o ref.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (correcao): nenhum comportamento de sucesso (retorno,
  `setSucesso`, `mergeDocumentoClinico`, `recarregarDocumentosAtendimento`)
  ou de erro (`setErro`) muda - apenas a ORDEM de quando o guard sincrono e
  aplicado.
- NFR-002 (minimizacao de raio de mudanca): nenhuma mudanca de assinatura
  de funcao, endpoint ou schema.

## 4) Contratos tecnicos

### API

Sem mudanca - ambos os achados sao inteiramente de frontend/estado React.

### Banco/migracoes

Nao aplicavel.

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx` (funcoes internas,
  sem mudanca de layout/JSX).
- Estados de UI: nenhum estado novo alem do `useRef`
  `documentoClinicoEmVooRef` (nao dispara re-render, e apenas um guard).
- Regras de exibicao/erro: inalteradas.

## 5) Compatibilidade e rollout

- Backward compatibility: total.
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (com os dois bugs).

## 6) Criterios de aceitacao (CA)

- CA-001: editar um campo de texto DURANTE o round-trip de um save manual
  preserva essa edicao apos a resposta chegar (nao e apagada).
- CA-002: um exame adicionado durante o round-trip de um save manual
  continua presente apos a resposta.
- CA-003: duplo clique em "Criar" (template) ou "Salvar documento" produz
  exatamente UM documento, nao dois.
- CA-004: o guard nao bloqueia permanentemente - depois que a primeira
  chamada termina (sucesso ou erro), uma nova chamada funciona normalmente.

## 7) Casos de borda

- CB-001: `obterAtendimentoIdParaDocumento` retornando `null`/`undefined`
  (atendimento nao pode ser salvo) ainda libera o guard corretamente via
  `finally`, permitindo nova tentativa.
- CB-002: erro de rede durante o POST/PUT do documento libera o guard via
  `finally`, mesmo padrao.

## 8) Fora de escopo

- `finalizarAtendimento`'s propria hidratacao pos-`/finalizar` (ver
  intent.md, secao 3).
- Desabilitar campos de texto do formulario durante `salvando`.
