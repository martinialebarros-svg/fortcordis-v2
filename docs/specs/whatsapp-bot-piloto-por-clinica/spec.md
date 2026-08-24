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
  1. `whatsapp_bot_conversa_estado.modo`, quando existir;
  2. `whatsapp_bot_clinica_estado.modo`, quando a identidade resolver para
     clinica e houver linha;
  3. `configuracoes.whatsapp_bot_modo`, **exceto** em `piloto`, onde a ausencia
     dos dois anteriores resulta em `off`.

  O nivel 1 ganha do 2 de proposito: e o controle operacional do atendente na
  conversa aberta, e precisa poder desligar o bot na hora mesmo numa clinica
  habilitada.

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
  estado de participacao; `PUT /whatsapp/bot/clinicas/{clinica_id}` grava modo
  e observacao. Mesmos papeis dos demais endpoints do bot. A postura
  (`whatsapp_bot_participacao`) entra na allowlist de `PUT /configuracoes`,
  **admin-only**, como os outros interruptores institucionais.

- **RF-P08 (UI)**: secao no painel do bot em Configuracoes > Empresa, junto da
  prontidao: seletor da postura e lista de clinicas ativas com modo por
  clinica. Mostra quem habilitou e quando.

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
