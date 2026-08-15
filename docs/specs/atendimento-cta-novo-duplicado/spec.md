# Spec - atendimento-cta-novo-duplicado

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

`frontend/app/atendimento/page.tsx`, botao do header (dentro de
`.fc-care-header-actions`):

- Passa a ser envolvido em `{selecionado ? null : (...)}` - so
  renderiza quando `selecionado` e falso (nenhum registro historico
  persistido esta selecionado).
- Conteudo/comportamento do botao (texto condicional por
  `form.paciente_id`, handler) permanece inalterado.

Banner ambar de "Registro historico" (`{selecionado ? (...) : null}`,
ja existente): inalterado, continua sendo a UNICA fonte da acao
"Novo atendimento deste paciente" quando `selecionado` e truthy.

## 2) Matriz de estados

| `selecionado` | `form.paciente_id` | Botao do header | Banner ambar | Total de CTAs "novo atendimento" |
| --- | --- | --- | --- | --- |
| falso | falso | "Novo atendimento" (`novoAtendimento`) | nao renderiza | 1 |
| falso | truthy | "Novo atendimento deste paciente" (`iniciarNovoAtendimentoPaciente`) | nao renderiza | 1 |
| truthy | truthy (implicito) | nao renderiza | "Novo atendimento deste paciente" (`iniciarNovoAtendimentoPaciente`) | 1 |

Antes deste pacote, a ultima linha resultava em 2 CTAs identicos.

## 3) Casos de borda

- `selecionado` e o mesmo valor que ja gate o banner ambar
  (`{selecionado ? (` na secao imediatamente abaixo do header) -
  reaproveita a mesma variavel/condicao, sem introduzir uma nova
  fonte de verdade.
- Nenhum outro botao do header (`Laudar`, `Salvar atendimento`,
  `Finalizar atendimento`) e afetado - so o CTA de "novo atendimento".

## 4) Fora de escopo

- Reestilizar ou mover o botao do banner ambar.
- Qualquer mudanca na logica de `iniciarNovoAtendimentoPaciente`/
  `novoAtendimento`.
