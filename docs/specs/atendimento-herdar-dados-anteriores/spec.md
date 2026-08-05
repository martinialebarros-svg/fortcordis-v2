# Spec - atendimento-herdar-dados-anteriores

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Escopo funcional

Nova funcao `herdarAtendimentoAnterior(atendimentoId)` (frontend) que busca o
detalhe completo de um atendimento historico do mesmo paciente
(`GET /atendimentos/{id}`), confirma explicitamente com o usuario, e inicia
um novo atendimento herdando `queixa_principal`, `anamnese`, `exame_fisico`,
`dados_clinicos` e a prescricao (reaproveitando a logica ja existente em
`iniciarNovoAtendimentoPaciente`). Disponibilizada em dois pontos de
entrada: o botao ja existente de "Usar em novo atendimento" (historico de
receitas) e um botao novo no "Historico recente" (todos os atendimentos,
com ou sem receita).

## 2) Requisitos funcionais (RF)

- RF-001: `iniciarNovoAtendimentoPaciente` ganha um terceiro parametro
  opcional `dadosClinicos?: { queixa_principal?: string; anamnese?: string;
  exame_fisico?: string; dados_clinicos?: string } | null`. Quando presente,
  o objeto `next` monta esses 4 campos a partir dele; quando ausente
  (chamadas existentes), o comportamento e identico ao de hoje (campos
  vazios).
- RF-002: nova funcao `herdarAtendimentoAnterior(atendimentoId: number)`:
  1. Reaproveita os guards ja existentes no inicio de
     `iniciarNovoAtendimentoPaciente` (paciente selecionado,
     `autosaveState !== "saving"`).
  2. Exibe `window.confirm` especifico, explicando que queixa, anamnese,
     exame fisico, dados clinicos e a receita (se houver) serao copiados, e
     que diagnostico/plano terapeutico/triagem NAO sao copiados.
  3. Busca `GET /atendimentos/{atendimentoId}` (mesma chamada ja usada por
     `abrirAtendimento`).
  4. Monta um objeto `PrescricaoHistorica` a partir de `detalhe.prescricao`
     (quando presente) e um `AtendimentoHistorico` a partir dos campos
     resumidos do detalhe.
  5. Chama `iniciarNovoAtendimentoPaciente(prescricaoHistorica, origem,
     { queixa_principal, anamnese, exame_fisico, dados_clinicos })`.
  6. Em caso de erro na busca, mostra `setErro(...)` e nao altera o form
     atual.
- RF-003: novo estado `dadosClinicosOrigem` (mesmo shape de
  `PrescricaoOrigem`), setado por `iniciarNovoAtendimentoPaciente` quando
  `dadosClinicos` foi fornecido, limpo quando nao foi.
- RF-004: banner informativo em `AtendimentoConsultaEditorSection.tsx`
  (mesmo padrao visual do banner de `prescricaoOrigem` em
  `AtendimentoPrescricaoHistorySection.tsx`), mostrado quando
  `dadosClinicosOrigem` esta presente, citando o numero do atendimento de
  origem e pedindo revisao antes de salvar.
- RF-005: o botao existente "Usar em novo atendimento"
  (`AtendimentoPrescricaoHistorySection.tsx:90`) passa a chamar
  `herdarAtendimentoAnterior(atendimento.id)` em vez de
  `iniciarNovoAtendimentoPaciente(atendimento.prescricao, atendimento)`
  diretamente - unifica o caminho de codigo e garante que os campos
  clinicos tambem sejam buscados e herdados a partir desse botao.
- RF-006: novo botao em `AtendimentoClinicalRadarAside.tsx`, na lista
  "Historico recente" (item por item, ate os 4 mais recentes exibidos),
  chamando `herdarAtendimentoAnterior(atendimento.id)` - disponivel para
  QUALQUER atendimento do historico, independente de ter prescricao.

## 3) Requisitos nao funcionais (NFR)

- NFR-A (compatibilidade): callers existentes de
  `iniciarNovoAtendimentoPaciente` que nao passam `dadosClinicos` continuam
  com o mesmo comportamento de hoje - nenhuma regressao no fluxo de "Novo
  atendimento" simples.
- NFR-B (sem endpoint novo): reaproveita `GET /atendimentos/{id}`, ja
  existente e ja testado.
- NFR-C (clinico): diagnostico, plano terapeutico e triagem nunca sao
  herdados por este fluxo, em nenhum dos dois pontos de entrada.

## 4) Contratos tecnicos

Puramente frontend - sem mudanca de contrato de API, sem migration.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - parametro novo e opcional, callers
  existentes inalterados.
- Rollback: reverter o commit.

## 6) Criterios de aceitacao (CA)

- CA-001: clicar em "Usar em novo atendimento" (historico de receitas) para
  um atendimento com queixa/anamnese/exame fisico preenchidos, confirmar o
  dialogo, resulta num novo atendimento (nao salvo ainda) com esses 4
  campos preenchidos identicos ao atendimento de origem, e a prescricao
  copiada (comportamento ja existente, preservado).
- CA-002: o mesmo clique, mas cancelando o `window.confirm`, nao altera o
  form atual.
- CA-003: o novo botao no "Historico recente" funciona para um atendimento
  SEM prescricao (`tem_prescricao: false`) - herda os campos clinicos e
  deixa a prescricao vazia (`emptyPrescriptionItem()`), sem erro.
- CA-004: diagnostico, plano terapeutico e campos de triagem do novo
  atendimento permanecem vazios/padrao apos herdar, mesmo que o atendimento
  de origem tivesse esses campos preenchidos.
- CA-005: o banner "dados clinicos copiados do atendimento #X" aparece na
  secao de Consulta apos herdar, e desaparece ao iniciar um atendimento sem
  heranca (`novoAtendimento()`/"Novo atendimento" simples).
- CA-006: o fluxo de "Novo atendimento" simples (sem herdar nada) continua
  funcionando identico a antes desta mudanca.
- CA-007: `npm run build` do frontend aprovado.

## 7) Casos de borda

- CB-001: atendimento de origem sem NENHUM campo clinico preenchido (todos
  vazios) - herdar nao gera erro, so aplica strings vazias (no-op visivel).
- CB-002: `GET /atendimentos/{id}` falha (rede, 404) - `herdarAtendimentoAnterior`
  mostra erro e NAO altera o form atual (form permanece como estava antes
  do clique).
- CB-003: usuario ja tem rascunho com conteudo digitado ao clicar em
  herdar - os guards existentes de `iniciarNovoAtendimentoPaciente`
  (autosave em andamento -> erro; autosave "dirty" com atendimento
  selecionado -> salva antes; rascunho sem atendimento selecionado -> pede
  confirmacao de substituicao) continuam se aplicando, alem da nova
  confirmacao especifica de heranca.

## 8) Fora de escopo

- Qualquer mudanca em diagnostico, plano terapeutico ou triagem.
- Endpoint novo ou mudanca no payload de `/historico`.
- Refactor de `iniciarNovoAtendimentoPaciente` alem da adicao do parametro
  opcional.
