# Plan — Assistência multimodal no atendimento

Data: 2026-10-27
Status: in_progress (base publicada com IA desativada; homologação da ativação em andamento)

## Fases

1. Confirmar documentação oficial de GPT-6.1 Sol, transcrição e arquivos. Isolar checkout sem copiar trabalho alheio.
2. Criar contrato Pydantic, serviço OpenAI e router autenticado com feature flag desligada. Transcrição e análise não escrevem prontuário. Rejeitar arquivos inválidos, recusa/incompletude do modelo e fontes/identidade inconsistentes.
3. Adicionar painel de captura/revisão, reprodução/download do áudio, seleção de arquivos, campos com revisão individual e sugestões separadas. Manter montagem ao trocar painéis do atendimento.
4. Integrar upload explícito de originais e aplicação de campos por acréscimo no formulário/autosave existente.
5. Reutilizar geração validada/autenticada dos PDFs para compartilhamento, com destinatário revisado e invalidação por edição/troca de paciente.
6. Executar testes focados backend/frontend, TypeScript, lint, build e SDD guardrail; revisar diff e registrar limites.

## Rollback e falha segura

Desligar `ATENDIMENTO_IA_ENABLED` interrompe novas chamadas de IA sem alterar prontuários. Sem migração. Reverter arquivos novos e integração remove assistência e compartilhamento, mantendo os fluxos antigos de cadastro, upload, PDF e edição. Erros do provedor não aplicam campos nem fazem fallback de modelo silencioso. Falha parcial no upload de originais conserva os anteriores e permite repetição com deduplicação existente.

## Homologação posterior

Validar dispositivos realmente usados, microfone interrompido, restauração de áudio, documentos fotografados e amostras representativas de nomes/medicamentos, valores/unidades e negações. Conferir acesso da conta ao modelo e custo/latência do esforço max antes de ativar para uso cotidiano. Nenhum resultado dos testes simulados prova qualidade clínica ou acesso real do provedor.

## Continuação autorizada em 27/10

1. Reutilizar a credencial existente somente em memória e enviar exclusivamente fixtures sintéticas à API oficial, com orçamento explícito de chamadas e sem persistir respostas clínicas.
2. Corrigir limite de áudio para 24.000.000 bytes e conferir o Blob final antes do envio. Preservar o original quando excedente ou incompatível, sem conversão silenciosa de formato.
3. Validar gravação nativa com fluxo sintético no Chrome do computador. A homologação física incluirá o computador e Android com Chrome, conforme informado pelo usuário.
4. Preparar ajuste de ingress somente para transcrever/analisar em stage, opt-in por `[atendimento-ia-ingress]`, com timeout de 210 s, backup e rollback. Manter o backend em 180 s e cliente em 300 s.
5. Aguardar liberação explícita da entrega concorrente de laudos e sua restauração de stage. Integrar a árvore restaurada, verificar checks/SHA e publicar somente a preparação em stage.
6. Antes de ativação cotidiana, comprovar a rota pública autenticada com material sintético, incluindo resposta acima de 60 s, e concluir revisão veterinária e teste físico. Produção permanece com IA desativada nesta fase.
