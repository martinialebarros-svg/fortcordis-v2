# Intent - atendimento-feedback-erros-frontend

Data: 2026-08-07
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Problema atual

Quatro achados de severidade media da auditoria completa
(docs/AUDITORIA-ATENDIMENTO-ACHADOS-2026-08-04.md, achados #26-#29), todos
sobre tratamento de erro e feedback ao usuario em
`frontend/app/atendimento/page.tsx`:

- **#26**: `carregarCadastroComplementar` tinha `try { ... } finally { ... }`
  sem `catch` externo - se `api.get('/pacientes/${id}')` rejeitasse, a
  excecao se propagava como unhandled rejection (a funcao e chamada via
  `void`, fire-and-forget). O `finally` ainda desligava o spinner, entao a
  tela simplesmente ficava sem os dados do cadastro complementar, sem
  nenhuma mensagem de erro.
- **#27**: `carregarFrasesClinicas` nao tinha absolutamente nenhum
  tratamento de erro (nem try/catch), ao contrario da funcao irma
  `carregarMedicamentosBanco`, que trata o mesmo tipo de chamada com
  try/catch + `setErro`.
- **#28**: `abrirAnexo` usava `extractApiErrorMessageSync` (versao
  sincrona) no catch de uma chamada com `responseType: "blob"` - a versao
  sincrona nao sabe ler `Blob` (so JSON ja parseado), entao cai para
  `error.message`, o texto tecnico generico do axios em ingles, perdendo o
  `detail` real que o backend devolve. As outras 2 chamadas blob do mesmo
  arquivo (PDF de documento e de receita/exames) ja usavam corretamente a
  versao assincrona `extractApiErrorMessage`.
- **#29**: `uploadArquivosResultadoExame` iterava sequencialmente sobre os
  arquivos de um lote; se um arquivo falhasse (limite de tamanho,
  extensao, rede), o loop interrompia (`break`) mas sempre limpava o
  estado de upload pendente incondicionalmente - o vet via so a mensagem
  do arquivo que falhou, sem nenhuma indicacao de que os arquivos
  RESTANTES do lote nunca chegaram a ser enviados.

## 2) Objetivo

Nenhuma falha de rede nessas 4 chamadas fica silenciosa. Quando um lote de
upload e interrompido, o usuario sabe quantos arquivos ficaram de fora, nao
so qual foi o motivo da primeira falha.

## 3) Nao objetivos

- Nao inclui um handler global de `unhandledrejection`/`window.onerror`
  (a auditoria confirmou que nao existe nenhum no frontend) - a correcao e
  pontual, nas 4 funcoes especificas, seguindo o padrao ja estabelecido
  (`setErro` + `extractApiErrorMessage[Sync]`) em vez de introduzir uma
  rede de seguranca global nova.
- Nao inclui retry automatico do upload que falhou nem retomar os arquivos
  que ficaram de fora - a correcao e sobre AVISAR, nao sobre recuperacao
  automatica.

## 4) Contexto e restricoes

- Restricoes tecnicas: `#28` reusa `extractApiErrorMessage` (versao
  async, ja importada no arquivo e usada por outras 2 chamadas blob).
  `#26`/`#27` reusam `extractApiErrorMessageSync` + `setErro`, o mesmo
  padrao ja usado por praticamente toda chamada de API no arquivo.
- Restricoes de prazo: nenhuma.
- Restricoes regulatorio/operacional: nenhuma - risco de usabilidade/
  confianca (dados aparentemente ausentes sem explicacao), nao de
  integridade de dado ou seguranca.

## 5) Impacto esperado

- Usuarios impactados: veterinarios em conexao instavel ou quando a API
  tem instabilidade momentanea.
- Modulos impactados: apenas `frontend/app/atendimento/page.tsx`.
- Risco de regressao: minimo - todas as 4 mudancas sao aditivas
  (adicionar catch, trocar uma funcao de extracao de erro por sua
  contraparte assincrona, adicionar uma mensagem agregada) - nenhum
  caminho de SUCESSO e alterado.

## 6) Riscos iniciais

Nenhum risco relevante identificado - as 4 correcoes seguem exatamente
padroes ja estabelecidos e usados em dezenas de outras chamadas no mesmo
arquivo (nao introduzem tecnica nova).

## 7) Perguntas abertas

Nenhuma - implementacao concluida. Prova determinística da aritmetica de
#29 e do padrao de guard reusado por #19 (pacote irmao) em
`verificacao/verifica_guard_documento_e_contagem_upload.mjs`.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
