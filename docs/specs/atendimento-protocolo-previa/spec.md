# Spec - atendimento-protocolo-previa

Data: 2026-08-12
Responsavel: Claude (pareado com Martiniano)
Status: done

## 1) Escopo funcional

Os chips de protocolo em `AtendimentoPrescricaoWorkspace` deixam de aplicar
instantaneamente. Selecionar um protocolo (clique, ou automaticamente
quando um gatilho casa com o diagnostico) abre uma previa inline mostrando
o gatilho identificado (se houver), os itens de receita e as orientacoes
que seriam inseridos, com botoes "Aplicar protocolo"/"Descartar". Nenhuma
mudanca de backend.

## 2) Requisitos funcionais (RF)

- RF-001: clicar em um chip de protocolo chama `selecionarProtocoloPrescricao(key)`
  em vez de aplicar diretamente. Se o mesmo protocolo ja estiver selecionado,
  o clique fecha a previa (toggle); caso contrario, seleciona esse protocolo
  (substituindo a previa de outro, se houver).
- RF-002: o efeito automatico que recomenda um protocolo com base no
  diagnostico continua selecionando-o quando nao ha selecao ativa, mas
  respeita `protocoloPrescricaoDecididoPara` (RF-005) para nao reabrir uma
  previa ja decidida para o texto de diagnostico atual.
- RF-003: a previa exibe:
  - o gatilho que casou com o diagnostico atual para o protocolo
    selecionado (via `protocoloPrescricaoSelecionadoGatilho`), ou uma
    mensagem indicando selecao manual sem gatilho quando nao houver match;
  - a lista de itens que seriam inseridos (`protocoloPrescricaoSelecionadoItensPreview`,
    gerada por `montarItemDeProtocoloPrescricao` - a mesma funcao usada na
    aplicacao real), com nome do medicamento, dose/frequencia/duracao/via e
    instrucoes quando presentes;
  - as orientacoes padrao do protocolo, se houver;
  - o retorno em dias sugerido, se houver.
- RF-004: "Aplicar protocolo" chama `aplicarProtocoloSelecionado()`, que
  aplica o protocolo (via `aplicarProtocoloPrescricao`, logica inalterada) e
  fecha a previa. "Descartar" fecha a previa sem alterar o formulario.
- RF-005: fechar a previa (aplicar, descartar, ou toggle no chip) marca
  `protocoloPrescricaoDecididoPara = diagnosticoTextoConsolidado` **somente**
  quando o protocolo fechado e o recomendado pelo gatilho atual
  (`protocoloPrescricaoRecomendado?.key`). Fechar um protocolo selecionado
  manualmente (sem gatilho, ou diferente do recomendado) nao marca a
  decisao - a recomendacao automatica, se houver, continua disponivel.
- RF-006: `protocoloPrescricaoDecididoPara` e zerado (`null`) nos mesmos 3
  pontos onde `protocoloPrescricaoSelecionado` ja era zerado ao trocar de
  contexto: abrir um atendimento historico, iniciar um novo atendimento
  para o mesmo paciente, e herdar dados de um atendimento anterior.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (previa fiel a aplicacao real): a previa e a aplicacao usam a
  mesma funcao de geracao de item (`montarItemDeProtocoloPrescricao`) -
  impossivel a previa mostrar algo diferente do que seria de fato inserido.
- NFR-002 (nao bloqueante): a previa e um card inline dentro da secao
  "Contexto da prescricao", sem overlay - o restante da tela permanece
  interativo enquanto a previa esta aberta.
- NFR-003 (sem chamada de API nova): toda a logica e client-side, sobre
  dados ja carregados (`PROTOCOLOS_PRESCRICAO`, `medicamentos`, `form`).

## 4) Contratos tecnicos

### API

- Nenhuma mudanca.

### Banco/migracoes

- Nenhuma.

### Frontend

- `frontend/app/atendimento/page.tsx`:
  - Novo estado: `protocoloPrescricaoDecididoPara` (`string | null`).
  - Novo memo: `protocoloPrescricaoSelecionadoGatilho`.
  - Nova constante por render: `protocoloPrescricaoSelecionadoItensPreview`.
  - Novas funcoes: `fecharPreviaProtocoloPrescricao`,
    `selecionarProtocoloPrescricao`, `descartarProtocoloSelecionado`.
  - `aplicarProtocoloSelecionado` (ja existia, nunca era chamada) passa a
    ser usada e a fechar a previa apos aplicar.
  - Efeito de auto-selecao atualizado para checar `protocoloPrescricaoDecididoPara`.
  - `aplicarProtocoloPrescricao` deixa de ser passada como prop para
    `AtendimentoPrescricaoWorkspace` (nao e mais chamada pelo componente
    filho diretamente).
- `frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx`:
  - Chip de protocolo: `onClick` passa a chamar `selecionarProtocoloPrescricao`;
    destaque visual distingue "selecionado" (teal solido) de "recomendado
    mas nao selecionado" (teal claro).
  - Novo bloco de previa inline (card `border-teal-200 bg-teal-50/60`) com
    gatilho, itens, orientacoes, retorno e os botoes Aplicar/Descartar.

## 5) Compatibilidade e rollout

- Backward compatibility: sim - `atendimento-prescricao-protocolos.ts`
  (catalogo de protocolos) nao foi alterado; a funcao que efetivamente
  insere itens (`aplicarProtocoloPrescricao`) tambem nao foi alterada.
- Estrategia de rollback: reverter o commit. Sem estado persistido no
  backend.

## 6) Criterios de aceitacao (CA)

- CA-001: diagnostico/queixa contendo um gatilho de protocolo abre
  automaticamente a previa desse protocolo, mostrando o gatilho exato que
  casou.
- CA-002: a previa lista os itens de receita (nome, dose/frequencia/duracao/via,
  instrucoes) e as orientacoes que seriam inseridas, sem alterar
  `form.prescricao_itens`/`form.prescricao_orientacoes` ate "Aplicar" ser
  clicado.
- CA-003: clicar "Descartar" fecha a previa sem alterar o formulario, e a
  previa do mesmo protocolo recomendado nao reaparece enquanto o texto de
  diagnostico nao mudar.
- CA-004: clicar "Aplicar protocolo" insere os itens/orientacoes (mesmo
  resultado de antes deste pacote) e fecha a previa.
- CA-005: selecionar manualmente um protocolo sem gatilho casando mostra a
  mensagem de selecao manual, sem gatilho, e sem impedir a previa continuar
  funcional (Aplicar/Descartar).
- CA-006: descartar um protocolo selecionado manualmente (nao o
  recomendado) nao suprime a recomendacao automatica - ela reaparece.
- CA-007: `npx tsc --noEmit` e `npm run build` do frontend aprovados sem
  novos erros/warnings.

## 7) Casos de borda

- CB-001: protocolo sem itens de receita (ex.: "Endocardiose B1", so
  orientacoes/retorno) mostra a mensagem "Este protocolo nao inclui itens
  de receita..." em vez de uma lista vazia.
- CB-002: item sem medicamento correspondente no catalogo (`buscarMedicamentoPorKeywords`
  sem match) ainda aparece na previa com o `nomeFallback` e os campos que
  vieram da config do protocolo (frequencia/duracao/via/instrucoes), mesmo
  sem dose calculada.
- CB-003: trocar de atendimento com uma previa aberta nao deixa residuo -
  `protocoloPrescricaoSelecionado` e `protocoloPrescricaoDecididoPara` sao
  zerados nos mesmos 3 pontos de reset (RF-006).

## 8) Fora de escopo

- Alterar o catalogo de protocolos ou o algoritmo de matching de gatilho.
- Destacar o gatilho dentro do texto do campo de diagnostico/queixa.
- Desfazer um protocolo ja aplicado.
