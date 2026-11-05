# Spec — Assistência multimodal no atendimento

Data: 2026-11-05
Status: in_progress (correção de latência em validação)

## Requisitos

- RF-001: gravar áudio de atendimento salvo com permissão do microfone, cronômetro, nível, parada, reprodução/download e aviso de interrupção/limite. Captura independe de conexão durante a gravação.
- RF-002: solicitar confirmação de autorização do tutor para captura/processamento externo; transcrever com modelo específico, preservar original e permitir editar texto antes da classificação.
- RF-010: obter o nome do paciente exclusivamente do cadastro carregado pelo servidor e usá-lo como pista literal de grafia na transcrição, com `keywords` e contexto delimitado. Não aceitar nome indicado pelo cliente como referência, acrescentar nomes ausentes nem substituir nomes divergentes após a resposta. Informar nos avisos quando a referência foi enviada ou omitida; revisão do áudio continua obrigatória.
- RF-003: analisar transcrição e até cinco JPEG/PNG/WebP/PDF, 10 MiB cada e 20 MiB total, com GPT-6.1 Sol via Responses. Análises só de texto limitam o esforço a `medium` e respeitam `low` quando configurado. Com exames, aplica-se o esforço configurado (padrão `max`). A transcrição revisada é enviada integralmente dentro do limite de 80.000 caracteres. Fotos/PDFs mantêm nomes e fontes; não há busca de URL externa.
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

- `GET /status`: disponibilidade, configuração, modelos efetivos, esforço com exames (`esforco`) e só texto (`esforco_texto`), e IDs do usuário/paciente autenticados, sem chave.
- `POST /transcrever`: multipart `audio`, `consentimento`; responde `texto`, `modelo`, `avisos`.
- `POST /analisar`: multipart `transcricao`, campo repetido `arquivos`, `consentimento`; responde `modelo`, `esforco`, `campos`, `achados_exames`, `sugestoes`, `pendencias`, `avisos`, fontes e estado de bloqueio.

A análise considera contexto clínico já salvo. Resultados são rascunhos na UI; alteração clínica só ocorre pelo fluxo existente após revisão do veterinário. Sem tabelas ou migrações novas. PDFs e upload mantêm endpoints existentes.

## Critérios de aceitação

- CA-001: indisponibilidade, falta de consentimento, formato/limite inválido e falta de permissão impedem envio ao provedor.
- CA-002: transcrição usa modelo/idioma atuais; análise usa Sol 6.1, o esforço correspondente à seleção, JSON schema e `store=false`; recusa/incompletude/identidade não conciliada nunca aplicam dados.
- CA-003: nenhum campo é incorporado só por receber resultado; clique individual acrescenta revisão, preserva conteúdo e não duplica por clique repetido.
- CA-004: erro de rede/transcrição conserva áudio para nova tentativa; troca de paciente não entrega resultado a outro registro.
- CA-005: PDF validado, destinatário confirmado, edição invalida arquivo; fallback informa que o usuário precisa anexar o PDF manualmente.
- CA-006: testes focados, TypeScript, lint, build, diff e guardrail passam, com lacunas de homologação registradas.
- CA-007: referência compatível melhora a grafia no cenário fictício testado; fala com nome diferente ou sem nome permanece fiel ao áudio. Backend e UI exibem o texto retornado sem troca de nomes e mostram aviso explícito sobre a pista. Nome vazio, longo ou com controles/`<`/`>` é omitido da pista, sem truncamento ou falha da transcrição.
- CA-009: a UI mostra o esforço efetivo antes de analisar e no resultado. Uma transcrição sintética longa deve retornar em até 60 segundos com esforço `medium` e passar nos critérios específicos de negações, peso, unidades, evidência literal e revisão. Falha conserva as fontes para revisão ou nova tentativa.

## Referência de nome — pedido de 2026-11-04

Após teste fictício com troca de “Nébula-Q7” por “nédula Q7”, o usuário pediu usar o nome cadastrado como referência, sem correções silenciosas, e testar novamente. A referência contém apenas o nome do paciente selecionado; tutor, contato, histórico e outros campos do contexto não acompanham o áudio nessa chamada. A transação continua liberada antes de chamar o provedor. O nome é dado não confiável e não uma instrução.

O contrato multipart de entrada e `texto`/`modelo`/`avisos` de saída permanece compatível. O prompt orienta preservar fala divergente/incerta; `keywords` é uma pista, não confirmação de identidade. Não há pós-processamento de nomes, correção automática ou garantia de acurácia. Nome não mencionado continua não mencionado. Aviso já exibido pelo painel permite saber que o cadastro participou da transcrição.

O novo teste usa somente áudios fictícios, sem alterar o serviço instalado, flags ou prontuários. Publicação do código é etapa separada deste pedido de melhoria/teste. O estado de produção anteriormente ativado não deve ser revertido por textos históricos de IA desativada abaixo.

Em04/11, após a validação, o usuário autorizou publicar essa melhoria em produção, verificando a fila e preservando trabalhos paralelos. A publicação promove somente este delta sobre o main atual, com stage isolado temporário e restauração completa. IA de produção permanece ON e stage OFF; o merge de promoção leva `[preserve-nginx]`. Não altera modelo, credencial, regras de revisão ou dados clínicos.

Fonte oficial consultada em04/11: [contexto de transcrição com prompt, keywords e languages](https://developers.openai.com/api/docs/guides/speech-to-text#add-transcription-context). Cada palavra-chave deve estar em uma linha, sem `<`, `>`, CR ou LF; pistas podem influenciar o reconhecimento e precisam de cenários negativos para detectar nomes não falados.

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

## Promoção do incremento para produção — autorização de 2026-11-02

O usuário autorizou promover para main o incremento da PR #512. A publicação leva o teto de áudio de24.000.000 bytes e as validações de captura/importação, preservando reprodução/download do original rejeitado. Mantém ATENDIMENTO_IA_ENABLED=false, revisão humana obrigatória e compartilhamento manual. Não ativa a IA, não instala ingress em produção e não altera credenciais, dados clínicos ou políticas de WhatsApp. Testes físicos, canário público demorado e homologação clínica continuam necessários antes de qualquer ativação posterior.

A árvore de produção contém somente esse incremento sobre main; funcionalidades paralelas de Gestão e laudos em stage são preservadas e restauradas após a promoção protegida. O helper transportado permanece restrito a stage, acionado apenas pelo marcador explícito do workflow; sua presença no repositório não executa configuração em produção.


## Distinção entre tutor e doutor — 04/11/2026

- RF-011: fornecer contexto veterinário e pistas equilibradas `tutor`, `tutora`, `doutor`, `doutora` ao reconhecimento. A fala continua sendo a fonte: os papéis não são deduzidos da frase, palavras ausentes não são acrescentadas e nenhum termo é substituído depois da resposta do provedor. O nome cadastrado continua opcional, autoritativo e tratado como dado não confiável.
- CA-008: o áudio fictício que retornou “Doutor” onde dizia “Tutor” deve ser retestado na versão candidata; um controle com “doutor” realmente falado precisa preservá-lo, e nomes compatível/divergente/ausente continuam cobertos. O teste real deve comparar texto bruto recebido e texto exibido, sem normalização corretiva. As pistas são informadas em aviso visível e não representam garantia de acerto.

Sem mudança de modelo, credencial, captura de áudio, API pública, schema, migração ou incorporação. A preparação local e o teste isolado não publicam código nem alteram o serviço de produção. Fonte técnica: [OpenAI Docs — contexto de transcrição](https://developers.openai.com/api/docs/guides/speech-to-text#add-transcription-context), consultada em04/11; keywords são pistas, não termos obrigatórios.


## Publicação de tutor/doutor autorizada — 04/11/2026

Pedido explícito: publicar em produção verificando fila e preservando os trabalhos paralelos. Escopo funcional restrito às pistas de contexto/vocabulário e aviso; sem substituição posterior, alteração de modelo, flag, captura, schema ou dados. Main observado4c109329 e stage completo07ab0677 serão reconferidos após liberação. Promoção protegida de snapshot isolado e restauração integral de stage são obrigatórias; IA ON em produção/OFF em stage e ingress preservados. Esta autorização não comprova instalação nem permite apagar backups/cache de outros trabalhos.
