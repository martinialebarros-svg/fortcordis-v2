# Intent - atendimento-herdar-dados-anteriores

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

Discussao anterior sobre agilidade do modulo de Atendimento levantou que o
veterinario perde tempo redigitando informacoes que ja constam no
prontuario do paciente. Hoje existe uma funcao
(`iniciarNovoAtendimentoPaciente`, `frontend/app/atendimento/page.tsx:2744`)
que ja copia a PRESCRICAO de um atendimento historico ao iniciar um novo
atendimento do mesmo paciente (botao "Usar em novo atendimento" em
`AtendimentoPrescricaoHistorySection.tsx:90`), mas deixa todo o resto do
quadro clinico vazio: `queixa_principal`, `anamnese`, `exame_fisico`,
`dados_clinicos` nunca sao herdados (confirmado comparando o objeto `next`
montado na funcao com `emptyForm()`).

Alem disso, esse botao so aparece para atendimentos que JA TEM prescricao
(`AtendimentoPrescricaoHistorySection.tsx:18`, filtro
`prescricao?.total_itens > 0`) - um paciente cujo ultimo atendimento nao
gerou receita nao tem NENHUMA opcao de "usar como base", mesmo que a queixa
e o exame fisico daquele atendimento sejam uteis para o proximo.

## 2) Objetivo

Permitir que o veterinario herde queixa principal, anamnese, exame fisico e
dados clinicos (alem da prescricao, ja existente) do atendimento anterior do
mesmo paciente ao iniciar um novo atendimento, com confirmacao explicita
antes de aplicar - disponivel tanto a partir do historico de receitas quanto
do historico geral de atendimentos (que hoje e so leitura).

## 3) Nao objetivos

- **Diagnostico** (`diagnostico_principal`, `diagnostico_secundario`,
  `diagnostico_diferencial`, `prognostico`) - decisao deliberada de NAO
  herdar. Diagnostico e uma avaliacao nova a cada consulta; pre-preencher
  com o diagnostico antigo poderia enviesar a nova avaliacao clinica ou ser
  esquecido sem revisao.
- **Plano terapeutico** (`plano_terapeutico`, `retorno_recomendado`,
  `motivo_retorno`) - decisao especifica da consulta atual, nao deve ser
  herdada.
- **Triagem** (peso, temperatura, frequencia cardiaca/respiratoria, pressao
  arterial, saturacao, escore corporal) - sinais vitais SEMPRE precisam ser
  medidos de novo; herdar valores antigos e um risco de seguranca clinica
  (ex.: calculo de dose por peso desatualizado).
- Nenhuma mudanca no endpoint `GET /atendimentos/paciente/{id}/historico`
  (`backend/app/api/v1/endpoints/atendimento.py:4697`) - permanece enxuto,
  so com `queixa_principal`/`diagnostico_principal` como resumo de lista.
  Os campos completos sao buscados sob demanda via
  `GET /atendimentos/{id}` (endpoint ja existente, mesmo usado por
  `abrirAtendimento`).
- Nenhum endpoint novo no backend.

## 4) Contexto e restricoes

- Trabalho em worktree isolado (`atendimento-herdar-dados-anteriores`,
  baseado em `origin/stage @ 16ba64d7`, que ja inclui os pacotes
  `atendimento-integridade-prontuario` e `atendimento-persistencia-e-fluidez`).
- Padrao de confirmacao ja estabelecido no arquivo: `window.confirm(...)`
  bloqueante antes da acao (4+ usos em `page.tsx`), e um banner informativo
  pos-acao (`prescricaoOrigem`, ja usado para a receita herdada) - a nova
  feature reaproveita os dois padroes.
- `iniciarNovoAtendimentoPaciente` ja tem uma cadeia de guards (autosave em
  andamento, rascunho nao salvo, confirmacao de substituicao) que deve
  continuar funcionando identica para os callers existentes (botao "Novo
  atendimento" simples, banner de registro historico).

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao iniciar um atendimento para um
  paciente com historico.
- Modulos impactados: `frontend/app/atendimento/page.tsx`,
  `AtendimentoPrescricaoHistorySection.tsx`,
  `AtendimentoClinicalRadarAside.tsx`, `AtendimentoConsultaEditorSection.tsx`
  (banner informativo). Nenhuma mudanca de backend.
- Risco de regressao: baixo - a mudanca e aditiva (novo parametro opcional
  em funcao existente, novo estado, novo botao); os callers existentes que
  nao passam o novo parametro continuam com o comportamento identico
  (campos clinicos ficam vazios, como hoje).

## 6) Riscos iniciais

- Risco 1: sobrescrever silenciosamente conteudo que o veterinario ja
  digitou no rascunho atual. Mitigado pelos guards ja existentes em
  `iniciarNovoAtendimentoPaciente` (`hasEncounterContent` + confirmacao) e
  por um segundo `window.confirm` especifico explicando o que sera herdado.
- Risco 2: usuario nao perceber que o texto herdado e de uma consulta
  ANTERIOR e trata-lo como se fosse novo. Mitigado pelo banner informativo
  (mesmo padrao ja usado para a receita herdada), visivel na secao de
  Consulta.
- Risco 3: o botao novo no "Historico recente" pode gerar uma chamada de
  rede extra (`GET /atendimentos/{id}`) mesmo quando o atendimento nao tem
  nada relevante para herdar (ex.: atendimento vazio/cancelado) - aceitavel,
  mesmo padrao de custo que abrir o atendimento original.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos (com justificativa clinica para
  cada exclusao).
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
