# Verify - whatsapp-bot-piloto-por-clinica

Data: 2026-08-24
Responsavel: Martiniano + Claude
Status: Fases 1-4 entregues

## Matriz de rastreabilidade

| ID | Tipo | Evidencia planejada | Status |
| --- | --- | --- | --- |
| CA-P01 | aceitacao | ok — `test_whatsapp_bot_piloto_clinica.test_todos_sem_linha_de_clinica_nao_bloqueia`; e a suite inteira passou sem alterar expectativa alguma |
| CA-P02 | aceitacao | ok — `test_piloto_sem_linha_de_clinica_bloqueia` + `test_bloqueio_nao_chama_provider` (provider com `side_effect=AssertionError`) |
| CA-P03 | aceitacao | ok — `test_piloto_com_clinica_habilitada_gera` |
| CA-P04 | aceitacao | ok — `test_clinica_off_explicito_bloqueia_mesmo_em_todos` |
| CA-P05 | aceitacao | ok — `test_conversa_vence_clinica_off` e `test_conversa_off_vence_clinica_habilitada` |
| CA-P06 | aceitacao | ok — `test_piloto_tutor_sem_opt_in_bloqueia` e `test_piloto_tutor_com_opt_in_gera` |
| CA-P07 | aceitacao | migracao idempotente, default `todos` | ok — `test_whatsapp_bot_piloto_migration.test_upgrade_cria_tabela_e_e_idempotente` (aplicada duas vezes em sequencia) + `test_participacao_nasce_todos_e_preserva_comportamento` |
| CA-P08 | aceitacao | ok — `test_configuracoes_autorizacao`: `test_nao_admin_nao_pode_alterar_participacao_do_bot` (403), `test_participacao_invalida_e_rejeitada_422` (422), `test_admin_pode_ligar_o_piloto` |
| CA-P09 | aceitacao | ok — `test_bloqueio_nao_chama_provider`: `provider.generate` levanta se chamado, e o resultado e `suppressed`/`fora_do_piloto` com `texto_gerado` nulo |
| CB-P01 | borda | ok — `test_identidade_nao_resolvida_em_piloto_bloqueia_sem_inventar_clinica`: mesmo com clinica habilitada no banco, sem `match_type` nao ha participacao |
| CB-P02 | borda | ok — `test_clinica_inativa_nao_aparece_na_listagem` (parcial: cobre a listagem; o escopo das tools ja filtra clinica ativa) |
| CB-P03 | borda | ok — `test_voltar_para_todos_preserva_off_explicito` |
| CB-P04 | borda | remocao da clinica remove a linha de participacao (cascade) | pendente |
| NFR-P01 | nao funcional | ok — coluna nasce `todos` (inclusive em linha que ja existia, via UPDATE explicito: default de coluna nao preenche linha antiga em todo dialeto) e a tabela nasce vazia. Suite completa 1044/1044 sem alterar nenhuma expectativa existente |
| NFR-P02 | nao funcional | ok — o portao roda logo apos `_escopo_da_persona` e antes de tools e provider; `test_bloqueio_nao_chama_provider` trava |
| NFR-P03 | nao funcional | ok — `20260824_76` aplicada duas vezes em cada teste, e `no-op` sem `configuracoes` coberto por `test_no_op_sem_configuracoes` |
| NFR-P04 | nao funcional | motivo gravado sem nome de clinica e sem telefone | pendente |

## Testes automatizados a executar

```bash
cd backend
venv/bin/python -m unittest tests.test_whatsapp_bot_piloto_clinica -v
venv/bin/python -m unittest tests.test_whatsapp_bot_gates -v
venv/bin/python -m unittest tests.test_whatsapp_bot_generation -v
venv/bin/python -m unittest tests.test_configuracoes_autorizacao -v
venv/bin/python -m unittest discover -s tests -p "test_*.py"

cd ../frontend
npx vitest run
./node_modules/.bin/eslint app/configuracoes/page.tsx --max-warnings=0
npx tsc --noEmit && npm run build
```

Baseline no momento em que esta spec foi escrita: backend **1040/1040**,
frontend **98/98**.

## Resumo dos resultados (Fase 1, 2026-08-24)

- Migracao `20260824_76_whatsapp_bot_piloto_clinica.py`, no padrao de helpers
  locais por arquivo das migracoes 72-75.
- `test_whatsapp_bot_piloto_migration` (4/4): idempotencia, unicidade de
  `clinica_id`, default `todos` em linha preexistente, e no-op sem
  `configuracoes`.
- Suite completa **1044/1044** (era 1040), sem alterar nenhuma expectativa
  existente — a feature e inerte ate ser ligada.
- **Aplicada de verdade**, nao so em teste: `setup_database.py` num sqlite novo
  criou a tabela e a coluna (`whatsapp_bot_clinica_estado` presente,
  `configuracoes.whatsapp_bot_participacao` presente).
- Modelos `WhatsAppBotClinicaEstado` e a coluna em `Configuracao` adicionados.
  Nada e lido em runtime ainda: resolucao de modo e portao sao a Fase 2.

Decisao de schema registrada: FK `ON DELETE CASCADE` (CB-P04). Participacao de
clinica que nao existe mais nao tem sentido, e restringir a exclusao faria o
cadastro de clinicas depender de uma tabela do bot.

## Testes manuais planejados (stage)

1. Postura `todos` com tudo como esta: nenhuma mudanca de comportamento.
2. Virar para `piloto` sem habilitar ninguem: toda conversa vira
   `fora_do_piloto`, e o preview confirma zero geracao.
3. Habilitar uma clinica em `suggest` e mandar mensagem real por ela: rascunho
   aparece na central.
4. Desabilitar a mesma clinica durante trafego: proximo job vira
   `clinica_desabilitada`, sem restart.
5. Conversa `off` dentro de clinica habilitada: nao responde.
6. Tutor sem opt-in durante o piloto: nao responde.

## Regressao e riscos residuais

- A resolucao de modo passa a ter tres niveis e e atravessada por **todo** job.
  E o ponto de maior risco da feature; por isso a Fase 2 exige que a suite
  inteira passe sem alteracao de expectativa com a postura em `todos`.
- Piloto estreito atrasa o P6.3: menos trafego, mais tempo ate 20 rascunhos
  decididos por persona. Custo aceito no `intent.md`.
- Amostra do piloto pode nao representar o conjunto. Mitigado pela metrica por
  clinica (Fase 4); sem ela, o numero agregado do piloto engana.

## Itens fora de escopo entregues

- Nenhum ate o momento.

## Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao com postura `todos` (feature dormente).
- [ ] Aprovado para producao com postura `piloto`.
- [ ] Nao aprovado (descrever motivo).


## Resumo dos resultados (Fase 2, 2026-08-24)

- `resolve_participacao` e `resolve_modo_efetivo` em `whatsapp_bot_gates`;
  portao em `gerar_resposta` logo apos `_escopo_da_persona`; endpoints
  `GET /whatsapp/bot/clinicas` e `PUT /whatsapp/bot/clinicas/{id}`;
  `whatsapp_bot_participacao` na allowlist de `PUT /configuracoes`, admin-only.
- **23 testes novos** (16 no arquivo do piloto, 3 de autorizacao, e os demais
  ajustes de fixture). Suite completa **1063/1063** (era 1040).
- **Criterio da fase cumprido**: com a postura em `todos`, nenhuma expectativa
  existente mudou. A feature e invisivel ate ser ligada.

### Correcao de desenho durante a implementacao

A primeira versao de `resolve_modo_efetivo` **recalculava** o modo a partir do
institucional, sobrescrevendo o que o chamador ja tinha resolvido. Dois testes
existentes quebraram e expuseram o erro: o parametro `modo` virava mentira, e
duas leituras da mesma coisa podiam discordar.

Corrigido para receber `modo_atual` e **nunca** recalcular — a funcao so
substitui quando a clinica tem modo proprio. `_process_job` tambem passa o
`estado` que ja resolveu, evitando reconsultar a mesma linha no caminho quente.

### Verificacao por mutacao

- Desligar o bloqueio do piloto (`if False`) derruba 4 testes.
- Inverter a precedencia, fazendo a clinica vencer a conversa, derruba 3.

Sem isso, os testes poderiam estar apenas descrevendo o codigo em vez de
travar a decisao.


## Resumo dos resultados (Fase 3, 2026-08-24)

Secao "Quem o bot atende" no painel do bot, acima da prontidao: seletor de
postura, filtro por nome e lista de clinicas ativas.

Tres decisoes de tela que nao sao cosmeticas:

1. **Cada linha diz o efeito, nao a marcacao.** "atendida pelo bot" / "fora do
   atendimento" vem do campo `participa`, calculado no backend. Mostrar so
   `modo` faria a mesma marcacao parecer a mesma coisa nas duas posturas,
   quando significa o oposto.
2. **`Automatico` nao aparece nos botoes por clinica.** So `Desligado` e
   `Sugerir`. O envio automatico nao existe; oferecer o botao criaria a
   impressao de que existe, num painel cuja funcao e justamente dizer a verdade
   sobre o que o bot faz.
3. **O texto de apoio muda com a postura**, porque a consequencia de "sem
   marcacao" se inverte entre `todos` e `piloto`.

Validacao: frontend **98/98**, `eslint` sem warning, `tsc --noEmit` limpo,
`next build` concluido. Backend inalterado nesta fase (**1063/1063**).

### Nao verificado ainda

Uso real da tela em stage: depende de publicar e de haver clinica ativa
cadastrada no ambiente. A prova de que o backend responde ja existe nos testes
de endpoint da Fase 2.


## Correcao da Fase 3 e Fase 4 (2026-08-24)

### A lacuna que a verificacao em stage revelou

A tela foi verificada com dado real em stage: 46 clinicas ativas, postura
virada para `piloto` (as 46 passaram de "atendida" para "fora do atendimento"
sem nenhuma marcacao mudar), uma clinica habilitada, e a tela concordando com
o backend.

Ao **limpar o teste**, o defeito apareceu: nao havia como remover uma marcacao.
So `off` e `suggest`. Em `piloto` isso nao importa - `off` e "sem marcacao" se
comportam igual -, mas em `todos` sao opostos: sem marcacao inclui, `off`
exclui. Resultado pratico: a limpeza deixou uma clinica de stage excluida, e um
admin cairia na mesma armadilha - marca para testar e nunca volta ao original.

Fechado com `DELETE /whatsapp/bot/clinicas/{id}` (idempotente) e um terceiro
botao **"Sem marcacao"**, que so aparece quando ha o que desfazer.

| Item | Evidencia |
| --- | --- |
| DELETE devolve ao padrao | `test_delete_devolve_ao_padrao_e_e_idempotente`: com `off` em `todos` a clinica fica fora; apos o DELETE volta a `participa=true` e a linha some do banco |
| Idempotencia | mesmo teste: remover duas vezes nao levanta |
| A diferenca so some em `piloto` | `test_sem_marcacao_e_off_so_coincidem_no_piloto` — trava o motivo pelo qual o defeito passou despercebido |

### Fase 4: metrica por clinica

`whatsapp_bot_respostas.clinica_id` (migracao `20260824_77`), gravado na origem
pelo worker, e `por_clinica` no endpoint de metricas.

| Item | Evidencia |
| --- | --- |
| Separa clinica boa de ruim | `test_metrica_separa_clinica_boa_de_clinica_ruim`: clinica 1 com 2 aceitos e 0 descartes, clinica 2 com 0 e 1 — o agregado sozinho esconderia isso |
| Conversas distintas por clinica | mesmo teste: 2 e 1, contadas por clinica e nao herdadas do geral |
| Resposta sem clinica nao polui | `test_resposta_sem_clinica_nao_polui_a_quebra`: tutor e identidade nao resolvida ficam so no agregado |
| Migracao | `test_adiciona_coluna_e_indice_e_e_idempotente` e `test_no_op_sem_a_tabela_de_respostas` |

Validacao: backend **1069/1069** (era 1063); frontend **98/98**, `eslint` sem
warning, `tsc --noEmit` limpo. As duas migracoes aplicadas de verdade num
sqlite novo via `setup_database.py`.

### Limpeza verificada pela tela (2026-08-24)

Publicado em `0690b080` (Deploy run `32773582619`, Migration CI `32773582658`,
ambos `success`). A pendencia deixada pela verificacao anterior foi usada como
teste do botao novo:

| | Antes | Depois |
| --- | --- | --- |
| Linha na tela | "fora do atendimento · marcada como off" | "atendida pelo bot · sem marcacao" |
| Botao "Sem marcacao" | presente | **sumiu** — nao ha mais o que desfazer |
| Backend | `modo: "off"` | `modo: null`, `participa: true` |
| Stage | 45 de 46 atendidas | **46 de 46**, zero marcacoes |

Stage voltou ao estado original, e o `DELETE` ficou verificado ponta a ponta:
tela, backend e o desaparecimento condicional do botao.

### Duvida em aberto: clique em "Listar clinicas"

Nesta rodada, o clique no botao **"Listar clinicas" nao funcionou** nem por
referencia de acessibilidade nem por coordenada. Nenhuma requisicao saia,
embora a sessao estivesse viva e `GET /whatsapp/bot/clinicas` respondesse `200`
com as 46 clinicas quando chamado direto. So funcionou acionando o elemento
por codigo.

**Nao classificado**: os demais cliques da sessao (Verificar, seletor de
postura, Sugerir, Sem marcacao) funcionaram por coordenada nesta mesma tela, o
que inclina para artefato da automacao — mas isso e hipotese, nao conclusao, e
nao esta registrado como verificado.

**Como resolver**: um clique manual. Se a lista abrir normalmente, era a
automacao; se nao abrir, e defeito da tela e vira correcao.

## Ativacao do piloto em producao - 2026-08-24

Autorizado por Martiniano ("habilita as clinicas do piloto"). Estado gravado e
conferido por `GET /api/v1/whatsapp/bot/clinicas` e `GET /api/v1/configuracoes`:

| Campo | Valor |
| --- | --- |
| `whatsapp_bot_atendimento_habilitado` | `true` |
| `whatsapp_bot_modo` | `suggest` |
| `whatsapp_bot_participacao` | `piloto` |
| Clinicas marcadas | **19**, todas `suggest` |
| Clinicas cadastradas | 161 |

Nenhuma clinica ficou em `auto`: o envio automatico continua inexistente, e
toda resposta gerada e rascunho para revisao humana.

### Criterio da selecao

Entraram as clinicas que **ja conversam pelo numero da Cloud API** - as unicas
que produzem amostra. Medicao sobre as 32 conversas de producao:

| | conversas |
| --- | --- |
| de clinica cadastrada | 26 |
| dessas, com mensagem de entrada | **20** |
| so notificacao enviada, sem resposta | 6 |
| tutor ou numero nao cadastrado | 6 |

Das 20 com entrada, 19 entraram no piloto. A vigesima e `41 Fort Cordis
Cardiovet`, o registro da propria empresa: foi marcada por engano e revertida
com "Sem marcacao" na mesma sessao. Trafego interno nao e amostra de parceiro.

Ficaram de fora as 6 que so receberam notificacao (`62`, `22`, `1`, `20`, `53`
e a segunda conversa de `28`): sem mensagem de entrada, nao ha o que o bot
responda. Entram quando responderem.

### Correcao de uma medicao anterior

A leitura anterior desta sessao concluiu "zero conversas de clinica" e
recomendou habilitar tutores em vez de clinicas. **Estava errada, e a
recomendacao foi descartada.** A causa era do script de medicao, nao dos dados:
`clinicas.whatsapps` guarda 11 digitos (DDD + numero, sem `55`), e a
comparacao era feita contra o `55...` das conversas. Nenhuma chave podia casar.

Fica o registro do metodo: normalizar os dois lados para DDD + 8 digitos finais
antes de comparar - descartando `55` e o nono digito -, nunca comparar as
formas cruas.

### Duvida do clique em "Listar clinicas": resolvida

Nesta sessao o botao foi acionado das duas formas na mesma tela de producao:

| Forma | Resultado |
| --- | --- |
| Clique por referencia de acessibilidade | nada acontece, lista nao abre |
| Clique por coordenada | lista abre normalmente, 161 clinicas |

E artefato da automacao, nao defeito da tela. A hipotese registrada na rodada
anterior fica confirmada, e o clique manual sugerido la deixa de ser
necessario.

### O que a ativacao ainda NAO libera

O piloto gera rascunho; nao envia. Antes de qualquer discussao sobre `auto`
continuam pendentes os sete guardrails restantes (1, 2, 3, 5, 7, 8, 9) e o
alinhamento de tabela de precos: em 3 dos 4 casos conferidos o atendente cotou
valor MAIOR que a tabela de producao, e o bot vai cotar o valor correto.

## Dois defeitos encontrados ao acompanhar a primeira leva - 2026-08-25

Verificacao pedida: acompanhar os primeiros rascunhos do piloto. **Nao houve
primeira leva** - zero rascunhos. Sete respostas na janela, todas
`suppressed`/`bot_desabilitado`. Investigar isso expos dois defeitos.

### Contexto: o piloto esta inerte por uma variavel de ambiente

`GET /api/v1/whatsapp/bot/preview` em producao:

| Campo | Valor |
| --- | --- |
| `whatsapp_bot_enabled_env` | **`false`** |
| `whatsapp_bot_atendimento_habilitado_banco` | `true` |
| `whatsapp_bot_ativo` | **`false`** |

O portao e `env AND banco` (`whatsapp_bot_gates.py:48-62`). O registro anterior
desta spec afirmou "bot ligado" lendo so a metade do banco - **estava
incompleto**. `WHATSAPP_BOT_ENABLED` nao e escrita por
`.github/workflows/deploy.yml` nem por `scripts/deploy_prod_vps.sh`; o default
e `False` (`backend/app/core/config.py:75`) e a unica fonte e
`/var/www/fortcordis-v2/backend/.env`, que e gitignored. Em stage esta `true`
por edicao manual - e a unica diferenca entre os dois ambientes.

Job suprimido recebe `status="done"`
(`whatsapp_bot_worker_service.py:182-184`): **nao fica pendente**. Mensagens de
`Vet Plus` e `Vetzil Mondubim` chegadas apos a marcacao das 19 clinicas foram
consumidas e descartadas. Ligar a env depois nao as recupera.

O resto da cadeia foi verificado funcionando: `POST /simular` em producao
devolveu `decisao: draft`, `motivo: modo_suggest`, citando o documento
institucional cadastrado e a validade de 30 dias. Prontidao 12 de 14 - os 2
pendentes sao `status_laudo`, que por construcao so se verifica em conversa
real.

### Defeito 1 - Somavet nao seria atendida apesar de estar no piloto

Medicao ao vivo: os 19 numeros das clinicas do piloto passados por
`GET /api/v1/whatsapp-contexto`.

| Resolucao | Clinicas |
| --- | --- |
| `clinica` | 18 |
| `ambiguous` | **1 (Somavet)** |

Causa: **o mesmo numero esta cadastrado em duas clinicas ativas** - `PET CAFE`
e `Somavet`. Em `resolve_whatsapp_context`, mais de um casamento direto produz
`resolution: ambiguous` e `match_type: null`. Com `match_type` nulo,
`resolve_modo_efetivo` pula o ramo da clinica
(`whatsapp_bot_gates.py:143`) e cai em `return "off", "fora_do_piloto"`
(`:153`) - a clinica marcada como `suggest` e suprimida assim mesmo.

Nao e defeito de normalizacao de telefone: a normalizacao trata corretamente o
cadastro de 11 digitos sem `55` e o nono digito. E **dado de cadastro**, e a
correcao e no cadastro, nao no codigo: decidir de quem e o numero.

Registrado como pendencia: enquanto nao for resolvido, o piloto tem 18
participantes efetivos, nao 19.

### Defeito 2 - o portao do piloto vaza por estado de conversa

`resolve_modo_efetivo` tem um curto-circuito **antes** de qualquer avaliacao de
clinica ou piloto (`whatsapp_bot_gates.py:140`):

```python
if estado is not None and str(estado.modo or "").strip().lower() in MODOS_VALIDOS:
    return modo_atual, None
```

A simples existencia de uma linha em `whatsapp_bot_conversa_estado` com modo
valido isenta a conversa do portao de participacao. Isso e deliberado como
mecanismo de opt-in por conversa - mas **tres caminhos do worker criam essa
linha sozinhos, com `modo="suggest"` hardcoded e sem acao humana**:

| Caminho | Chamada | Cria estado em |
| --- | --- | --- |
| Emergencia | `worker:228` -> `trigger_active_handoff` -> `handoff_service:154` | `gates:217` |
| Pausa por claim/`from_me` | `worker:250` -> `pause_conversation` | `gates:203` |
| Pedido de humano | `worker:262` -> `trigger_active_handoff` -> `handoff_service:154` | `gates:217` |

Os tres rodam **antes** do portao de participacao. Consequencia: depois de um
unico evento desses, um numero fora do piloto fica permanentemente isento -
`fora_do_piloto` nunca mais e avaliado para aquela conversa.

Agravante nos dois caminhos de handoff: `set_handoff_motivo` **nao preenche
`pausado_ate`** (so `pause_conversation` preenche, `gates:205`), e
`handoff_motivo` nao e usado como portao em lugar nenhum do worker nem da
geracao (verificado por busca direta). Ou seja, ja na proxima mensagem de
entrada do mesmo numero a conversa atravessa todos os portoes e chega ao
gerador. No caminho de pausa o efeito e o mesmo, apenas diferido ate
`WHATSAPP_BOT_HANDOFF_PAUSE_HOURS` expirar (12h por default).

**Alcance do dano:** em `suggest` isso custa token e roda as tools sobre os
dados de quem esta fora do piloto. **Nao envia nada**: `decisao = "sent"` e
escrito em um unico lugar em todo o backend, o endpoint de envio manual
(`whatsapp_bot.py:302`), atras de `require_any_papel`. O `sent: 1` observado em
stage e a resposta 7, aprovada por humano - nao envio automatico.

Contradiz o NFR-P02 ("barrar nao custa token") para qualquer conversa que tenha
passado por um desses tres eventos.

### Procedencia destes achados

Honestidade sobre o metodo: a verificacao adversarial rodou pela metade -
**8 dos 16 agentes falharam** por limite de sessao, incluindo os **tres**
designados a checar o casamento de clinica.

- O **defeito 2** veio de um verificador que **derrubou** a analise original da
  cadeia de portoes. Foi reconferido a mao antes de ser registrado aqui:
  `gates:140`, `gates:203`, `gates:217`, `worker:228/250/262`,
  `handoff_service:154`, e a ausencia de `handoff_motivo` como portao.
- O **defeito 1** ficou sem verificacao por agente e foi apurado por
  **medicao ao vivo** nos 19 numeros. A medicao foi mais util que a leitura de
  codigo: a causa real (duas clinicas com o mesmo numero) nao era a hipotese
  levantada na leitura (colisao com tutor).

### Pendencias que isto abre

1. Resolver o numero duplicado entre `PET CAFE` e `Somavet` no cadastro.
2. Decidir o que fazer com o vazamento do portao: hoje o piloto nao e um
   conjunto fechado depois que uma conversa dispara emergencia, pedido de
   humano ou pausa.
3. Ligar `WHATSAPP_BOT_ENABLED=true` em `/var/www/fortcordis-v2/backend/.env` e
   reiniciar `fortcordis-backend` - `settings` e singleton com `@lru_cache`
   avaliado no import (`config.py:178-183`), entao sem restart nao rele.
   **Nao executado**: e configuracao de producao e exige autorizacao explicita.

## Correcao do defeito 2 - vazamento do portao do piloto - 2026-08-25

Implementa RF-P10, CA-P10 e CB-P05. Autorizado por Martiniano ("pode resolver
as outras duas pendencias").

### O que mudou

| Arquivo | Mudanca |
| --- | --- |
| `models/whatsapp_bot.py:77` | `modo` vira `nullable=True` e **perde o `default`** |
| `services/whatsapp_bot_gates.py:206` | `pause_conversation` cria com `modo=None` |
| `services/whatsapp_bot_gates.py:223` | `set_handoff_motivo` cria com `modo=None` |
| `migrations/versions/20260825_78_...py` | coluna anulavel + zera `'suggest'` |

Nenhum ponto de LEITURA precisou mudar. As duas guardas de `gates.py` (140 e
167) ja usavam `str(estado.modo or "")`, e `modo_origem` no endpoint usa
truthiness - a semantica nova cai certa sem tocar em nada disso.

**O default tinha de cair junto com o NOT NULL.** Medido: com
`default="suggest"` no model, passar `modo=None` explicito no construtor
**ainda grava `'suggest'`** - o SQLAlchemy omite atributo `None` no INSERT e o
default Python dispara. Trocar so os dois construtores nao teria efeito nenhum.

### Migracao

SQLite exige rebuild (`CREATE __new` / `INSERT..SELECT` / `DROP` / `RENAME`),
porque a coluna nasceu com `NOT NULL` explicito em `20260820_75`. O
`INSERT..SELECT` ja faz a conversao `'suggest' -> NULL` junto com a copia.
No Postgres sao `DROP NOT NULL` + `DROP DEFAULT` + `UPDATE`.

A guarda sai cedo quando a coluna ja e anulavel. Isso serve a dois casos: banco
novo (nasce do model, `create_all` roda antes das migracoes) e segundo run -
sem a guarda, rodar de novo apagaria override deliberado gravado **depois** da
conversao.

### Verificacao

Suite completa: **1077 passed**. Quatro testes novos em
`test_whatsapp_bot_piloto_clinica.py` e quatro em
`test_whatsapp_bot_conversa_modo_nulo_migration.py`.

Teste de mutacao - cada mutante morto por um teste diferente:

| Mutante | Teste que pegou | Sintoma |
| --- | --- | --- |
| `modo="suggest"` de volta nos dois construtores | `test_pausa_grava_modo_nulo_e_nao_fura_o_piloto` e `test_handoff_grava_modo_nulo_e_nao_fura_o_piloto` | `AssertionError: 'suggest' is not None` |
| `INSERT..SELECT` sem o `CASE` | `test_converte_coluna_e_zera_suggest_incidental` | linha incidental sobrevive |
| guarda de idempotencia trocada por `UPDATE` sempre | `test_segundo_run_nao_apaga_override_deliberado` | apaga escolha posterior |
| `handoff_motivo` fora da copia do rebuild | `test_converte_coluna_e_zera_suggest_incidental` | dado perdido em silencio |

Dois testes existem so como guarda contra corrigir demais, e passam nos dois
mundos: `test_pausa_nao_desliga_clinica_habilitada` (clinica do piloto continua
atendida depois de um handoff) e `test_opt_in_deliberado_sobrevive_a_pausa_posterior`
(modo escolhido por gente continua vencendo).

### Ramo PostgreSQL: verificado, depois de uma afirmacao errada

Este registro dizia primeiro que o ramo Postgres nao fora executado e que o
Migration CI cobriria a lacuna ao subir para stage. **A segunda metade era
falsa**: `.github/workflows/migrations-ci.yml:37` roda com
`DATABASE_URL: sqlite:///./fortcordis-ci.db`. O check verde nao dizia nada
sobre o dialeto de producao.

A lacuna foi entao fechada de verdade: instancia PostgreSQL 16 descartavel,
migracao `75` (que cria `NOT NULL DEFAULT 'suggest'`) seguida da `78`.

| Verificacao | Resultado |
| --- | --- |
| `is_nullable` apos a 75 | `NO` |
| `is_nullable` apos a 78 | `YES` |
| `column_default` apos a 78 | `NULL` |
| `'suggest'` incidental | virou `NULL` |
| `off` e `auto` | preservados |
| `handoff_motivo` | preservado |
| INSERT omitindo a coluna | grava `NULL`, nao `'suggest'` |
| Segundo run | nao apaga override deliberado |

Virou teste permanente, nao verificacao de uma vez so:
`WhatsAppBotConversaModoNuloPostgresTest`, que roda quando `POSTGRES_TEST_URL`
esta definida e **pula** quando nao esta - o CI atual pula. Cada teste usa
schema proprio, fixado no engine por `search_path`.

```
POSTGRES_TEST_URL=postgresql+psycopg2://postgres@127.0.0.1:5432/postgres pytest \
  tests/test_whatsapp_bot_conversa_modo_nulo_migration.py
```

Mutacao no ramo Postgres, os dois mortos por
`test_alter_converte_e_derruba_o_default`:

| Mutante | Sintoma |
| --- | --- |
| sem `DROP DEFAULT` | `column_default` sobrevive; INSERT que omite a coluna ressuscita `'suggest'` |
| sem o `UPDATE` de backfill | linha incidental continua `'suggest'` |

**Fica em aberto**: o Migration CI nao exercita PostgreSQL para migracao
nenhuma deste repo, nao so esta. Isso e maior que este PR e nao foi tratado
aqui.

**Executado localmente em 2026-08-25.** Os dois testes do ramo PostgreSQL, que
ate entao pulavam em todo lugar por falta de `POSTGRES_TEST_URL`, foram rodados
de fato contra PostgreSQL 16 local, em banco efemero criado e descartado para
isto:

```bash
POSTGRES_TEST_URL="postgresql://<usuario>@127.0.0.1:5432/<banco_efemero>" \
  venv/bin/python -m unittest tests.test_whatsapp_bot_conversa_modo_nulo_migration -v
```

Resultado: **6/6 ok**, incluindo
`WhatsAppBotConversaModoNuloPostgresTest.test_alter_converte_e_derruba_o_default`
e `..._segundo_run_nao_apaga_override_deliberado`. Isso importa porque producao
roda PostgreSQL e a migracao 78 **ja rodou la** (esta em `origin/main`) sem que
esse ramo tivesse sido verificado em lugar nenhum - um teste que nunca executa
nao e protecao. A lacuna estrutural do Migration CI continua aberta: a execucao
foi manual e nao ha nada no CI que a repita.

### Estado das tres pendencias

| Pendencia | Estado |
| --- | --- |
| 1. Numero duplicado `PET CAFE` / `Somavet` | **Resolvida por Martiniano** - clinica PET CAFE apagada por nao existir mais. Reconferir a resolucao dos 19 numeros quando a sessao do painel voltar; a ultima tentativa caiu em 401. |
| 2. Vazamento do portao | **Resolvida aqui.** Falta subir para stage e promover. |
| 3. `WHATSAPP_BOT_ENABLED=true` em producao | **Nao executada** - sem acesso SSH a partir deste ambiente (`Permission denied (publickey,password)`). Precisa de Martiniano na VPS. |

**Ordem recomendada:** ligar a env **depois** que esta correcao chegar a
producao. Com o bot ligado antes, cada emergencia, pedido de humano ou pausa
grava mais uma linha `'suggest'` incidental - e a migracao ja tera rodado, entao
essas linhas novas nao seriam zeradas por ela. Seria preciso um segundo
saneamento manual.

## Piloto vivo em producao e promocao do RF-P11 - 2026-08-25

### O piloto saiu da inercia

`WHATSAPP_BOT_ENABLED` foi acrescentada ao `.env` de producao por Martiniano na
VPS (a linha nao existia; por isso o default `False` valia) e o
`fortcordis-backend` foi reiniciado. Conferido com a propria funcao do portao,
nao com reimplementacao:

| Campo | Valor |
| --- | --- |
| `settings.WHATSAPP_BOT_ENABLED` | `True` |
| toggle do banco | `True` |
| `is_whatsapp_bot_enabled()` | **`True`** |
| modo padrao | `suggest` (`auto` bloqueado) |

`grep -c '^WHATSAPP_BOT_ENABLED=' ` devolveu `1` - sem duplicata, que era o
risco de o `sed` e o `tee -a` se somarem.

### Primeira leva real

28 jobs (24 `done`, 4 `superseded` - debounce funcionando, zero `error`) e 24
respostas. Descontando as 14 `bot_desabilitado` anteriores a ativacao, sobram 10
pos-ativacao: 4 `fora_do_piloto`, 3 `pausado`, 2 `blocked/sem_fonte` e
**1 `sent/modo_suggest`**.

A `sent` e o marco: em `suggest` so e alcancavel por clique humano em Enviar.
Resposta `#20`, persona `clinica`, 7.068 ms - **a primeira resposta assistida do
piloto chegou ao cliente**.

A conversa `151` conta a historia inteira: `#18 fora_do_piloto` ->
`#19 blocked/sem_fonte` -> `#20 sent` -> `#22/#23/#24 pausado`. A transicao de
`fora_do_piloto` para processada mostra a marcacao da clinica pegando efeito no
meio do fluxo.

**Prova incidental da migracao 78 em producao**: a linha de pausa gravada pelo
envio assistido tem `modo=None`. Antes da migracao ela nasceria com `'suggest'`
incidental e furaria o portao do piloto - o defeito 2 esta confirmado corrigido
no ambiente real, nao so em teste.

### Observacao registrada, sem correcao

O envio assistido pausa a conversa por 12h. Medido: envio as 12:05, e o cliente
escreveu as 12:27, 12:31 e 12:33 - tres vezes em 28 minutos, todas
`suppressed/pausado`, e `suppressed` nao aparece na central. E o comportamento
desenhado (um atendente assumiu), mas se a pessoa responde uma vez e sai, o
cliente fica numa janela morta longa. **Nao foi alterado**: exige decisao de
produto.

### Promocao stage -> main

`origin/main` avancou `114b01c1..4b3177f7` por `scripts/promote_stage_to_main.sh`.

| Run | Nome | Resultado |
| --- | --- | --- |
| `32859464147` | Deploy to VPS | `success` |
| `32859464261` | Migration CI | `success` |

**Risco encontrado e afastado antes de promover.** `origin/main` **nao** era
ancestral de `origin/stage`: producao tinha 6 commits proprios, incluindo
`1474902d hotfix(deploy): para de copiar o .env Meta de stage no deploy de
producao (#72)`. O script promove com `-X theirs` (prefere stage em conflito) -
exatamente o cenario que o `CLAUDE.md` alerta. Se aquele hotfix existisse apenas
em `main`, a promocao o teria revertido, o deploy voltaria a copiar o `.env` de
stage e isso **apagaria o `WHATSAPP_BOT_ENABLED=true` recem-configurado** alem de
recontaminar a identidade Meta.

Verificacao feita antes de promover:

- `git diff --quiet origin/stage origin/main -- .github/workflows/deploy.yml` ->
  identico, o backport ja tinha sido feito;
- nenhum arquivo dos demais commits so-de-main difere entre os dois lados;
- `git diff --name-status origin/main origin/stage` -> **1 adicionado, 6
  modificados, zero deletado**.

Revalidacao externa de producao antes e depois, identica: raiz `200`,
`/whatsapp/health` `200`, `/bot/preview` e `/whatsapp/conversations` `401`.

### O detector de cortesia em producao

Depois do deploy, medido na VPS com a funcao real:

| Entrada | Resultado | Esperado |
| --- | --- | --- |
| `is_whatsapp_bot_enabled()` | `True` | a env sobreviveu ao deploy |
| `Bom dia, obrigada.` | `True` | o caso real da Vet Plus |
| `Obrigado!` | `True` | cortesia simples |
| `ok?` | `False` | oposto de `ok`, so pela interrogacao |
| `?` | `False` | pedido de resposta mais explicito que existe |
| `qual o valor do eco?` | `False` | pergunta legitima |

Os tres `False` sao os falsos positivos que os agentes adversariais pegaram na
primeira versao. Confirmados corrigidos **em producao**.

### Defeito 1 fechado - todos os numeros resolvem - 2026-08-25

Medido em producao, rodando `resolve_whatsapp_context` no primeiro numero de
cada clinica com linha em `whatsapp_bot_clinica_estado`:

**`PARTICIPANTES EFETIVOS: 20 de 20`** - todas `matched/clinica`, nenhuma
`ambiguous`, nenhuma sem numero, nenhuma clinica apagada com estado orfao.

`Somavet` (`id=114`, `...1090`) resolve como `matched/clinica`. Apagar a
duplicata `PET CAFE` bastou: nao havia colisao adicional com tutor, que era a
hipotese que sobrava (a ambiguidade conta clinicas **e** tutores). **O defeito 1
esta fechado** e o piloto nao tem participante fantasma.

O teste cobre o primeiro numero de cada clinica (`whatsapps[0]`, com fallback
para `telefone`). Clinica com varios WhatsApps que escreva de outro numero nao
foi coberta por esta medicao.

### Divergencia a confirmar: 10 em `suggest`, nao 19

A mesma medicao mostrou **20 linhas de estado**, distribuidas em **10 `suggest`
e 10 `off`** - enquanto o registro anterior desta spec afirmava "19 clinicas em
`suggest`". Sao duas diferencas: uma clinica a mais que o registrado, e metade
do piloto desligada.

**Nao foi investigado nem alterado.** Pode ser reducao deliberada do piloto apos
a primeira leva, e nesse caso o registro anterior e que esta velho. Uma pista a
favor disso: `Fort Cordis Cardiovet` (`id=41`, `...4320`) esta em `suggest` e e
a conversa `151` que recebeu o envio assistido - testar no proprio numero antes
de abrir para terceiros e o esperado. Fica pendente de confirmacao de
Martiniano; ate la, o numero valido de participantes ativos e **10**, nao 19.

## RF-P11 - detector de cortesia - 2026-08-25

Nasceu do primeiro caso real do piloto: `Vet Plus` escreveu "Bom dia, obrigada."
e o bot gastou 1210 tokens de entrada, 147 de saida e 9,3s para produzir texto
que o proprio guardrail barrou por `sem_fonte`.

### A primeira versao estava errada, e o ataque provou

Escrevi o detector exigindo que a mensagem INTEIRA fosse cortesia e conclui que
isso dispensava checar interrogacao - "se sobrar palavra de conteudo, nao e
cortesia". **Raciocinio falso**: a pergunta pode ser feita inteirinha com
palavras da propria lista.

Tres agentes adversariais atacaram com portugues real de clinica veterinaria e
produziram **79 falsos positivos**, confirmados por execucao:

| Mensagem | Por que e grave |
| --- | --- |
| `?` / `???` | o pedido de resposta mais explicito que existe |
| `🆘` | emoji de socorro classificado como "nao pede resposta" |
| `ok?` | indistinguivel de `ok` - mensagens opostas |
| `ja viu?` | secretaria perguntando se o laudo foi visto |
| `ta ai?` | "voce esta ai?" - literalmente "me responde" |
| `so isso?` | pergunta sobre o que falta enviar |
| `e o senhor?` | devolve a pergunta e espera resposta |

A causa raiz nao era so a falta do `?`: era a lista `preenchimento` conter
palavras que CARREGAM pergunta (`ja`, `viu`, `so`, `isso`, `ai`, `vc`, `e`,
`da`, `pra`). Combinadas, dissolviam frases inteiras.

### As tres regras que sairam disso

1. **Interrogacao desqualifica, sempre.** A normalizacao apaga pontuacao, entao
   sem esta regra `ok` e `ok?` chegam identicos ao casamento. Custa falsos
   negativos ("tudo bem?"), e isso e barato.
2. **Sem uma letra sequer, nao arrisca.** Emoji e pontuacao sozinhos sao
   ambiguos: `👍` encerra, `🆘` e socorro. Nao da para distinguir por
   vocabulario. Vai para o caminho normal, que tem detector de emergencia
   antes. Inverte a decisao da primeira versao.
3. **`preenchimento` so aceita palavra inerte** - vocativo, intensificador ou
   complemento fechado. Esta escrito no proprio arquivo de termos, porque e a
   regra que alguem vai quebrar sem querer ao acrescentar um termo.

Um quarto detalhe: o colapso de letra repetida (`bom diaa` -> `bom dia`) e
aplicado aos DOIS lados, mensagem e vocabulario, o que troca dezenas de
variantes de alongamento por uma regra.

### Resultado

| | Primeira versao | Versao final |
| --- | --- | --- |
| Falsos positivos (dos 79 do ataque) | 79 | **1** |
| Falsos negativos (dos 81 do ataque) | 81 | 4 |
| Mensagens reais preservadas | 12/12 | 12/12 |

O falso positivo remanescente e `"oi tudo bem entao ta"`. O agente argumentou
que seria audio transcrito truncado; **discordo e mantive como cortesia** - a
mensagem nao tem pergunta alguma, e o custo de errar aqui e nao oferecer
rascunho.

Dos 4 falsos negativos, dois contem `?` e sao consequencia deliberada da regra
1; um contem "so isso", removido de proposito.

**Os 78 falsos positivos corrigidos viraram regressao permanente** em
`WhatsAppBotCortesiaTest.NAO_CORTESIA`.

### Verificacao

Suite completa: **1087 passed**, 227 subtests. Mutacao:

| Mutante | Teste que pegou |
| --- | --- |
| casamento por substring | 17 testes de uma vez |
| portao antes da emergencia | `test_emergencia_vence_cortesia` |
| portao removido | `test_cortesia_suprime_antes_de_gerar` |
| sem a regra da interrogacao | `test_nao_engole_mensagem_de_verdade` (35 falhas) |
| "sem letra" volta a ser cortesia | `test_sem_letra_nenhuma_nao_arrisca` |
| sem o colapso de repeticao | `test_reconhece_cortesia` |

**Um teste meu nao testava nada.** `test_emergencia_vence_cortesia` patcheava
`gates.detecta_cortesia`, mas o worker importa o simbolo direto no namespace
dele - o patch nao tinha efeito, e o mutante da ordem foi pego por outro teste,
por acaso. Corrigido para patchear `worker.detecta_cortesia`.

### Estado do piloto em producao no momento deste registro

`WHATSAPP_BOT_ENABLED=true` ligada por Martiniano; `whatsapp_bot_ativo: true`.
19 clinicas em `suggest`, nenhuma em `auto`. Placar: 1 `blocked`/`sem_fonte`
(a Vet Plus, o caso que originou isto), 1 `suppressed`/`fora_do_piloto`,
**zero rascunhos e zero envios**.
