# Intent - atendimento-formula-feedback

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #38 ("[UX] 'Salvar formula' sem feedback visivel"), origem
achado #19 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): o botao "Salvar formula na biblioteca" (aba Prescricao, card de
um item com medicamento selecionado) executa
`duplicarMedicamentoManipulado`, que apenas abre o banco de
medicamentos internamente (`setShowMedicationBank(true)`) e preenche o
formulario (`setMedForm(...)`) - sem trocar de aba
(`setWorkspacePainel`) e sem toast (`setSucesso("")` limpava, em vez de
mostrar, uma mensagem). Como o banco de medicamentos so e renderizado
na aba "Bibliotecas clinicas" (`isBibliotecasWorkspace`), nada muda
visualmente enquanto o vet permanece em "Prescricao".

O vet clica esperando confirmacao, nada acontece na tela, e assume que
a acao falhou - podendo clicar de novo sem efeito adicional perceptivel
- ate descobrir por conta propria que precisa abrir manualmente
"Bibliotecas clinicas" para ver o formulario pre-preenchido.

## 2) Objetivo

Exatamente como sugerido pela auditoria: fazer a funcao tambem trocar
para a aba Bibliotecas (`setWorkspacePainel("bibliotecas")`) e exibir
um toast de confirmacao ("Formula pronta para revisao em Bibliotecas
clinicas.") usando o mecanismo de toast (`sucesso`/`sucessoPopup`) ja
existente e usado em todas as outras acoes do componente.

## 3) Nao objetivos

- Nao alterar o comportamento de `hydrateMedicationForm`/pre-preenchimento
  do formulario - ja funciona corretamente, so nao era visivel.
- Nao mudar o fluxo de salvamento efetivo do medicamento
  (`saveMedicamento`) - o vet ainda precisa revisar e clicar "Salvar
  medicamento" na aba Bibliotecas; este pacote so torna essa etapa
  visivel/alcancavel.
- Nao adicionar um novo mecanismo de toast - reaproveita
  `setSucesso`/`sucessoPopup` (auto-dismiss em 5s), o mesmo usado em
  todas as outras ~30 acoes do componente (salvar exame, salvar
  documento, etc.), para manter consistencia visual.
- Unico call site de `duplicarMedicamentoManipulado` no componente e o
  botao "Salvar formula na biblioteca" (aba Prescricao); a mudanca nao
  afeta nenhum outro fluxo.
