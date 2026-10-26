# Spec — Assistência multimodal no atendimento

Data: 2026-10-26
Status: done (implementação local; homologação e publicação pendentes)

## Requisitos

- RF-001: gravar áudio de atendimento salvo com permissão do microfone, cronômetro, nível, parada, reprodução/download e aviso de interrupção/limite. Captura independe de conexão durante a gravação.
- RF-002: solicitar confirmação de autorização do tutor para captura/processamento externo; transcrever com modelo específico, preservar original e permitir editar texto antes da classificação.
- RF-003: analisar transcrição e até cinco JPEG/PNG/WebP/PDF, 10 MiB cada e 20 MiB total, com GPT-6.1 Sol/max via Responses. Fotos/PDFs mantêm nomes e fontes; não há busca de URL externa.
- RF-004: classificar fatos explícitos em campos do atendimento, mostrar evidência, achados documentais, pendências e sugestões de plano/conduta separadas. Valores ausentes/ambíguos permanecem não resolvidos; não inferir normalidade, posologia ou decisão como fato.
- RF-005: exigir identidade conciliada para conteúdo de exames; bloquear integração de identidade divergente/ausente e fontes inválidas. O veterinário confere documentos e aprova cada campo; textos acrescentam ao formulário sem apagar conteúdo existente.
- RF-006: guardar originais no prontuário por botão próprio usando upload autenticado e deduplicação existentes; analisar não significa anexar.
- RF-007: revisar telefone/tutor/paciente, preparar PDF de receita ativa ou solicitação de exames, compartilhar arquivo por Web Share quando suportado ou baixá-lo e abrir conversa neutra. Envio final cabe ao usuário no WhatsApp. Não incluir token, link protegido ou dados clínicos no wa.me.
- RF-009: preservar áudio, transcrição, arquivos e revisões temporariamente na memória da mesma aba ao navegar, isolados por usuário/atendimento/paciente. Avisar saída, impedir troca pelas ações do atendimento enquanto grava/envia e proteger reload com beforeunload. Recuperação persistente de áudio é opt-in; fechar/recarregar elimina rascunho em memória.
- RF-008: invalidar documento após edição do contexto e descartar respostas tardias após troca de atendimento/paciente. IA não cria receitas, exames, diagnósticos ou finalizações automaticamente.

## Não funcionais

- NFR-001: autenticação e permissão `atendimento_clinico` também no router novo; segredo somente servidor; feature off por padrão; sem fallback silencioso.
- NFR-002: limites antes de chamada externa, timeout, erro público sem segredo/conteúdo clínico; `store=false` na análise; liberar transação DB antes de aguardar provedor. `store=false` não deve ser apresentado como garantia de retenção zero do provedor.
- NFR-003: respostas estruturadas validadas; arquivos e transcrições são fontes não confiáveis, nunca instruções. Não aceitar decisão/normalidade inventada como informação do prontuário.
- NFR-004: backup local de áudio opcional, com isolamento por usuário/atendimento, expiração (limpeza na próxima abertura) e descarte. Falha de armazenamento deve ser visível; sem prometer recuperar áudio não salvo pelo navegador.

## API

Prefixo `/api/v1/atendimentos/{atendimento_id}/assistente`:

- `GET /status`: disponibilidade, configuração, modelos efetivos e IDs do usuário/paciente autenticados, sem chave.
- `POST /transcrever`: multipart `audio`, `consentimento`; responde `texto`, `modelo`, `avisos`.
- `POST /analisar`: multipart `transcricao`, campo repetido `arquivos`, `consentimento`; responde `modelo`, `esforco`, `campos`, `achados_exames`, `sugestoes`, `pendencias`, `avisos`, fontes e estado de bloqueio.

A análise considera contexto clínico já salvo. Resultados são rascunhos na UI; alteração clínica só ocorre pelo fluxo existente após revisão do veterinário. Sem tabelas ou migrações novas. PDFs e upload mantêm endpoints existentes.

## Critérios de aceitação

- CA-001: indisponibilidade, falta de consentimento, formato/limite inválido e falta de permissão impedem envio ao provedor.
- CA-002: transcrição usa modelo/idioma atuais; análise usa Sol 6.1/max, JSON schema e `store=false`; recusa/incompletude/identidade não conciliada nunca aplicam dados.
- CA-003: nenhum campo é incorporado só por receber resultado; clique individual acrescenta revisão, preserva conteúdo e não duplica por clique repetido.
- CA-004: erro de rede/transcrição conserva áudio para nova tentativa; troca de paciente não entrega resultado a outro registro.
- CA-005: PDF validado, destinatário confirmado, edição invalida arquivo; fallback informa que o usuário precisa anexar o PDF manualmente.
- CA-006: testes focados, TypeScript, lint, build, diff e guardrail passam, com lacunas de homologação registradas.

## Fora de escopo

Envio automático pela Meta Cloud API, transcrição simultânea por Realtime, prescrição autônoma, garantia de acurácia, ativação da IA antes de homologação e alterações reais de prontuários.

## Publicação autorizada

Em 2026-10-26, o usuário autorizou publicar após aguardar a fila existente. A entrega publica gravação local, revisão/anexação e compartilhamento manual de documentos; transcrição e análise externas permanecem desativadas por padrão até homologação. A publicação deve usar o fluxo protegido de stage para produção, preservar alterações paralelas e comprovar o SHA instalado. Não altera a configuração operacional da Meta nem habilita chamadas externas automaticamente.

## Fontes oficiais consultadas em 2026-10-26

- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/file-inputs
- https://learn.chatgpt.com/docs/models#gpt-61-sol

## Uso em computador e celular — confirmação do usuário

O usuário alterna computador e celular. Ambos integram a matriz de homologação: Safari/iOS, Chrome/Android, Safari/macOS e Chrome/desktop, conforme os aparelhos disponíveis. Seleção de codec é por capacidade do navegador; compartilhamento nativo é por suporte a arquivos, sem inferir suporte apenas pelo tipo de aparelho.

O rascunho da IA e o áudio local não são sincronizados entre aparelhos. A UI orienta parar a gravação, revisar/incorporar, confirmar salvamento do atendimento e baixar o áudio antes de trocar. Somente informação já incorporada/salva e anexos enviados ao prontuário ficam disponíveis pelo sistema no outro aparelho. Não prometer continuação da gravação no segundo dispositivo nem transcrição em segundo plano.
