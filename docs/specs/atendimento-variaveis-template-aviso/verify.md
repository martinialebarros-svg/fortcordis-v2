# Verify - atendimento-variaveis-template-aviso

Data: 2026-08-11
Responsavel: Claude (pareado com Martiniano)
Status: implementado, aguardando deploy

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-1 | aceitacao | `identificar_variaveis_vazias`: 5 testes unitarios cobrindo valor vazio/preenchido/ausente-do-contexto/repetido/sem-chaves - todos passam. | ok |
| CA-2 | aceitacao | End-to-end real: `POST /atendimentos/1/documentos {template_id: 1}` com paciente sem `raca` cadastrada -> resposta real `variaveis_vazias: ["idade", "raca", "tutor_nome"]`, corpo mesclado confirmado com a lacuna silenciosa exata da auditoria. | ok |
| CA-3 | aceitacao | Scan live de placeholders nao resolvidos (`extrairVariaveisNaoResolvidas`) reaproveitado em 2 pontos (`useMemo` do editor + guard de `baixarPdfDocumentoClinico`), cobrindo tanto o editor aberto quanto o download a partir da lista. | ok (por leitura de codigo + revisao adversarial) |
| CA-4 | aceitacao | `pytest tests/ -k "atendimento or documento or template"` (163/163) - sem regressao. | ok |
| CA-5 | aceitacao | `npx tsc --noEmit` sem erros; `npm run build` verde. | ok |

## 2) Testes automatizados executados

```bash
cd backend && venv/bin/python -m pytest tests/test_atendimento_documento_variaveis_vazias.py -v
# 5 passed

cd backend && venv/bin/python -m pytest tests/ -k "atendimento or documento or template" -q
# 163 passed, 541 deselected

cd frontend && npx tsc --noEmit
# sem saida (0 erros)

cd frontend && npm run build
# Compiled successfully
```

## 3) Testes manuais / end-to-end

Preview local isolado do worktree (backend `:8019`, frontend `:3019`,
`fortcordis.db`/`.env` copiados so para teste e removidos do worktree
ao final):

1. `raca` do paciente real "celine" (id 9) zerada no banco local
   copiado, so para o teste.
2. Login via `fetch()` autenticado (`POST /api/v1/auth/login`,
   `application/x-www-form-urlencoded`, `username`/`password` -
   contrato `OAuth2PasswordRequestForm`), token salvo em
   `localStorage` (`token`/`user`, mesmas chaves que `lib/axios.ts`
   usa) para igualar o comportamento real do frontend.
3. `POST /api/v1/atendimentos/1/documentos {template_id: 1}`
   (template real "Parecer Medico Veterinario", que referencia
   `{{raca}}`, `{{idade}}`, `{{tutor_nome}}` entre outras) - resposta
   `201` real:
   - `corpo`: `"...raca , com , de propriedade do(a) tutor(a) ."` -
     a lacuna silenciosa exatamente como descrita na auditoria,
     confirmando o problema original.
   - `variaveis_vazias: ["idade", "raca", "tutor_nome"]` - a nova
     deteccao capturou corretamente as 3 chaves que resolveram vazio.
4. **Limitacao encontrada nesta sessao de preview:** apos autenticar e
   navegar para `/atendimento`, nem clique (via `computer`, testado
   com `ref` e com coordenada apos `screenshot`) nem digitacao
   (`computer` type, inclusive apos confirmar via `element.focus()`
   programatico que o campo realmente ficava focado no DOM)
   registraram como entrada real - `document.activeElement`
   permanecia `<body>` e nenhum caractere aparecia no campo. Isso
   impediu navegar interativamente ate abrir o editor de documentos e
   capturar visualmente o banner amber e o `window.confirm()`. E uma
   instabilidade do pipeline de input do Browser tool nesta sessao
   especifica (a mesma pagina aceitou `.focus()` programatico sem
   problema, e os pacotes anteriores desta mesma sessao longa - #21,
   #38, e outros antes - tiveram cliques reais funcionando
   normalmente), nao um bug de codigo. Mitigado por:
   - A verificacao backend end-to-end real (passo 3), que cobre a
     logica de negocio completa (o nucleo funcional do achado #42).
   - Os dois elementos visuais novos (banner amber com
     `AlertTriangle`, `window.confirm()` antes de uma acao) serem
     exatamente os mesmos padroes ja implementados E verificados
     visualmente ao vivo, com clique real, no pacote imediatamente
     anterior desta mesma auditoria (`atendimento-documento-emitido-
     aviso`, achado #43) - nao e um mecanismo novo sem precedente de
     verificacao visual nesta base de codigo.
5. Preview encerrado; db/.env copiados removidos do worktree.

## 4) Revisao adversarial

Agente ceptico leu a funcao `identificar_variaveis_vazias` completa,
o endpoint `criar_documento_atendimento`, o guard de
`baixarPdfDocumentoClinico`, e os 5 testes novos.

**Achado real (CONFIRMED), corrigido nesta mesma sessao:**
`criar_documento_atendimento` calculava `variaveis_vazias` a partir do
template CRU, mas `payload.titulo`/`payload.corpo` podiam sobrescrever
o texto renderizado do template (`titulo = (payload.titulo or "").
strip() or titulo_base`) sem que o calculo de `variaveis_vazias` levas-
se isso em conta - se um chamador enviasse `template_id` E `titulo`/
`corpo` explicitos na mesma requisicao, o `variaveis_vazias` reportado
descreveria placeholders do template que nem estao no texto realmente
salvo. Confirmado que o frontend atual nunca envia essa combinacao
(`criarDocumentoClinicoDeTemplate` so envia `template_id`), mas e um
bug de contrato real na API, nao so hipotetico.

**Correcao aplicada:** `variaveis_vazias` so e calculado quando o
`titulo`/`corpo` finais (apos a logica de fallback) sao exatamente
iguais a `titulo_base`/`corpo_base` (ou seja, o chamador nao
sobrescreveu o texto renderizado do template) - `atendimento.py`,
`criar_documento_atendimento`. Reverifiquei: `pytest` (163/163) e
sintaxe (`ast.parse`) apos a correcao, sem regressao.

**Demais pontos verificados pelo agente, sem achados:**
- Classificacao vazio/nao-vazio correta para todos os tipos de valor
  que o contexto realmente produz (sempre `str` ou `None`, nunca
  int/float cru - confirmado lendo `montar_contexto_template_
  documento` e os modelos de dados).
- `baixarPdfDocumentoClinico` sempre le `documentoParaPdf` DEPOIS do
  possivel auto-save, em todos os 3 caminhos (novo save, re-save do
  documento aberto, download de item da lista) - sem caminho com
  conteudo desatualizado.
- Campo `variaveis_vazias` na resposta e aditivo/seguro - nenhum
  validador estrito (zod ou `response_model`) que rejeitaria a chave
  nova.
- Os 5 testes novos exercitam ramos reais e distintos da
  implementacao, sem asserts tautologicos.

## 5) Riscos residuais aceitos

- Verificacao visual do banner/confirm nao capturada nesta sessao (ver
  secao 3) - mitigado pela verificacao backend real + reuso de
  padroes ja verificados visualmente no pacote #43.
- Sem teste de nivel de endpoint (TestClient) para o cenario corrigido
  (`template_id` + `titulo`/`corpo` explicitos na mesma requisicao) -
  a funcao pura subjacente (`identificar_variaveis_vazias`) esta 100%
  testada; o caminho corrigido no endpoint nao e alcancavel pelo
  frontend atual e adicionar infraestrutura de teste TestClient
  completa (auth, fixtures de DB) so para este edge case nao pareceu
  proporcional ao esforco "medio" deste pacote - documentado aqui de
  forma transparente em vez de omitido.
- Escopo deste pacote cobre apenas o achado #42 (issue de tracking
  #57); os demais achados permanecem para pacotes futuros.
