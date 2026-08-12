# Intent - atendimento-protocolo-previa

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Problema atual

**Origem:** `docs/AUDITORIA-ATENDIMENTO-UX-FLUXO-2026-08-09.md` - achado #18
(dimensao: Fluxo de prescricao), rastreado como issue #37.

Os protocolos de prescricao (`PROTOCOLOS_PRESCRICAO`) usam gatilhos
(palavras-chave) comparados ao texto de diagnostico/queixa para recomendar
um protocolo, mas nenhuma keyword aparece na tela - o card so mostra o nome
do protocolo. Ao clicar em qualquer chip de protocolo, os itens de receita
sao inseridos e as orientacoes concatenadas de forma sincrona e imediata,
sem nenhuma previa do que sera adicionado.

Um clique injeta 2-3 medicamentos com dose e frequencia prontos; o vet so
percebe um clique equivocado ao rolar a lista de itens e remover cada um
manualmente. Como o card nao diz qual termo disparou a sugestao, tambem nao
ha como avaliar a pertinencia antes de aceitar.

## 2) Objetivo

Exibir, para o protocolo selecionado, qual gatilho (se algum) casou com o
diagnostico atual, e substituir a aplicacao direta por uma previa dos itens
de receita e orientacoes que seriam inseridos - com botoes explicitos
"Aplicar protocolo"/"Descartar" antes de qualquer mudanca no formulario.

## 3) Nao objetivos

- Mudar o algoritmo de matching de gatilho (substring simples, case/acento
  normalizados via `normalizarTokenPrescricao`) - fora do escopo do achado.
- Editar o catalogo de protocolos (`atendimento-prescricao-protocolos.ts`) -
  os 4 protocolos existentes e seus gatilhos/itens permanecem inalterados.
- Destacar o gatilho diretamente no texto do campo de diagnostico/queixa
  (ex.: sublinhar a palavra) - o achado pede para mostrar "qual gatilho
  casou" no card do protocolo, o que a previa ja cobre.
- Desfazer um protocolo ja aplicado - a correcao continua sendo remover os
  itens indesejados manualmente (fluxo ja existente), como antes.
- Calcular a dose de forma diferente na previa vs. na aplicacao real - a
  previa reusa exatamente `montarItemDeProtocoloPrescricao`, a mesma funcao
  que gera os itens reais, para nunca divergir do que sera de fato inserido.

## 4) Contexto e restricoes

- **Decisao de engenharia (reaproveitar estado existente):** o estado
  `protocoloPrescricaoSelecionado` e a funcao `aplicarProtocoloSelecionado`
  ja existiam no codigo, mas `aplicarProtocoloSelecionado` nunca era chamada
  por nenhum lugar da UI (codigo morto) - o clique no chip chamava
  `aplicarProtocoloPrescricao` diretamente. Isso sugere um design anterior
  de "selecionar, depois aplicar" que nunca foi conectado a UI. Este pacote
  completa esse design: o clique no chip agora so seleciona (abre a previa);
  `aplicarProtocoloSelecionado` passa a ser o botao "Aplicar protocolo".
- **Decisao de engenharia (previa proativa, nao so sob clique):** o efeito
  que auto-seleciona o protocolo recomendado quando o diagnostico casa com
  um gatilho (`useEffect` existente) foi mantido, mas agora, como a selecao
  abre a previa, isso significa que a previa aparece proativamente (inline,
  nao bloqueante) assim que o vet digita um diagnostico compativel - nao
  exige um clique previo. Julgado como o comportamento correto: o achado
  quer transparencia *antes* de aplicar, e mostrar a previa sem exigir uma
  acao extra e mais transparente, nao menos.
- **Decisao de engenharia (por que nao reabrir apos "Descartar"):** como o
  efeito de auto-selecao roda a cada render enquanto o gatilho continuar
  casando, descartar a previa do protocolo recomendado faria ela reaparecer
  imediatamente no proximo render sem o novo estado de controle. Foi
  adicionado `protocoloPrescricaoDecididoPara` (string | null), guardando o
  texto de diagnostico para o qual o vet ja decidiu (aplicou ou descartou) o
  protocolo recomendado. O efeito de auto-selecao passa a verificar esse
  valor antes de reabrir. Ao editar o diagnostico (texto consolidado muda),
  a decisao anterior deixa de valer e a recomendacao pode aparecer de novo
  (inclusive para o mesmo protocolo, se o novo texto ainda casar).
- **Decisao de engenharia (descarte de protocolo escolhido manualmente):**
  `protocoloPrescricaoDecididoPara` so e gravado quando o protocolo
  descartado/aplicado e o *recomendado* (`protocoloPrescricaoRecomendado?.key
  === protocoloKey`). Descartar um protocolo escolhido manualmente (sem
  gatilho, so para explorar) nao marca o diagnostico como "decidido" - ao
  fechar essa previa manual, a recomendacao automatica (se houver) volta a
  aparecer, em vez de ficar tambem suprimida.
- **Decisao de engenharia (toggle no chip):** clicar no chip do protocolo ja
  selecionado fecha a previa (mesmo efeito de "Descartar"), em vez de nao
  fazer nada - evita a necessidade de rolar até o botao "Descartar" so para
  fechar uma previa aberta por engano.

## 5) Impacto esperado

- Usuarios impactados: veterinarios, ao usar protocolos de prescricao
  rapidos na aba Prescricao.
- Modulos impactados: Atendimento (frontend) - `page.tsx` e
  `AtendimentoPrescricaoWorkspace.tsx`. Nenhuma mudanca de backend, banco ou
  contrato de API. `atendimento-prescricao-protocolos.ts` nao foi alterado.
- Risco de regressao: baixo - a funcao que efetivamente insere itens
  (`aplicarProtocoloPrescricao`) nao foi alterada; so o gatilho de chamada
  (clique direto -> clique + confirmacao explicita) e o que muda.

## 6) Riscos iniciais

- Risco 1: a previa mostrar uma dose diferente da que sera realmente
  aplicada. Mitigado reusando a mesma funcao `montarItemDeProtocoloPrescricao`
  para gerar tanto a previa quanto os itens reais - impossivel divergir por
  construcao.
- Risco 2: a previa proativa (sem clique) ser vista como intrusiva. Mitigado
  por ser um card inline dentro da secao "Contexto da prescricao", sem
  overlay nem bloqueio de interacao com o resto da tela - o vet pode ignorar
  e continuar preenchendo outros campos livremente.
- Risco 3: `protocoloPrescricaoDecididoPara` nao resetar ao trocar de
  atendimento, herdando uma decisao de um atendimento anterior - por
  exemplo, se dois atendimentos tiverem o mesmo texto de diagnostico
  (frase padrao reutilizada entre pacientes), a decisao do atendimento
  anterior suprimiria indevidamente a recomendacao no novo. Mitigado
  explicitamente: `setProtocoloPrescricaoDecididoPara(null)` foi adicionado
  nos 3 mesmos pontos onde `setProtocoloPrescricaoSelecionado("")` ja
  zerava a selecao ao abrir um atendimento historico, iniciar um novo
  atendimento e herdar dados de um atendimento anterior.

## 7) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
