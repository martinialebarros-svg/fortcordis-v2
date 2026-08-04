# Intent - atendimento-persistencia-e-fluidez

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

Depende do pacote `atendimento-integridade-prontuario` (concluido e em producao).
Uma auditoria de codigo anterior levantou ~27 achados adicionais no modulo de
Atendimento Clinico, conscientemente adiados para este segundo pacote. Sete
deles foram verificados por leitura direta do codigo atual (worktree em
`origin/stage`, commit `701bc965`) e continuam presentes, cada um com
`arquivo:linha` confirmado:

1. **Perda de texto clinico (4 buracos que se somam)** -
   `frontend/app/atendimento/page.tsx`: nao ha handler `beforeunload`; o
   cleanup do timer de autosave (~3928) so limpa o timer, nunca faz flush; o
   POST automatico de criacao nunca acontece em modo autosave (`if
   (isAutosave) return;`, ~3776); o rascunho em `localStorage` so grava
   enquanto `!selecionado` (~2471) - depois do primeiro save, se o autosave
   falhar, a edicao fica so em memoria, sem nenhum fallback.
2. **Calculo mg/kg da prescricao descartado no save** - o frontend declara
   `dose_mg_kg`, `peso_referencia_kg`, `unidade_dose_calculo` e
   `concentracao_personalizada` no estado local (page.tsx ~344-357), mas
   `buildAtendimentoPayload` (~1160-1226) ja os descarta antes de montar o
   payload, e nem o schema (`PrescricaoItemPayload`), nem o model
   (`PrescricaoItem`, `prescricoes_itens`), nem `_map_prescricao_item` (backend)
   os conhecem. Ao reabrir, tudo volta a `""`/`"mg"`. Adicionalmente, o
   backend ja calcula `prescricao.apoio_clinico` (alertas de interacao, faixa
   de dose) via `analyze_prescription_items`, mas o frontend nunca le esse
   campo - reimplementou o calculo localmente em `calcularDosePrescricaoItem`.
3. **Abrir um atendimento zera o cadastro complementar** -
   `_montar_detalhe_atendimento` e o endpoint `/contexto` (backend) devolvem
   so `paciente_nome`/`tutor_nome` (strings), nunca os objetos `paciente`/
   `tutor` completos que `aplicarCadastroComplementar` espera. Como ela
   recebe `undefined`, zera o estado do cadastro complementar. O
   `useEffect [form.paciente_id]` so repopula quando o `paciente_id` muda -
   abrir um segundo atendimento do MESMO paciente nao dispara o efeito de
   novo, deixando o bloco em branco permanentemente.
4. **`consulta_concluida` tem dois donos** - um `useEffect` incondicional
   (page.tsx ~5160-5163) forca `form.consulta_concluida` a bater com
   `consultaEtapasCompletas` (os 11 campos clinicos completos), sem checar
   `hydratingFormRef`. Um atendimento carregado do banco com
   `consulta_concluida = 1` e campos incompletos tem esse valor zerado logo
   apos abrir, e o autosave persiste o 0 de volta no banco - revertendo
   tambem qualquer marcacao manual do checkbox.
5. **`DELETE /atendimentos/{id}` sem guard, sem reversao e sem auditoria** -
   apaga um atendimento `Concluido` sem bloqueio; nao reverte
   `agendamento.status`; nao cancela a `OrdemServico` ativa (fica orfa); nao
   limpa `EvolucaoClinica`/`PrescricaoItemAjuste`/`AlertaClinico` (sem FK,
   ficam orfaos); nao chama `registrar_auditoria` - apagar prontuario nao
   deixa rastro nenhum.
6. **Filtro de periodo traz um dia a mais** - o frontend ja envia
   `data_fim` como fim-de-dia (`T23:59:59`), e o backend soma
   `+ timedelta(days=1)` por cima disso (duplo ajuste), incluindo quase todo
   o dia seguinte no resultado.
7. **Estado de exames indexado por posicao no array** -
   `examesExpandidos`, `examUploadDrafts` e `examDropActive` sao mapas
   chaveados por indice, e a key do React tambem usa indice como primeiro
   componente. Excluir um exame do meio da lista desloca os indices
   seguintes sem realinhar esses mapas - um upload pendente pode ficar
   associado ao exame errado.

## 2) Objetivo

Eliminar os caminhos em que o veterinario perde trabalho digitado durante a
consulta e as inconsistencias que obrigam retrabalho a cada atendimento,
sem alterar o contrato ja homologado de
`POST /atendimentos/{id}/finalizar` nem fazer refactor arquitetural de
`page.tsx` (ha spec propria para isso: `arch-fe-01-modularizar-atendimento-for39`).

## 3) Nao objetivos

- Refactor arquitetural de `page.tsx` ou `atendimento.py` (specs proprias
  ja existem para isso).
- Auditoria campo a campo de toda edicao de prontuario (mencionada como
  pendente em `atendimento-integridade-prontuario/spec.md`, mas fora de
  escopo aqui - o item 5 adiciona auditoria pontual so no DELETE).
- Migrar o frontend para consumir `prescricao.apoio_clinico` do backend em
  vez de recalcular localmente (avaliado no item 2, mas o calculo local
  reage a cada edicao de campo antes de salvar, enquanto `apoio_clinico` so
  existe apos um GET do atendimento persistido - substituir exigiria
  redesenhar o fluxo reativo; registrado como sugestao para pacote futuro).
- Migrar a chave `exame-${index}` de `uploadingAttachmentKey` /
  `uploadProgressByKey` (usada durante o upload em si, nao um dos 3 mapas
  citados no defeito 7) - mencionada nas notas de interacao, mas mantida
  fora de escopo para nao expandir a superficie da mudanca; documentada como
  debito conhecido.

## 4) Contexto e restricoes

- Trabalho feito em worktree isolado
  (`atendimento-persistencia-e-fluidez`, baseado em `origin/stage` @
  `701bc965`), sem tocar a working tree principal (que tem trabalho
  "Portal" de outra sessao, nao commitado).
- Nao existe test runner de frontend no projeto (`frontend/package.json`
  sem runner, nenhum `*.test.*`) - os itens 1, 3, 4 e 7 (frontend puro ou
  frontend+backend) precisam de roteiro manual documentado no `verify.md`
  em vez de teste automatizado.
- Baseline de testes backend antes das mudancas:
  `cd backend && ./venv/bin/python -m pytest tests/ -k atendimento -q --no-header`.
  Nao existe binario `python` no PATH - usar `./venv/bin/python`.
- Qualquer migration nova entra depois da `20260730_60` (a mais recente) e
  deve usar a assinatura `upgrade(connection, dialect=None)`.
- `frontend/app/atendimento/page.tsx` tem 6684 linhas e concentra estado
  compartilhado entre os itens 1, 4 e 7 (autosaveState, hydratingFormRef,
  form.exames) - a ordem de implementacao e os pontos de interacao entre
  itens estao mapeados no `plan.md`.

## 5) Impacto esperado

- Usuarios impactados: veterinarios usando o modulo de Atendimento Clinico
  (todos os itens), e indiretamente Portal/Laudos (item 5, por causa dos
  registros hoje orfaos de OS/Agendamento).
- Modulos impactados: `frontend/app/atendimento/page.tsx`,
  `frontend/app/atendimento/components/AtendimentoExamesSection.tsx`,
  `frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx`,
  `backend/app/api/v1/endpoints/atendimento.py`,
  `backend/app/schemas/atendimento.py`, `backend/app/models/atendimento_clinico.py`,
  nova migration para `prescricoes_itens`.
- Risco de regressao: moderado - varios itens tocam efeitos React
  compartilhados (autosaveState, `selecionado`, `hydratingFormRef`) no mesmo
  arquivo grande; mitigado por implementacao sequencial (nao paralela) e
  revisao adversarial item a item antes do deploy.

## 6) Riscos iniciais

- Risco 1 (item 1): o POST automatico de criacao precisa de guarda de
  idempotencia real (nao existe hoje, pois hoje nunca ha POST automatico) -
  digitacao rapida antes do primeiro POST retornar nao pode disparar dois
  atendimentos duplicados para o mesmo paciente/horario.
- Risco 2 (item 2): `unidade_dose_calculo` tem 3 valores possiveis no
  frontend - a migration/schema deve validar contra esses valores (Literal/
  Enum ou CHECK) para nao aceitar lixo.
- Risco 3 (item 5): cancelar a `OrdemServico` ativa ao apagar um atendimento
  concluido e uma decisao de produto (nao so tecnica) - a direcao adotada
  (bloquear por padrao, permitir exclusao explicita e auditada) sera
  registrada no `spec.md` e comunicada antes do deploy.
- Risco 4 (item 6): corrigir so um lado do duplo ajuste sem coordenacao
  pode trocar "um dia a mais" por "um dia a menos" (excluindo o proprio dia
  final) - a correcao escolhida (spec.md) ajusta so o backend, mantendo o
  frontend como esta.
- Risco 5 (item 7): mudar a chave dos 3 mapas de indice para
  id/uid muda tambem a key do React - precisa confirmar visualmente que a
  UI de exames nao pisca/reordena de forma inesperada apos a mudanca.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros (7 itens, cada um com evidencia
  atual confirmada por leitura de codigo).
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
