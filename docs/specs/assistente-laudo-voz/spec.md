# Spec - assistente-laudo-voz

Data: 2026-07-26
Responsável: Martiniano + Codex
Status: stage_followup_pending_provider_quota

## 1. Arquitetura encontrada

- frontend Next.js no App Router;
- backend FastAPI com SQLAlchemy 2 e Pydantic 2;
- migrations versionadas em `backend/migrations/versions`, executadas pelo runner
  próprio e validadas em SQLite/PostgreSQL;
- autenticação JWT por bearer ou cookie, CSRF para cookie e matriz de permissões por
  módulo;
- `Laudo` genérico armazena medidas/blocos em `descricao`, conclusão em `diagnostico`
  e o editor estruturado em `anexos.ecocardiograma_estruturado`;
- o editor real possui 15 chaves qualitativas e 39 chaves de medidas;
- uploads temporários usam `UPLOAD_DIR` com fallback local;
- chamadas OpenAI existentes ocorrem somente no backend;
- não existe ainda entidade de organização; `clinic_id` é o limite organizacional
  disponível no laudo e `user_id` é o proprietário estrito da sessão.

## 2. Decisão de arquitetura

O módulo é aditivo e isolado:

1. `SpeechToTextProvider` recebe bytes e vocabulário, retornando somente a
   transcrição.
2. `ClinicalStructuringProvider` recebe a transcrição minimizada e frases
   preferidas, retornando `EchoClinicalStructureOutput`.
3. OpenAI é a primeira implementação, configurada por ambiente.
4. Transcrição e estruturação rodam no `ThreadPoolExecutor` do processo, compatível
   com os jobs já usados pelo backend.
5. O áudio fica em arquivo aleatório com permissão `0600`, expira e pode ser
   excluído manualmente.
6. A aplicação cria trilha e snapshot, mas devolve apenas um patch. O `Laudo` não é
   modificado pelo endpoint de IA.
7. A expiração aceita timestamps sem timezone do SQLite e timezone-aware do
   PostgreSQL, normalizando a comparação no worker.

## 3. Requisitos funcionais

- RF-001: `AI_ECHO_ASSISTANT_ENABLED=false` desativa o módulo no backend e oculta o
  controle no frontend.
- RF-002: todas as rotas exigem usuário autenticado e permissão de laudos.
- RF-003: uma sessão só pode ser consultada ou alterada pelo `user_id` que a criou.
- RF-004: a sessão conserva `clinic_id`, `patient_id` e `laudo_id`, sem enviar nomes
  ou contatos ao provedor.
- RF-005: áudio aceita somente m4a, mp3, mp4, mpeg/mpga, wav e webm dentro dos
  limites configurados.
- RF-006: o áudio recebe expiração, exclusão manual e limpeza automática periódica.
- RF-007: a transcrição usa idioma `pt`, prompt de vocabulário versionado e modelo
  configurável.
- RF-008: a transcrição original é imutável na interface e existe uma cópia
  editável.
- RF-009: a estruturação usa Responses API com Pydantic e rejeita saída incompleta
  ou fora do esquema.
- RF-010: somente as chaves reais do editor podem ser retornadas.
- RF-011: números ditados são extraídos deterministicamente, preservados em
  `raw_value` e comparados com a saída do modelo.
- RF-012: valores negativos inválidos, percentuais acima de 100 e divergências de
  número/unidade geram alerta e nunca correção silenciosa.
- RF-013: velocidade/gradiente tricúspide usa apenas o alerta
  `ΔP = 4 × V²`, sem substituir valores.
- RF-014: contradições textuais conhecidas geram alerta clínico.
- RF-015: cada sugestão mostra campo, origem, confiança, texto atual e texto sugerido.
- RF-016: o usuário pode selecionar, editar ou rejeitar campos individualmente, ou
  selecionar todos os itens pendentes.
- RF-017: modos `replace`, `append` e `empty_only` são suportados.
- RF-018: substituição de campo preenchido exige confirmação visível.
- RF-019: o backend exige literalmente `confirmed=true`.
- RF-020: aplicação registra snapshot e patch com `report_persisted=false`.
- RF-021: o formulário recebe as sugestões selecionadas e força status local
  `Rascunho`; o salvamento continua em `/laudos/{id}`.
- RF-022: edição, aceite e rejeição por campo não alteram o laudo diretamente e
  ficam registrados como feedback.
- RF-023: vocabulário e frases preferidas são cadastráveis pelo usuário.
- RF-024: frases preferidas entram no prompt e seu uso aceito incrementa contagem.
- RF-025: falhas do provedor preservam áudio/transcrição enquanto válidos e nunca
  afetam o rascunho manual.
- RF-026: o prompt solicita no máximo uma sugestão por campo. Se o modelo ainda
  retornar duplicidades, o backend mantém deterministicamente a sugestão de maior
  confiança e apresenta `duplicate_field_suggestion` para revisão, sem interromper
  a sessão.
- RF-027: falhas de validação Pydantic da resposta estruturada são classificadas
  como `invalid_structured_output`, nunca como indisponibilidade do provedor.
- RF-028: uma afirmação explícita de exame normal ou sem alterações
  ecocardiográficas gera sugestões normais para todos os 14 aspectos qualitativos
  e para a conclusão, sem criar medidas numéricas.
- RF-029: a expressão "demais parâmetros ecocardiográficos dentro da normalidade"
  completa somente os aspectos sem alteração específica. Achados ditados são
  preservados e prevalecem sobre a frase normal do mesmo campo.
- RF-030: no caso explícito de disfunção diastólica grau I, padrão senil, com os
  demais parâmetros normais, `funcao_diastolica` recebe a alteração, os outros
  aspectos recebem frases normais e a conclusão contém somente
  "Disfunção diastólica grau I (padrão senil).".
- RF-031: a expansão de normalidade é sempre uma sugestão revisável, identificada
  por `global_normality_expanded`, e continua sujeita ao aceite explícito.
- RF-032: o assistente fica disponível também em `Novo laudo`. Ao abri-lo, depois
  de identificado o paciente, o frontend cria uma única vez um laudo técnico em
  status `Rascunho` e permanece na mesma experiência de edição.
- RF-033: o identificador do rascunho é reutilizado na sessão de IA e no
  salvamento final; o fluxo nunca cria um segundo laudo para concluir o mesmo
  ditado.
- RF-034: depois da criação técnica, a URL passa a apontar para a edição do
  rascunho, permitindo recarregar ou retomar o trabalho sem duplicação.
- RF-035: a aplicação das sugestões altera somente o estado local do formulário.
  O rascunho permanece `Rascunho` até o usuário clicar em salvar, quando o mesmo
  registro é atualizado com os dados completos e finalizado.
- RF-036: ao reconhecer uma afirmação global de normalidade, o backend substitui
  respostas genéricas do modelo pelas frases específicas de cada aspecto no
  preset estruturado `Exame normal`, usando a variante canina ou felina conforme
  a espécie do paciente.
- RF-037: na expressão "demais parâmetros ... dentro da normalidade", sugestões
  genéricas fundamentadas somente nessa afirmação global são substituídas pelo
  preset; alterações explicitamente ditadas continuam prevalecendo.
- RF-038: expressões equivalentes, incluindo "o resto dos parâmetros
  ecocardiográficos avaliados dentro da normalidade", acionam a mesma expansão
  determinística pelo preset normal.
- RF-039: quando o ditado informa espessamento mitral com refluxo leve,
  classificação B1 sem remodelamento e disfunção diastólica grau I, o campo
  mitral recebe descrição clínica detalhada e a conclusão reúne somente esses
  achados, incluindo o estágio B1 (ACVIM).
- RF-040: depois de gerar sugestões, o usuário pode escolher `Gravar novo áudio`.
  A sessão anterior é rejeitada para auditoria, seu áudio temporário é excluído
  e a interface retorna à gravação sem aplicar sugestões nem criar outro laudo.
- RF-041: o novo áudio cria uma nova sessão de IA vinculada ao mesmo rascunho,
  permitindo gerar e revisar um novo conjunto de sugestões.
- RF-042: a estruturação recebe também as medidas já preenchidas no formulário,
  mesmo quando elas não foram mencionadas no áudio.
- RF-043: em cães, AE/Ao igual ou superior a 1,6 gera sugestão revisável de
  aumento atrial; AE/Ao superior a 2,3 gera sugestão de dilatação atrial
  importante e repercussão hemodinâmica significativa, sem definir isoladamente
  estágio ACVIM ou etiologia.
- RF-044: toda interpretação derivada de medida identifica o valor no
  `source_span` de origem e pode substituir uma frase global de normalidade
  conflitante antes do aceite explícito; a frase clínica sugerida não repete
  esse valor.
- RF-045: se AE/Ao indicar remodelamento atrial e a transcrição afirmar B1 sem
  remodelamento, a sugestão preserva a doença mitral e o refluxo, remove a
  classificação conflitante e não infere outro estágio com AE/Ao isoladamente.
- RF-046: a conclusão clínica determinística dos achados alterados substitui a
  conclusão genérica do preset normal quando ambas forem geradas.
- RF-047: o provedor de estruturação recebe, no mesmo input, a transcrição
  anonimizada, as medidas atuais não vazias com unidades canônicas e método e o contexto
  de espécie, raça, idade e peso, sem nome do paciente ou tutor.
- RF-048: no contexto canino de endocardiose/doença valvar mixomatosa, o
  assistente correlaciona AE/Ao, DIVEd normalizado, onda E, E/A, E/E', IM Vmax
  e IT Vmax com os achados explicitamente ditados, mantendo o valor de origem.
- RF-049: a comparação de DIVEd, AE/Ao, onda E, E/A e demais medidas usa
  prioritariamente a linha mais próxima da tabela de referência carregada para
  a espécie e o peso. Os limiares consensuais caninos de AE/Ao e DIVEd
  normalizado permanecem como salvaguarda quando aplicáveis.
- RF-050: IM Vmax é descrita, mas não gradua isoladamente a regurgitação mitral.
  IT Vmax igual ou superior a 3,0 m/s gera alerta para correlação com sinais
  anatômicos adicionais antes de classificar hipertensão pulmonar.
- RF-051: regurgitação tricúspide isolada não autoriza inferir dilatação das
  câmaras direitas; essa repercussão só preenche AD/VD quando estiver no ditado.
- RF-052: estágio C é afirmado somente quando sustentado por história atual ou
  prévia de insuficiência cardíaca no ditado/contexto. Um padrão ecocardiográfico
  avançado pode sugerir condicionalmente que o caso corresponda ao estágio C,
  mas congestão venosa pulmonar só é afirmada quando explicitamente informada.
- RF-053: a correlação avançada não substitui a conclusão mitral leve quando
  somente AE/Ao está elevado; nesse cenário permanece a regra específica que
  preserva refluxo e disfunção diastólica já ditados.
- RF-054: o canary vivo exerce no máximo duas estruturações por sessão, igual ao
  limite operacional; a segunda cobre simultaneamente correlação C e integridade
  numérica da AE/Ao ditada.
- RF-055: todos os campos de medidas exibem unidade no rótulo; relações
  matemáticas são identificadas como adimensionais.
- RF-056: a linha de referência mais próxima é resolvida no backend pela espécie
  e peso do cabeçalho, incluindo os defaults publicados já adotados pelo sistema,
  e é entregue tanto ao modelo quanto ao validador determinístico.
- RF-057: o conjunto simultâneo de regurgitação mitral mensurada, aumento atrial
  esquerdo, dilatação ventricular esquerda e pressão de enchimento elevada pode
  gerar sugestão revisável de doença valvar mixomatosa mitral avançada mesmo que
  o áudio não repita todos esses achados.
- RF-058: alertas de unidade, referência ou contexto ausente retornados pelo
  modelo são descartados quando o backend já forneceu esses dados; alertas
  clínicos equivalentes são consolidados por conceito.
- RF-059: ao excluir o áudio depois da transcrição, inclusive quando a geração de
  sugestões falhar, a tentativa atual é rejeitada para auditoria, o áudio
  temporário é excluído e todo o estado local da sessão (transcrição, sugestões,
  medidas e seleções) é limpo. A interface retorna imediatamente à etapa
  `Gravar ou enviar áudio`, preservando o mesmo rascunho do laudo.
- RF-060: a estruturação com `gpt-5.6-sol` usa esforço de raciocínio explícito
  `low` e orçamento máximo de 8.000 tokens de saída. O orçamento compreende
  raciocínio e JSON estruturado e deve reservar espaço suficiente para a
  resposta clínica validada pelo esquema Pydantic.
- RF-061: o backend estrutura sem chamar o provedor externo somente os casos em
  que todas as orações estejam cobertas pelas regras existentes de normalidade
  global/restante, alteração mitral leve com B1 e/ou disfunção diastólica grau I.
  Qualquer achado não reconhecido, avançado ou conflitante continua no fluxo da
  IA com validação Pydantic estrita; o esquema estruturado não é afrouxado.
- RF-062: no ditado de espessamento mitral leve, regurgitação mitral leve,
  classificação B1 e demais parâmetros normais, o assistente usa a descrição
  mitral detalhada, completa os outros campos com o preset normal específico e
  conclui degeneração mixomatosa mitral B1 (ACVIM), sem acrescentar alteração
  não ditada.
- RF-063: respostas `429 insufficient_quota` são apresentadas como cota da API
  esgotada, distintas de um limite temporário de requisições. O laudo manual e
  os casos determinísticos conhecidos permanecem disponíveis.
- RF-064: a tabela formal de medidas inclui as ondas e' e a' do Doppler
  tecidual, ambas identificadas em `cm/s`; a relação E/E' permanece
  adimensional.
- RF-065: o deploy de produção configura explicitamente o assistente de ditado
  com a flag habilitada, provedor OpenAI e modelos aprovados, sem registrar ou
  expor a chave da API.

## 4. Estados

`created`, `uploading`, `transcribing`, `structuring`, `awaiting_review`,
`applied`, `rejected`, `failed`.

Processamentos interrompidos por reinício passam a `failed` com mensagem de nova
tentativa, sem mutação do laudo.

## 5. Persistência

- `ai_echo_sessions`;
- `ai_echo_audio_assets`;
- `ai_echo_transcripts`;
- `ai_echo_field_suggestions`;
- `ai_echo_measurements`;
- `ai_echo_clinical_warnings`;
- `ai_echo_feedback`;
- `ai_echo_vocabulary`;
- `ai_echo_phrase_preferences`;
- `ai_echo_applications`.

A migration `20260725_56` é idempotente e inclui `downgrade()` destrutivo somente
para essas tabelas.

## 6. API

- `GET /api/v1/ai/echo-sessions/config`;
- `POST /api/v1/ai/echo-sessions`;
- `POST /api/v1/ai/echo-sessions/{id}/audio`;
- `POST /api/v1/ai/echo-sessions/{id}/transcribe`;
- `POST /api/v1/ai/echo-sessions/{id}/structure`;
- `GET /api/v1/ai/echo-sessions/{id}`;
- `GET /api/v1/ai/echo-sessions/{id}/audit`;
- `POST /api/v1/ai/echo-sessions/{id}/apply`;
- `POST /api/v1/ai/echo-sessions/{id}/feedback`;
- `DELETE /api/v1/ai/echo-sessions/{id}/audio`;
- `GET/PUT /api/v1/ai/echo-sessions/preferences`.

## 7. Segurança e LGPD

- nenhum segredo chega ao navegador;
- áudio e transcrição integral não entram em logs;
- logs técnicos usam IDs, etapa, duração, status, provedor, modelo e prompt;
- falhas internas registram a subetapa técnica segura, sem mensagem de exceção,
  áudio, transcrição ou conteúdo clínico;
- e-mail, telefone, documento e rótulos de pessoa são removidos antes da
  estruturação;
- somente transcrição anonimizada, preferências clínicas, espécie, raça, idade,
  peso, medidas com unidades e intervalos de referência são enviados ao
  provedor; nomes, tutor e contatos permanecem fora do payload;
- o hash do usuário enviado como `safety_identifier` não permite recuperar e-mail;
- o áudio não é anexado ao laudo;
- o acesso cruzado retorna 404;
- auditoria funcional contém chaves de campo, nunca o laudo integral.

## 8. Configuração e custos

Variáveis obrigatórias em homologação:

- `AI_ECHO_ASSISTANT_ENABLED=true`;
- `AI_PROVIDER=openai`;
- `OPENAI_API_KEY` por secret do ambiente;
- `AI_TRANSCRIPTION_MODEL`;
- `AI_STRUCTURING_MODEL`.

Limites e retenção usam as demais variáveis descritas em
`backend/.env.example`. A estimativa de custo fica nula enquanto as taxas por
milhão estiverem em zero.

## 9. Critérios de aceite

- CA-001: gravação/upload, reprodução, exclusão e regravação funcionam em tablet e
  desktop.
- CA-002: transcrição pode ser editada antes da estruturação.
- CA-003: sugestões e medidas aparecem separadas, com confiança e origem.
- CA-004: alertas não alteram valores.
- CA-005: somente itens selecionados chegam ao estado do formulário.
- CA-006: nenhum endpoint de IA persiste `Laudo`.
- CA-007: laudo continua `Rascunho` até o salvamento normal.
- CA-008: outro usuário não acessa a sessão.
- CA-009: áudio pode ser excluído e expira automaticamente.
- CA-010: feature flag desativada preserva integralmente o fluxo manual.
- CA-011: migration faz upgrade idempotente e downgrade restrito.
- CA-012: testes, lint, TypeScript e build aprovam.
- CA-013: homologação executa migration, deploy e smoke sem dados reais.
- CA-014: nenhuma alteração é promovida a produção.

O smoke vivo de CA-013 deve ser descartável e executado apenas sob marcação
explícita `[ai-echo-canary]`: áudio sintético sem dados pessoais, provedor real,
aplicação seletiva com `report_persisted=false`, consulta da auditoria, exclusão do
áudio e remoção dos registros artificiais. O deploy normal não deve pagar esse
custo.
