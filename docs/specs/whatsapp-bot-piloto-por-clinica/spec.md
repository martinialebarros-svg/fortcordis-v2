# Spec - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: draft

## Escopo funcional

Terceiro nivel de controle do bot de atendimento, entre o global e o por
conversa: **participacao por clinica parceira**, com modo proprio. Somado a uma
postura de participacao que, no piloto, inverte o default — quem nao foi
habilitado fica de fora, em vez de herdar o padrao institucional.

## Requisitos funcionais

- **RF-P01 (estado por clinica)**: nova tabela `whatsapp_bot_clinica_estado`
  com `clinica_id` (unico, FK para `clinicas`), `modo`
  (`off` | `suggest` | `auto`), `habilitado_por_id`, `observacao`,
  `created_at`, `updated_at`. Estado operacional do bot, com historico e
  responsavel — por isso tabela propria, e nao coluna nova em `Clinica`, que
  ja carrega 25 colunas de cadastro.

- **RF-P02 (postura de participacao)**: nova coluna
  `configuracoes.whatsapp_bot_participacao`, `todos` | `piloto`, default
  **`todos`** (preserva o comportamento atual).
  - Em `todos`: nada muda em relacao a hoje.
  - Em `piloto`: **ausencia de habilitacao explicita significa `off`**, nao o
    padrao institucional. Vale para clinica e para tutor.

- **RF-P03 (ordem de precedencia)**: do mais especifico para o mais geral.
  1. `whatsapp_bot_conversa_estado.modo`, quando **nao for nulo**;
  2. `whatsapp_bot_clinica_estado.modo`, quando a identidade resolver para
     clinica e houver linha;
  3. `configuracoes.whatsapp_bot_modo`, **exceto** em `piloto`, onde a ausencia
     dos dois anteriores resulta em `off`.

  O nivel 1 ganha do 2 de proposito: e o controle operacional do atendente na
  conversa aberta, e precisa poder desligar o bot na hora mesmo numa clinica
  habilitada.

  **A resolucao nunca recalcula o nivel 3 (2026-08-24).** `resolve_modo_efetivo`
  recebe o `modo_atual` que o chamador ja resolveu (conversa, com fallback
  institucional) e so o substitui quando a clinica tem modo proprio. A primeira
  implementacao relia o institucional e sobrescrevia o parametro; dois testes
  existentes quebraram e expuseram o defeito, que era duplo: o parametro `modo`
  virava mentira, e duas leituras da mesma coisa podiam discordar. Pelo mesmo
  motivo, `_process_job` passa adiante o `estado` que ja consultou, em vez de
  deixar a geracao reconsultar a mesma linha no caminho quente.

- **RF-P10 (linha de estado nao e opt-in) - 2026-08-25**: em
  `whatsapp_bot_conversa_estado`, `modo` e **anulavel**, e `NULL` significa
  "sem override por conversa". A tabela guarda duas coisas na mesma linha: a
  escolha de modo (decisao de gente) e a escrituracao de pausa e handoff
  (efeito colateral do worker). Enquanto a coluna foi `NOT NULL DEFAULT
  'suggest'`, anotar uma pausa criava tambem um override que ninguem pediu.

  Isso furava o nivel 3 do RF-P03: `pause_conversation` e `set_handoff_motivo`
  gravavam `'suggest'` sozinhos, e o curto-circuito do nivel 1 passava a valer
  para sempre. Bastava **uma** emergencia, um pedido de humano ou uma pausa
  para a conversa ficar isenta do piloto. Nos dois caminhos de handoff nao ha
  `pausado_ate`, e `handoff_motivo` nao e portao em lugar nenhum, entao a
  proxima mensagem do mesmo numero ja chegava ao gerador.

  Os dois construtores passam `modo=None` **explicito**, e o model perde o
  `default`. Sem remover o default a mudanca nao teria efeito: o SQLAlchemy
  omite atributo `None` no INSERT e deixa o default Python gravar `'suggest'`
  assim mesmo.

- **RF-P11 (cortesia nao pede resposta) - 2026-08-25**: mensagem formada
  apenas por saudacao, agradecimento, confirmacao ou despedida e barrada
  ANTES da geracao, gravando `suppressed` com motivo `sem_pergunta`.

  Nasceu do primeiro caso real do piloto em producao: a clinica `Vet Plus`
  escreveu "Bom dia, obrigada." e o bot gastou 1210 tokens de entrada, 147 de
  saida e 9,3s para produzir um texto que o proprio guardrail barrou por
  `sem_fonte`. Alem do custo, isso poluia a taxa de bloqueio - que existe para
  medir problema de QUALIDADE e e insumo da decisao de `auto`. Agradecimento
  contado como bloqueio faz a metrica somar duas coisas diferentes.

  **O detector exige que a mensagem INTEIRA seja cortesia**, ao contrario de
  `detecta_emergencia` e `detecta_pedido_humano`, que casam por substring.
  Substring aqui engoliria "obrigada, voces fazem eco?" - que contem
  "obrigada" e e uma pergunta de verdade. O casamento consome o trecho
  encontrado e so devolve `True` quando nao sobra nada.

  **Posicao**: imediatamente antes de `gerar_resposta`, depois de emergencia,
  pedido de humano, pausa e janela. E o unico ponto onde o portao economiza
  algo, e manter os anteriores na frente garante que nenhum deles seja
  mascarado por uma saudacao no comeco da mensagem.

  **Erra para o lado seguro nas duas direcoes**, e isso e o que autoriza uma
  heuristica simples: falso positivo apenas deixa de oferecer rascunho, e a
  mensagem continua visivel na central para uma pessoa; falso negativo devolve
  ao comportamento anterior. Fonte de termos ilegivel resulta em lista vazia,
  ou seja, nada e cortesia - erra para gerar, nunca para calar.

- **RF-P04 (onde o portao roda)**: a checagem por clinica acontece em
  `gerar_resposta`, logo apos `_escopo_da_persona` resolver `clinica_id`
  (`whatsapp_bot_generation.py:225`), e **antes de qualquer gasto de token**
  (chamada ao provider na linha 301). Nao pode ir junto dos portoes de
  `_process_job`, que rodam antes da resolucao de identidade.

- **RF-P05 (decisao registrada)**: conversa barrada pela participacao grava
  resposta com `decisao="suppressed"` e motivo
  `fora_do_piloto` (identidade nao habilitada) ou
  `clinica_desabilitada` (clinica com `modo="off"` explicito). Motivos
  distintos porque significam coisas diferentes: um e "ainda nao entrou", o
  outro e "foi tirado".

- **RF-P06 (tutor no piloto)**: tutor nao tem agrupamento. Em `piloto`, tutor
  participa **somente** por opt-in de conversa (nivel 1). Decisao registrada no
  `intent.md`, com o custo de prazo aceito: menos volume para o P6.3.

- **RF-P07 (API)**: `GET /whatsapp/bot/clinicas` lista clinicas ativas com o
  estado de participacao **e a postura vigente**, mais um campo derivado
  `participa`. O campo e calculado no backend porque, sem linha, o mesmo estado
  significa coisas opostas nas duas posturas — deixar a tela inferir convidaria
  a errar justo no campo que decide exposicao.
  `PUT /whatsapp/bot/clinicas/{clinica_id}` grava modo e observacao, com
  auditoria. `DELETE /whatsapp/bot/clinicas/{clinica_id}` **remove a marcacao**
  e devolve a clinica ao padrao — idempotente.
  - Existe porque "sem marcacao" e `off` **nao sao o mesmo estado** em `todos`:
    a primeira herda o institucional, a segunda exclui. Em `piloto` os dois
    coincidem, e e justamente por isso que a diferenca passa despercebida ate
    alguem voltar a postura. Sem o DELETE, marcar uma clinica para testar era
    irreversivel pela interface. Mesmos papeis dos demais endpoints do bot. A postura
  (`whatsapp_bot_participacao`) entra na allowlist de `PUT /configuracoes`,
  **admin-only**, como os outros interruptores institucionais.

- **RF-P08 (UI)**: secao "Quem o bot atende" no painel do bot em
  Configuracoes > Empresa, acima da prontidao: seletor de postura
  (`Todos` / `So o piloto`), filtro por nome e lista de clinicas ativas com
  o modo de cada uma.
  - Cada linha diz o **efeito** ("atendida pelo bot" / "fora do atendimento"),
    nao so a marcacao. E o campo `participa` vindo do backend, porque sem
    linha a mesma marcacao significa coisas opostas nas duas posturas.
  - Os botoes por clinica oferecem apenas `Desligado` e `Sugerir`.
    **`Automatico` fica de fora de proposito**: o envio automatico nao existe,
    e oferecer o botao criaria a impressao de que existe.
  - O texto de apoio muda com a postura, porque a consequencia de "sem
    marcacao" se inverte entre `todos` e `piloto`.

## Requisitos nao funcionais

- **NFR-P01 (default seguro)**: `whatsapp_bot_participacao` nasce `todos` e
  `whatsapp_bot_clinica_estado` nasce vazia. Instalacao existente nao muda de
  comportamento ao aplicar a migracao.
- **NFR-P02 (custo zero quando barrado)**: conversa barrada nao chama LLM nem
  roda tools de dado.
- **NFR-P03 (migracao idempotente)**: no padrao dos helpers locais por arquivo
  ja usados nas migracoes 72-75.
- **NFR-P04 (sem vazamento)**: o motivo gravado nao carrega nome de clinica nem
  telefone; so `clinica_id`.

- **RF-P09 (metrica atribuivel)**: `whatsapp_bot_respostas` ganha `clinica_id`,
  gravado na ORIGEM pelo worker, e `GET /whatsapp/bot/metricas` passa a expor
  `por_clinica`.
  - Gravar na origem, e nao resolver na leitura, por dois motivos: reexecutar a
    identificacao de telefone por linha e caro, e o resultado poderia divergir
    do que era verdade quando a resposta foi gerada, se o cadastro mudou no
    meio. Metrica que muda o passado nao serve para decidir.
  - **Sem FK** de proposito: resposta e registro historico, nao pode sumir por
    cascade nem travar a exclusao de uma clinica.
  - Resposta sem clinica de origem (tutor, identidade nao resolvida) nao entra
    na quebra — fica so no agregado e em `por_persona`.

## Criterios de aceitacao

- **CA-P01**: em `todos`, com clinica sem linha, o modo resolvido e o
  institucional — comportamento identico ao de hoje.
- **CA-P02**: em `piloto`, clinica sem linha resulta em `suppressed` com motivo
  `fora_do_piloto`, sem chamada ao provider.
- **CA-P03**: em `piloto`, clinica com `modo="suggest"` gera rascunho
  normalmente.
- **CA-P04**: clinica com `modo="off"` explicito resulta em `suppressed` com
  motivo `clinica_desabilitada`, mesmo com a postura em `todos`.
- **CA-P05**: modo por conversa vence o modo por clinica, nas duas direcoes
  (conversa `off` em clinica habilitada, e conversa `suggest` em clinica `off`).
- **CA-P06**: em `piloto`, tutor sem opt-in de conversa resulta em `suppressed`
  com motivo `fora_do_piloto`; com opt-in, gera normalmente.
- **CA-P07**: migracao aplicada duas vezes em sequencia nao falha, e o default
  de `whatsapp_bot_participacao` e `todos`.
- **CA-P08**: `PUT /configuracoes` recusa `whatsapp_bot_participacao` para
  papel nao admin (403) e valor invalido (422).
- **CA-P11 (2026-08-25)**: "Bom dia, obrigada." resulta em `suppressed` com
  motivo `sem_pergunta` e **nenhuma chamada ao gerador**; "Bom dia, obrigada.
  Voces fazem ecocardiograma?" continua chegando a geracao; e mensagem de
  emergencia continua virando handoff mesmo que o detector de cortesia diga
  que sim.
- **CA-P10 (2026-08-25)**: em `piloto`, conversa fora do piloto que passa por
  pausa, emergencia ou pedido de humano continua resultando em `suppressed`
  com motivo `fora_do_piloto` na mensagem seguinte - a linha criada pelo
  worker grava `modo` nulo e nao vale como opt-in.
- **CA-P09**: nenhuma chamada ao provider nos caminhos barrados, verificada por
  mock que falha se chamado.

## Casos de borda

- **CB-P01**: identidade `ambiguous` entre duas clinicas, uma habilitada e
  outra nao. Sem `match_type` resolvido nao ha `clinica_id`: cai em
  `handoff`/`identidade_nao_resolvida`, como hoje. Nao inventa participacao.
- **CB-P02**: clinica desativada no cadastro (`ativo=false`) com linha de
  participacao habilitada. A linha nao ressuscita a clinica: o escopo das tools
  ja filtra por clinica ativa.
- **CB-P03**: postura volta de `piloto` para `todos` com clinicas marcadas
  `off`. As marcacoes `off` continuam valendo — sao explicitas.
- **CB-P04**: clinica removida do cadastro. A FK precisa decidir entre cascade
  e restrict; a spec adota **cascade**, porque estado de participacao de
  clinica inexistente nao tem sentido.

- **CB-P05 (2026-08-25)**: linhas ja gravadas com `'suggest'` incidental. Nao
  existe discriminador confiavel entre o escolhido e o acidental -
  `atualizado_por_id` nao separa, porque o worker pausa sem usuario mas a
  central pausa **com** usuario e tambem criava a linha. A migracao zera todo
  `'suggest'` para `NULL`, aceitando apagar override deliberado: o valor
  apagado coincide com o default institucional, entao a conversa segue em
  `suggest` por heranca; o que muda e que ela volta a respeitar o piloto. Erra
  para o lado de atender menos, como o resto dos portoes. `off` e `auto` sao
  preservados.
