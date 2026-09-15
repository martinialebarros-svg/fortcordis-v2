# Spec - atendimento-formula-feedback

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Comportamento esperado

`duplicarMedicamentoManipulado(item)` (`page.tsx`), ao ser chamada pelo
botao "Salvar formula na biblioteca" (visivel quando
`item.medicamento_id` esta preenchido, no card do item de prescricao):

1. Continua abrindo o banco de medicamentos (`setShowMedicationBank(true)`)
   e pre-preenchendo `medForm` com os dados derivados do medicamento de
   origem (nome com sufixo "- formula manipulada", observacoes
   concatenadas) - comportamento inalterado.
2. Passa a chamar `setWorkspacePainel("bibliotecas")`, trocando a aba
   ativa para "Bibliotecas clinicas", onde o formulario pre-preenchido
   fica imediatamente visivel.
3. Passa a chamar `setSucesso("Formula pronta para revisao em
   Bibliotecas clinicas.")` em vez de `setSucesso("")`, disparando o
   toast padrao do app (`sucessoPopup`, auto-dismiss em 5s).
4. `setErro("")` inalterado (limpa qualquer erro anterior).

## 2) Casos de borda

- Vet ja estava na aba Bibliotecas ao clicar (fluxo indireto, nao o
  call site principal): `setWorkspacePainel("bibliotecas")` e um
  no-op visual (ja estava la), toast ainda aparece normalmente.
- Multiplos cliques rapidos no botao: cada clique reseta o timer do
  toast (mesmo padrao de todas as outras chamadas `setSucesso` no
  arquivo) e sobrescreve `medForm` com os dados do medicamento atual -
  comportamento pre-existente, inalterado por este pacote.
- Nenhum outro call site de `duplicarMedicamentoManipulado` no
  componente - mudanca isolada ao unico botao "Salvar formula na
  biblioteca".

## 3) Fora de escopo

- Scroll automatico até o formulario dentro da aba Bibliotecas (o
  formulario ja aparece por estar no topo da secao renderizada quando
  `showMedicationBank` e true) - nao necessario para o achado #38.
- Nenhuma mudanca de backend/contrato - `duplicarMedicamentoManipulado`
  e puramente client-side (nao persiste nada até o vet clicar "Salvar
  medicamento" na aba Bibliotecas).
