# Intent — Assistência multimodal no atendimento

Data: 2026-10-26
Status: done (implementação local; homologação e publicação pendentes)

## Problema e objetivo

O veterinário divide sua atenção entre paciente/tutor e digitação; fotos/PDFs de exames precisam ser lidos e registrados manualmente, e receitas/solicitações exigem sair do atendimento para compartilhar. Integrar captura de voz, transcrição, extração documental e sugestões revisáveis ao atendimento, mantendo o veterinário responsável por toda incorporação e decisão clínica.

## Escopo autorizado

Implementação local de áudio/transcrição, análise de fotos/PDFs e preparação de documentos para WhatsApp. Preferência do usuário por GPT-6.1 Sol preservada; API documenta esforço máximo `max`, enquanto Ultra é configuração do Codex. A implementação não promete ausência de erros de IA.

## Restrições

- Preservar trabalho paralelo; branch `codex/atendimento-assistente-ia` em worktree isolado, base `origin/main` 6d77526d.
- Não substituir conteúdo existente automaticamente nem transformar sugestões em diagnósticos, prescrições ou solicitações emitidas.
- Sem migração ou edição de registros clínicos reais nesta entrega; sem envio real de WhatsApp ou alteração Meta.
- Originais selecionados para análise só são anexados ao prontuário por ação explícita, usando upload existente.
- Publicação e ativação permanecem etapas separadas da implementação local.

## Riscos e decisões

Valores ilegíveis, unidades, negações, identidade e atribuição de falas podem ser interpretados incorretamente. Exibir fonte, pendências e incertezas; exigir conferência com original. Documentos sem identidade conciliada não geram incorporação. Captura depende do navegador e microfone; recuperação precisa ser verificável e não confundida com garantia contra perda. Compartilhamento depende de suporte Web Share; desktop oferece download e conversa separadamente.

## Definition of Ready

- [x] Problema, escopo e restrições definidos.
- [x] Fluxos existentes de anexos, PDF autenticado e autosave identificados.
- [x] Contratos frontend/backend alinhados.
- [x] Validação local com fixtures e mocks, sem pacientes reais.
