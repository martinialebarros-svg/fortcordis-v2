# Plan - assistente-laudo-voz

Data: 2026-07-25
Responsável: Martiniano + Codex
Status: stage_validated

## Fase 1 - Descoberta

1. Mapear o modelo real de laudo, editor, autenticação, uploads, migrations e testes.
2. Confirmar as chaves reais qualitativas e de medidas.
3. Consultar a documentação oficial atual de Speech-to-Text, Responses API e
   Structured Outputs.

Rollback: nenhuma mudança.

## Fase 2 - Contratos e persistência

1. Criar SDD e esquema Pydantic estrito.
2. Criar modelos isolados e migration reversível.
3. Adicionar feature flag e limites administrativos.
4. Criar vocabulário versionado fora do código principal.

Rollback: desativar flag e executar `downgrade()` antes de qualquer dado relevante.

## Fase 3 - Backend

1. Implementar abstrações de provedor.
2. Implementar OpenAI com Audio Transcriptions e Responses Structured Outputs.
3. Implementar storage temporário, expiração e limpeza.
4. Implementar estados, jobs, minimização, validações e endpoints.
5. Implementar aplicação como patch sem mutar o laudo.
6. Implementar preferências, feedback, métricas e auditoria segura.

Rollback: remover router/worker e manter tabelas inertes com a flag desligada.

## Fase 4 - Frontend

1. Adicionar botão apenas no editor de ecocardiograma.
2. Implementar gravação, pausa, reprodução, regravação e upload.
3. Implementar polling sem bloquear a página.
4. Implementar revisão da transcrição, comparação e seleção.
5. Conectar patch aos estados reais e forçar rascunho.
6. Implementar cadastro manual de vocabulário e frases.

Rollback: remover o componente; editor manual permanece inalterado.

## Fase 5 - Verificação

1. Executar testes focais de schema, números, segurança, aplicação e migration.
2. Executar suíte completa do backend.
3. Executar ESLint, TypeScript e build.
4. Executar migration em SQLite e guardrail SDD.
5. Corrigir qualquer regressão.

Rollback: não publicar enquanto qualquer gate falhar.

## Fase 6 - Homologação

1. Confirmar `origin/stage` imediatamente antes da promoção.
2. Commitar somente arquivos do módulo, preservando `.gitignore` e `tutorials/`.
3. Enviar a feature branch.
4. Integrar o SHA validado em `stage`, sem tocar em `main`.
5. Aguardar quality gate, SDD guardrail, migration e deploy.
6. Fazer smoke anônimo/autenticado com caso clínico artificial.
7. Excluir o áudio de teste e confirmar que produção não mudou.

O smoke autenticado específico do módulo usa `scripts/ai_echo_stage_canary.py`
somente quando a mensagem do commit contém `[ai-echo-canary]`. Ele executa
transcrição e estruturação reais com áudio sintético, aplica um patch seletivo sem
persistir o laudo, consulta a auditoria e remove áudio e registros artificiais.

Rollback: `AI_ECHO_ASSISTANT_ENABLED=false` em stage; se necessário, reverter o
commit em `stage`. A migration é aditiva e pode permanecer inerte; `downgrade()` é
reservado a ambiente vazio ou backup confirmado.
