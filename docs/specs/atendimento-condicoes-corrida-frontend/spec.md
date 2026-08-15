# Spec - atendimento-condicoes-corrida-frontend

Data: 2026-08-06
Responsavel: Claude (Sonnet 5)
Status: done

## 1) Escopo funcional

`carregarHistoricoPaciente`, `carregarCadastroComplementar` e
`abrirAtendimento` passam a descartar respostas de rede fora de ordem via
contador de request-id por funcao. `saveAtendimento` passa a serializar
chamadas concorrentes (nunca dois PUT/POST simultaneos para o mesmo
atendimento). `carregarBase` passa a usar `Promise.allSettled` em vez de
`Promise.all`.

## 2) Requisitos funcionais (RF)

- RF-001: `carregarHistoricoPaciente(pacienteId)` incrementa
  `historicoPacienteRequestIdRef` a cada chamada; ao receber a resposta (ou
  erro), so aplica `setHistoricoPaciente` se o request-id capturado no
  inicio da chamada ainda for o mais recente.
- RF-002: `carregarCadastroComplementar(pacienteId)` aplica o mesmo padrao
  via `cadastroComplementarRequestIdRef`, incluindo o caminho de paciente
  invalido/vazio (`aplicarCadastroComplementar()` sem argumentos).
- RF-003: `abrirAtendimento(id)` aplica o mesmo padrao via
  `abrirAtendimentoRequestIdRef`, tanto no caminho de sucesso quanto no de
  erro.
- RF-004: `saveAtendimento(mode)` passa a ser um wrapper sobre
  `executarSaveAtendimento(mode)` (a implementacao original, renomeada):
  se ja houver uma chamada em voo (`salvamentoAtendimentoEmVooRef.current`
  nao nulo), a nova chamada espera essa promise resolver (ignorando erro,
  se houver) e so entao refaz a si mesma recursivamente, usando o
  `formRef.current` mais atual no momento em que de fato executa - nunca
  duas requisicoes de save simultaneas para o mesmo atendimento.
- RF-005: `carregarBase()` troca `Promise.all` por `Promise.allSettled`
  sobre as 5 chamadas (pacientes, clinicas, medicamentos, catalogo de
  exames, frases clinicas); cada recurso com `status === "fulfilled"`
  aplica seu `setState` normalmente; recursos com `status === "rejected"`
  sao listados em uma mensagem de erro unica, sem impedir os demais.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): os guards usam `useRef` (nao `useState`), sem
  disparar re-render adicional por chamada.
- NFR-002 (UX): falha de um recurso secundario no boot (ex.: frases
  clinicas) nao trava mais o carregamento de pacientes/clinicas/
  medicamentos/catalogo; usuario ve mensagem especifica de quais recursos
  falharam.
- NFR-003 (correcao): nunca ha sobrescrita de estado por resposta obsoleta
  nem perda de escrita por save concorrente - ambos os mecanismos
  (request-id e serializacao) sao deterministicos, nao dependem de timing
  de rede para "geralmente funcionar".

## 4) Contratos tecnicos

### API

- Nenhuma mudanca de contrato de API - a correcao e inteiramente do lado
  do cliente (como e quando as respostas sao aplicadas ao estado React).

### Banco/migracoes

- Nao aplicavel.

### Frontend

- Telas afetadas: `frontend/app/atendimento/page.tsx` (pagina inteira,
  mudanca em 4 funcoes internas).
- Estados de UI: `carregarBase` agora pode exibir uma mensagem de erro
  parcial ("Nao foi possivel carregar: X, Y. Recarregue a pagina...")
  mesmo quando outros recursos carregaram com sucesso - antes, qualquer
  falha bloqueava a tela inteira sem diferenciar o que falhou.
- Regras de exibicao/erro: erro de `saveAtendimento` continua sendo
  reportado normalmente; a serializacao apenas atrasa quando a chamada
  efetivamente dispara, nao altera como o erro e comunicado.

## 5) Compatibilidade e rollout

- Backward compatibility: nenhuma mudanca de contrato externo; comportamento
  observavel pelo usuario so muda nos cenarios de corrida (que antes tinham
  resultado indefinido/errado).
- Feature flag: nenhuma.
- Estrategia de rollback: reverter o commit restaura o comportamento
  anterior (com os bugs de corrida).

## 6) Criterios de aceitacao (CA)

- CA-001: trocar de paciente duas vezes rapidamente aplica apenas os dados
  do paciente selecionado por ultimo (historico e cadastro complementar).
- CA-002: clicar em dois casos da lista lateral em sequencia rapida abre
  apenas o atendimento clicado por ultimo.
- CA-003: disparar um save manual enquanto um autosave esta em voo nao
  perde a edicao mais recente - o resultado final no banco reflete o
  estado mais atual do formulario no momento em que o ultimo save de fato
  executa.
- CA-004: falha da chamada de frases clinicas no boot nao impede carregar
  pacientes/clinicas/medicamentos/catalogo de exames.

## 7) Casos de borda

- CB-001: dois saves manuais consecutivos (nao um manual vs autosave)
  tambem sao serializados pelo mesmo mecanismo - nao ha caminho especial
  so para manual-vs-autosave.
- CB-002: se TODOS os 5 recursos de `carregarBase` falharem, a mensagem
  lista todos e a tela permanece funcional o suficiente para o usuario
  recarregar a pagina (nenhum crash de render).

## 8) Fora de escopo

- Cobertura de teste automatizado de frontend (o projeto nao tem test
  runner configurado - ver riscos residuais no verify.md desta feature).
- Reescrita de `carregarBase`/`saveAtendimento` para um padrao de data
  fetching mais amplo.
