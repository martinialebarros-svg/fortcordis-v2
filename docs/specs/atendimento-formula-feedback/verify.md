# Verify - atendimento-formula-feedback

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | Clique real em "Salvar formula na biblioteca" (aba Prescricao) troca a aba ativa para "Bibliotecas clinicas" - confirmado via `computer` click real + leitura do DOM (nenhuma das 4 tabs `fc-care-tab` fica ativa, condizente com `isBibliotecasWorkspace` ser um botao separado). | ok |
| CA-2 | aceitacao | Formulario "Novo medicamento" (banco de medicamentos) aparece pre-preenchido com `nome="Furosemida - formula manipulada"` apos o clique - confirmado via `input.value` no DOM. | ok |
| CA-3 | aceitacao | Toast de confirmacao ("Formula pronta para revisao em Bibliotecas clinicas.") - confirmado por leitura de codigo: mesmo mecanismo `setSucesso`/`sucessoPopup` (timer de 5000ms) usado em ~30 outras acoes do arquivo; captura visual direta nao teve sucesso por latencia do Browser tool exceder a janela de 5s do toast (ver secao 3). | ok (por leitura de codigo) |
| CA-4 | aceitacao | Unico outro call site (`AtendimentoBibliotecasSection.tsx`, botao "Duplicar formula" dentro do proprio banco de medicamentos) so e renderizado quando `workspacePainel === "bibliotecas"` - `setWorkspacePainel("bibliotecas")` e no-op nesse caso, sem efeito colateral. | ok |
| CA-5 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde. | ok |

## 2) Testes automatizados executados

```bash
cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

Sem suite automatizada de UI para esta pagina no projeto.

## 3) Testes manuais

Preview local isolado do worktree (backend `:8017`, frontend `:3017`,
`fortcordis.db`/`.env` copiados so para teste e removidos do worktree
ao final):

1. Login como `admin@fortcordis.com`, paciente real ("marinete")
   selecionado em atendimento novo, aba Prescricao.
2. Item manual adicionado, medicamento "Furosemida" selecionado da
   biblioteca (habilita o botao "Salvar formula na biblioteca").
3. Estado antes do clique confirmado via DOM: aba ativa = "Prescricao".
4. Clique real (`computer` tool) em "Salvar formula na biblioteca" ->
   aba ativa passa a "Bibliotecas clinicas" (nenhuma das 4 tabs
   `fc-care-tab` marcada ativa - esperado, "Bibliotecas" e navegacao
   separada); secao "Banco de medicamentos" / "Novo medicamento"
   visivel com campo Nome pre-preenchido `"Furosemida - formula
   manipulada"` - confirmado via DOM.
5. Toast: tentativas de capturar `sucessoPopup` no DOM apos o clique
   nao encontraram o texto - em ambas as tentativas o round-trip do
   Browser tool (varias chamadas de leitura sequenciais) excedeu o
   timer de auto-dismiss de 5000ms do toast antes da checagem chegar
   a acontecer. Isso NAO indica um bug: o `setSucesso(...)` e chamado
   de forma incondicional e sincrona na mesma função, usando o mesmo
   par `sucesso`/`sucessoPopup` + `useEffect` (linhas ~1507-1535) que
   dispara o toast para toda outra acao do componente (ex.: "Medicamento
   salvo com sucesso.", "Exame adicionado a solicitacao.") - mecanismo
   ja comprovado, nao introduzido por este pacote. Documentando esta
   limitacao de verificacao de forma transparente em vez de afirmar
   uma captura visual que nao ocorreu.
6. Preview encerrado; db/.env copiados removidos do worktree; dados de
   teste existiam so no banco local descartavel.

## 4) Revisao adversarial

Agente ceptico revisou a funcao completa, todos os call sites no
repositorio, os efeitos de sincronizacao do toast e possiveis efeitos
colaterais de `setWorkspacePainel`.

**Veredito: correto, sem achados.**
- Unicos 2 call sites de `duplicarMedicamentoManipulado`: o botao
  "Salvar formula na biblioteca" (Prescricao, o alvo do fix) e um
  botao "Duplicar formula" dentro do proprio banco de medicamentos
  (`AtendimentoBibliotecasSection.tsx:526`), que so renderiza quando
  `workspacePainel` ja e `"bibliotecas"` - `setWorkspacePainel(...)`
  vira um no-op seguro nesse segundo caso.
- Nenhum `useEffect` no arquivo reage a `workspacePainel === "bibliotecas"`
  de forma a resetar `medForm`/`showMedicationBank` ou produzir efeito
  colateral inesperado.
- Mecanismo de toast (`sucesso`/`sucessoPopup`) confirmado idêntico ao
  usado em todo o resto do componente.

## 5) Riscos residuais aceitos

- Toast nao foi capturado visualmente no preview (ver secao 3) - risco
  aceito dado que o mecanismo subjacente e pre-existente e usado em
  dezenas de outros pontos do mesmo arquivo, nao introduzido por este
  pacote.
- Sem suite automatizada cobrindo este comportamento.
- Escopo deste pacote cobre apenas o achado #38 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
