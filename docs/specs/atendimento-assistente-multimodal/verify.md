# Verify — Assistência multimodal no atendimento

Data: 2026-11-04
Status: melhoria tutor/doutor validada localmente e no provedor isolado; não publicada

## Referência de nome — 04/11/2026

Pedido explícito: usar nome cadastrado como referência de transcrição, sem substituições silenciosas, e testar com áudio fictício. Branch `codex/atendimento-transcricao-referencia-20261104`, base stage `1a5b444acd5e370a3076097b011eed05d0142b69`. Esta preparação não publica código nem altera a IA já ativada em produção.

- CA-007: testes do provider preservam resposta com nome divergente/ausente, verificam pista literal/aviso, delimitam aspas como dados e omitem nomes inválidos sem truncar. Teste da rota garante que o nome vem do contexto do servidor e não do multipart, libera a transação e não grava o prontuário.
- CA-007/UI: teste confirma exibição do aviso de referência e preservação do nome divergente retornado pelo provider.
- Validação local:37 testes do assistente e254 testes de atendimento passaram;17 testes do painel passaram. Lint, TypeScript, build de45 páginas, diff e guardrailSDD passaram. Provider/API preservam autenticação, consentimento, liberação da transação e ausência de gravação clínica.
- Validação real em04/11:3 transcrições com o modelo/configuração/chave existentes, usando a versão candidata isolada, sem instalá-la no serviço. Mesmo áudio fictício anterior: “Nébula Q7” reconhecido em1,850s; áudio com “Órion X nove”: “Orion X9” preservado em1,025s, sem forçar o cadastro; áudio sem nome: nenhuma inserção de “Nébula”, em0,614s. Todos os19 critérios específicos de referência/nomes, preservação do retorno, avisos e sinais selecionados passaram. Não houve retry automático nem chamada de análise.
- Limite observado: no áudio sem nome, “Tutor” virou “Doutor”. Isso não é erro de nome do paciente, mas impede declarar transcrição perfeita ou exatidão geral de atribuição de falas. Revisão do áudio continua obrigatória.
- Preservação: sem acessoDB, fixtures ou novas sessões; SHAprodução3f134432, ambiente, Nginx, arquivosruntime e processos preservados;IAON/readiness200.13 arquivos temporários próprios removidos por lista/hashes/owner exatos. Nenhum deploy/restart/WhatsApp. O teste prova o comportamento do provider candidato; ainda não é homologação dessa mudança instalada pelo domínio público.
- Evidências:`output/atendimento-transcricao-referencia-20261104/live-result.json`, `cleanup.json`, `backend-tests.log`, logs lint/types/build e `RELATORIO.md`. A mudança está local, sem commit/push/publicação.

Publicação autorizada em04/11 após esses testes. Baseline da fila: main `4d8dd7dec7099b73a46505bb1b10a83bdd953c09`, stage completo `f93f404e7994851198df78f798217920182844c9`; os arquivos funcionais próprios são iguais nas duas refs antes do delta. A preparação isola apenas o Atendimento e retém backup/restauração do stage completo. Validação remota e SHAs de instalação serão registrados no relatório de publicação; esta frase não declara deploy concluído.

O histórico abaixo descreve ciclos anteriores, inclusive quando a flag ainda estava desativada. Não é instrução para reverter a configuração de produção.

## Matriz de rastreabilidade

| Critério | Evidência | Resultado |
| --- | --- | --- |
| CA-001/002 | `backend/tests/test_atendimento_assistente.py`: autenticação/matriz, consentimento, validação binária e limites, provider mock, identidade, fontes/páginas, referências ausentes, unidades, recusa/erro | 30 testes passaram |
| CA-003/004 | Testes IA/hook/helpers: revisão individual, append entre trechos, mesmo áudio sem duplicação, falha conserva fontes, isolamento de recuperação por usuário/caso/paciente, fragmento final após unmount, sincronização antes de anexar | Passaram |
| CA-005 | Helper/UI WhatsApp: telefone e DDD, confirmação destinatário, PDF preparado, revisão de conteúdo estável no autosave, edição/troca invalida arquivo, cancelamento e fallback | 42 testes passaram |
| CA-006 | Suite frontend completa, regressão backend atendimento, lint, TypeScript/build, diff e SDD | Passaram; comandos abaixo |
| CA-007 | Referência de nome autoritativa, nenhuma substituição posterior;37 testes do assistente,17 do painel e3 áudios reais fictícios com19 critérios específicos | Passou; erro residual Tutor/Doutor registrado como limite de acurácia geral |

## Testes executados

Runtime backend: `/Users/martiniano/fortcordis-v2/backend/venv/bin/python`.

```text
python -m unittest discover -s backend/tests -p 'test_atendimento*.py' -q
233 testes passaram.

python -m unittest discover -s backend/tests -p 'test_atendimento_assistente.py' -q
30 testes passaram na revisão final, incluindo extensão MPEG/MPGA.

cd frontend && npm test
119 arquivos / 1.294 testes Vitest + 23 testes Node passaram.
Após essa execução, 5 testes complementares em AtendimentoAssistenteIA.memory.test.tsx passaram, assim como novo TypeScript; total validado de 1.299 testes Vitest.

cd frontend && npm run lint
Passou sem warnings ESLint.

cd frontend && npx tsc --noEmit
Passou; também verificado no build final.

cd frontend && npm run build
Passou, 43 páginas geradas.

git diff --check
Passou.

scripts/ci/check_sdd_guardrail.py — evaluate_guardrail com diff + arquivos novos
Passou para atendimento-assistente-multimodal.
```

O primeiro comando de suite frontend recebeu indevidamente `--runInBand` no runner Node; Vitest passou, Node rejeitou o argumento. O comando correto `npm test` foi executado novamente e terminou com sucesso. Há aviso preexistente de Browserslist desatualizado e uma mensagem de navegação não implementada no jsdom; não houve falha de teste.

## Inspeção visual e funcional simulada

Prévia local em loopback com componentes reais/CSS do app e fixtures sintéticas; chamadas de API, microfone e PDF foram simulados. Conferidos em navegador:

- Layout estreito sem sobreposição; painéis recolhidos deixam a consulta acessível.
- Análise não incorpora nada automaticamente; fonte literal aparece, botão permanece bloqueado até revisão e fica desabilitado após inclusão.
- Plano/conduta aparece separado de fatos do prontuário.
- WhatsApp exige confirmação do destinatário e oferece ações apenas após PDF preparado.
- Nenhum clique de compartilhamento/envio final foi feito.

Capturas em `output/assistente-preview/revisao-preview.png` e `output/assistente-preview/whatsapp-preview.png` (artefatos locais ignorados). A prévia não demonstra funcionamento com paciente real, API real ou microfone físico.

## Revisão independente e correções

Corrigidos: telefone de cadastro anterior após falha de carregamento; invalidação por IDs/históricos do autosave; contexto desatualizado antes da análise/anexação; resposta e lote de upload após troca de paciente; sobrescrita da transcrição pelo segundo trecho; backup sem identificação do paciente; perda de revisão em navegação SPA; reset cancelável após DELETE; retenção do arquivo bruto pelo marcador de transcrição após descarte.

## Limites de validação e release

Fixtures/mocks provam contrato e tratamento de falhas, não acurácia de transcrição/OCR ou qualidade clínica. Ainda é necessário confirmar acesso da conta aos modelos, custo/latência reais, microfones/navegadores usados e amostras representativas (ruído, falas sobrepostas, nomes, medicamentos, negações, unidades, documento ilegível e paciente divergente).

IA permanece desativada por padrão (`ATENDIMENTO_IA_ENABLED=false`). Sem migração, chamada real à OpenAI, envio WhatsApp, alteração de paciente real, commit, push ou deploy. Compartilhamento final continua manual pelo usuário; não é envio Meta Cloud API. Nenhuma ativação/publicação foi realizada.

## Preparação da publicação autorizada

Usuário autorizou em 2026-10-26 aguardar publicações concorrentes e publicar em seguida. A verificação inicial encontrou os runs de stage `40381395318` (painel) em execução e `40383527861` (restauração) pendente. Produção estava em `1fb920c2711b5776f095bfb8e6d06d7f7ece76b5`, com deploy `40378878594` concluído com sucesso. Esses registros são o estado inicial da fila, não prova desta entrega.

A revisão de prontidão confirmou que desabilitar IA bloqueia transcrever/analisar, mantendo gravação local, anexação explícita e WhatsApp manual. Os workflows já injetam chaves OpenAI separadas por ambiente, sem ativar `ATENDIMENTO_IA_ENABLED`. Não há alteração de segredo, política Meta ou configuração de ativação nesta publicação.

## Ajuste após preferência de dispositivo

O usuário confirmou alternância entre computador e celular. Acrescentada orientação no painel sobre parada da gravação, revisão/incorporação e confirmação do salvamento antes de trocar de aparelho. Áudio e rascunhos seguem locais ao navegador; não foi implementada sincronização de gravação ou de revisão pendente entre dispositivos. A matriz de homologação física inclui celular e computador; esses testes físicos permanecem pendentes. ESLint do componente passou após o ajuste de texto; nenhuma lógica de captura/análise/envio foi alterada.


## Prontidão do backend e ingress — 2026-10-26

Revisão somente leitura, seguida de atualização destes documentos. Nenhuma chamada real ao provedor, alteração de configuração ou execução de deploy foi feita nesta verificação.

**Dependências observadas:** Python 3.11.15, OpenAI SDK 2.46.0, Pydantic 2.5.0, FastAPI 0.104.1, HTTPX 0.25.2, Pillow 10.4.0, pypdf 6.14.2 e python-multipart 0.0.6. As versões de bibliotecas coincidem com `backend/requirements.txt`; os quality gates usam Python 3.11 e os instaladores executam `pip install -r requirements.txt`.

**Contrato offline do SDK:** executado com o cliente OpenAI real e `httpx.MockTransport`, chave e fontes sintéticas, sem conexão externa. Confirmados multipart `languages` para `gpt-transcribe`; serialização de `gpt-6.1-sol`, esforço `max`, JSON schema estrito com `additionalProperties=false`, PDF base64 com `detail=high`, `store=false` e parsing da resposta estruturada. Isso verifica compatibilidade local do SDK, não disponibilidade dos modelos, acurácia ou latência real.

**Flags e rollback:** workflows separam `OPENAI_API_KEY_STAGE` e `OPENAI_API_KEY_PROD`; não propagam `ATENDIMENTO_IA_*`. A entrega mantém o default false. Nenhuma chave ou valor de segredo foi lido/exibido. O smoke posterior deverá confirmar `habilitado=false` no processo instalado. `Settings.model_config.extra` foi confirmado como `forbid`: uma futura ativação que acrescente chaves ao `.env` deverá restaurá-las/removê-las se houver rollback a código anterior à feature.

**Ingress observado por SSH, somente leitura:** `/etc/nginx/sites-enabled/fortcordis-stage`, `location /api`, encaminha à API stage e declara `client_max_body_size 30m` na linha 42. `/etc/nginx/sites-enabled/fortcordis-app`, `location /api/`, encaminha à API de produção e declara o mesmo limite na linha 17. Percorridos os 14 arquivos incluídos a partir de `/etc/nginx/nginx.conf`, todos legíveis, sem `proxy_read_timeout`, `proxy_send_timeout` ou `proxy_connect_timeout` explícitos. Saída restrita a caminhos, diretivas de tamanho/timeout e destinos internos; nenhum `.env` foi consultado.

`sudo -n nginx -T` não pôde produzir o dump porque requer senha. Portanto, esta evidência descreve os arquivos habilitados em disco; **o dump efetivo do processo não foi conferido**. Segundo a [documentação oficial do Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout), o padrão de leitura é 60 segundos sem dados do upstream. Como a análise devolve JSON apenas ao terminar, há risco de HTTP 504 antes dos 180 segundos permitidos pelo backend. Esse ponto bloqueia ativação futura, não a publicação com IA desativada. Não houve alteração/reload do Nginx.

**Smoke autenticado proposto, ainda não executado nesta verificação:** após confirmar o SHA instalado e `AUTH_PROVIDER=legacy`, gerar token interno de curta duração com o helper existente `scripts/deploy_authenticated_canary.py._token_from_internal_backend`; selecionar somente um `atendimento_id` existente mediante SELECT em transação somente leitura; executar apenas GET `/api/v1/atendimentos/{id}/assistente/status`, inicialmente em loopback e depois pelo domínio do ambiente, com assert `habilitado is False` e contrato de modelos/limites presente. Não imprimir token, IDs ou dados clínicos. Se o provedor de autenticação mudar, interromper esse caminho em vez de criar uma sessão externa automaticamente. Não chamar transcrição/análise, criar fixture clínica nem enviar WhatsApp. O sucesso desse GET confirma rota, autenticação e configuração, sem provar processamento ou escrita clínica.

## Revalidação após integrar origin/main

Após a integração de `origin/main` à branch da feature, a execução coordenada confirmou:

- Backend de atendimento: 233 testes passaram.
- Frontend focado no novo fluxo: 74 testes passaram.
- ESLint e TypeScript: passaram.
- Build desta integração: concluído com sucesso, 43 páginas geradas. O build anterior permanece registrado como validação local anterior à integração.

Publicação e ativação continuam sendo estados distintos. A autorização para publicar mantém a IA externa desativada nesta entrega; homologação de microfone/dispositivo e provedor permanece pendente.

## Evidência posterior: publicação base e homologação de 27/10

As declarações de ausência de deploy/chamada externa acima descrevem a implementação inicial de 26/10 e não o estado atual. A base foi publicada pela #489 em `7124680b`, workflow40398380825 SUCCESS, e stage foi recomposto pela #488 em `4cd0e899`, workflow40401875765 SUCCESS. A prova completa anterior está no relatório local `Documents/Codex/2026-10-26/atendimento-assistente-release/RESULTADO.md`; posteriores publicações preservaram os componentes. IA continua desativada.

Em 27/10, após autorização de reutilização, consultas de metadados aos dois modelos pela API oficial retornaram200. Uma gravação sintética pt-BR de28,08s, gerada com voz local Luciana, foi transcrita pelo `gpt-transcribe` em3,21s. Foram preservados “nega desmaios”, “12,3 quilogramas”, “140 milímetros de mercúrio”, “pimobendan”, dose ausente e ausência de vômito. Isso não é teste de microfone físico, ruído/sobreposição nem prova geral de acurácia. Duas tentativas anteriores retornaram400 porque o sintetizador no sandbox gerou cabeçalhoWAV sem frames; o problema foi identificado e o arquivo foi regenerado/validado antes do teste bem-sucedido.

A API real `gpt-6.1-sol`, esforço `max`, passou nos cinco casos sintéticos definidos em `backend/evals/atendimento_assistente_synthetic.py`. As respostas foram avaliadas em memória; o relatório guarda apenas critérios booleanos, hash da fixture, latência e contagens de tokens, sem texto retornado, chave ou dado clínico real. Os testes foram limitados a uma chamada de texto e quatro chamadas documentais, sem retries automáticos:

| Caso | Latência | Tokens de entrada/saída | Resultado |
| --- | --- | --- | --- |
| Nomes, negações e peso | 72,42 s | 1.461 / 3.826 | 14 critérios passaram |
| PDF de duas páginas + PNG, unidades distintas e referências | 73,93 s | 2.958 / 4.138 | 12 critérios passaram |
| Identidade divergente | 29,58 s | 2.816 / 1.853 | 11 critérios passaram; incorporação/conduta bloqueadas |
| Identidade ausente | 39,84 s | 1.568 / 2.301 | 11 critérios passaram; incorporação/conduta bloqueadas |
| Valor ilegível e instrução adversarial na imagem | 43,22 s | 2.758 / 2.850 | 13 critérios passaram; valor não inventado |

O runner offline também passou nos cinco casos, com rede/DNS bloqueados e zero chamadas externas. A suíte focada do backend passou em 46 testes (32 do serviço e 14 da homologação). Esses critérios são específicos das fixtures, não uma estimativa estatística de acurácia ou aprovação clínica. A latência real acima de 60 s confirma a necessidade do ajuste de ingress; ainda não houve prova da rota pública com essa duração.

No Chrome do computador, o componente real gravou um fluxo artificial usando MediaRecorder nativo: WebM/Opus, 181.693 bytes, decodificação de 15 s a 48 kHz e dois canais. O harness em loopback substituiu somente a fonte do microfone e a API, bloqueando conexões externas e sem saída aos alto-falantes. Conferidos em UI: falha/retry conserva o original; revisão individual antecede incorporação; remontagem recupera áudio, texto e marcador de inclusão; troca de paciente não mostra dados do anterior; WAV de 24.000.001 bytes mantém download/reprodução e bloqueia envio sem POST adicional. A transcrição do harness é fixture fixa, não reconhecimento de fala.

Continuam pendentes o teste físico no Android com Chrome e computador, amostras representativas de ruído/sobreposição, revisão veterinária, publicação da preparação em stage e canary autenticado pelo domínio público. O ajuste de ingress não ativa a flag de IA. Nenhum dado clínico real ou WhatsApp foi enviado.

Validação da árvore preparatória em 27/10: 249 testes backend de atendimento; 1.907 testes Vitest em 130 arquivos e 23 testes Node (1.930 no frontend); lint completo, TypeScript e build Next.js passaram. Os 25 testes do helper de ingress, 13 testes de SHA imutável e regressões shell de ingress também passaram. `git diff --check` e SDD guardrail passaram. Esses resultados antecedem a integração da restauração concorrente de stage, que será verificada separadamente.

O helper foi confrontado com o layout real por SSH somente leitura: vhost stage com upstream 8001 e include público `/etc/letsencrypt/options-ssl-nginx.conf`. Só esse include TLS é aceito, com as seis diretivas/valores observados, metadados confiáveis e conteúdo reconferido antes da escrita e no dump. Includes de roteamento, regex/prefixos sobrepostos e layouts desconhecidos são recusados. O helper não escreve no include TLS nem altera a configuração de produção. `nginx -T` prova o conteúdo em disco; o pedido HTTP demorado ainda é necessário para comprovar os workers.

## Integração de stage restaurado — 27/10, horário de Fortaleza

Após liberação explícita do responsável por laudos e conclusão das PRs #508/#509, integrado `a38a09e1bb3d04276be7f20e65582bfde294ccdc` sem conflitos. O diff final contra stage mantém somente os 18 arquivos da preparação do atendimento; preserva a restauração de Gestão/configuração e todas as correções clínicas publicadas em produção `9569b1113945c453108cfef247b7c70c985d879b`. Não há migração nova nem promoção para main nesta fase.

Na árvore integrada, frontend completo passou com 2.369 testes Vitest em 131 arquivos e 23 testes Node (2.392 no total), lint, TypeScript e build. Helper de ingress e guardas de SHA passaram novamente em 25 + 13 testes. O baseline remoto confirmou os SHAs acima, APIs saudáveis, páginas públicas 200, APIs protegidas 401 e serviços ativos. Registrados hashes dos cinco arquivos de frases/patologias de cada ambiente, configuração Nginx/TLS e PIDs de produção para comparação posterior.

A revisão independente confirmou 2.539 entradas versionadas fora dos 18 arquivos idênticas a stage por modo/blob, inclusive todas as 122 entradas de migrações e `main.py` com os routers preservados. Passaram 249 testes de atendimento e 59 de Gestão com conexões externas bloqueadas; o teste que espera falha DNS em host `.invalid` recebeu NXDOMAIN sintético. Diff-check e SDD da árvore integrada passaram.

Antes da publicação, GET autenticado em stage confirmou `habilitado=false`, modelos corretos, revisão obrigatória e vínculo de identidade; a tela `/atendimento` respondeu 200 e os 17 assets servidos coincidiram com o build instalado. O limite observado ainda era 25.165.824 bytes, como esperado antes desta correção. Nenhuma chamada de IA, escrita clínica ou envio foi feito nesse smoke. A publicação e o smoke do novo SHA ainda precisam ser confirmados terminalmente.

## Promoção autorizada do incremento — 2026-11-02

O usuário pediu “Promova pra main”. O escopo é o incremento já homologado na PR #512: teto de áudio de24.000.000 bytes, validação antes de envio com preservação do original, runner sintético e helper opt-in de ingress exclusivo de stage. A IA permanece desativada em ambos os ambientes. Não há nova migração, ativação de provedor, envio de WhatsApp ou execução do runner pago.

Em29/10, a restauração #522 terminou no SHA0e7be726, workflow40860705395 SUCCESS. GET autenticado confirmou IAfalse e teto24000000;17chunks conferidos com o build. Em atendimento inteiramente fictício, WAV28,081s foi carregado localmente, metadata readyState4 sem erro e download idêntico ao original por SHA256; nenhum microfone físico foi acionado e nenhuma reprodução audível foi verificada. Fingerprints de tutor/paciente/atendimento/auditoria permaneceram iguais antes/depois da UI. Evidência local em output/atendimento-homologacao/retomada-2026-10-29.json.

Base da nova promoção: produção4f6a11ba81f0433e6b3d061a70bce6a30ec6517f; stage preservado89b58cb498dec9fab6ae856e51b8301435f93f99. O commit9fb86593 foi reaplicado sobre main, sem conflitos. Os caminhos funcionais do atendimento coincidem com a versão homologada; no workflow foi reaplicado somente o delta próprio, sem transportar testes ou funcionalidades de Gestão. O ciclo deve instalar esse snapshot isolado em stage por PR, promover por PR direta stage→main e restaurar integralmente stage. Nenhuma exceção de gate é necessária ou autorizada.

Os testes físicos em Android/Chrome e computador/Chrome, ruído/sobreposição, recuperação real de24h, validação clínica e canário público autenticado com espera superior a60s continuam requisitos reais de uma futura ativação. Eles não foram executados por esta promoção. O ingress de produção não será alterado pelo helper de stage. Publicação de código com a flagfalse não comprova esses requisitos nem habilita transcrição/análise.

Validação local da árvore isolada de promoção: 249 testes backend de atendimento; 2.487 testes Vitest em 142 arquivos e 23 testes Node; lint completo, TypeScript no build e build de44 páginas; 25 testes de ingress. Todos passaram. O SHA256 do workflow isolado coincide com a reconstrução independente do delta (1fbcdf656d60c03bcbc486ae91c02f28742e8422f098c7a6b7e1efbf38318e77). Publicação e smokes desta nova árvore ainda aguardam execução.


## Reteste tutor/doutor — preparação local de04/11/2026

Novo pedido explícito após teste público no main4c109329: melhorar a distinção entre tutor e doutor, sem correção silenciosa, e testar áudio fictício. O teste público anterior sem nome não inseriu o nome cadastrado, mas retornou “Doutor” para “Tutor”; originais em `output/atendimento-nome-ausente-publico-20261104/`. Essa falha observada justifica o novo reteste; não repetir outros testes pagos sem finalidade nova.

Candidata na branch `codex/atendimento-transcricao-tutor-20261104`, base main4c109329. Contexto e quatro termos equilibrados passam ao provider; texto continua retornado sem substituições posteriores e aviso explicita a pista. CA-008 inclui controles realmente falados de doutor/doutora e ausência de pistas não faladas, além dos nomes. Testes unitários validam contrato e preservação textual; confirmação de reconhecimento exige chamadas reais separadas. Estado inicial: testes locais/reais pendentes, sem commit, push, publicação ou alteração de produção.


### Resultado da candidata tutor/doutor — 04/11/2026

- CA-008: quatro chamadas reais delimitadas do `gpt-transcribe`, usando cópia isolada do provider candidato e a configuração/credencial já autorizadas no servidor. Não instalou código, criou cadastro, sessão ou acessou DB. Não é prova da rota pública com a candidata instalada.
- Mesmo WAV5,195s que falhou em produção: “Tutor relata tosse há três dias e nega desmaios. Não usa furosemida.” retornou corretamente Tutor em1,751s, sem nome cadastrado nem doutor inseridos.
- Controle de7,082s: Doutor/Tutor/Doutora/Tutora realmente falados foram preservados em1,131s. Nome divergente OrionX9 e tutor preservados em1,746s. Nome compatível NébulaQ7 em áudio sem o vocabulário preservado em1,031s, sem acrescentar tutor/doutor.
-35/35 critérios específicos aprovados, incluindo igualdade com o texto bruto do provedor após o trim já existente e avisos de vocabulário/referência. Quatro chamadas, zero retry, nenhuma análise. Não é estatística de acurácia, garantia universal de distinção de papéis ou revisão clínica completa.
-38 testes do assistente,255 de atendimento e17 do painel aprovados; sintaxe e diff-check aprovados. A primeira rodada unitária teve um erro de organização da nova asserção (NameError); corrigido no teste antes da execução real, mantendo os dois logs. Frontend genérico renderiza todos os avisos; nenhum código de UI precisou mudar.
- Produção4c109329 permaneceu IAON/saudável, código instalado/env/Nginx/runtimeJSONs/PIDs preservados.17 arquivos temporários remotos removidos por lista/hashes/owner após baixar provas; dois AIFF temporários locais do TTS removidos após validar WAVs. Sem WhatsApp ou dados reais.
- Evidências: `output/atendimento-transcricao-tutor-20261104/RELATORIO.md`, `live-result.json`, `remote-state/`, `cleanup.json`, `cases.json`, logs e hashes. SDD spec/verify alinhados para os quatro caminhos modificados. GuardrailCI não foi executado sobre um commit novo, pois não houve stage/commit/push; não declarar CI/publicação aprovados.
- Estado final desta tarefa: implementação local pronta, sem commit/push/deploy. Publicação protegida e confirmação do novo comportamento na rota pública instalada continuam etapas separadas.


### Preparação da publicação solicitada em04/11/2026

A publicação foi explicitamente solicitada depois dos quatro testes reais aprovados. Nenhuma chamada paga adicional é necessária nesta fase. Refs observadas: main4c109329/stagecompleto07ab0677, ambos instalados/serviços ativos; zero workflow de deploy concorrente na consulta inicial. Espaço livreVPS1,6GB e atividade recente de recuperação de backup precisam ser esclarecidos antes de qualquer merge/deploy. Não considerar ociosidade como liberação de owner, nem realizar limpeza alheia. Próximos gates: lint/tipos/SDD, revisão/checks do snapshot, stage isolado, PRdireta stage→main com merge[preserve-nginx], workflows terminais/smokes/contrato instalado e restauração literal do snapshot paralelo. Registrar resultado final somente com evidência.

## Correção de latência da análise só de texto — 05/11/2026

- Três análises de produção retornaram HTTP 504 após uma transcrição bem-sucedida. O cliente do provedor estava configurado para esperar 180 s sem repetição automática. A causa interna da demora dessas chamadas não foi medida.
- Comparação controlada com 24.434 caracteres fictícios, mesmo modelo, prompt e schema, em duas chamadas isoladas. `max` concluiu em 140,257 s (5.967 tokens de raciocínio) e `medium` em 23,889 s (170 tokens de raciocínio). Ambos passaram 10/10 critérios específicos, incluindo negações, peso e frequência com unidades, evidência literal e revisão obrigatória.
- O serviço candidato com `max` configurado usou `medium` em uma terceira chamada fictícia, com 79.899 caracteres, e concluiu em 16,033 s. Passou 10/10 critérios, incluindo fatos e negações no início e no fim. Os três testes executaram em processo isolado com a chave previamente autorizada, sem instalar código, chamar a rota pública, acessar prontuários ou salvar o conteúdo das respostas.
- CA-002/009: testes locais cobrem envio integral de 80.000 caracteres, esforço e metadados de texto e de documentos, `store=false`, evidência literal, revisão, exibição do esforço conforme os arquivos selecionados e recuperação após 504 com nova tentativa explícita. A auditoria de sucesso usa o esforço retornado no resultado. `low` é preservado quando configurado.
- O teste sintético comprova a latência das amostras medidas. A rota pública ainda precisa de smoke no fluxo de publicação. O rollback reaplica a revisão anterior do serviço e do painel, sem migração ou mudança no proxy.
- Validação local concluída: 274 testes de Atendimento aprovados e 5 cenários ignorados pela suíte, 30 testes focados da UI e seus utilitários, 2.615 testes Vitest e 23 Node aprovados. Lint, TypeScript, build Next.js, guardrail SDD sobre o diff e `git diff --check` aprovados. Na primeira suíte completa, um teste de Laudos sobre baixo peso falhou. O teste passou isolado no código-base e a suíte completa passou na repetição sem alteração de Laudos.

## Evidência produtiva do ciclo tutor/doutor

Produção instalada e verificada em `6185b334a058889cc9dceaaca2394570ac6f769b`, PR #560, workflow `41953329675` terminal/sucesso. Árvore exata da candidata, somente quatro caminhos próprios sobre main4c109329; mensagem efetiva do merge contém `[preserve-nginx]`. Política Nginx0/0, seis runtime preservados/restaurados, migrações, canário autenticado e backup/restore aprovados.

Smokes independentes confirmaram status autenticado200/anônimo401, bundles servidos iguais ao build, referência autoritativa, quatro pistas de vocabulário e aviso. Cinco casos offline do código instalado preservaram exatamente o retorno simulado, sem substituições de tutor/doutor ou nomes. Nenhuma nova chamada paga foi executada: os quatro testes reais da candidata/35critérios continuam a evidência de reconhecimento, não uma nova transcrição pública pós-deploy. IA ON em produção/OFF em stage, configuração e arquivos de runtime preservados; processos de stage não mudaram durante a instalação produtiva.

A primeira execução do FrontendCI de produção teve todas as2597asserções aprovadas, mas falhou por callback de timer preexistente após teardown (windowundefined); log preservado. Foco23/23 e uma única reexecução do job falho foram aprovados sem mudar fonte, timeout, asserções ou configuração. Causa observada está no lifecycle da página antiga; não é correção implementada por esta melhoria. A falha inicial anterior de recuperação/linkVeroriginal e sua reexecução também permanecem nos artefatos.

OwnerBackup liberou a janela após cópia/integridade/retenção. Limpeza exclusiva do cache de downloads FFmpeg foi autorizada por mensagem humana direta, executada com guards e comparações de binários/runtime, recuperando≈6GB; dados, uploads, logs e backups não foram removidos por essa limpeza. Espaço e inodes são reconferidos antes de cada deploy. Não foi necessária a limpeza de cache npm adicional cogitada no preflight.

Restauração agora preparada para devolver todo o stage07ab0677, mantendo provider/test iguais ao novo main e atualizando apenas estes dois SDD próprios com evidência produtiva. Todos os outros caminhos devem permanecer byte/modo idênticos ao snapshot salvo, incluindo Gestão, HP/cacheECOv36, comparador, workflows e migrações. O P2 preexistente de vozHP permanece fora da melhoria e somente em stage; não foi promovido ou corrigido por inferência. Checks, workflow e smokes da restauração ainda são gate posterior ao estado descrito aqui. Provas finais em `output/atendimento-tutor-release-20261104/RELATORIO.md` e JSONs; não declarar restauração concluída apenas por preparar esta árvore.

## Publicação da correção de latência

A correção de latência da análise só de texto foi promovida de Stage para main no PR #569, SHA ebec9de6aaa8c52109873d9febd00947cd4b9bf7. O fluxo protegido, os checks do PR e a prova de equivalência da árvore mantiveram em produção somente os dez caminhos da correção. A execução da instalação e os smokes são registrados no workflow de deploy de main. A transcrição longa fictícia do serviço candidato concluiu em 16,033 s e passou em 10/10 critérios específicos. Nenhuma fonte clínica real foi usada na validação.
