# Intent - atendimento-variaveis-template-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: em andamento

## 1) Problema atual

GitHub issue #42 ("[UX] Variáveis {{chave}} não resolvidas/vazias
indistinguíveis"), origem achado #23 da auditoria UX/fluxo
(`docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md`, issue de tracking
#57): `renderizar_template_documento`
(`backend/app/services/atendimento/document_context_service.py`) deixa
`{{chave}}` literal no texto quando a chave nao existe no contexto, e
varias chaves do contexto (peso, tutor, raca, idade etc.) resolvem
para string vazia quando o dado nao existe no cadastro do paciente. O
editor e um `<textarea>` plano exibindo o corpo ja mesclado, sem
qualquer marcacao visual distinguindo "preenchido pelo sistema",
"vazio por falta de dado" ou "placeholder nao reconhecido".

Confirmado ao vivo neste pacote (endpoint real, template real
"Parecer Medico Veterinario", paciente sem raca/tutor/idade
cadastrados): o corpo gerado saiu com `"...raca , com , de propriedade
do(a) tutor(a) ."` - a lacuna silenciosa exatamente como descrita na
auditoria, sem qualquer indicio visual de que algo esta faltando.

## 2) Objetivo

Os dois pontos da sugestao da auditoria, com uma divisao de
responsabilidade backend/frontend por natureza do problema:

1. **Placeholders nao resolvidos** (`{{chave}}` que sobra literal no
   texto porque a chave nem existe no contexto) - sempre
   re-detectavel a partir do texto atual, em qualquer momento,
   independente de como o texto chegou ali (criado de template,
   editado a mao, documento legado). Implementado 100% no frontend:
   scan por regex em tempo real sobre `documentoClinicoForm.titulo`/
   `corpo`, com banner amber + confirmacao antes de gerar o PDF.
2. **Campos vazios vindos do contexto** (chave existe mas o dado nao
   esta cadastrado) - so detectavel no momento da fusao
   template+contexto, contra o TEMPLATE original; depois de mesclado,
   um campo vazio e indistinguivel de texto normal ausente. Resolvido
   no backend: `identificar_variaveis_vazias` roda no momento da
   criacao do documento a partir de um template e retorna a lista de
   chaves vazias na resposta da API; o frontend mostra isso como um
   aviso pontual (toast) no momento da criacao.

## 3) Decisao de arquitetura - por que nao um so mecanismo

Um mecanismo unico "so no frontend" nao cobriria o caso 2 (campo
vazio), porque depois que `{{peso}}` e substituido por `""`, nao ha
mais nenhum marcador no texto dizendo que aquele espaco vazio "era"
uma variavel - e indistinguivel de qualquer outro espaco em branco do
documento. Um mecanismo unico "so no backend" nao cobriria bem o caso
1 de forma reativa a edicoes do vet no textarea (o vet pode digitar
`{{algo}}` manualmente, ou editar um documento antigo que ja tinha
placeholders nao resolvidos de antes deste pacote) sem reconsultar a
API a cada tecla.

Por isso, dividido: deteccao viva de placeholders remanescentes
(frontend, sempre atual) + aviso pontual de campos vazios no momento
da criacao a partir de template (backend, so tem essa informacao
naquele momento exato).

## 4) Nao objetivos

- Nao ha highlight inline dentro do `<textarea>` - tecnicamente
  impossivel (textarea nao renderiza HTML), por isso o aviso e um
  banner acima do campo + lista textual das chaves problematicas, em
  vez de um `<mark>` inline como a auditoria sugere como exemplo
  (a auditoria tambem oferece a alternativa "ou um contador", que e o
  formato adotado aqui).
- Nao bloqueia "Gerar PDF" de forma rigida - usa `window.confirm()`
  (mesmo padrao ja estabelecido no pacote `atendimento-documento-
  emitido-aviso`, achado #43), permitindo que o vet prossiga
  intencionalmente (ex.: placeholder que ele sabe que vai preencher a
  mao no PDF impresso, ou nao se aplica a este documento).
- Nao adiciona um novo campo persistido na tabela `documentos_
  atendimento` para os campos vazios - e um aviso pontual (toast) no
  momento da criacao, nao um estado continuo do documento (evita
  ficar "desatualizado" depois que o vet edita o corpo).
- Nao altera `montar_contexto_template_documento` nem os valores que
  cada chave resolve - so adiciona a deteccao de quais ficaram vazias.
