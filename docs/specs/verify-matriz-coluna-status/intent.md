# Intent - verify-matriz-coluna-status

Data: 2026-09-16
Responsavel: Martiniano

## Problema

O gate de promocao (`check_promotion_verify_pending.py`) so le tabela markdown
que tenha coluna `Status` -- `extrair_pendencias()` ignora qualquer outra. Isso
e deliberado e esta fixado como RF-004 de
`promocao-bloqueia-criterio-pendente`: o `verify.md` traz tambem tabelas de
etapas, de respostas e de medicao, e ler todas geraria falso positivo.

O efeito colateral nunca foi tratado. O template canonico
(`docs/specs/templates/verify.md`) usa `| ID | Tipo | Evidencia | Status |`,
mas 56 dos 251 `verify.md` do repo usam outro cabecalho -- o mais comum sendo
`| Criterio | Evidencia | Resultado |`, herdado de specs anteriores ao gate.
Nessas specs a matriz inteira e invisivel para o gate.

Confirmado empiricamente antes desta entrega: rodando o script com
`--head-sha f18eabb4` (commit em que
`docs/specs/laudo-aviso-whatsapp-parceiro/verify.md` tinha `CA-012` marcado
`pendente` numa coluna `Resultado`), a saida foi
`1 feature(s) no diff, nenhum criterio pendente. PASSED`.

Esse e o pior modo de falha possivel para um gate: ele nao fica em silencio, ele
afirma que olhou e que nao encontrou nada. O PR verde da a impressao de que a
promocao nao leva pendencia, quando o gate simplesmente nao leu a tabela.

## Por que agora

`main` faz deploy automatico a cada push. O anteparo entre um criterio aberto e
producao e esse gate, e hoje ele tem um ponto cego que depende so de qual
cabecalho o autor da spec escolheu meses atras. Nada no repo impede que a
proxima spec volte a divergir do template.

## Fora de escopo

- Afrouxar o parser do gate para ler qualquer coluna de resultado. Seria
  desfazer RF-004 e trazer de volta o falso positivo que ele evita: as tabelas
  de etapas e de medicao do `verify.md` tem celulas `pendente` que nao sao
  criterio. A correcao certa e o documento, nao o parser.
- Escrever matriz para as 34 specs que registram verificacao so em prosa, sem
  tabela nenhuma. Inventar `ID`, `Evidencia` e `Status` a partir de texto
  corrido produziria status que ninguem verificou -- exatamente o risco que
  este trabalho existe para eliminar. Ficam listadas no `verify.md` desta spec
  e entram no formato canonico quando alguem encostar nelas.
- Normalizar o vocabulario de status (`passou` -> `ok`). Remapear valor e como
  um `pendente` viraria `ok`; a conversao move a celula, nao a reescreve.
