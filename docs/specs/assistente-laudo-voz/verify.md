# Verify - assistente-laudo-voz

Data: 2026-07-26
Responsável: Martiniano + Codex
Status: local_pass

## Matriz

| Critério | Evidência | Status |
| --- | --- | --- |
| CA-001 | componente compilado e bundle do editor servido em stage com gravação, pausa, upload, reprodução, exclusão e regravação; teste manual de microfone em tablet/desktop fica na matriz exploratória | stage_bundle_pass |
| CA-002 | transcrição original somente leitura e cópia editável antes de `/structure` | local_pass |
| CA-003 | Pydantic estrito, Structured Outputs e UI com edição/rejeição, origem e confiança | local_pass |
| CA-004 | testes de decimal, negativo, unidade, percentual, contradição e `ΔP = 4 × V²` | local_pass |
| CA-005 | teste aplica somente `s1`, preserva `s2` e registra edição | local_pass |
| CA-006 | teste confirma `descricao`, `diagnostico` e status oficiais inalterados | local_pass |
| CA-007 | callback força `Rascunho`; endpoint retorna `report_persisted=false` | local_pass |
| CA-008 | teste de serviço e integração HTTP retornam 404 para outro usuário | local_pass |
| CA-009 | testes de exclusão manual e `cleanup_expired_audio()` | local_pass |
| CA-010 | testes da flag desativada e chave ausente | local_pass |
| CA-011 | upgrade repetido, downgrade restrito e ciclo global de migrations | local_pass |
| CA-012 | 446 testes e 2 subtestes, pip check, ESLint, TypeScript e build Next.js | stage_pass |
| CA-013 | workflow `30178211835`: deploy, transcrição real, estruturação, AE/Ao, aplicação seletiva sem persistência, auditoria, exclusão e limpeza | stage_pass |
| CA-014 | `origin/main=6a12cf9a815d6e2e14d58604e03242948f8e1093`; produção sem alteração | pass |
| CA-015 | regressão reproduz o texto reportado, consolida sugestões duplicadas por maior confiança e registra alerta visível | stage_pass |
| CA-016 | `ValidationError` estruturado retorna `invalid_structured_output`, sem mensagem falsa de indisponibilidade | stage_pass |
| CA-017 | correlação multimodal de áudio + sete medidas em endocardiose mitral C, com salvaguardas de ICC/IM Vmax e classificação de hipertensão pulmonar somente quando IT Vmax possui contexto anatômico direito | local_pass |
| CA-018 | contexto do paciente contém espécie, raça, idade e peso; referência mais próxima carregada chega ao provedor e ao validador | stage_pass |
| CA-019 | medidas possuem unidades canônicas no payload e em todos os rótulos das telas novo/editar | stage_pass |
| CA-020 | padrão avançado derivado das medidas gera frases interpretativas sem números e estágio C apenas condicional sem evidência de ICC | stage_pass |
| CA-021 | exclusão após transcrição ou falha rejeita a sessão, remove o áudio e limpa transcrição/sugestões locais antes de retornar à gravação no mesmo rascunho | local_pass |
| CA-022 | ditado exato de mitral leve/B1 + demais parâmetros normais gera 15 sugestões ricas sem chamar o provedor externo; achado não reconhecido continua no fluxo estrito da IA | local_pass |
| CA-023 | `insufficient_quota` é distinguido de rate limit temporário e retorna mensagem explícita de cota esgotada | local_pass |
| CA-024 | tabela formal de medidas apresenta e' e a' do Doppler tecidual em `m/s`; importação converte `cm/s` e referência histórica é ajustada para comparação | local_pass |
| CA-025 | workflow de produção habilita a flag do ditado e configura os modelos antes de reiniciar os serviços, sem revelar credenciais | local_pass |
| CA-026 | gradientes IM/IT/IA/IP usam `4 × V²`; remodelamento atrial direito moderado + IT Vmax 3,6 gera gradiente 51,84, PAD 10 e PSAP 61,84 mmHg | local_pass |
| CA-027 | ditado com sinais clínicos explícitos não gera alerta de ausência; estágio C sem congestão mantém correlação clínica específica | local_pass |
| CA-028 | matriz canina classifica alta probabilidade com IT elevada e dois locais direitos; regra felina retorna suspeita orientativa com alerta próprio | local_pass |
| CA-029 | PDF com `MM/LVIDd` e `2D/LVIDd` conserva as duas séries, informa as duas técnicas e bloqueia aplicação até escolha do bloco do laudo | local_pass |
| CA-030 | PDF final usa `VE_tecnica_relatorio` para emitir exclusivamente o bloco Modo M ou Modo 2D selecionado | local_pass |
| CA-031 | suíte oficial com 471 testes, 70 testes focados e 13 subtestes, `pip check`, ESLint, TypeScript, build Next.js e `git diff --check` | local_pass |
| CA-032 | canário vivo avançado exige alta probabilidade ecocardiográfica quando IT Vmax 3,6 m/s está associada a repercussão em câmaras direitas e rejeita o alerta legado de velocidade isolada | stage_pending |
| CA-033 | PDF real com seções independentes 2D e M-Mode separa os dez pares de medidas do VE, detecta ambas as técnicas e reduz os conflitos de 10 para 0 | local_pass |
| CA-034 | novo/editar oferecem VDF, VSF, FE de Teicholz e Delta D/FS no bloco 2D; a escolha de técnica controla também esses campos no PDF | local_pass |

## Evidência local executada

### Rodada atual: separação integral entre Modo M e Modo 2D

- O PDF clínico externo de duas páginas foi processado sem persistir dados
  identificáveis no repositório.
- Antes da correção, os dez pares DIVEd, DIVEs, SIVd, SIVs, PLVEd, PLVEs, VDF,
  VSF, FE e Delta D/FS resultavam em dez conflitos e nenhuma técnica detectada.
- Com o extrator versão 4, o mesmo estudo retornou 38 medidas sugeridas, zero
  conflitos e `tecnicas_ve_detectadas = ["2d", "modo_m"]`.
- A regressão automatizada confirma que cabeçalhos de seção mantêm o contexto
  técnico até o início de outra seção e que o Doppler não herda Modo M/2D.
- O teste do PDF confirma que a escolha Modo M ou Modo 2D seleciona também
  volumes, fração de ejeção e encurtamento fracional da série correspondente.

### Rodada atual: PSAP, hipertensão pulmonar e técnicas do VE

```bash
cd backend
./venv/bin/python -m pytest -q \
  tests/test_ai_echo_voice_assistant.py \
  tests/test_eco_study_extraction_service.py \
  tests/test_pdf_laudo_echo_measurements.py
# 70 testes e 13 subtestes, OK

./venv/bin/python -m unittest discover -s tests -p "test_*.py"
# 471 testes, OK

./venv/bin/python -m pip check
# No broken requirements found.

cd ../frontend
npm run lint
./node_modules/.bin/tsc --noEmit
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=1536' \
  ./node_modules/.bin/next build --no-lint
# build otimizado, tipos, 36 páginas e traces, OK

cd ..
git diff --check
# OK
```

A tentativa de executar `pytest` indiscriminadamente desde a raiz do backend
também coletou quatro scripts legados na raiz, fora de `backend/tests`, que
pressupõem um banco SQLite previamente criado. Eles falharam na coleta por
ausência da tabela `usuarios`; a suíte oficial e os testes focados acima
executam no ambiente isolado e passaram integralmente.

```bash
cd backend
./venv/bin/python -m unittest \
  tests/test_ai_echo_voice_assistant.py \
  tests/test_ai_echo_migration.py
# 31 testes focados, OK
./venv/bin/python -m unittest discover -s tests -p "test_*.py"
# 432 testes, OK
./venv/bin/python -m pip check
# No broken requirements found.
./venv/bin/python -m unittest tests/test_migration_ci_cycle.py
# 1 teste, OK

cd ../frontend
npx eslint app/laudos/components/EchoVoiceAssistant.tsx \
  'app/laudos/[id]/editar/page.tsx' --max-warnings=0
npx tsc --noEmit --pretty false
npm run lint
NODE_OPTIONS='--max-old-space-size=1536' \
  NEXT_TELEMETRY_DISABLED=1 npx next build --no-lint
# build otimizado, tipos, 36 páginas e traces, OK

cd ..
git diff --check
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/deploy-stage.yml")'
```

### Evidência local de unidades e referência clínica

- `venv/bin/python -m pytest -q`: 446 testes e 2 subtestes aprovados;
- foco de IA, canary e defaults de referência: 46 testes aprovados;
- `venv/bin/python -m pip check`: nenhuma dependência quebrada;
- ESLint dirigido, TypeScript e build Next.js com 36 páginas: aprovados;
- `git diff --check`: aprovado;
- nenhuma migration nova: a implementação consulta a tabela
  `referencias_eco` já existente.

### Recuperação após falha e exclusão do áudio

O teste focado cobre uma sessão em estado `failed` com áudio temporário:
`reject_session` registra o descarte, muda a sessão para `rejected` e a exclusão
remove o arquivo e marca o ativo como apagado. No frontend, `Excluir e gravar
novamente` usa o mesmo descarte completo de `Gravar novo áudio`, limpa sessão,
transcrição, sugestões, medidas e seleções locais e volta à etapa 1 sem criar
outro laudo.

O `check_sdd_guardrail.py` depende de um `HEAD` commitado e será executado antes
do push de `stage`.

### Regressão da resposta clínica fora do formato

O teste reproduz integralmente o ditado da captura:
`Espessamento de valva mitral com regurgitação leve. O espessamento de mitral
é leve. Demais parâmetros ecocardiográficos dentro da normalidade. Animal
classificado como B1 para endocardiose de mitral.`

A chamada dos casos complexos passa a usar raciocínio `low`, orçamento de 8.000
tokens e prompt `echo-clinical-ptbr-v7`, que orienta o modelo a não repetir
frases normais genéricas. Casos simples integralmente cobertos pelas regras
conhecidas são estruturados localmente, sem consumir cota da API. O teste de
integração exige sessão em `awaiting_review`, os 14 campos qualitativos mais a
conclusão, preset rico por estrutura, alteração mitral leve, conclusão B1 e
confirma que o provedor externo não foi chamado. Um caso com massa atrial
confirma que achados não reconhecidos continuam no fluxo estrito e permanecem
em `failed` quando o provedor retorna `invalid_structured_output`.

```bash
cd backend
./venv/bin/python -m unittest \
  tests.test_ai_echo_voice_assistant \
  tests.test_ai_echo_stage_canary
# 48 testes, OK
./venv/bin/python -m pytest -q
# 451 testes e 2 subtestes, OK
./venv/bin/python -m pip check
# No broken requirements found.
```

O primeiro deploy da correção (`30212298835`, commit `e800e7d`) concluiu
guardrail, quality gate e implantação no VPS. O canário vivo foi bloqueado antes
da estruturação, durante a transcrição artificial, com
`provider_rate_limited`. Uma requisição mínima e sem conteúdo clínico feita com
a configuração local da API confirmou `429 insufficient_quota`, sem
`retry-after`. Como não se trata de falha do esquema clínico, o seguimento torna
os casos conhecidos independentes da API na etapa de estruturação e preserva o
canário vivo como verificação separada, a ser repetida depois da regularização
da cota.

### Correlação multimodal em doença mitral avançada

O teste determinístico usa o ditado artificial "endocardiose mitral estágio C",
regurgitação mitral importante, regurgitação tricúspide, repercussão direita e
congestão venosa pulmonar junto com `AE_Ao=2,5`,
`DIVEd_normalizado=2,0`, `Onda_E=1,35`, `E_A=2,2`, `E_E_linha=14`,
`IM_Vmax=5,5` e `IT_Vmax=3,6`.

As asserções exigem frases específicas para mitral, átrio esquerdo, ventrículo
esquerdo, função diastólica, tricúspide, câmaras direitas e conclusão C, sem
repetir os números nas frases. Como a IT Vmax elevada está acompanhada de
repercussão em câmaras direitas, o canário exige alta probabilidade
ecocardiográfica de hipertensão pulmonar e a ausência do alerta reservado à
velocidade tricúspide isolada. A salvaguarda de ICC continua exigindo evidência
clínica/congestiva para o estágio C. Um teste separado confirma que as medidas
com unidades, os intervalos de referência e espécie/raça/idade/peso chegam
juntos ao provedor.
O canary mantém ainda o cenário anterior B1 + refluxo leve + DDG1 + AE/Ao 2,4
para assegurar que a correlação avançada não apague achados leves já ditados.
O AE/Ao 2,5 também é pronunciado no segundo ditado artificial, permitindo usar
a mesma tentativa para validar extração numérica, aplicação seletiva e auditoria,
sem ultrapassar as duas estruturações permitidas por sessão.

## Homologação

O deploy `30177544271` concluiu no VPS com `HEAD=5acfee7`, migrations, readiness,
zero 5xx, worker de limpeza, canary autenticado geral e restore drill aprovados.
O canary específico descartável falhou antes de registrar a transcrição com
`processing_failed`; os registros e o áudio artificiais foram removidos pelo
`finally`. A repetição `30177966805`, em `HEAD=cce3584`, isolou
`processing_failed_transcription_audio_validation`: o timestamp retornado em stage
era timezone-aware e o relógio legado era naive. A correção compara corretamente
timestamps de SQLite e PostgreSQL. Usar somente caso artificial, sem nome,
telefone, endereço, documento ou dado oficial.

### Evidência final

- Migration CI `30178211800`: sucesso em `d317ac806de21304bf3a3d40ce406d7a50522dbf`.
- Deploy Stage `30178211835`: quality gate, guardrail SDD e VPS aprovados.
- Runtime: readiness pronta, zero 5xx, cleanup worker vivo, canary autenticado
  geral e restore drill aprovados.
- Canary específico: configuração pronta; transcrição real; estruturação;
  `AE/Ao=1,74`; aplicação seletiva e auditoria; `report_persisted=false`;
  `Rascunho`; exclusão do áudio; limpeza integral dos registros artificiais.
- Smoke público: institucional `200`, aplicação `200`, editor `200` e endpoint
  protegido do módulo `401` sem credenciais, conforme esperado.
- O chunk do editor de laudos servido por stage contém o componente do assistente.
- Nenhuma credencial, transcrição, conteúdo clínico ou dado pessoal foi impresso.
- O teste manual autenticado de `MediaRecorder` em tablet e desktop não foi
  executado por ausência de sessão de usuário fornecida; permanece como validação
  exploratória anterior a uma eventual promoção, sem afetar o canary de backend.

### Correção de sugestões duplicadas

A transcrição reportada pelo usuário em 2026-07-25 foi reproduzida sem dados
pessoais. Antes da correção, `responses.parse()` recebia uma saída com
`field_key` repetida, o validador Pydantic lançava erro na raiz e o adaptador
convertia incorretamente a falha em `provider_unavailable`.

A correção usa o prompt `echo-clinical-ptbr-v2`, aceita a resposta ainda não
consolidada para validação defensiva e mantém uma única sugestão por campo,
escolhendo a maior confiança e adicionando `duplicate_field_suggestion`. Uma
falha estrutural genuína passa a ser `invalid_structured_output`. A reprodução
viva local com o mesmo texto retornou quatro sugestões e quatro campos únicos.
O canary descartável de stage repetirá primeiro esse texto e exigirá chaves
únicas antes de continuar com o cenário numérico AE/Ao.

### Evidência da correção em stage

- Commit implantado: `16227f6a8d159d26e47c0afe56145f4b28d3f120`.
- Migration CI `30179454079`: sucesso.
- Deploy Stage `30179454098`: quality gate, SDD, VPS e canary aprovados.
- Canary: transcrição real, texto da regressão com campos únicos, estruturação
  numérica, aplicação seletiva sem persistência, auditoria e exclusão do áudio.
- Runtime: ready, zero 5xx, cleanup worker vivo e restore drill aprovado.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Ditado durante a criação do laudo

O fluxo automatizado cobre o contrato de criação contínua:

- o assistente aceita resolver o `laudo_id` sob demanda;
- a tela `Novo laudo` exige paciente antes do ditado;
- chamadas concorrentes reutilizam a mesma promessa de criação;
- o backend cria o rascunho com status `Rascunho`;
- a URL passa para `/laudos/{id}/editar` sem desmontar a tela atual;
- as sugestões são aplicadas ao formulário local;
- salvar reutiliza `PUT /laudos/{id}` e atualiza o mesmo registro, incluindo
  paciente, campos estruturados e conclusão;
- o teste de regressão confirma que nenhum segundo `Laudo` é inserido durante a
  finalização do rascunho.

### Evidência do fluxo contínuo em stage

- Commit implantado: `e556c8a8af34e7e8cc0fe4ae8d25abb44cbb5fb7`.
- Migration CI `30181850541`: sucesso.
- Deploy Stage `30181850536`: guardrail SDD, quality gate, VPS, restore drill e
  canary de IA aprovados.
- Validação local: 436 testes e 2 subtestes, lint, TypeScript, build e
  `pip check` aprovados.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais, conforme esperado.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Expansão controlada de normalidade

Os testes automatizados cobrem duas expressões clínicas:

- "Exame normal, sem alterações ecocardiográficas" produz os 14 aspectos
  qualitativos e a conclusão com as frases ricas e distintas do preset normal
  da espécie, substituindo respostas genéricas do modelo e sem criar medidas;
- "Disfunção diastólica grau 1, padrão senil e demais parâmetros
  ecocardiográficos dentro da normalidade" preserva a alteração no campo
  diastólico, completa os outros 13 aspectos com o preset normal e conclui
  somente a disfunção diastólica grau I.

A regra é determinística no backend, usa o prompt
`echo-clinical-ptbr-v3`, não persiste o laudo e mantém revisão/aceite explícitos.
O canary descartável de stage usa o segundo texto e exige as 15 chaves, frases
distintas de mitral e aórtica provenientes do preset, o texto diastólico canônico
e a conclusão restrita antes de seguir para o cenário AE/Ao.

O cenário de regressão também cobre a formulação "o resto dos parâmetros
ecocardiográficos avaliados dentro da normalidade" junto com espessamento mitral,
refluxo leve, estágio B1 sem remodelamento e disfunção diastólica grau I. Ele
exige descrição mitral detalhada, preset rico nos demais aspectos e conclusão
contendo somente os achados ditados.

### Regravação após sugestões

A interface apresenta `Gravar novo áudio` na revisão das sugestões. A ação
registra a rejeição da sessão anterior, exclui seu áudio temporário, limpa apenas
o estado do assistente e retorna à etapa 1. O rascunho e seus campos permanecem
inalterados; a gravação seguinte cria outra sessão vinculada ao mesmo laudo.

### Interpretação das medidas do formulário

A estruturação recebe as medidas atuais além da transcrição. O teste de regressão
usa `AE_Ao=2,4` sem ditar o valor e exige sugestão de dilatação atrial esquerda
importante, repercussão hemodinâmica significativa e preservação do achado mitral
na conclusão. O valor fica apenas na origem auditável, sem alerta redundante e
sem aparecer no texto sugerido. Como essa medida
conflita com a afirmação ditada de ausência de remodelamento/B1, o canary exige
que a endocardiose e o refluxo sejam preservados, mas que o estágio B1 não seja
mantido. A regra não atribui um novo estágio ACVIM com AE/Ao isoladamente.
O validador remove deterministicamente da conclusão as expressões conflitantes
`sem remodelamento cardíaco significativo` e `Estágio B1 (ACVIM)`.
O teste unitário usa uma conclusão contendo ambas as expressões e confirma sua
remoção, sem perder a endocardiose mitral.
O cenário misto também confirma que a conclusão específica substitui a conclusão
genérica de normalidade eventualmente carregada pelo preset.

### Unidades, paciente e tabela de referência

O backend resolve a linha de referência mais próxima da tabela carregada usando
espécie e peso do cabeçalho. O payload clínico do prompt
`echo-clinical-ptbr-v7` contém:

- espécie, raça, idade calculada e peso, sem nome do paciente ou tutor;
- somente medidas numéricas válidas, cada uma com unidade canônica e método;
- os limites mínimo/máximo da tabela para cada medida disponível;
- identificação da referência e do peso de referência mais próximo.

O teste determinístico usa onda E discretamente acima do máximo da tabela, mas
abaixo do fallback genérico, junto com AE/Ao, DIVEd normalizado e IM Vmax. Isso
prova que a referência carregada participa da interpretação. O resultado exige
descrições de valva mitral, átrio esquerdo, ventrículo esquerdo e pressão de
enchimento, além de conclusão de doença valvar mixomatosa avançada com estágio C
condicional. Nenhuma frase sugerida pode repetir os valores de origem.

Nas telas `Novo laudo` e `Editar laudo`, volumes exibem mL; frações, %; velocidades,
m/s; tempos, ms; gradientes, mmHg; dp/dt, mmHg/s; e
razões são explicitamente adimensionais.

### Evidência de unidades e referência clínica em stage

- Implementação validada: `c3de7773713f7df8f94cf1c22f2b647bde627498`
  (origem funcional `1cc370ff8ed1636c326d389c2eecdb1f90e3454e`).
- Migration CI `30208626034`: sucesso.
- Deploy Stage `30208626047`: SDD guardrail, 445 testes e 2 subtestes, lint,
  build, VPS, migrations, readiness e quality gate aprovados.
- Runtime: `HEAD=c3de777`, readiness pronta, zero 5xx, canário autenticado geral
  e restore drill aprovados.
- Canário clínico real: transcrição, regressão B1 + DDG1, correlação multimodal
  avançada, frases sem repetição dos valores das medidas, integridade numérica
  no campo de origem, alerta de IT Vmax, aplicação seletiva sem persistir o
  laudo, auditoria, exclusão do áudio e limpeza aprovadas.
- Smoke público: raiz `200`; rota autenticada de novo laudo redireciona anonimamente;
  configuração protegida do assistente retorna `401` sem credenciais.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência da regravação em stage

- Commit implantado: `0c69d8a15e18dbe27ebcdbb35a46841118b8d8cb`.
- Validação local: lint, TypeScript, build, verificação de diff e guardrail SDD
  aprovados.
- Migration CI `30202477845`: sucesso.
- Deploy Stage `30202477840`: quality gate, guardrail SDD e VPS aprovados; o
  canary clínico foi dispensado por se tratar de alteração exclusiva de frontend.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais. O chunk servido da rota contém
  `Gravar novo áudio`.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência da interpretação de medidas em stage

- Commit implantado: `49ab0f71bf4ffa5fc36bdc2ec8e723fae5f54e41`.
- Validação local: 36 testes focados aprovados; suíte completa anterior com 439
  testes e 2 subtestes, lint, TypeScript, build, diff check e guardrail SDD
  aprovados.
- Migration CI `30204439549`: sucesso.
- Deploy Stage `30204439552`: quality gate, guardrail SDD, VPS e canary clínico
  aprovados.
- Canary real: AE/Ao 2,4 interpretado como dilatação atrial esquerda importante
  e repercussão hemodinâmica significativa; achados mitral e diastólico
  preservados; conclusão normal e B1 conflitantes removidos; aplicação seletiva,
  auditoria e exclusão do áudio aprovadas.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência da correlação multimodal C em stage

- Commit implantado: `bfcaa3f91305538f4d46dc295ead6b50b32538c7`
  (inclui a implementação `42df756bc015c2538c2b0103a58b9b6632d61184`).
- Validação local: 40 testes focados e 443 testes completos aprovados; lint,
  TypeScript, build, diff check e guardrail SDD aprovados.
- Migration CI `30206311386`: sucesso.
- Deploy Stage `30206311321`: quality gate, guardrail SDD, VPS, readiness,
  canary autenticado e restore drill aprovados.
- Canary clínico real: transcrição; regressão B1 + DDG1; correlação avançada de
  estágio C com sete medidas; integridade numérica AE/Ao; aplicação seletiva sem
  persistência do laudo; auditoria; exclusão do áudio e limpeza aprovadas.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência do cenário misto B1 + DDG1 em stage

- Commit implantado: `c06fb512db76a4336ec4339d8bc6e01ee9510063`.
- Validação local: 438 testes e 2 subtestes, `pip check`, verificação de diff e
  guardrail SDD aprovados.
- Migration CI `30183939045`: sucesso.
- Deploy Stage `30183939021`: quality gate, guardrail SDD, VPS e canary
  aprovados.
- Canary real: transcrição; reconhecimento de B1, refluxo leve e DDG1; preset
  rico nos demais campos; conclusão restrita aos achados; aplicação seletiva;
  auditoria e exclusão do áudio.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais, conforme esperado.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência do preset normal rico em stage

- Commit implantado: `467ca0f2c7d31deeca199bd271c409eee4b9e489`.
- Validação local: 437 testes e 2 subtestes, `pip check`, lint, TypeScript,
  build e guardrail SDD aprovados.
- Migration CI `30182446724`: sucesso.
- Deploy Stage `30182446758`: guardrail SDD, quality gate, VPS e canary
  aprovados.
- Canary: transcrição real; expansão das 15 chaves; frases específicas e
  distintas do preset para mitral e aórtica; preservação da disfunção diastólica
  grau I; conclusão restrita; aplicação seletiva; auditoria; exclusão do áudio.
- Smoke público: aplicação e `/laudos/novo` responderam `200`; configuração
  protegida respondeu `401` sem credenciais, conforme esperado.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.

### Evidência da expansão em stage

- Commit implantado: `1e87dc8c6036c239ff74e8067b238f41228b36f3`.
- Migration CI `30181145386`: sucesso.
- Deploy Stage `30181145397`: guardrail SDD, quality gate, VPS e canary aprovados.
- Canary: transcrição real; expansão dos demais campos; preservação da disfunção
  diastólica grau I; conclusão restrita; estruturação numérica; aplicação seletiva
  sem persistência; auditoria; exclusão do áudio.
- Smoke público: aplicação `200` e configuração protegida `401` sem credenciais,
  conforme esperado.
- `origin/main` permaneceu em `6a12cf9a815d6e2e14d58604e03242948f8e1093`.
