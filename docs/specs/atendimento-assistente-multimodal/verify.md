# Verify — Assistência multimodal no atendimento

Data: 2026-10-27
Status: in_progress (base publicada com IA desativada; verificação da ativação em andamento)

## Matriz de rastreabilidade

| Critério | Evidência | Resultado |
| --- | --- | --- |
| CA-001/002 | `backend/tests/test_atendimento_assistente.py`: autenticação/matriz, consentimento, validação binária e limites, provider mock, identidade, fontes/páginas, referências ausentes, unidades, recusa/erro | 30 testes passaram |
| CA-003/004 | Testes IA/hook/helpers: revisão individual, append entre trechos, mesmo áudio sem duplicação, falha conserva fontes, isolamento de recuperação por usuário/caso/paciente, fragmento final após unmount, sincronização antes de anexar | Passaram |
| CA-005 | Helper/UI WhatsApp: telefone e DDD, confirmação destinatário, PDF preparado, revisão de conteúdo estável no autosave, edição/troca invalida arquivo, cancelamento e fallback | 42 testes passaram |
| CA-006 | Suite frontend completa, regressão backend atendimento, lint, TypeScript/build, diff e SDD | Passaram; comandos abaixo |

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
