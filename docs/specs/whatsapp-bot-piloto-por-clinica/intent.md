# Intent - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: draft

## 1) Problema atual

O bot de atendimento tem dois niveis de controle e nada no meio:

- **global**: `WHATSAPP_BOT_ENABLED` (env) e
  `configuracoes.whatsapp_bot_atendimento_habilitado` (banco);
- **por conversa**: `whatsapp_bot_conversa_estado.modo`
  (`off`/`suggest`/`auto`), chaveado por telefone.

Ligar o bot em producao e, na pratica, tudo ou nada. Nao existe como liberar
para um conjunto pequeno de clinicas parceiras, colher retorno delas e so
depois ampliar.

Isso trava o P6.3 do chatbot: a coleta de taxa de aceite precisa de trafego
real de producao, mas o unico jeito de obter trafego real hoje e expor a base
inteira de clientes de uma vez.

**O buraco menos obvio**: um controle so por clinica nao resolveria sozinho.
Tutor nao tem agrupamento equivalente. Habilitar tres clinicas com o modo
institucional em `suggest` deixaria **todos os tutores** dentro junto. Controle
por clinica sem uma postura de participacao nao e piloto, e ilusao de piloto.

## 2) Objetivo

Permitir liberar o bot para clinicas parceiras selecionadas, uma a uma, com
modo proprio por clinica, mantendo todo o resto fora — inclusive tutores.

Valor operacional: colher retorno qualificado de parceiros conhecidos antes de
expor cliente final, e produzir os numeros do P6.3 com risco proporcional.

## 3) Nao objetivos

- Nao muda a arvore de decisao, os guardrails nem o gerador.
- Nao cria envio automatico: `auto` segue bloqueado pelas guardas em aberto.
- Nao agrupa tutores. Tutor continua controlado por conversa.
- Nao substitui o interruptor global nem o modo por conversa.
- Nao promove nada para producao por si so.

## 4) Contexto e restricoes

- **Restricoes tecnicas**: `clinica_id` so existe depois de
  `resolve_whatsapp_context`, que roda dentro de `gerar_resposta`
  (`whatsapp_bot_generation.py:225`), **depois** dos portoes de
  `_process_job`. O portao novo precisa viver ali, e nao junto dos demais.
  Verificado que naquele ponto ainda nao houve gasto de token: a chamada ao
  provider e na linha 301.
- **Restricoes de prazo**: piloto estreito atrasa o P6.3. Com poucas clinicas,
  juntar 20 rascunhos decididos por persona pode levar semanas. Trade-off
  aceito de forma explicita: troca-se tempo por risco.
- **Restricoes operacionais**: a decisao de quais clinicas participam e humana
  e precisa de responsavel registrado.

## 5) Impacto esperado

- **Usuarios impactados**: equipe de atendimento (nova tela de controle) e
  clinicas parceiras selecionadas.
- **Modulos impactados**: `whatsapp_bot_gates`, `whatsapp_bot_generation`,
  endpoints do bot, painel de Configuracoes, metricas.
- **Risco de regressao**: baixo se o default preservar o comportamento atual —
  fora do modo piloto, nada muda.

## 6) Riscos iniciais

- **Risco 1 — falso piloto**: habilitar clinicas e esquecer que tutores seguem
  o modo institucional. Mitigado por `whatsapp_bot_participacao=piloto`
  significar `off` para quem nao tem habilitacao explicita, incluindo tutor.
- **Risco 2 — clinica habilitada sem saber**: parceiro recebendo resposta
  automatica sem ter combinado. Mitigado por habilitacao explicita, um por um,
  com responsavel registrado.
- **Risco 3 — amostra enviesada**: as primeiras clinicas nao representam o
  conjunto, e a taxa de aceite do piloto nao se sustenta na ampliacao.
  Mitigado registrando a metrica por clinica, nao so agregada.
- **Risco 4 — dois interruptores conflitantes**: modo por conversa e modo por
  clinica discordarem. Mitigado por ordem de precedencia explicita, do mais
  especifico para o mais geral.

## 7) Perguntas abertas

- Tutores durante o piloto: **RESPONDIDA em 2026-08-24** — entram somente por
  opt-in de conversa. Decisao do usuario, com o custo de prazo aceito.
- A tela de controle vive no painel do bot em Configuracoes ou no cadastro da
  clinica? (proposta: no painel do bot, junto da prontidao)
- Metrica por clinica entra nesta feature ou na seguinte?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
