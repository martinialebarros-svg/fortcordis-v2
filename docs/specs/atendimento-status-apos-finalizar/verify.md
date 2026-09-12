# Verify - atendimento-status-apos-finalizar

Data: 2026-09-11  
Responsavel: Martiniano Barros  
Status: verificado por teste automatizado; verificacao manual em stage pendente

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-001 | aceitacao | `atendimento-form-merge.test.ts` - "adota o status Concluido devolvido pelo finalizar" | ok |
| RF-002 / CA-002 | aceitacao | "continua preservando a edicao de texto feita durante o round-trip" - texto local sobrevive e o status vira "Concluido" na mesma passada | ok |
| RF-003 / CA-003 | funcional | "mantem o status local quando o servidor nao devolve um" | ok |
| RT-001 | tecnico | regra extraida para `mergeAtendimentoFinalizado`; `page.tsx` so chama | ok |
| RT-002 | tecnico | `mergeAutoSavedFormState` inalterado; os 13 testes que ja existiam seguem passando | ok |
| RF-004 / CA-005 | funcional | saida do `if (!atendimentoId)` passa a compor mensagem com o erro do save | ok (revisao de codigo; o caminho depende de falha de rede/servidor) |
| CA-004 | aceitacao | finalizar e emitir em stage sem recarregar | pendente |

## 2) Testes executados

```bash
cd frontend && npm run lint && npx vitest run && npm run build
```

- `eslint --max-warnings=0` limpo.
- **287 testes em 41 arquivos** (eram 284; tres novos).
- `next build` concluido.
- `tsc --noEmit`: limpo fora de `app/whatsapp-stage/AppointmentQueue.test.tsx`,
  que ja estava quebrado antes desta entrega (ver `verify.md` de
  `receita-emitida-em-fuso-operacional`, secao 2).

## 3) Teste negativo

Trocando o corpo de `mergeAtendimentoFinalizado` por `return merged;` - isto e,
voltando ao comportamento anterior - dois dos tres testes novos falham:

```
AssertionError: expected 'Em atendimento' to be 'Concluido'
AssertionError: expected 'Em atendimento' to be 'Concluido'
```

Confirma que o teste cobre o defeito, e nao apenas a funcao nova.

## 4) Origem, para quem reabrir isto depois

O defeito foi encontrado em producao, nao em teste: atendimento #62, com o vet
no meio da consulta. O sintoma relatado foi "nao consigo emitir a receita", sem
erro aparente. O que apareceu na tela foi o aviso do autosave, falando de
reabertura de atendimento - texto correto, porem desconectado do botao que
tinha sido apertado.

Duas licoes registradas:

- A observacao fora de escopo da entrega anterior descrevia este mesmo defeito
  pelo sintoma menor (banner de concluido so aparece ao reabrir). A causa era
  a mesma; o impacto real era travar a emissao de receita. Sintoma cosmetico
  nao implica causa cosmetica.
- Saida silenciosa em caminho de acao do usuario custa caro no diagnostico.
  O `return` mudo transformou um erro explicavel em "o botao nao faz nada".

## 5) Pendente

- Stage: finalizar um atendimento vinculado a agendamento e, sem recarregar,
  emitir a receita. Esperado: autosave segue "Sincronizado", PDF gerado, e o
  banner de concluido aparece na hora.
- Producao, apos a entrega: confirmar com o atendimento #62 que a emissao
  funciona sem o workaround manual.
