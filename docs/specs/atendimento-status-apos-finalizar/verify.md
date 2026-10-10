# Verify - atendimento-status-apos-finalizar

Data: 2026-09-11; CA-004 verificado em 2026-10-10
Responsavel: Martiniano Barros  
Status: verificado por testes automatizados e ensaio de interface em stage

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| RF-001 / CA-001 | aceitacao | `atendimento-form-merge.test.ts` - "adota o status Concluido devolvido pelo finalizar" | ok |
| RF-002 / CA-002 | aceitacao | "continua preservando a edicao de texto feita durante o round-trip" - texto local sobrevive e o status vira "Concluido" na mesma passada | ok |
| RF-003 / CA-003 | funcional | "mantem o status local quando o servidor nao devolve um" | ok |
| RT-001 | tecnico | regra extraida para `mergeAtendimentoFinalizado`; `page.tsx` so chama | ok |
| RT-002 | tecnico | `mergeAutoSavedFormState` inalterado; os 13 testes que ja existiam seguem passando | ok |
| RF-004 / CA-005 | funcional | saida do `if (!atendimentoId)` passa a compor mensagem com o erro do save | ok (revisao de codigo; o caminho depende de falha de rede/servidor) |
| CA-004 | aceitacao | Chrome real em stage `154356d4`: finalizar atendimento sintetico vinculado e gerar PDF da receita sem reload; Concluido e Sincronizado visiveis | ok |

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

## 5) Ensaio em stage — 2026-10-10

CA-004 fechado no snapshot `154356d488891b07f0f6617d34ddec2833057e3e`, apos o workflow [Deploy to Stage 38086194169](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38086194169) concluir com sucesso.

- Chrome real em contexto isolado, fixture exclusiva `CODEX-CA004-20261010-a37c`: atendimento #18 vinculado ao agendamento #166. Nenhum prontuario de producao foi editado.
- O clique em Finalizar gerou a OS #48 e mostrou imediatamente o banner Concluido e o indicador Sincronizado.
- A receita produziu PDF valido de 893.742 bytes sem recarregar: `performance.timeOrigin` permaneceu igual e houve somente uma navegacao principal no periodo finalizar/emitir.
- A edicao clinica posterior manteve Concluido e produziu auditoria com antes/depois. A verificacao ampliada de documento e persistencia esta em [edicao-pos-conclusao/verify](../atendimento-edicao-pos-conclusao/verify.md).

A verificacao historica sugerida sobre o prontuario real #62 nao foi executada: a prova operacional usa fixture sintetica, sem modificar prontuario real para testar.

## Atualizacao de contrato em 2026-10-10

A autoridade do status confirmado pelo servidor passa a abranger tambem a recuperacao de rascunhos locais e a edicao posterior de atendimentos concluidos. Texto clinico digitado permanece recuperavel. Salvar documento persistido nao fica condicionado a um save desnecessario do formulario do atendimento.

Contrato e evidencias desta alteracao: [spec](../atendimento-edicao-pos-conclusao/spec.md) e [verify](../atendimento-edicao-pos-conclusao/verify.md). A evidencia de publicacao de entregas anteriores nao comprova a publicacao desta atualizacao.
