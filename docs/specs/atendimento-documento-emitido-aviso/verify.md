# Verify - atendimento-documento-emitido-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Preview local: documento de teste com `status="emitido"` -> badge "Emitido" (`bg-amber-100 text-amber-800`) confirmado via DOM; documentos sem esse status mostram badge "Rascunho" (`bg-slate-100 text-slate-600`). | ok |
| CA-2 | aceitacao | Ao selecionar o documento emitido, banner de aviso (`border-amber-200 bg-amber-50`, icone `AlertTriangle`) confirmado no editor; ao clicar "Novo" (documento sem status emitido), banner desaparece - `titleValue` limpo e `bannerFound: false`. | ok |
| CA-3 | aceitacao | `window.confirm` mockado (retornando `false`) disparado ao clicar "Gerar PDF" no documento emitido, com a mensagem exata esperada; download nao ocorreu (retorno antes do `try`/chamada a API). | ok |
| CA-4 | aceitacao | Confirmado por leitura de codigo (revisao adversarial): documento novo/"rascunho" nunca aciona o confirm extra - `emptyDocumentoAtendimentoForm()` inicia com `status: "rascunho"` e o backend forca `status="rascunho"` na criacao, independente do payload. | ok |
| CA-5 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde - confirmado 2x (implementacao + revisao adversarial independente). | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Nao ha suite automatizada de UI para esta pagina no projeto. A
verificacao de comportamento foi feita via preview local (inspecao de
DOM + mock de `window.confirm`) e revisao adversarial (leitura de
codigo, incluindo o backend).

## 3) Testes manuais

Preview local isolado do worktree (backend em `:8015`, frontend em
`:3015`, banco de dados sqlite copiado de `backend/fortcordis.db` so
para teste, depois apagado do worktree - nunca commitado):

1. Login como `admin@fortcordis.com`, aba Atendimento, atendimento
   existente selecionado (paciente "celine"), aba Documentos.
2. Inserido manualmente 1 documento de teste com `titulo="Atestado de
   comparecimento"`, `status="emitido"`, `emitido_at=now()` no
   atendimento #1 - dado descartavel, so no banco local copiado.
3. Lista de documentos -> badge "Emitido" (amber) confirmado via DOM
   (`className` do `<span>`).
4. Clique no documento -> editor carrega titulo/corpo corretamente;
   banner de aviso confirmado presente (`AlertTriangle` + texto "ja foi
   emitido...").
5. `window.confirm` substituido por um mock que registra a chamada e
   retorna `false` -> clique em "Gerar PDF" disparou o confirm com a
   mensagem exata esperada, e nao houve chamada a API/download (efeito
   do `return` antecipado).
6. Clique em "Novo" -> titulo limpo, banner desaparece (sem falso
   positivo para documento sem `status="emitido"`).
7. Preview local encerrado; `.env`/`fortcordis.db` copiados removidos
   do worktree; dado de teste existia so no banco local descartado
   (nunca tocou banco de producao/stage).

## 4) Revisao adversarial

Escopo pequeno (2 arquivos, aditivo, sem mudanca de backend/contrato) -
revisao com 1 agente ceptico, incluindo leitura do backend para
confirmar a persistencia real de `status`/`emitido_at`.

**Veredito: correto, sem achados.** Confirmado por leitura de codigo:
- `hydrateDocumentoForm`/`selecionarDocumentoClinico` garantem que o
  badge da lista e o banner do editor refletem exatamente o mesmo
  campo `status` vindo do backend, sem drift.
- `salvarDocumentoClinico` nunca reseta `status` como efeito colateral
  do salvamento (envia sempre o valor ja hidratado) - o novo guard de
  confirmacao ve corretamente "emitido" quando aplicavel.
- Os dois pontos de entrada de `baixarPdfDocumentoClinico` (botao "PDF"
  na lista e "Gerar PDF" no editor) convergem no mesmo guard, sem
  bypass.
- Documento novo/nunca salvo nunca aciona o confirm extra (`status`
  inicial "rascunho", backend forca "rascunho" na criacao).
- `AlertTriangle` importado corretamente, sem duplicar import.
- `tsc`/`build` re-confirmados limpos de forma independente.

**Observacao nao bloqueante:** o backend tambem aceita um terceiro
valor de status, `"arquivado"`, que o badge atual trata como
"Rascunho" (so binario emitido/nao-emitido, conforme RF-1). Confirmado
que nenhum caminho do codigo (frontend, backend, migrations, testes)
produz esse valor hoje - inalcancavel na pratica, nao adicionada
logica extra para um caso nunca exercitado.

## 5) Riscos residuais aceitos

- Titulo/corpo do documento permanecem editaveis mesmo apos emitido
  (decisao deliberada, ver `intent.md`) - o aviso e a confirmacao
  reduzem o risco de edicao acidental sem aviso, mas nao bloqueiam
  correcoes legitimas.
- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #43 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
