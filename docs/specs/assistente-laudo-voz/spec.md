# Spec - assistente-laudo-voz

Data: 2026-07-25
Responsável: Martiniano + Codex
Status: local_validated_stage_pending

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
- somente transcrição e preferências clínicas mínimas são enviadas ao provedor;
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
