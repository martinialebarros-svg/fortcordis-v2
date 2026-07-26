# Verify - assistente-laudo-voz

Data: 2026-07-25
Responsável: Martiniano + Codex
Status: duplicate_suggestion_fix_stage_pass

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
| CA-012 | 432 testes, pip check, ESLint, TypeScript e build Next.js | stage_pass |
| CA-013 | workflow `30178211835`: deploy, transcrição real, estruturação, AE/Ao, aplicação seletiva sem persistência, auditoria, exclusão e limpeza | stage_pass |
| CA-014 | `origin/main=6a12cf9a815d6e2e14d58604e03242948f8e1093`; produção sem alteração | pass |
| CA-015 | regressão reproduz o texto reportado, consolida sugestões duplicadas por maior confiança e registra alerta visível | stage_pass |
| CA-016 | `ValidationError` estruturado retorna `invalid_structured_output`, sem mensagem falsa de indisponibilidade | stage_pass |

## Evidência local executada

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

O `check_sdd_guardrail.py` depende de um `HEAD` commitado e será executado antes
do push de `stage`.

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
importante, repercussão hemodinâmica significativa, preservação do achado mitral
na conclusão e o alerta `report_measurement_interpreted`. Como essa medida
conflita com a afirmação ditada de ausência de remodelamento/B1, o canary exige
que a endocardiose e o refluxo sejam preservados, mas que o estágio B1 não seja
mantido. A regra não atribui um novo estágio ACVIM com AE/Ao isoladamente.

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
