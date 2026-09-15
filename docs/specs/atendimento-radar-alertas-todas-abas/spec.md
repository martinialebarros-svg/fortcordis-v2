# Spec - atendimento-radar-alertas-todas-abas

Data: 2026-08-09
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Mudanca aditiva de frontend, isolada em `frontend/app/atendimento/`:
um novo componente compacto de alertas criticos, e o rearranjo condicional
do grid/aside das abas Exames e Prescricao para acomoda-lo.

## 2) Requisitos funcionais (RF)

- RF-1: novo componente `AtendimentoAlertasCriticosCard` - recebe
  `alertasAtivos` e `getGravidadeClass`; filtra para `gravidade` em
  `{"critica","alta"}`; renderiza `null` se a lista filtrada for vazia;
  caso contrario renderiza um card compacto (titulo, gravidade, descricao
  por alerta), reusando `getGravidadeClass` para a cor de cada linha.
- RF-2: aba Prescricao passa a renderizar `AtendimentoAlertasCriticosCard`
  no topo da aside existente, antes de `AtendimentoPrescricaoAside`
  (que continua sendo renderizada sem alteracao).
- RF-3: aba Exames passa a renderizar uma aside contendo apenas
  `AtendimentoAlertasCriticosCard`, e somente quando existe ao menos um
  alerta de gravidade alta/critica para o paciente selecionado
  (`temAlertasCriticos`). Sem alerta critico, a aba Exames permanece de
  1 coluna, sem aside, como hoje.
- RF-4: abas Consulta e Documentos (`showClinicalRadarAside`) e aba
  Bibliotecas nao sao alteradas por este pacote.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (nao regressao visual): quando nao ha alerta critico, a aba
  Exames nao deve reservar espaco de coluna vazia no grid (`xl:` 2
  colunas) - o grid so muda para 2 colunas quando a aside de fato tem
  conteudo.
- NFR-B (nao duplicacao): nenhuma aba deve renderizar o mesmo alerta em
  dois lugares simultaneamente (radar completo + card compacto).
- NFR-C (compatibilidade): nenhuma mudanca de contrato de API/backend.

## 4) Contratos tecnicos

Nenhuma migration, nenhum endpoint novo. Mudanca 100% frontend.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - so adiciona visibilidade onde antes nao
  havia nada.
- Rollback: reverter o commit (sem estado persistido).

## 6) Criterios de aceitacao (CA)

- CA-1: paciente com alerta critico/alta selecionado, aba Exames -> aside
  aparece com o card compacto listando o(s) alerta(s), grid em 2 colunas
  a partir do breakpoint `xl:`.
- CA-2: mesmo paciente, aba Exames, sem nenhum alerta ativo -> nenhuma
  aside, grid permanece 1 coluna.
- CA-3: mesmo paciente com alerta critico, aba Prescricao -> card
  compacto aparece no topo da aside, `AtendimentoPrescricaoAside`
  continua aparecendo normalmente abaixo dele.
- CA-4: abas Consulta e Documentos continuam mostrando
  `AtendimentoClinicalRadarAside` (radar completo) sem alteracao.
- CA-5: `npx tsc --noEmit` e `npm run build` sem erros novos.
