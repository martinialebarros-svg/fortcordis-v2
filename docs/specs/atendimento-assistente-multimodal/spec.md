# Spec — Assistência multimodal no atendimento

Data: 2026-10-27
Status: in_progress (base publicada com IA desativada; homologação da ativação em andamento)

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
- NFR-004: backup local de áudio opcional, com isolamento por usuário/atendimento/paciente, expiração (limpeza na próxima abertura) e descarte. Falha de armazenamento deve ser visível; sem prometer recuperar áudio não salvo pelo navegador.
- NFR-005: antes de ativar chamadas externas, validar upload e tempo de espera em todo o caminho público. O proxy deve permitir o processamento síncrono previsto pelo servidor, ou o fluxo deve passar a trabalho assíncrono; um teste local no backend não comprova esse caminho.

- NFR-006: áudio limitado a 24.000.000 bytes, abaixo dos 25 MB documentados do provedor. Aceitar MP3, MP4, MPEG, MPGA, M4A, WAV e WebM; não enviar OGG/FLAC sem contrato validado. Revalidar o Blob final e imediatamente antes do envio. Excesso ou formato não suportado conserva reprodução/download e bloqueia apenas a transcrição.
- NFR-007: homologação automatizada usa exclusivamente fixtures sintéticas e chamadas limitadas, sem banco, prontuários, chave no relatório ou ativação automática. Aprovação dos cenários não substitui homologação física e revisão veterinária.

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

## Condições antes da ativação da IA

Esta publicação mantém `ATENDIMENTO_IA_ENABLED=false`; não insere novas chaves de ativação no ambiente. Ativar exige homologação física e clínica, acesso efetivo aos modelos e verificação do caminho público completo.

O backend permite 180 segundos de espera pelo provedor e a UI espera 300 segundos. A leitura dos arquivos habilitados do Nginx em 2026-10-26 encontrou limite de corpo de 30 MiB nas rotas API de stage e produção, mas nenhuma diretiva de timeout nos includes. O [padrão documentado de `proxy_read_timeout`](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_read_timeout) é 60 segundos entre leituras do upstream. Antes de habilitar IA, conferir o dump efetivo do processo, ajustar o timeout especificamente para o fluxo ou implementar resposta assíncrona e comprovar resposta pelo domínio público em processamento superior a 60 segundos. A publicação inicial não alterou Nginx. A continuação autorizada em 2026-10-27 prepara ajuste restrito a stage e mantém produção desativada até a validação completa.

A verificação futura deve incluir áudio próximo de 24.000.000 bytes, lote de exames próximo de 20 MiB, cancelamento/repetição e conservação das fontes quando houver falha. O limite de 30 MiB cobre o corpo multipart previsto, mas não substitui um teste real do caminho público. Não há garantia de acurácia ou acesso ao provedor baseada apenas em configuração presente.

Na ativação posterior, registrar o estado anterior das chaves `ATENDIMENTO_IA_*`. Para retornar a código anterior à feature, restaurar também essas chaves antes de reiniciar: `Settings` rejeita campos extras no `.env`. Nenhuma migração de banco é necessária.

## Fontes oficiais consultadas em 2026-10-26

- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/docs/guides/file-inputs
- https://learn.chatgpt.com/docs/models#gpt-61-sol

## Uso em computador e celular — confirmação do usuário

O usuário alterna computador e celular e confirmou Android com Chrome em 27/10. A matriz física prioritária é Android/Chrome e computador/Chrome; outros navegadores dependem de verificação separada. Seleção de codec é por capacidade do navegador; compartilhamento nativo é por suporte a arquivos, sem inferir suporte apenas pelo tipo de aparelho.

O rascunho da IA e o áudio local não são sincronizados entre aparelhos. A UI orienta parar a gravação, revisar/incorporar, confirmar salvamento do atendimento e baixar o áudio antes de trocar. Somente informação já incorporada/salva e anexos enviados ao prontuário ficam disponíveis pelo sistema no outro aparelho. Não prometer continuação da gravação no segundo dispositivo nem transcrição em segundo plano.

## Continuação autorizada em 2026-10-27

Após a publicação base #489 e a restauração #488, o usuário pediu prosseguir com a preparação da ativação e confirmou reutilizar a chave existente. A chave permanece no destino atual; nenhum segredo é copiado ao repositório. São autorizados testes limitados com material sintético e preparação do timeout. A fila concorrente de laudo (#508/#509) deve terminar e liberar a janela antes de qualquer mudança remota em stage.

O helper de ingress é opt-in e exclusivo de stage: valida SHA instalado, ambiente e vhost, preserva a configuração anterior e restringe 210 segundos às rotas de análise/transcrição; mantém rotas gerais e produção. Falha de validação/reload deve restaurar a configuração. A flag de IA não é ativada pelo helper. A execução depende da validação local e da janela de publicação.

Fontes oficiais reconferidas: [Sol 6.1](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [transcrição de arquivos](https://developers.openai.com/api/docs/guides/speech-to-text) e [entrada de PDFs](https://developers.openai.com/api/docs/guides/file-inputs). `max` é o maior esforço documentado da API; não substituir o modelo solicitado silenciosamente.
