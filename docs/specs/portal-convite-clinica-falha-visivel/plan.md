# Plan - portal-convite-clinica-falha-visivel

Data: 2026-09-15  
Responsavel: Martiniano Barros  
Status: concluido

## 1) Tarefas

- [x] T1 reconstruir o caminho real da falha a partir da resposta observada
      (`manual_copy` com `provider: null`), em vez de supor causa.
- [x] T2 eliminar a hipotese de gate desligado -- `whatsapp_agenda_enabled: true`
      conferido pelo endpoint `lembrete-preview`, depois do deploy.
- [x] T3 mapear os modos de falha de `send_approved_utility_template`.
- [x] T4 acrescentar logger e separar os dois `except`.
- [x] T5 dois testes: motivo propagado no 502 por falha de envio e por
      integracao nao configurada.
- [x] T6 teste negativo.

## 2) Ordem e dependencias

T1 e T2 antes de T4: sem eles, a correcao seria escrita para uma causa suposta.
T2 foi o que provou que o `try` era alcancado -- e portanto que havia excecao
sendo engolida, e nao envio pulado.

## 3) Risco

Baixo. Nao muda quando o envio acontece nem o fallback; so acrescenta registro e
troca um texto generico pelo motivo real.

Um cuidado de ordem: `HTTPException` herda de `Exception`. Com os `except` na
ordem inversa, o ramo generico capturaria as condicoes de ambiente e o `detail`
util se perderia -- o mesmo defeito, com roupa nova. Fixado em RT-002 e coberto
por CA-002.

Cuidado de conteudo: o motivo vai para log, entao nao pode carregar numero de
destino nem token. As mensagens do servico de entrega sao descricoes de
condicao, nao dados do envio.

Rollback: reverter o commit. Volta a engolir.

## 4) Entrega

Correcao de diagnostico, nao de funcionalidade -- o convite ja funcionava por
copia manual. Entra por `stage` no fluxo normal.

Vale entregar antes de investigar a causa raiz do ambiente: e esta mudanca que
torna a proxima tentativa legivel.
