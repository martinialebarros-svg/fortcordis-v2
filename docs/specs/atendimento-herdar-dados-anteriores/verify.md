# Verify - atendimento-herdar-dados-anteriores

Data: 2026-08-04
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `herdarAtendimentoAnterior` busca `GET /atendimentos/{id}` e aplica `queixa_principal`/`anamnese`/`exame_fisico`/`dados_clinicos` + prescricao via `iniciarNovoAtendimentoPaciente`. Confirmado por leitura de codigo (revisao adversarial, secao 4) e `tsc --noEmit`. | ok (leitura de codigo + roteiro manual) |
| CA-002 | aceitacao | Cancelar o `window.confirm` retorna cedo sem chamar `iniciarNovoAtendimentoPaciente` nem alterar o form. | ok (leitura de codigo) |
| CA-003 | aceitacao | Quando `detalhe.prescricao` e null/ausente (atendimento sem receita), `prescricaoHistorica` fica `null` e `iniciarNovoAtendimentoPaciente` cai no fallback `[emptyPrescriptionItem()]` (comportamento ja existente, reaproveitado). | ok (leitura de codigo) |
| CA-004 | aceitacao | `next` em `iniciarNovoAtendimentoPaciente` so aplica os 4 campos clinicos + prescricao a partir de `...emptyForm()` - diagnostico/plano_terapeutico/triagem nunca sao tocados, confirmados vazios/padrao apos herdar (revisao adversarial, secao 4, pergunta 1). | ok |
| CA-005 | aceitacao | Banner em `AtendimentoConsultaEditorSection.tsx` renderiza quando `dadosClinicosOrigem` presente; `setDadosClinicosOrigem(null)` replicado em todos os pontos onde `setPrescricaoOrigem(null)` ja existia (abrirAtendimento, novoAtendimento, save manual). | ok (leitura de codigo) |
| CA-006 | aceitacao | Callers antigos de `iniciarNovoAtendimentoPaciente` (botao "Novo atendimento" simples) nao passam `dadosClinicos` - comportamento identico ao anterior (campos ficam vazios via `emptyForm()`), confirmado pela revisao adversarial (secao 2). | ok |
| CA-007 | aceitacao | `npm run build` aprovado (2 rodadas: apos implementacao inicial, e apos a correcao da condicao de corrida encontrada na revisao). `npx tsc --noEmit` tambem aprovado, sem erros. | ok |

## 2) Testes automatizados executados

Sem mudanca de backend - nenhum teste pytest novo necessario (reaproveita
`GET /atendimentos/{id}`, ja coberto por testes existentes do modulo).

```bash
cd frontend && npx tsc --noEmit
# sem erros

cd frontend && npm run build
# Compiled successfully, 39/39 paginas geradas (2 rodadas, antes e depois
# da correcao da condicao de corrida)
```

## 3) Testes manuais

Sem test runner de frontend no projeto. Assim como no pacote anterior
(`atendimento-persistencia-e-fluidez`), a ferramenta de Browser continuou
bloqueada por restricao de ambiente desta sessao ("This site requires
per-action approval") - a verificacao visual ao vivo NAO foi possivel
novamente. A validacao desta feature se apoiou em: leitura de codigo linha
a linha (secao 4), `tsc --noEmit`, `npm run build`, e revisao adversarial
independente.

**Roteiro planejado (nao executado nesta sessao):**

1. Abrir um atendimento historico com queixa/anamnese/exame fisico/dados
   clinicos preenchidos e SEM prescricao. No "Historico recente" (aside),
   clicar em "Herdar para novo atendimento" -> confirmar o dialogo -> os 4
   campos clinicos devem aparecer preenchidos no novo atendimento (nao
   salvo), prescricao vazia, banner "dados clinicos copiados do atendimento
   #X" visivel na secao de Consulta.
2. Repetir com um atendimento historico QUE TEM prescricao, a partir do
   botao "Usar em novo atendimento" (historico de receitas) -> confirmar
   que tanto os campos clinicos quanto a receita sao herdados.
3. Abrir um atendimento, digitar conteudo no rascunho, cancelar o
   `window.confirm` de heranca -> confirmar que nada foi alterado.
4. Com um atendimento ja aberto e "dirty" (edicao pendente), clicar em
   "Herdar" a partir de outro atendimento historico -> confirmar que a
   edicao pendente e salva automaticamente antes de trocar para o novo
   atendimento (nao perdida).
5. Verificar que diagnostico, plano terapeutico e triagem do novo
   atendimento continuam vazios apos herdar, mesmo que o atendimento de
   origem tivesse esses campos preenchidos.

## 4) Revisao adversarial

Um agente independente revisou o codigo completo (nao o resumo) contra as
6 perguntas do plano de verificacao. Resultado:

| # | Pergunta | Veredito |
| --- | --- | --- |
| 1 | Diagnostico/plano/triagem nunca herdados? | Confirmado - sem vazamento. |
| 2 | Guards existentes intactos para callers antigos? | Confirmado, mas revelou o achado abaixo. |
| 3 | Props corretos nos 3 componentes? | Confirmado, sem mismatch. |
| 4 | Campos completos, sem risco de `undefined`? | Confirmado - backend sempre coerca com `or ""`; `formatDate` tolera `undefined`. |
| 5 | Risco de sobrescrever conteudo digitado sem confirmacao? | **Achado real, severidade media** - ver abaixo. |
| 6 | Botao novo esconde para o atendimento em edicao? | Confirmado, correto. |

**Achado corrigido:** `herdarAtendimentoAnterior` introduz um `await`
(fetch de rede) entre a confirmacao e a chamada a
`iniciarNovoAtendimentoPaciente` - um intervalo que nao existia nos
callers sincronos anteriores. Os guards de
`iniciarNovoAtendimentoPaciente` (`autosaveState === "saving"`,
`selecionado && autosaveState === "dirty"`, `!selecionado &&
hasEncounterContent(...)`) liam o **state por closure**, capturado no
momento do clique - se o usuario continuasse digitando durante o fetch, o
autosave real ficaria "dirty" mas o guard (com o valor antigo) nao
detectaria, pulando o auto-save automatico e sobrescrevendo o formulario
sem salvar a edicao feita durante aquele intervalo.

**Correcao aplicada:** as tres checagens agora leem `autosaveStateRef.current`
e `selecionadoRef.current` (refs ja existentes no arquivo, sincronizadas a
cada render, exatamente para este tipo de leitura pos-`await`), em vez do
state capturado por closure. `herdarAtendimentoAnterior` tambem passou a
usar `autosaveStateRef.current` na sua propria checagem inicial, por
consistencia.

## 5) Regressao e riscos residuais

- Nenhuma mudanca de backend - sem risco de regressao no endpoint
  `GET /atendimentos/{id}` (ja usado por `abrirAtendimento`).
- O botao "Usar em novo atendimento" agora sempre faz uma chamada de rede
  extra (`GET /atendimentos/{id}`) mesmo quando os itens de prescricao ja
  estavam disponiveis na lista de historico - custo aceito deliberadamente
  (RF-005/spec.md) para unificar o caminho de codigo e garantir que os
  campos clinicos tambem sejam herdados a partir desse botao.
- Verificacao visual ao vivo nao realizada nesta sessao (mesma limitacao de
  ambiente do pacote anterior) - roteiro documentado na secao 3 para
  confirmacao manual pelo usuario ou proxima sessao com acesso ao Browser
  tool.

## 6) Itens fora de escopo entregues

- Nenhum.

## 7) Decisao de release

- [x] Aprovado para stage - `76315163`, deploy-stage concluido com sucesso
  (sdd-guardrail + quality-gate + deploy-stage). Verificacao visual ao vivo
  nao realizada nesta sessao (mesma limitacao de Browser tool do pacote
  anterior).
- [ ] Aprovado para producao.
