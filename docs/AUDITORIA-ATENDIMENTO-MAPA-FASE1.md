# Auditoria do módulo de Atendimento Clínico — Mapeamento (Fase 1)

> **Origem:** workflow `auditoria-atendimento-clinico` (run `wf_52aa0a11-5e0`), executado em 31/07/2026.
> **Status:** Fase 1 (Mapear) concluída — 4/4 agentes. Fases 2–4 **não executadas** (limite de sessão).
> Ver [HANDOFF-AUDITORIA-ATENDIMENTO.md](HANDOFF-AUDITORIA-ATENDIMENTO.md) para como retomar.
>
> ⚠️ Este mapeamento reflete o **estado do disco em 31/07/2026**, com a working tree não commitada
> (~819 linhas alteradas em `atendimento.py`, mais a migration `20260730_59`). Se a working tree
> mudou desde então, revalide os `arquivo:linha` antes de agir.
>
> ⚠️ Os itens em "Pontos de atenção" são **suspeitas não verificadas** — os agentes foram
> explicitamente instruídos a não afirmar que são bugs. A verificação adversarial é a Fase 3,
> que não rodou. Confirme no código antes de corrigir qualquer um.

## Índice

- [Backend — rotas, ciclo de vida, locks e transações](#backend--rotas-ciclo-de-vida-locks-e-transações)
- [Frontend — máquina de estados, abas, fluxo de cliques](#frontend--máquina-de-estados-abas-fluxo-de-cliques)
- [Dados e contrato — schema, enums, divergências BE↔FE](#dados-e-contrato--schema-enums-divergências-befe)
- [Testes e specs — cobertura real vs. prometida](#testes-e-specs--cobertura-real-vs-prometida)


---

## Backend — rotas, ciclo de vida, locks e transações

<sub>`mapa:backend` · agente `a6a34c12d7893313f`</sub>

### Resumo

MAPA DO BACKEND DE ATENDIMENTO CLINICO (estado atual do disco, com working tree nao commitada).

ROTEAMENTO: router registrado em backend/app/main.py:442 com prefix /api/v1/atendimentos, tag "atendimento". Auth: todas as rotas usam Depends(get_current_user) (backend/app/core/security.py:178), que ja aplica a matriz de permissoes por modulo/metodo (_authorize_request_by_matrix, security.py:152; admin tem bypass total). As 3 rotas de PDF (prescricao, exames, documento) NAO usam get_current_user: usam _autenticar_usuario_pdf (atendimento.py:820), que redecodifica o JWT manualmente, proibe access_token na querystring e chama a matriz explicitamente.

MODELOS (backend/app/models/atendimento_clinico.py, 261 linhas, todos sem ForeignKey real — integridade so por indice/aplicacao):
- AtendimentoClinico (atendimentos_clinicos): paciente_id, tutor_id, clinica_id, agendamento_id, veterinario_id, especie, data_atendimento, status (default "Triagem"); blocos TRIAGEM (peso, temperatura, FC, FR, PA, SpO2, ECC, mucosas, hidratacao, obs), CONSULTA (queixa_principal, anamnese, exame_fisico, dados_clinicos), DIAGNOSTICO (principal/secundario/diferencial, plano_terapeutico, prognostico), RETORNO (retorno_recomendado, motivo_retorno, observacoes), flags triagem_concluida/consulta_concluida, auditoria (created_at, updated_at, criado_por_id/nome). Indices compostos por data/clinica/status/agendamento + indice UNICO PARCIAL ux_atendimentos_clinicos_agendamento_unico (agendamento_id WHERE agendamento_id IS NOT NULL) — NOVO nesta working tree (linhas 14-20).
- Satelites: AnexoAtendimento (anexos_atendimentos; exame_id opcional, arquivo_hash, dedupe_key, caminho_arquivo, origem "upload"|"externo"), DocumentoAtendimentoTemplate, DocumentoAtendimento (status rascunho|emitido|arquivado, emitido_at), EvolucaoClinica, AlertaClinico (por paciente), Medicamento (banco proprio), PrescricaoClinica (1 por atendimento, na pratica), PrescricaoItem, PrescricaoItemAjuste (trilha de auditoria campo a campo), UploadDedupeMetrica, UploadDedupeCleanupRun.
- Exame vive em backend/app/models/laudo.py:45 (tabela exames) com atendimento_id, paciente_id, laudo_id, catalogo_exame_id, painel_exame_id, status, data_solicitacao/data_resultado, valor.
- OrdemServico (backend/app/models/ordem_servico.py): numero_os unico, agendamento_id, paciente_id, clinica_id, servico_id, origem_atendimento, tipo_horario, valor_servico/desconto/valor_final, status (Pendente|Pago|Cancelado) + indice UNICO PARCIAL ux_ordens_servico_agendamento_ativa (agendamento_id WHERE COALESCE(status,'')<>'Cancelado') — NOVO (linhas 16-22).
- Migration nova: backend/migrations/versions/20260730_59_atendimento_agenda_transactional_finalization.py cria os dois indices parciais com CREATE UNIQUE INDEX IF NOT EXISTS, mas antes ABORTA com RuntimeError se encontrar duplicidades (lista ate 20 agendamentos conflitantes).

SCHEMAS (backend/app/schemas/atendimento.py): payloads permissivos (quase tudo Optional com default ""), diagnostico aceita Union[DiagnosticoPayload, str] (compatibilidade legada, normalizado por _normalizar_diagnostico:246). Novo AtendimentoFinalizarPayload (tipo_horario "comercial"|"plantao") e novos campos triagem_concluida/consulta_concluida no Create.

50 ROTAS EXPOSTAS (agrupadas):
1) CRUD do atendimento: GET "" (lista paginada com total/items, filtros data_inicio/data_fim/paciente_id/clinica_id/agendamento_id/status/search, JOINs de nome + 2 queries agregadas para total_exames e tem_prescricao — anti N+1); GET /{id} (detalhe completo via _montar_detalhe_atendimento:1734); POST "" (201); PUT /{id}; POST /{id}/finalizar (NOVO); DELETE /{id}; GET /contexto?agendamento_id= (pre-carrega paciente/tutor/clinica/inicio/status da Agenda para abrir o atendimento).
2) Exames/paineis: GET /exames/catalogo (delega exam_catalog_service.montar_contexto_catalogo_exames, que roda ensure_exam_catalog_seeded); GET/POST/PUT/DELETE /paineis[/{id}] (paineis customizados, prefixo de codigo "custom_", soft delete ativo=0, servico painel_service.py); POST /exames/{exame_id}/portal/liberar.
3) Frases clinicas: GET/POST/PUT/DELETE /frases-clinicas[/{id}] + POST /{id}/restaurar (clinical_phrase_crud_service.py; secoes validas fixas em clinical_phrase_service.VALID_SECOES).
4) Documentos: GET/POST/PUT/DELETE /documentos/templates[/{id}] + /restaurar; GET/POST /{id}/documentos, PUT/DELETE /{id}/documentos/{doc_id}; GET /{id}/documentos/{doc_id}/pdf.
5) PDFs: GET /{id}/prescricao/pdf, GET /{id}/exames/pdf, POST /prescricao/preview (retorna pdf_base64, nao persiste).
6) Medicamentos: GET/POST/PUT/DELETE /medicamentos/banco[/{id}] (delete = soft, ativo=0; duplicidade por nome ilike).
7) Evolucoes: GET/POST /{id}/evolucoes.
8) Anexos: GET /{id}/anexos, POST /{id}/anexos (link externo), POST /{id}/anexos/upload (multipart), GET /anexos/{anexo_id}/arquivo, DELETE /anexos/{anexo_id}.
9) Alertas do paciente: GET/POST /paciente/{paciente_id}/alertas, PUT/DELETE /alertas/{alerta_id} (delete = ativo=0).
10) Historico: GET /paciente/{id}/historico, GET /paciente/{id}/timeline.
11) Metricas de dedupe: GET /upload-metrics/dedupe (SQL cru agregando por dia), POST /upload-metrics/dedupe/cleanup e GET .../status (exigem papel admin via _require_admin_cleanup_access:1505).

SINCRONIZACAO DE FILHOS (padrao "payload e a verdade"):
- _sync_exames (1574): carrega exames existentes por atendimento_id num dict; para cada item do payload, faz UPDATE se payload.id existe, senao INSERT; enriquece campos vazios com CatalogoExame/PainelExame; forca data_solicitacao se nula e data_resultado=now() se status "concluid*"; ao final, TODO exame existente ausente do payload e DELETADO junto com seus anexos (arquivos removidos do disco por _excluir_anexos_por_exame:870).
- _sync_prescricao (1655): garante 1 PrescricaoClinica por atendimento (cria+flush se nao existir), grava orientacoes_gerais/retorno_dias, faz upsert dos itens pelo id, registra PrescricaoItemAjuste campo a campo (7 campos, via _registrar_ajuste_prescricao:186, que ignora quando anterior==novo) e DELETA itens ausentes do payload. Se prescricao_payload for None, nao altera nada.
- Documentos: criados a partir de template (renderizacao {{chave}} via document_context_service.renderizar_template_documento:126 com contexto de ~26 chaves) ou titulo/corpo manuais; atualizacao/exclusao em document_crud_service.py; ao gerar PDF, atualizar_documento_template_se_contexto_mudou (document_context_service.py:159) re-renderiza o corpo apenas se o texto atual ainda for identico ao render "original" e o documento nao estiver emitido; depois o endpoint marca status="emitido"+emitido_at e COMMITA dentro de um GET (2648-2651).
- Anexos: upload em atendimento.py:3742 -> le bytes, sha256 (calculate_attachment_sha256), dedupe_key = "exame:<id|none>|sha256:<hash>" (build_upload_dedupe_key), precheck por dedupe_key (retorna 200 com deduplicado=true), grava arquivo atomicamente (mkstemp+os.replace em atendimento_upload_service.store_atendimento_attachment_file:144, limite 25MB, extensoes pdf/jpg/jpeg/png/webp com validacao cruzada extensao<->MIME), insere anexo, define url=/api/v1/atendimentos/anexos/{id}/arquivo, promove exame para "Em andamento" e preenche data_resultado; em IntegrityError faz rollback, apaga o arquivo do disco e reconsulta o dedupe_key (colisao concorrente -> 200 deduplicado). Cada caminho grava UploadDedupeMetrica (evento upload_novo|dedupe_precheck|dedupe_collision) com commit proprio best-effort (1513).

CICLO DE VIDA / TRANSACOES / LOCKS:
- Status canonicos (atendimento.py:146): Triagem, Em atendimento, Aguardando exames, Retorno agendado, Concluido; _normalizar_status_atendimento(278) normaliza acento/caixa e devolve 422 fora do conjunto.
- Gate clinico _validar_primeira_conclusao_atendimento(298): so na PRIMEIRA conclusao exige queixa_principal + (anamnese|exame_fisico|dados_clinicos) + (algum diagnostico|plano_terapeutico); senao 422 listando pendencias.
- POST "" (2663): valida status, valida/reserva o agendamento (_carregar_e_validar_agendamento_atendimento:428 checa duplicidade de atendimento no mesmo agendamento -> 409, existencia, paciente igual, clinica coerente, origem domiciliar dispensa clinica), PROIBE criar vinculado ja "Concluido" (409, obriga usar Finalizar), herda clinica_id e data_atendimento do agendamento, resolve tutor_id/especie do paciente, cria, flush, sincroniza exames e prescricao, commit protegido por _commit_atendimento_com_guard(519)/_raise_atendimento_integrity_conflict(488) que traduz violacao do indice unico em 409 apontando o atendimento existente.
- PUT /{id} (2776): recalcula destino de paciente/clinica/agendamento, revalida o agendamento excluindo o proprio id, aplica o gate clinico, BLOQUEIA transicao para Concluido quando ha agendamento (409, "use Finalizar") e BLOQUEIA reabertura de vinculado concluido (409). Depois aplica campos, marca consulta_concluida=1 na conclusao, sincroniza exames/prescricao e commita com o mesmo guard.
- POST /{id}/finalizar (3060) — operacao transacional unica: _adquirir_lock_finalizacao(369) [SQLite: BEGIN IMMEDIATE se nao houver transacao; Postgres: pg_advisory_xact_lock(24052302); outros: SELECT ... FOR UPDATE na tabela Configuracao] -> SELECT do atendimento com with_for_update -> gate clinico -> se houver agendamento: revalida com lock=True (SELECT FOR UPDATE no Agendamento), rejeita agenda em status terminal (Cancelado/Faltou/Expirado -> 409), exige servico_id e clinica (salvo origem domiciliar) -> _buscar_os_ativa(392) reutiliza OS nao cancelada; se nao houver, calcula preco via precos_service.calcular_preco_servico (clinica/servico/tipo_horario/origem), exige valor > 0, gera numero_os via _gerar_numero_os_finalizacao(404) (OS+YYYYMM+seq, derivado da ultima OS do mes + varredura ate numero livre) e cria a OrdemServico com status "Pendente" -> marca agendamento.status="Realizado" (+atualizado_em/updated_at) -> marca atendimento Concluido + consulta_concluida=1 -> COMMIT unico. Tratamento de erro: HTTPException/IntegrityError/SQLAlchemyError todos com db.rollback() (IntegrityError -> 409 "repeticao e segura"; SQLAlchemyError -> 500 "nenhuma mudanca parcial"). Efeitos colaterais so DEPOIS do commit, em _emitir_efeitos_finalizacao(2947): auditoria ATENDIMENTO_FINALIZADO ou ATENDIMENTO_FINALIZACAO_REPETIDA (sessao propria em auditoria_service), auditoria AGENDAMENTO_REALIZADO_POR_ATENDIMENTO + publish no agenda_realtime_manager + push de agenda (so se o status da agenda mudou) e push financeiro os_generated (so se a OS foi criada agora) — todos em try/except com log de warning. Resposta: {atendimento (detalhe completo), agenda {id,status,status_anterior}, ordem_servico {id,numero_os,valor_final,reutilizada}, mensagem}.
- DELETE /{id} (3272): deleta exames (+anexos e arquivos), anexos do atendimento, itens da prescricao + prescricao, documentos e o proprio atendimento; commit unico. Sem guard de status.

MAPEAMENTO AGENDAMENTO <-> ATENDIMENTO: 1:1 garantido pelo indice unico parcial + checagem previa em _carregar_e_validar_agendamento_atendimento + traducao de IntegrityError para 409. O atendimento e criado SEMPRE pelo modulo de atendimento (POST com agendamento_id), nunca pela agenda; GET /contexto alimenta a abertura. Na direcao inversa, agenda.py:5376-5403 (working tree) agora BLOQUEIA com 409 a transicao manual de status para "Realizado" e o desfazer "Realizado"->"Em atendimento" quando existe atendimento vinculado, orientando a finalizar pelo modulo Atendimento — mas a agenda mantem seu proprio caminho legado de geracao/remocao de OS (agenda.py:5533-5605) para agendamentos SEM atendimento. Laudos se ligam por atendimento_id e por (agendamento_id, paciente_id) em laudos.py:215, 301, 1398-1425; o portal da clinica parceira consome Exame.atendimento_id e AtendimentoClinico.clinica_id (portal.py:638-677) com status "Liberado no portal" (core/portal_release.py).

### Fluxo

1. 1. Agenda: usuario abre um agendamento e aciona iniciar atendimento; o frontend chama GET /api/v1/atendimentos/contexto?agendamento_id=N (atendimento.py:2340) e recebe paciente_id/especie/tutor/clinica/inicio/status para pre-popular a tela.

2. 2. Criacao: POST /api/v1/atendimentos (2663) com paciente_id + agendamento_id. O backend normaliza o status (default Triagem), roda o gate clinico (irrelevante fora de Concluido), valida o agendamento (duplicidade 1:1, paciente igual, clinica coerente, origem domiciliar dispensa clinica), recusa 409 se tentarem criar vinculado ja Concluido, herda clinica_id e data_atendimento (inicio da agenda), resolve tutor_id e especie a partir do Paciente e persiste com criado_por/veterinario_id = usuario logado.

3. 3. Ainda no mesmo POST: db.flush() para obter o id, _sync_exames grava os exames solicitados (enriquecidos pelo CatalogoExame/PainelExame) e _sync_prescricao cria PrescricaoClinica + itens; commit protegido converte violacao do indice unico de agendamento em 409 apontando o atendimento ja existente.

4. 4. Trabalho clinico incremental: sucessivos PUT /api/v1/atendimentos/{id} (2776) com exclude_unset. Cada PUT revalida o vinculo com a agenda, aplica o gate de conclusao, recusa 409 se tentarem concluir vinculado por PUT (obriga Finalizar) ou reabrir vinculado concluido, atualiza triagem/consulta/diagnostico/retorno e RESSINCRONIZA exames e prescricao pelo payload (o que nao vier e apagado).

5. 5. Exames: catalogo e paineis via GET /exames/catalogo e /paineis; paineis customizados criados/editados por POST/PUT /paineis (codigo custom_<slug>, itens substituidos em bloco por substituir_itens_painel_exame). Solicitacao impressa por GET /{id}/exames/pdf.

6. 6. Resultados e anexos: POST /{id}/anexos/upload (3742) calcula sha256, monta dedupe_key por (exame, hash), retorna 200 deduplicado se ja existir, senao grava o arquivo atomicamente no storage, cria AnexoAtendimento origem=upload, promove o exame para Em andamento, preenche data_resultado e registra metrica de dedupe. Alternativa de link externo: POST /{id}/anexos (origem=externo, sem hash). Download por GET /anexos/{id}/arquivo; exclusao por DELETE /anexos/{id} (apaga o arquivo do disco).

7. 7. Liberacao no portal: POST /exames/{exame_id}/portal/liberar (3624) exige atendimento com clinica_id, exame com paciente_id e ao menos um anexo PDF; normaliza tipo_exame (ECG -> Eletrocardiograma, categoria Cardiologia), grava status Liberado no portal, data_resultado=utcnow e observacoes fixa; a partir dai o exame aparece no portal da clinica parceira.

8. 8. Prescricao: itens montados no editor, preview sem persistencia por POST /prescricao/preview (pdf_base64), receita final por GET /{id}/prescricao/pdf (exige prescricao com itens). Cada alteracao de item existente gera PrescricaoItemAjuste com valor_anterior/valor_novo/responsavel. O detalhe do atendimento devolve apoio_clinico calculado por medication_automation.analyze_prescription_items (dose por peso, volume/comprimidos, interacoes entre itens).

9. 9. Documentos: templates em /documentos/templates; POST /{id}/documentos renderiza titulo/corpo do template com o contexto do atendimento; GET /{id}/documentos/{doc_id}/pdf re-renderiza se o contexto mudou e o documento ainda for rascunho intocado, gera o PDF com branding (logomarca do sistema, assinatura do usuario, CRMV, rodape) e marca o documento como emitido.

10. 10. Evolucoes e alertas: POST /{id}/evolucoes registra acompanhamento; alertas clinicos por paciente em /paciente/{id}/alertas alimentam o radar clinico.

11. 11. Finalizacao: POST /{id}/finalizar (3060) com tipo_horario. Adquire lock de finalizacao, trava o atendimento (FOR UPDATE), roda o gate clinico, trava e valida o agendamento (rejeita agenda Cancelado/Faltou/Expirado, exige servico_id e clinica salvo domiciliar), reutiliza OS ativa ou calcula preco e cria OrdemServico Pendente com numero OSYYYYMMSSSS, marca a agenda como Realizado e o atendimento como Concluido/consulta_concluida=1 em UM UNICO COMMIT.

12. 12. Pos-commit: refresh dos tres objetos e _emitir_efeitos_finalizacao registra auditoria (finalizada ou reconfirmada), publica status_changed no realtime da agenda, envia push de agenda e push financeiro os_generated (apenas quando a OS foi criada agora); todas as falhas sao logadas sem quebrar a resposta.

13. 13. Consulta e historico: GET /{id} devolve o prontuario completo (triagem, consulta, diagnosticos, exames com anexos_resultado, prescricao com apoio clinico, evolucoes, anexos, documentos); GET /paciente/{id}/historico e /timeline agregam atendimentos, evolucoes, exames solicitados/resultados, anexos e laudos agrupados por ano.

14. 14. Exclusao: DELETE /{id} (3272) remove exames (com anexos e arquivos), anexos do atendimento, prescricao e itens, documentos e o atendimento, em commit unico — sem tocar agenda nem OS.

### Pontos de atenção (30, não verificados)

- Lock SQLite provavelmente inefetivo em requisicao real: _adquirir_lock_finalizacao (atendimento.py:369) so executa BEGIN IMMEDIATE se `not db.in_transaction()`, mas get_current_user usa a MESMA Session (get_db em cache de dependencia) e ja executou SELECTs de User/matriz, abrindo a transacao por autobegin. Em SQLite o caminho exclusivo tende a ser silenciosamente ignorado; o advisory lock do Postgres nao e afetado.

- A flag db.info['_atendimento_finalization_lock'] (linha 389) nunca e limpa apos commit/rollback. Numa Session reaproveitada (override de dependencia em testes, ou qualquer reuso) a segunda finalizacao pula a aquisicao do lock.

- Duas implementacoes concorrentes de numeracao de OS: _gerar_numero_os_finalizacao (404) usa datetime.now(ATENDIMENTO_LOCAL_TZ) e agenda._gerar_numero_os (agenda.py:5347) usa datetime.now() naive — o prefixo YYYYMM pode divergir em servidor UTC/virada de mes. Ambas derivam a sequencia da ultima OS por id + varredura linear, dependendo do lock e do unique de numero_os para nao colidir.

- Possivel bypass dos guards de conclusao/reabertura em PUT /{id}: os dois bloqueios 409 (2835-2859) dependem de `agendamento_destino` ser verdadeiro. Um payload com agendamento_id: null desvincula (2870-2871) e escapa dos dois guards, permitindo reabrir/concluir isoladamente e deixando a Agenda em Realizado e a OS orfas.

- DELETE /{id} (3272) nao tem nenhum guard de status nem de vinculo: apaga um atendimento ja Concluido sem reverter agendamento.status='Realizado' nem a OrdemServico ativa, e ainda libera o indice unico para um novo atendimento no mesmo agendamento.

- DELETE /{id} tambem nao limpa EvolucaoClinica, PrescricaoItemAjuste nem UploadDedupeMetrica (nao ha FK/cascade em nenhum modelo), deixando linhas orfas; e nao zera Laudo.atendimento_id / Exame.laudo_id.

- _sync_exames (1574) e destrutivo por omissao: qualquer exame ausente do payload e deletado junto com os anexos e os ARQUIVOS em disco (_excluir_anexos_por_exame:870), inclusive exames com laudo_id vinculado ou com status 'Liberado no portal'. Nao ha protecao para exame laudado/liberado.

- _sync_exames confia no cliente para status e laudo_id: ExameSolicitacaoPayload so limita tamanho (schemas/atendimento.py:12-23). Um PUT com o status antigo em cache reverte 'Liberado no portal' para 'Solicitado', e laudo_id ausente desvincula o laudo silenciosamente.

- upload_anexo (3855) forca exame.status='Em andamento' sempre que _status_exame_concluido for falso — e PORTAL_RELEASED_STATUS ('Liberado no portal') nao satisfaz essa checagem, logo um novo anexo em exame ja liberado o retira do portal.

- liberar_exame_no_portal (3624) nao e idempotente nem auditado: sobrescreve exame.observacoes com mensagem fixa e data_resultado com utcnow a cada chamada, nao verifica se ja estava liberado e nao exige que o atendimento esteja concluido.

- Mistura de datetimes naive e aware nas mesmas colunas DateTime(timezone=True): data_atendimento pode ser aware (datetime.now(ATENDIMENTO_LOCAL_TZ), 2709) enquanto created_at/updated_at/data_solicitacao usam datetime.now() naive e liberar_exame_no_portal usa datetime.utcnow() (3653). _to_operational_iso (565) assume que todo naive esta em -03:00, o que desloca 3h a exibicao de registros gravados em UTC por outros caminhos.

- _to_operational_iso e aplicado apenas em data_atendimento, data_resultado e agenda.inicio; created_at, updated_at, data_solicitacao, evolucoes, anexos e documentos continuam em _to_iso — o mesmo payload mistura duas semanticas de fuso.

- listar_atendimentos (1939) filtra status por igualdade exata, sem passar por _normalizar_status_atendimento, divergindo da escrita; e data_fim usa `< data_fim + 1 dia` (1932), que inclui um dia extra quando o cliente manda timestamp completo.

- _normalizar_status_atendimento (278) restringe a 5 estados; linhas legadas com outros status nao podem mais ser salvas por PUT (422) mesmo que o PUT nao esteja mexendo em status, ja que o valor vem do formulario.

- finalizar_atendimento escreve agendamento.status='Realizado' direto (3188), sem passar pelas regras de slot/expiracao da agenda nem pelos efeitos financeiros que o caminho legado da agenda executa; e o desfazer continua existindo apenas na agenda, agora bloqueado quando ha atendimento (agenda.py:5376) — nao existe rota de 'desfazer finalizacao' no modulo de atendimento.

- Idempotencia parcial do finalizar: repetir em atendimento ja Concluido reutiliza a OS mas reescreve agendamento.status='Realizado'. finalizacao_repetida (2971) e inferida so comparando status anteriores, entao se a agenda tiver sido revertida manualmente a repeticao a re-realiza e registra como finalizacao nova.

- Efeitos colaterais pos-commit engolidos: realtime e push em try/except com warning (3023-3057). Se o publish falhar, os clientes da agenda ficam com estado defasado sem sinal de erro na resposta.

- O guard da agenda contra 'Realizado' manual roda inspect(db.get_bind()).get_table_names() a cada chamada (agenda.py:5381) — introspecao de schema no caminho quente.

- GETs com efeito de escrita: /exames/catalogo e /frases-clinicas disparam ensure_exam_catalog_seeded / ensure_clinical_phrases_seeded (que inserem e commitam); e GET /{id}/documentos/{doc_id}/pdf muta o documento para status 'emitido' + emitido_at e commita (2648-2651).

- _registrar_upload_dedupe_metrica (1513) executa db.commit() na sessao da requisicao logo apos o commit do anexo — um commit extra que pode persistir qualquer alteracao pendente que esteja na mesma Session.

- criar_anexo (3704) aceita `url` arbitraria do cliente sem qualquer validacao, com origem='externo', sem hash e sem dedupe — caminho de confianca diferente do upload.

- GET /anexos/{id}/arquivo (3909) e DELETE /anexos/{id} (3925) so exigem usuario autenticado com permissao no modulo: nao verificam se o anexo pertence a clinica/escopo do usuario e os ids sao sequenciais.

- _montar_detalhe_atendimento (1734) faz ~11 consultas sequenciais por chamada e recalcula analyze_prescription_items (varredura par a par O(n^2) de interacoes) em todo GET; _montar_timeline_paciente (4058) carrega TODO o historico do paciente (atendimentos, evolucoes, anexos, exames, laudos) sem paginacao e e chamado tanto por /timeline quanto por /historico (que ja carregou atendimentos antes).

- _autenticar_usuario_pdf (820) duplica decodificacao de JWT, checagem de usuario ativo e chamada da matriz, em paralelo a get_current_user — duas implementacoes de auth no mesmo arquivo, com risco de divergencia.

- _obter_nome_medicamento (1571) levanta 422 no meio do _sync_prescricao, depois de exames/itens ja terem sido mutados na Session; o descarte depende de nao haver commit e do fechamento da sessao, sem rollback explicito.

- PrescricaoItemAjuste so e gravado quando o payload traz o id do item (1715). Se o frontend reenviar itens sem id (recriando), toda a trilha de auditoria se perde; itens deletados deixam ajustes orfaos apontando para prescricao_item_id inexistente.

- tipo_horario da finalizacao vem do cliente e define o preco da OS (3068, 3141-3176) sem confronto com o horario real do agendamento (inicio) nem com regra de plantao.

- Codigo morto/ruido no arquivo monolitico: estilos declarados e nao usados em _gerar_pdf_prescricao_bytes (1072-1096) e _gerar_pdf_exames_bytes (1222-1237), _montar_story_cabecalho_atendimento (882) aparentemente sem uso, `import base64` dentro da funcao (2562), e comentarios com mojibake (1797, 1854, 3465, 3941, 4216) indicando corrupcao de encoding em edicoes anteriores.

- Ordenacao de rotas fragil: /contexto, /exames/catalogo, /paineis, /frases-clinicas e /documentos/templates convivem com /{atendimento_id}; hoje nao ha colisao porque as contagens de segmentos diferem, mas GET /medicamentos/banco, /upload-metrics/* e /exames/{exame_id}/portal/liberar estao declarados DEPOIS de /{atendimento_id} — qualquer nova rota de 1 segmento adicionada abaixo sera sombreada.

- Nenhum modelo do modulo declara ForeignKey; a consistencia atendimento<->exame<->anexo<->prescricao<->OS depende inteiramente do codigo da aplicacao e dos dois indices unicos parciais recem-criados. A migration 59 aborta com RuntimeError se houver duplicidade preexistente, entao bases sujas travam o deploy ate conciliacao manual.

### Referências

- `/Users/martiniano/fortcordis-v2/backend/app/main.py:442 — registro do router com prefix /api/v1/atendimentos`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:146 — ATENDIMENTO_STATUS_CANONICOS, tipos de horario, status terminais da agenda e chave do lock`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:298 — _validar_primeira_conclusao_atendimento (gate clinico da conclusao)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:369 — _adquirir_lock_finalizacao (SQLite BEGIN IMMEDIATE / pg_advisory_xact_lock / FOR UPDATE fallback)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:392 — _buscar_os_ativa (reuso de OS nao cancelada)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:404 — _gerar_numero_os_finalizacao (OSYYYYMM+seq)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:428 — _carregar_e_validar_agendamento_atendimento (1:1, paciente, clinica, origem domiciliar, lock opcional)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:488 — _raise_atendimento_integrity_conflict e 519 — _commit_atendimento_com_guard`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:565 — _to_operational_iso (assume naive = -03:00)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:820 — _autenticar_usuario_pdf (auth paralela para as rotas de PDF)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1474 — _find_existing_upload_anexo_by_dedupe_key e 1513 — _registrar_upload_dedupe_metrica (commit proprio)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1574 — _sync_exames (upsert + delete por omissao, apaga anexos e arquivos)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1655 — _sync_prescricao (upsert de itens + PrescricaoItemAjuste + delete por omissao)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1734 — _montar_detalhe_atendimento (contrato do GET /{id})`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1900 — GET "" (lista com agregados anti N+1)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2340 — GET /contexto (ponte Agenda -> Atendimento)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2615 — GET /{id}/documentos/{doc_id}/pdf (muta status para emitido e commita num GET)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2663 — POST "" criar_atendimento`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2776 — PUT /{id} atualizar_atendimento (guards de conclusao e reabertura em 2835-2859)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2947 — _emitir_efeitos_finalizacao (auditoria, realtime, pushes pos-commit)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3060 — POST /{id}/finalizar (transacao unica atendimento+agenda+OS)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3165 — criacao da OrdemServico na finalizacao`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3272 — DELETE /{id} excluir_atendimento (sem guard de status/vinculo)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3624 — POST /exames/{exame_id}/portal/liberar`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3742 — POST /{id}/anexos/upload (sha256, dedupe, storage atomico, colisao concorrente)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:4058 — _montar_timeline_paciente (historico completo sem paginacao)`
- `/Users/martiniano/fortcordis-v2/backend/app/models/atendimento_clinico.py:9 — __table_args__ do AtendimentoClinico com ux_atendimentos_clinicos_agendamento_unico`
- `/Users/martiniano/fortcordis-v2/backend/app/models/ordem_servico.py:16 — ux_ordens_servico_agendamento_ativa (OS ativa unica por agendamento)`
- `/Users/martiniano/fortcordis-v2/backend/app/models/laudo.py:45 — modelo Exame (atendimento_id, laudo_id, status, datas)`
- `/Users/martiniano/fortcordis-v2/backend/app/schemas/atendimento.py:7 — ExameSolicitacaoPayload (status e laudo_id vindos do cliente) e :152 — AtendimentoFinalizarPayload`
- `/Users/martiniano/fortcordis-v2/backend/migrations/versions/20260730_59_atendimento_agenda_transactional_finalization.py:70 — upgrade que valida duplicidades e cria os dois indices unicos parciais`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/agenda.py:5376 — bloqueio 409 de Realizado/desfazer quando ha atendimento vinculado`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/agenda.py:5533 — caminho legado da agenda que gera OS (segunda fonte de OS e de numeracao)`
- `/Users/martiniano/fortcordis-v2/backend/app/services/atendimento/document_context_service.py:159 — atualizar_documento_template_se_contexto_mudou (re-render condicional do documento)`
- `/Users/martiniano/fortcordis-v2/backend/app/services/atendimento_upload_service.py:144 — store_atendimento_attachment_file (limite 25MB, extensao x MIME, mkstemp+os.replace)`
- `/Users/martiniano/fortcordis-v2/backend/app/services/medication_automation.py:85 — analyze_prescription_items (dose por peso e interacoes par a par)`
- `/Users/martiniano/fortcordis-v2/backend/app/core/portal_release.py:1 — PORTAL_RELEASED_STATUS = 'Liberado no portal'`
- `/Users/martiniano/fortcordis-v2/backend/app/core/security.py:152 — _authorize_request_by_matrix aplicado dentro de get_current_user (:178)`
- `/Users/martiniano/fortcordis-v2/backend/tests/test_atendimento_transactional_finalization.py:152 — suite que cobre finalizacao, rollback, reuso de OS, agenda terminal e bloqueio de reabertura`


---

## Frontend — máquina de estados, abas, fluxo de cliques

<sub>`mapa:frontend` · agente `a0df8e9652764d10b`</sub>

### Resumo

FRONTEND DO ATENDIMENTO CLINICO - MAPA COMPLETO (estado atual do disco, incluindo working tree nao commitada)

#### Arquitetura geral
`frontend/app/atendimento/page.tsx` (6499 linhas) e um unico componente client (`AtendimentoPage`, linha 1297) que concentra TODO o estado: 104 `useState`, 29 `useEffect`, 42 `useMemo`, 5 `useRef` e 52 chamadas HTTP. Os 15 componentes de `components/` sao puramente de apresentacao, carregados via `next/dynamic` (linhas 87-100) e recebem callbacks/estado por props tipadas como `Record<string, any>` (`components/component-props.ts`: `export type LooseAtendimentoComponentProps = Record<string, any>`) - ou seja, a fronteira page->componentes nao tem tipagem nenhuma. `renderPrescricaoItemCard` (page.tsx:5165, ~420 linhas de JSX) e definida no corpo da page e passada como prop para o `AtendimentoPrescricaoWorkspace`.

Libs: `atendimento-utils.ts` (timezone operacional America/Fortaleza -03:00, formatacao, parsing), `atendimento-clinical-notes.ts` (11 campos clinicos, frases rapidas, scaffolds, `buildClinicalQuickSummary` -> completeness %), `atendimento-prescricao-protocolos.ts` (4 protocolos cardiologicos com gatilhos por texto de diagnostico), `atendimento-cadastro.ts` (mascaras CPF/CEP/telefone, idade->data de nascimento, `ATENDIMENTOS_LIST_LIMIT = 30`).

#### Maquina de estados (5 dimensoes independentes, nao ha reducer nem state machine formal)
1. `workspacePainel`: `consulta | exames | prescricao | documentos | bibliotecas` (tipo em :338, estado em :1308). Os 4 primeiros aparecem como abas (`workspaceCards`, :4897); `bibliotecas` so pelo botao "Bibliotecas clinicas" na barra de navegacao (:5806).
2. `consultaEditorEtapa`: `anamnese | diagnostico | plano` (:339, :1309) - 3 sub-etapas DENTRO do painel Consulta, definidas em `CONSULTA_EDITOR_ETAPAS` (:576-600) com 4+3+4 = 11 campos clinicos.
3. `consultaCampoAtivo`: `ClinicalFieldKey` (:1310) - UM campo textarea visivel por vez; navegacao por botoes ChevronLeft/Right, `Alt+Shift+Setas` (:5021) e `Ctrl/Cmd+Enter` (:4985).
4. `autosaveState`: `idle | local | dirty | saving | saved | error` (:1320) + `autosaveAt` -> badge `autosaveLabel`/`autosaveBadgeClass` (:5113-5133).
5. `selecionado: number | null` (:1339) - divide o mundo em dois regimes: `null` = rascunho novo (persistido SO em localStorage) vs numero = registro existente (autosave no servidor habilitado).

Estados de dominio derivados: `form.status` (`STATUS_ATENDIMENTO` :541: Triagem / Em atendimento / Aguardando exames / Retorno agendado / Concluido - "Concluido" so via Finalizar, a option esta sempre `disabled` fora desse caso, ConsultaOverviewSection:151-159); fluxo por exame `aguardando_arquivo -> arquivo_anexado -> interpretado` (derivado em `resolveExamFlowStatus` :922, mapeado para status backend em `resolveExamBackendStatus` :928); `painelModalMode: list|create|edit` (:1350); `prescricaoEntradaModo: null|industrializado|manipulado` (:1421); `attachmentPreview.kind: image|pdf`.

#### Montagem e submissao do formulario
Tudo vive em UM objeto `form: AtendimentoForm` (tipo :510-537) com `triagem` e `diagnostico` como sub-objetos e `exames`/`prescricao_itens`/`evolucoes`/`anexos`/`documentos` como arrays. O setter generico e `setField(name, value)` (:2670); updates aninhados sao spread manual (ex.: `setField("triagem", {...form.triagem, peso})`). Campos clinicos passam por `getClinicalFieldValue`/`setClinicalFieldValue` (switch de 11 cases, :1702-1769) e `injectClinicalSnippet` (:1775) que insere frase na posicao do cursor via refs de textarea.

`buildAtendimentoPayload(form)` (:1142-1209) monta o body: filtra exames sem `tipo_exame`, filtra itens de prescricao sem medicamento, deriva status do exame pela contagem de anexos, converte datetime-local -> ISO com offset operacional via `localInputToOperationalIso`. `serializeAtendimentoSnapshot` = JSON.stringify desse payload e serve como chave de dirty-check contra `lastPersistedSnapshotRef`.

NAO fazem parte do payload principal (endpoints separados): anexos, evolucoes, documentos clinicos, templates, medicamentos, frases clinicas, paineis customizados. Presets de prescricao sao SO localStorage (`fortcordis:atendimento:prescricao-presets:v1`).

#### Autosave vs save manual (o ponto mais delicado)
Ha DOIS loops de autosave mutuamente exclusivos:
- **Rascunho local** (:2431-2468): debounce 700ms, grava `fortcordis:atendimento:draft:v1` em localStorage. Guard: `!selecionado`. Restaurado em :2390-2429 com validacao de contexto (`canRestoreDraft` compara paciente/clinica/agendamento).
- **Autosave no servidor** (:3754-3781): debounce `AUTOSAVE_DELAY_MS = 1800`, `PUT /atendimentos/{id}`. Guard: `selecionado` presente.

Consequencia central: **um atendimento novo NUNCA e criado automaticamente**. Em `saveAtendimento` (:3628) o caminho POST tem `if (isAutosave) return;` (:3658). O primeiro salvamento e sempre manual ou implicito. Save manual valida a prescricao (`validarItensPrescricao` :899) e pula para a aba prescricao em caso de erro; autosave pula essa validacao. No autosave a resposta e mesclada por `mergeAutoSavedFormState` (:1264) que reconcilia IDs por id e depois por assinatura (`buildExamMergeKey`/`buildPrescriptionMergeKey`) para nao sobrescrever teclas digitadas durante o PUT em voo.

Saves manuais IMPLICITOS (o usuario nao clica em "Salvar"): `resolveExamIdForUpload` (:3948, ao anexar arquivo de exame - e pode chamar `abrirAtendimento` para re-sincronizar), `obterAtendimentoIdParaDocumento` (:4245), `baixarPdfAtendimento` (:4812), `iniciarNovoAtendimentoPaciente` (:2603, se dirty) e `finalizarAtendimento` (:3712).

#### Quando ha fetch/refetch
- Mount: guard de token -> `carregarBase` (:1902, 5 GETs em paralelo: pacientes limit=1000, clinicas limit=500, medicamentos limit=500, catalogo de exames, frases limit=1000) + `carregarLista(1)`; em paralelo `carregarCustomPaineis`, `carregarDocumentoTemplates`, presets e racas do localStorage, e import dinamico de `fuse.js` (:1882).
- `aplicarContexto` (:1805-1880): le `atendimento_id`, `agendamento_id`, `paciente_id`, `clinica_id` da URL. Com `agendamento_id`: `GET /atendimentos/contexto` + `GET /atendimentos?agendamento_id=...` para tentar reabrir um atendimento ja existente antes de criar novo.
- `useEffect [form.paciente_id]` (:2485): dispara `carregarHistoricoPaciente` + `carregarCadastroComplementar` (2-3 GETs: paciente, tutor, fallback /pacientes/{id}/tutor) a CADA troca de paciente.
- `abrirAtendimento` (:2495): `GET /atendimentos/{id}` + historico; reseta ~12 pedacos de UI.
- Pos save manual e pos finalizar: `carregarLista(paginaLista)` + `carregarHistoricoPaciente`.
- Documentos: `recarregarDocumentosAtendimento` apos criar/salvar/PDF/excluir.
- Preview do PDF da receita: `POST /atendimentos/prescricao/preview` sob demanda (`gerarPreviewPdf` :3022), devolve base64 injetado como `data:application/pdf` em iframe.

#### Working tree (nao commitado)
O diff adiciona ao frontend: estado `finalizando` + `tipoHorarioFinalizacao` (comercial/plantao), a funcao `finalizarAtendimento` (:3709) que faz save manual e depois `POST /atendimentos/{id}/finalizar`, o bloco de botao "Finalizar atendimento" no header (:5700-5737), propagacao de erro no autosave (`setErro` no branch autosave, :3697), `data_atendimento` preenchido pelo `contexto.inicio` do agendamento (:1861), e a troca de `new Date(x).toISOString()` por `localInputToOperationalIso` no payload. Em `AtendimentoConsultaOverviewSection` o campo livre "Agendamento ID" foi substituido por um display read-only e os inputs ganharam `<label>`. No backend, `finalizar` (atendimento.py:3060) e transacional: valida conteudo clinico minimo (:298-338), trava agendamento, gera/reutiliza a OS, marca agendamento "Realizado" e atendimento "Concluido".

### Fluxo

1. ENTRADA (fora da page): na Agenda o vet clica no agendamento e depois em 'Iniciar atendimento' -> router.push('/atendimento?agendamento_id=X') (frontend/app/agenda/page.tsx:1437 e :1511). Alternativas: /atendimento?paciente_id=X (pacientes/[id]/page.tsx:285) ou /atendimento?atendimento_id=X (:385). ~2 cliques.

2. BOOT AUTOMATICO (0 cliques): guard de token -> carregarBase() com 5 GETs paralelos + carregarLista(1) (page.tsx:1902-1924); tela travada em 'Carregando modulo de atendimento...' (:5608). Depois aplicarContexto() (:1805) le a query string: com agendamento_id faz GET /atendimentos/contexto e GET /atendimentos?agendamento_id para reabrir atendimento existente (abrirAtendimento) ou pre-preencher paciente/especie/clinica/agendamento/data. Em seguida o useEffect [form.paciente_id] (:2485) busca historico do paciente e cadastro complementar. Se nao havia atendimento, o useEffect :2390 tenta restaurar o rascunho do localStorage.

3. ABA CONSULTA (default, workspacePainel='consulta'): renderiza 4 secoes empilhadas - ConsultaOverviewSection (contexto/paciente/clinica/data/status + cards do 'Fluxo clinico'), CadastroComplementarSection (recolhida), TriagemSection (recolhida) e ConsultaEditorSection. 0 cliques para chegar aqui.

4. PASSO 1 - Selecionar/confirmar paciente: se veio da agenda ja esta preenchido. Manualmente: digitar >=2 letras no campo 'Paciente ou tutor' -> dropdown Fuse.js (pacientesFiltrados, :2019) -> 1 clique em selecionarPaciente (:2672), que dispara refetch de historico + cadastro.

5. PASSO 2 - Cadastro complementar (opcional, recolhido por default): 1 clique em 'Revisar cadastro' -> preencher especie/raca/idade/data nascimento/peso cadastral do pet e whatsapp/telefone/email/CPF/CEP/endereco do tutor (CEP dispara GET /clinicas/cep/{cep} no blur) -> 1 clique 'Copiar peso para triagem' (opcional) -> 1 clique 'Salvar cadastro' (PUT /pacientes/{id} + PUT /tutores/{id}). O badge conta pendencias via cadastroComplementarPendencias (:2127). ~3 cliques + 10 campos.

6. PASSO 3 - Triagem (recolhida por default, triagemExpandida=false): 1 clique no chevron para expandir -> preencher peso, temperatura, FC, FR, pressao arterial, SpO2, escore corporal, mucosas, hidratacao, observacoes (10 campos) -> 1 clique no checkbox 'Triagem Concluida' (grava form.triagem_concluida=1). O peso alimenta prescricaoSupport, calculo de dose, sugestao de apresentacao e a curva de peso lateral. ~2 cliques + 10 campos.

7. PASSO 4 - Editor clinico guiado (11 campos em 3 etapas, UM campo visivel por vez). Etapa 'Anamnese e exame' ja ativa com campo 'queixa_principal' focado automaticamente (useEffect :5009 da focus e posiciona o cursor no fim). Digitar e avancar: 3 cliques em ChevronRight (ou Ctrl+Enter / Alt+Shift+Direita) para anamnese, exame_fisico, dados_clinicos. Cada campo tem botao de scaffold (roteiro) + 3 botoes de frase rapida (ClinicalFieldCard.tsx:99-126) que inserem texto na posicao do cursor. ~3 cliques + 4 textareas.

8. PASSO 5 - Etapa 'Diagnostico': 1 clique no card da etapa -> diagnostico_principal / diagnostico_secundario / diagnostico_diferencial com 2 cliques de avanco. ~3 cliques + 3 textareas.

9. PASSO 6 - Etapa 'Plano e retorno': 1 clique no card -> plano_terapeutico / retorno_recomendado / motivo_retorno / observacoes com 3 cliques de avanco. Mais 1 clique no select 'Prognostico'. Quando os 11 campos tem texto, o useEffect :5004 marca form.consulta_concluida=1 automaticamente e a barra de progresso da etapa vai a 100%. ~5 cliques + 4 textareas.

10. PASSO 7 - Aba EXAMES: 1 clique na aba. Tres formas de adicionar: (a) digitar na busca do catalogo e 1 clique no resultado (adicionarExameDoCatalogo :3582); (b) 1 clique no select de painel + 1 clique 'Aplicar painel' (aplicarPainelExames :3588) ou 1 clique num chip de painel customizado (aplicarPainel :3379); (c) 1 clique 'Exame manual'. Painel customizado: 1 clique '+ Novo painel' -> nome + categoria + N cliques para escolher exames -> 1 clique 'Criar painel' (POST /atendimentos/paineis). ~2-4 cliques por exame.

11. PASSO 8 - Anexar resultado do exame: arrastar arquivo OU 1 clique 'Selecionar arquivo(s)' + 1 clique 'Enviar agora'. Se o exame ainda nao tem id, resolveExamIdForUpload (:3948) faz saveAtendimento('manual') e, se preciso, abrirAtendimento() para descobrir o exame_id - ou seja, anexar arquivo salva o atendimento inteiro. POST /atendimentos/{id}/anexos/upload com barra de progresso e botao Cancelar. Depois digitar a 'Interpretacao resumida do resultado' (leva o exame para o estado 'interpretado'). Opcional: 1 clique 'Visualizar' (abre AttachmentPreviewModal com zoom/pan/paginacao), 1 clique 'Laudar' (router.push /laudos/novo), 1 clique 'Imprimir' ou 'Gerar PDF' (GET /atendimentos/{id}/exames/pdf). ~2-5 cliques por exame.

12. PASSO 9 - Aba PRESCRICAO: 1 clique na aba (o useEffect :5053 forca prescricaoModoFoco=true). Renderiza PrescricaoHistorySection (receitas anteriores com 'Usar em novo atendimento'/'Abrir original') + PrescricaoWorkspace. Entrada: 1 clique no card 'Adicionar produto industrializado' (ou 'Adicionar formula manipulada') -> digitar na busca -> 1 clique 'Selecionar' por medicamento (criarItemPrescricaoDoMedicamento :2920 pre-preenche frequencia, duracao, via, dose mg/kg, peso de referencia, concentracao e ja calcula a dose). Alternativas: 1 clique num chip de protocolo (aplicarProtocoloPrescricao :3221, insere varios itens + orientacoes + retorno), 1 clique num preset salvo (aplicarPresetPrescricao :3485) ou 1 clique 'Item manual'. ~2-3 cliques.

13. PASSO 10 - Ajustar cada item da receita (renderPrescricaoItemCard :5165): select do medicamento da biblioteca, nome exibido, apresentacao comercial, dose, frequencia, duracao, via, instrucoes. Assistentes com 1 clique cada: 'Aplicar calculo' (dose mg/kg x peso -> mg/mL/comprimidos), 'Aplicar dose sugerida', 'Aplicar apresentacao', 'Marcar como formula manipulada', 'Salvar formula na biblioteca'. Validacao obrigatoria: medicamento, dose, frequencia e via (validarItensPrescricao :899). Mais 'Retorno (dias)' e 'Instrucoes gerais do tratamento'. ~4-8 cliques + 6 campos por item.

14. PASSO 11 - Conferir/emitir receita: 1 clique 'Preview PDF' no header do workspace (POST /atendimentos/prescricao/preview -> iframe com base64) e/ou no aside 'Saida da prescricao': 1 clique 'Salvar atendimento', 1 clique 'Imprimir' (janela window.open com HTML montado no cliente, :4673) ou 1 clique 'Baixar PDF' (GET /atendimentos/{id}/prescricao/pdf, salvando antes se estiver dirty). Opcional: nome do preset + 1 clique 'Salvar preset' (localStorage). ~2-4 cliques.

15. PASSO 12 - Aba DOCUMENTOS (opcional): 1 clique na aba. Documento clinico: 1 clique no select de template + 1 clique 'Criar' (POST /atendimentos/{id}/documentos) -> ajustar titulo/corpo -> 1 clique 'Salvar documento' -> 1 clique 'Gerar PDF' (marca status 'emitido'). Evolucao: digitar descricao + sinais vitais -> 1 clique 'Registrar Evolucao' (POST direto no componente, DocumentosSection:402-412, seguido de abrirAtendimento). Anexos gerais: select tipo + descricao + arquivo -> 1 clique 'Enviar arquivo'; ou URL + 1 clique 'Adicionar link'. Templates: 1 clique 'Templates' -> editar/desativar/criar. ~4-9 cliques.

16. PASSO 13 - FINALIZAR: (se houver agendamento vinculado) 1 clique no select 'Horario da OS' -> comercial|plantao; 1 clique 'Finalizar atendimento' (page.tsx:5718). finalizarAtendimento (:3709) faz saveAtendimento('manual') e depois POST /atendimentos/{id}/finalizar. O backend (atendimento.py:3060) valida conteudo clinico minimo (queixa principal + um de anamnese/exame/dados + um de diagnostico/plano), trava atendimento e agendamento, gera ou reutiliza a OS (calcular_preco_servico com o tipo_horario), marca agendamento 'Realizado' e atendimento 'Concluido', tudo em uma transacao. Depois o front rehidrata o form, limpa o rascunho local e refaz carregarLista + historico. 1-2 cliques.

17. CONTAGEM: caminho minimo realista (vindo da agenda, 1 exame com arquivo, 1 medicamento, sem revisar cadastro e sem documentos) = ~2 cliques na agenda + ~28 cliques na page = ~30 cliques, alem de ~15 campos digitados. Caminho completo (revisando cadastro, 3 exames com upload, 3 medicamentos, 1 documento com PDF, 1 evolucao) = ~55-70 cliques. Etapas obrigatorias de navegacao pura (sem entrada de dado): 4 abas + 3 etapas do editor + 8 avancos de campo + 2 expansoes de secao recolhida = 17 cliques so para percorrer a interface.

### Pontos de atenção (22, não verificados)

- consulta_concluida tem dois donos. O checkbox 'Consulta concluida' (AtendimentoConsultaEditorSection.tsx:52-58) escreve o campo, mas o useEffect de page.tsx:5004-5007 tambem escreve, derivado de consultaEtapasCompletas (os 11 campos preenchidos). O efeito roda no mount com consultaEtapasCompletas=false, entao um atendimento carregado do servidor com consulta_concluida=1 e incompleto tem o valor zerado logo apos abrirAtendimento - e isso e visivel no card 'Consulta' do fluxoClinico (:4876).

- Nao ha fallback local depois do primeiro save. O rascunho em localStorage (page.tsx:2431) so roda quando !selecionado. Com o atendimento ja salvo, se o autosave do servidor falhar (autosaveState='error') as edicoes existem apenas em memoria - nenhum snapshot local e gravado.

- O autosave do servidor nao faz flush no unmount. O useEffect :3754-3781 tem cleanup que apenas limpa o timer de 1800ms; sair da pagina (ou trocar de rota) dentro da janela de debounce descarta a ultima edicao silenciosamente. Nao ha handler de beforeunload nem de route change.

- Atendimento novo nunca e persistido automaticamente: saveAtendimento retorna cedo no branch autosave antes do POST (:3658). Todo o valor clinico digitado antes do primeiro clique em 'Salvar atendimento' depende exclusivamente do localStorage.

- Estados por indice de array em exames. examesExpandidos, examUploadDrafts e examDropActive sao mapas keyed por index (:1317, :1386, :1387), e a key do React na lista e `${index}-${exame.id || 'novo'}` (AtendimentoExamesSection.tsx:374). removerExamesVazios (:5092), a exclusao de um exame do meio da lista (ExamesSection:434-441) e mergeExamesNoFormulario (:3275) deslocam os indices, o que pode reassociar estado de expansao e arquivo pendente ao exame errado.

- Anexar arquivo de exame pode resetar a UI. resolveExamIdForUpload (:3948) chama saveAtendimento('manual') e, se nao encontrar o exame sincronizado, chama abrirAtendimento(id) (:3969) - que reseta triagemExpandida, cadastroComplementarExpandido, prescricaoEntradaModo, prescricaoBuscaRapida, documentoClinicoForm, anexoArquivo e limpa os drafts de upload (:2519-2529). Efeito colateral pesado para a acao de anexar um PDF.

- Upload em lote compartilha o mesmo uploadKey. uploadArquivosResultadoExame (:4001) percorre os arquivos em serie, todos com uploadKey='exame-${index}'; o AbortController em uploadAbortControllersRef e o progresso sao sobrescritos por arquivo, e o botao 'Cancelar upload' aborta apenas o arquivo corrente (o loop entao para por causa do break em :4025).

- pesoSerie usa fuso do navegador, nao o operacional. Em :2230 faz `new Date(form.data_atendimento).toISOString()` sobre uma string datetime-local, divergindo de buildAtendimentoPayload que agora usa localInputToOperationalIso (-03:00, alteracao nao commitada). O ponto de peso do atendimento atual pode cair em outro dia na curva lateral.

- gerarPreviewPdf (:3022) tem `form` inteiro nas dependencias do useCallback, entao sua identidade muda a cada tecla; e chamado por setTimeout(...,100) no toggle do preview (PrescricaoWorkspace.tsx:96) e pelo botao 'Tentar novamente'. Nao ha refresh automatico quando a receita muda - o preview em iframe fica desatualizado sem sinalizacao ao usuario.

- Par de efeitos de validacao de prescricao escrevendo na dependencia um do outro (:5065-5069 e :5071-5074): um limpa prescricaoValidationErrors quando total===0, o outro reescreve a partir de prescricaoValidacaoAtual.errors sempre que prescricaoErrosCount!==0, e prescricaoErrosCount deriva de prescricaoValidationErrors. Converge apenas porque a referencia do useMemo e estavel entre renders.

- obterPacienteNome()/obterClinicaNome() (:4670-4671) usados na impressao HTML leem apenas dos arrays `pacientes` (limit=1000) e `clinicas` (limit=500) de carregarBase. Um paciente fora dessa primeira pagina imprime 'Nao informado', mesmo com o cadastro complementar carregado corretamente.

- Duas fontes de verdade para o layout da receita e da solicitacao de exames: imprimirPrescricao/imprimirSolicitacaoExames (:4673 e :4732) montam HTML no cliente e injetam num window.open com <script> inline de auto-print, enquanto baixarPdfAtendimento usa o PDF gerado no backend. Os dois documentos podem divergir.

- carregarBase (:1902) bloqueia a tela inteira ate concluir 5 GETs nao paginados (pacientes limit=1000, clinicas limit=500, medicamentos limit=500, catalogo completo de exames, frases limit=1000), e depois constroi 3 indices Fuse.js sobre esses arrays (:1983-2017). Custo fixo de entrada em toda visita a pagina, inclusive quando o vet so quer reabrir um atendimento pelo id.

- Painel de casos oculto por default: painelCasosAberto inicia false (:1315) e showCaseSidebar tambem e forcado a false nas abas prescricao e bibliotecas (:4928). Filtros, busca, paginacao e a lista de atendimentos recentes so aparecem apos clicar em 'Casos recentes'.

- AtendimentoDocumentosSection recebe a instancia do axios como prop (`api={api}`, page.tsx:6312) e faz POST /atendimentos/{id}/evolucoes inline no onClick (DocumentosSection:402-412), seguido de abrirAtendimento(selecionado) - fora do padrao de handlers da page, com tratamento de erro proprio e resetando a UI.

- 'Confirmar sincronizacao' (:5732) re-executa POST /finalizar num atendimento cujo status ja e 'Concluido'. O backend e idempotente por desenho (_validar_primeira_conclusao_atendimento sai cedo em :311 e _buscar_os_ativa reutiliza a OS), mas o front nao distingue visualmente reenvio de primeira finalizacao.

- finalizarAtendimento (:3709) faz saveAtendimento('manual') e so depois o POST /finalizar. Se o POST retornar 422 (validacao de conteudo clinico do backend, atendimento.py:298-338) ou 409 (agenda em status terminal), o save ja aconteceu: o dado esta persistido mas status/agenda ficam no estado anterior - a mensagem de erro afirma que nada foi perdido, o que e coerente, porem o usuario nao ve qual das duas etapas falhou.

- Fronteira page->componentes totalmente sem tipos: LooseAtendimentoComponentProps = Record<string, any>. Sao ~60 props passadas para AtendimentoExamesSection e ~40 para AtendimentoPrescricaoWorkspace; um rename ou typo nao quebra a compilacao. Alem disso os componentes usam esse mesmo alias como tipo de parametros de map/callback (ex.: `(filtro: AtendimentoExamesSectionProps)` em ExamesSection:149), o que e semanticamente errado ainda que compile.

- renderPrescricaoItemCard (:5165) e uma funcao de render de ~420 linhas definida no corpo da page e passada como prop; nenhum item da receita pode ser memoizado, entao cada tecla em qualquer campo re-renderiza todos os cards de prescricao junto com a page de 6499 linhas.

- Tres caminhos distintos revogam o mesmo objectURL do preview de anexo: o cleanup do useEffect (:1577), o handler de Escape dentro desse mesmo efeito (:1564) e closeAttachmentPreview (:3842).

- abrirAtendimento so pede confirmacao (window.confirm, :2500) quando `!selecionado && hasEncounterContent(form)`. Com um atendimento ja aberto e editado (autosaveState='dirty'), clicar em outro caso na lista de casos recentes troca o registro sem aviso, contando com o autosave de 1800ms ter rodado.

- 104 useState e 29 useEffect em um unico componente, incluindo estado que nao pertence ao atendimento (CRUD de medicamentos, frases clinicas, templates de documento, paineis de exame, paginacao da lista e todos os modais). Especificacoes de modularizacao ja existem em docs/specs/arch-fe-01-modularizar-atendimento-for39/ e ainda nao foram aplicadas a page.

### Referências

- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:87`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:338`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:510`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:541`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:576`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:899`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:922`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1075`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1142`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1264`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1297`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1308`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1320`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1702`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1775`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1805`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1902`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:1926`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2230`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2390`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2431`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2485`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2495`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2544`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2584`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2670`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2796`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:2920`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3022`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3221`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3485`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3628`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3658`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3709`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3754`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3948`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4001`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4041`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4154`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4245`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4336`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4670`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4673`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4778`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4867`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4897`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4932`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:4996`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5004`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5021`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5065`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5113`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5165`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5700`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:5820`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:6105`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:6317`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/component-props.ts:1`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx:44`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx:143`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx:205`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoTriagemSection.tsx:26`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx:52`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx:138`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaEditorSection.tsx:272`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/ClinicalFieldCard.tsx:99`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoExamesSection.tsx:149`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoExamesSection.tsx:364`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoExamesSection.tsx:502`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx:86`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx:155`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoPrescricaoWorkspace.tsx:477`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoPrescricaoAside.tsx:48`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx:402`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/PainelExamesModal.tsx:125`
- `/Users/martiniano/fortcordis-v2/frontend/lib/atendimento-utils.ts:43`
- `/Users/martiniano/fortcordis-v2/frontend/lib/atendimento-clinical-notes.ts:373`
- `/Users/martiniano/fortcordis-v2/frontend/lib/atendimento-clinical-notes.ts:455`
- `/Users/martiniano/fortcordis-v2/frontend/lib/atendimento-prescricao-protocolos.ts:22`
- `/Users/martiniano/fortcordis-v2/frontend/lib/atendimento-cadastro.ts:86`
- `/Users/martiniano/fortcordis-v2/frontend/app/agenda/page.tsx:1437`
- `/Users/martiniano/fortcordis-v2/frontend/app/pacientes/[id]/page.tsx:285`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:298`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3060`


---

## Dados e contrato — schema, enums, divergências BE↔FE

<sub>`mapa:dados` · agente `a2c6435fd57b16711`</sub>

### Resumo

Mapeamento completo de dados e contrato do modulo de atendimento clinico no estado ATUAL do disco (working tree, com as alteracoes nao commitadas). PERSISTENCIA: 11 tabelas proprias em backend/app/models/atendimento_clinico.py (atendimentos_clinicos, anexos_atendimentos, documentos_atendimento_templates, documentos_atendimento, upload_dedupe_metricas, upload_dedupe_cleanup_runs, evolucoes_clinicas, alertas_clinicos, medicamentos, prescricoes_clinicas, prescricoes_itens, prescricao_item_ajustes) + duas tabelas compartilhadas com outros modulos: exames (definida em app/models/laudo.py, com atendimento_id) e ordens_servico (gerada na finalizacao). NAO ha Alembic: as migracoes sao um runner proprio (backend/migrations/runner.py) que executa em ordem de nome de arquivo e para na primeira falha; 14 migrations tocam o modulo, da 20260222_04 ate a NOVA 20260730_59. A migration 59 cria dois indices unicos PARCIAIS (ux_atendimentos_clinicos_agendamento_unico WHERE agendamento_id IS NOT NULL e ux_ordens_servico_agendamento_ativa WHERE COALESCE(status,'') <> 'Cancelado'), ambos ja espelhados nos __table_args__ dos modelos, e ABORTA com RuntimeError se existir duplicidade previa. NULLABILITY: quase tudo e nullable; NOT NULL real apenas em atendimentos_clinicos.{paciente_id, veterinario_id, data_atendimento, status}, anexos_atendimentos.{atendimento_id, tipo, url, origem}, prescricoes_itens.{prescricao_id, medicamento_nome, ordem}, documentos_atendimento.{atendimento_id, titulo, corpo, status}, exames.{paciente_id, tipo_exame} (estes dois ultimos podem ter perdido o NOT NULL em bases legadas por causa da 20260324_19). CONTRATO HTTP: nenhum response_model Pydantic - todas as respostas sao dicts montados a mao (_montar_detalhe_atendimento, _map_exame, _serialize_anexo, _map_prescricao_item, serializar_documento_atendimento), portanto sem validacao de saida; os schemas Pydantic cobrem apenas a ENTRADA. O frontend consome tudo com `any` (hydrateFormFromDetail(d: any)) e os 12 componentes de secao recebem props tipadas como Record<string, any> via LooseAtendimentoComponentProps - o contrato nao e verificado em nenhum dos dois lados. VOCABULARIOS DE STATUS/ENUM (nenhum e Enum de banco; todos sao String livre): atendimento -> backend normaliza (case/acento-insensitive) para exatamente {Triagem, Em atendimento, Aguardando exames, Retorno agendado, Concluido} e devolve 422 fora disso; frontend STATUS_ATENDIMENTO lista os mesmos 5 (MATCH). Exame.status -> banco default 'Solicitado'; frontend so produz {Solicitado, Em andamento, Concluido}; backend tambem grava 'Em andamento' no upload e 'Liberado no portal' na liberacao para o portal (valor DESCONHECIDO pelo frontend). Exame.prioridade -> {Rotina, Urgente, Emergencial} (apenas comentario, sem validacao; default 'Rotina' em ambos). Documento -> {rascunho, emitido, arquivado} validados no PUT; a UI so usa rascunho e emitido. Anexo.origem -> {externo, upload}. Anexo.tipo -> UI oferece {imagem, radiografia, ultrassom, documento, outro} mas o upload de resultado grava 'resultado_exame'. Alerta -> tipo {alergia, contraindicacao, doenca_cronica, risco, outro}, gravidade {baixa, media, alta, critica} default 'media'. tipo_horario -> {comercial, plantao} (422 fora). origem_atendimento -> {clinica_parceira, domiciliar} com aliases. OS -> {Pendente, Pago, Cancelado}. Agenda na finalizacao -> 'Realizado', bloqueada em {Cancelado, Faltou, Expirado}. UploadDedupeMetrica.evento -> {upload_novo, dedupe_precheck, dedupe_collision}. Mucosas/hidratacao/prognostico: texto livre, com listas DIFERENTES entre o comentario do modelo e as opcoes da UI. Frases clinicas: as 11 secoes de VALID_SECOES batem exatamente com ClinicalFieldKey (unico enum com paridade perfeita). As divergencias de maior impacto encontradas sao: (1) a liberacao de exame no portal pode ser revogada pelo autosave, porque o frontend reescreve exames.status com um vocabulario de 3 valores e o portal depende de 'Liberado no portal'; (2) _sync_exames deleta exames (e anexos + arquivos fisicos) que nao vierem no payload, e o payload filtra exames com tipo_exame vazio; (3) mistura sistematica de datetime naive e aware alimentando colunas timestamptz, com serializacao inconsistente (_to_iso sem offset vs _to_operational_iso com -03:00) contra um frontend que agora assume America/Fortaleza para strings sem timezone; (4) aplicarCadastroComplementar(d.paciente, d.tutor) le campos que o payload nunca devolveu; (5) os campos de calculo de dose mg/kg do frontend nao existem no schema nem no banco e sao perdidos a cada reload, enquanto o apoio_clinico calculado pelo backend nunca e consumido.

### Fluxo

1. ENTRADA NA PAGINA: /atendimento monta AtendimentoPage; carregarBase() dispara 5 GETs em paralelo: /pacientes?limit=1000, /clinicas?limit=500, /atendimentos/medicamentos/banco?limit=500 (le .items), /atendimentos/exames/catalogo (le .exames e .paineis), /atendimentos/frases-clinicas?include_inactive=1&limit=1000 (le .frases). Depois carregarLista(1) -> GET /atendimentos?limit=30&skip=0[&status&search&clinica_id&data_inicio&data_fim] que retorna {total, items[]}.

2. CONTEXTO POR URL: se ?atendimento_id -> abrirAtendimento(id). Se ?agendamento_id -> GET /atendimentos/contexto?agendamento_id=N (retorna agendamento_id, paciente_id, especie, paciente_nome, tutor_id, tutor_nome, clinica_id, clinica_nome, inicio, status) + GET /atendimentos?agendamento_id=N&limit=10 para reaproveitar atendimento existente; senao preenche form (paciente_id, especie, clinica_id, agendamento_id, data_atendimento=isoToLocalInput(contexto.inicio)).

3. ABRIR ATENDIMENTO: GET /atendimentos/{id} -> _montar_detalhe_atendimento (dict grande, sem envelope). hydrateFormFromDetail(d) monta AtendimentoForm; triagem vem aninhada em d.triagem; diagnostico e montado a partir dos campos PLANOS d.diagnostico_principal/secundario/diferencial/prognostico; exames de d.exames (cada um com anexos_resultado); prescricao de d.prescricao.{orientacoes_gerais,retorno_dias,itens}; evolucoes/anexos/documentos copiados diretos.

4. CADASTRO COMPLEMENTAR: useEffect em [form.paciente_id] chama GET /pacientes/{id} e GET /tutores/{tutor_id} (fallback GET /pacientes/{id}/tutor) e popula cadastroComplementar.{paciente,tutor}. Nao vem do payload do atendimento.

5. HISTORICO: GET /atendimentos/paciente/{id}/historico?limite=10 -> {paciente{id,nome,especie,raca,peso,nascimento}, alertas[], atendimentos[](com prescricao historica embutida), pesos[], timeline[{ano,eventos[]}]}. Timeline tambem exposta isolada em GET /atendimentos/paciente/{id}/timeline.

6. EDICAO/AUTOSAVE: qualquer setField marca dirty; autosave com debounce de 1800ms chama saveAtendimento('autosave') -> buildAtendimentoPayload(form) -> PUT /atendimentos/{id} (POST /atendimentos apenas no salvamento manual do primeiro registro). Resposta (detalhe completo) e mesclada por mergeAutoSavedFormState (mantem ...current, so casa ids/assinaturas de exames e itens de prescricao).

7. BACKEND NO SAVE: criar/atualizar_atendimento normalizam status via ATENDIMENTO_STATUS_CANONICOS (422 se fora), validam primeira conclusao (_validar_primeira_conclusao_atendimento), resolvem tutor_id e especie a partir do paciente, validam agendamento (_carregar_e_validar_agendamento_atendimento: 1 atendimento por agendamento, mesmo paciente, mesma clinica), depois _sync_exames e _sync_prescricao, commit com guard de IntegrityError, e retornam _montar_detalhe_atendimento.

8. SYNC DE EXAMES: _sync_exames faz upsert por payload.id na tabela exames (Exame de app/models/laudo.py) e DELETA todo exame do atendimento cujo id nao veio no payload, removendo tambem os anexos e os arquivos fisicos (_excluir_anexos_por_exame -> remove_atendimento_attachment_file).

9. SYNC DE PRESCRICAO: _sync_prescricao cria/atualiza 1 linha em prescricoes_clinicas por atendimento, faz upsert dos prescricoes_itens por id, deleta os ausentes e grava diffs campo a campo em prescricao_item_ajustes (7 campos monitorados).

10. UPLOAD DE ANEXO: POST /atendimentos/{id}/anexos/upload (multipart: arquivo, tipo, descricao, exame_id) -> valida extensao (.pdf/.jpg/.jpeg/.png/.webp) e 25MB, calcula sha256, monta dedupe_key 'exame:{id|none}|sha256:{hash}', grava anexos_atendimentos com origem='upload', seta url=/api/v1/atendimentos/anexos/{id}/arquivo, promove exame.status para 'Em andamento' e preenche exame.data_resultado. Retorna _serialize_anexo + campo extra 'deduplicado'. Colisao de unique index -> 200 com deduplicado=true. Link externo: POST /atendimentos/{id}/anexos (AnexoPayload, origem forcada 'externo').

11. DOCUMENTOS: GET /atendimentos/documentos/templates (retorna {templates}), POST /atendimentos/{id}/documentos (template_id -> renderiza titulo/corpo e grava status='rascunho'), PUT .../documentos/{doc_id} (aceita titulo/corpo/status em {rascunho,emitido,arquivado}), GET .../documentos/{doc_id}/pdf (gera PDF E ALTERA o registro para status='emitido' + emitido_at).

12. FINALIZACAO: finalizarAtendimento() faz saveAtendimento('manual') e depois POST /atendimentos/{id}/finalizar {tipo_horario: comercial|plantao}. Backend adquire lock (pg_advisory_xact_lock / BEGIN IMMEDIATE no sqlite), revalida conclusao, valida agenda (nao terminal, servico_id, clinica quando nao domiciliar), reaproveita OS ativa ou cria OrdemServico (numero OS{YYYYMM}{NNNN}, status 'Pendente', preco via calcular_preco_servico), marca agendamento.status='Realizado', atendimento.status='Concluido' e consulta_concluida=1, commit unico. Retorna {atendimento: detalhe, agenda:{id,status,status_anterior}|null, ordem_servico:{id,numero_os,valor_final,reutilizada}|null, mensagem}.

13. EFEITOS POS-COMMIT: _emitir_efeitos_finalizacao dispara auditoria, push de agenda/financeiro e broadcast agenda_realtime_manager (fora da transacao).

14. EXCLUSAO: DELETE /atendimentos/{id} remove atendimento e cascateia anexos/arquivos; DELETE /atendimentos/anexos/{anexo_id} remove registro + arquivo.

### Pontos de atenção (22, não verificados)

- EXAME LIBERADO NO PORTAL PODE SER REVOGADO PELO AUTOSAVE: liberar_exame_no_portal (atendimento.py:3624) grava exames.status='Liberado no portal' (PORTAL_RELEASED_STATUS) e o portal usa exatamente esse valor para autorizar acesso (portal.py:395-405, 616). Mas o frontend so conhece 3 valores e sempre reescreve status via resolveExamBackendStatus (page.tsx:925-933 -> 'Solicitado'|'Em andamento'|'Concluido'), e mergeAutoSavedFormState (page.tsx:1264) NAO reimporta status do servidor. Logo, qualquer save/autosave posterior do atendimento tende a sobrescrever 'Liberado no portal' e retirar o exame do portal. Alem disso o endpoint nao tem NENHUM caller no frontend (so o teste backend test_atendimento_portal_exam_release.py) - endpoint orfao com efeito colateral cruzado.

- EXCLUSAO SILENCIOSA DE EXAMES E ANEXOS NO AUTOSAVE: buildAtendimentoPayload filtra exames com tipo_exame vazio (page.tsx:1167) e _sync_exames deleta todo exame do atendimento que nao veio no payload, apagando tambem anexos e arquivos fisicos (atendimento.py:1646-1650 + 870-874). Se o usuario limpar o campo tipo_exame, o autosave (1800ms) apaga o exame e o PDF de resultado ja anexado, sem confirmacao.

- d.paciente / d.tutor NAO EXISTEM NO PAYLOAD: abrirAtendimento chama aplicarCadastroComplementar(d.paciente, d.tutor) (page.tsx:2516) e o fluxo de contexto chama aplicarCadastroComplementar(contexto.paciente, contexto.tutor) (page.tsx:1863), mas _montar_detalhe_atendimento so devolve paciente_nome/tutor_nome/clinica_nome (atendimento.py:1869-1871) e /contexto devolve campos planos (paciente_nome, tutor_id, tutor_nome). Ambas as chamadas recebem undefined e ZERAM o cadastro complementar. O useEffect em [form.paciente_id] (page.tsx:2484) repopula - exceto quando o paciente nao muda (abrir outro atendimento do mesmo paciente), caso em que o bloco de cadastro fica vazio.

- MISTURA DE DATETIME NAIVE E AWARE NA MESMA COLUNA timestamptz: data_atendimento novo usa datetime.now(ATENDIMENTO_LOCAL_TZ) (aware, atendimento.py:2707) enquanto created_at/updated_at, prescricao.updated_at, exame.data_solicitacao, documento.emitido_at e released_at usam datetime.now()/datetime.utcnow() (naive). Na serializacao a inconsistencia se repete: data_atendimento e data_resultado saem por _to_operational_iso (com offset -03:00) e created_at/updated_at/data_solicitacao/data_evolucao/anexos.created_at saem por _to_iso (SEM offset) - atendimento.py:552-574, 1408-1409. O frontend novo (lib/atendimento-utils.ts, parseOperationalDate) assume que string sem timezone e America/Fortaleza; se o processo do backend rodar em UTC, todos esses campos aparecem 3h adiantados. Caso mais claro: liberar_exame_no_portal usa datetime.utcnow() e devolve _to_operational_iso (atendimento.py:3653, 3684).

- FILTRO data_fim COM OFF-BY-ONE DE UM DIA: o frontend envia data_fim=`${data}T23:59:59` (page.tsx:1948) e o backend aplica data_atendimento < dt_fim + timedelta(days=1) (atendimento.py:1931). O intervalo efetivo inclui praticamente todo o dia seguinte.

- tem_prescricao=true SEM NENHUM ITEM: buildAtendimentoPayload sempre envia o objeto prescricao (mesmo com itens=[]), _sync_prescricao cria a linha em prescricoes_clinicas quando o payload nao e None (atendimento.py:1660-1666) e listar_atendimentos/historico calculam tem_prescricao apenas pela existencia da linha (atendimento.py:1985-1994, 4319). O badge de prescricao aparece para atendimentos sem medicamento algum.

- CAMPOS DE CALCULO DE DOSE SAO DESCARTADOS: PrescricaoItem no frontend tem dose_mg_kg, peso_referencia_kg, unidade_dose_calculo e concentracao_personalizada (page.tsx:342-366), mas PrescricaoItemPayload e a tabela prescricoes_itens nao possuem esses campos. Ao reabrir o atendimento, toda a memoria do calculo mg/kg e perdida (voltam para '' / 'mg'). Colisao de nome: peso_referencia_kg e number|null no payload (nivel atendimento e nivel prescricao) e string no item do formulario.

- apoio_clinico E peso_referencia_kg DO BACKEND SAO PAYLOAD MORTO: _montar_detalhe_atendimento devolve prescricao.apoio_clinico (analyze_prescription_items, com alertas de interacao, faixa de dose, volume_ml, comprimidos) e peso_referencia_kg (atendimento.py:1783-1794), mas nao ha nenhuma referencia a apoio_clinico no frontend. O calculo de dose foi reimplementado no cliente (calcularDosePrescricaoItem, page.tsx:660-677) - duas fontes de verdade divergentes para posologia.

- CONTRATO DE PROPS DO FRONTEND ANULADO: frontend/app/atendimento/components/component-props.ts contem apenas `export type LooseAtendimentoComponentProps = Record<string, any>` e todas as 12 secoes usam esse alias como tipo de props. Pior: o alias foi usado tambem como tipo de parametros de callback (ex.: AtendimentoExamesSection.tsx:149 `EXAME_FILTRO_OPCOES.map((filtro: AtendimentoExamesSectionProps) => ...)`, :438, :505; AtendimentoBibliotecasSection.tsx:102, :368) - artefato de refactor automatico que elimina qualquer verificacao de tipo entre a pagina e os componentes.

- COLUNA LEGADA atendimentos_clinicos.diagnostico: criada NOT NULL-livre pela migration 20260225_11 e nunca removida, mas ausente do modelo AtendimentoClinico. O detalhe ainda serializa uma chave 'diagnostico' calculada de diagnostico_principal (atendimento.py:1857, comentario 'Compatibilidade') e listar_atendimentos expoe 'diagnostico' em vez de 'diagnostico_principal' - dois significados para o mesmo nome (coluna morta no banco vs campo derivado na API). Mesmo padrao em medicamentos.nome_key (existe no banco legado via 20260324_18, ausente do modelo Medicamento).

- CAMPOS diagnostico_principal/secundario/diferencial NO LOOP DE UPDATE SAO CODIGO MORTO: atualizar_atendimento itera uma lista que inclui esses 3 nomes (atendimento.py:2903-2915), mas AtendimentoUpdatePayload nao os declara, entao Pydantic descarta e eles nunca chegam em `data`. Tambem nao existe caminho para atualizar prognostico isoladamente - so via o objeto diagnostico.

- DIVERGENCIA MODELO x MIGRATIONS EM INDICES (banco migrado != banco de create_all/testes). Faltam nas migrations, existem no modelo: ix_atendimentos_clinicos_{tutor_id,agendamento_id,veterinario_id,status}, ix_prescricoes_itens_medicamento_nome, ix_medicamentos_classe_terapeutica, indices de prescricao_item_ajustes.campo e .created_at, ix_exames_atendimento_id (existe na migration 20260225_11:262 mas Exame.atendimento_id nao declara index=True). Faltam no modelo, existem nas migrations: ix_anexos_atendimentos_upload_dedupe e principalmente o UNIQUE ux_anexos_atendimentos_upload_dedupe (20260404_22) - AnexoAtendimento nao tem __table_args__, logo em banco criado por create_all o guard de corrida de upload (caminho IntegrityError -> deduplicado=true) nao e exercitado. Sem indice em exames.paciente_id (usado por _montar_timeline_paciente) nem em exames.laudo_id (usado pelos joins do portal).

- MIGRATION 20260730_59 ABORTA A ESTEIRA INTEIRA SE HOUVER DUPLICIDADE: _assert_no_duplicates levanta RuntimeError antes de criar ux_atendimentos_clinicos_agendamento_unico e ux_ordens_servico_agendamento_ativa. Como o runner (migrations/runner.py:129-160) executa em ordem de nome e para na primeira falha, a presenca de 2 atendimentos ou 2 OS ativas para o mesmo agendamento bloqueia tambem a migration seguinte 20260730_60_laudos_referring_partner. Exige conciliacao previa em stage/prod.

- STATUS LEGADO FORA DO VOCABULARIO CANONICO QUEBRA O SAVE: _normalizar_status_atendimento levanta 422 para qualquer valor fora de {Triagem, Em atendimento, Aguardando exames, Retorno agendado, Concluido} (atendimento.py:278-289) e o frontend sempre reenvia form.status (vindo cru do banco). Uma linha antiga com status diferente (o default original da migration 20260225_11 era 'Em atendimento', que esta na lista, mas qualquer outro valor gravado historicamente) torna o atendimento impossivel de salvar/autosalvar.

- GET COM EFEITO COLATERAL: GET /atendimentos/{id}/documentos/{doc_id}/pdf altera o registro para status='emitido' + emitido_at + updated_at e commita (atendimento.py:2648-2651). Nao e idempotente e reordena a lista de documentos (ordenada por updated_at desc).

- STATUS DE DOCUMENTO IGNORADO NO POST: o frontend envia status no POST de documento (page.tsx:4313) mas DocumentoAtendimentoCreatePayload nao tem o campo e o backend fixa 'rascunho' (atendimento.py:2295). O valor 'arquivado', aceito no PUT, nao existe na UI. E o frontend gera emitido_at otimista com new Date().toISOString() (UTC 'Z', page.tsx:4367) enquanto o backend grava datetime.now() naive.

- CAMPO status DA TIMELINE E POLISSEMICO: _montar_timeline_paciente coloca em 'status' valores heterogeneos por tipo de evento - atendimento.status, evolucao.responsavel_nome, exame.prioridade no evento exame_solicitado (atendimento.py:4143), exame.status no exame_resultado, anexo.tipo no anexo e laudo.status no laudo. O tipo TimelineEvento no frontend (page.tsx:216-223) declara apenas status: string, sem distincao.

- VOCABULARIOS DE TRIAGEM DIVERGEM DOS COMENTARIOS DO MODELO E NAO SAO VALIDADOS: modelo documenta mucosas 'rosadas, palidas, ictericas, cianoticas' e hidratacao 'normal, desidratado, desidratado++' (atendimento_clinico.py:42-43), o frontend oferece MUCOSAS com 'Hiperemicas' extra e HIDRATACAO 'Normal/Desidratado leve/moderado/grave' (page.tsx:548-549). Nem TriagemPayload nem o banco validam - texto livre. Idem prognostico (String livre no banco, 3 opcoes na UI) e anexos.tipo (a UI oferece imagem/radiografia/ultrassom/documento/outro, mas o upload de resultado de exame grava tipo='resultado_exame', page.tsx:3991 e 4020, valor ausente de qualquer lista).

- CAMPOS SERIALIZADOS SEM CONTRAPARTIDA NO TIPO DO FRONTEND (extras ignorados, sem erro mas sem contrato): anexos.atendimento_id e o 'deduplicado' do upload nao estao no type Anexo (page.tsx:132-146); AtendimentoResumo nao declara especie nem created_at, ambos retornados por listar_atendimentos (atendimento.py:2001, 2013); CatalogoExame e PainelExame nao declaram clinic_id, retornado por catalogo_exame_to_dict/painel_exame_to_dict. Inversamente, 'nascimento' no historico vs 'data_nascimento' em /pacientes/{id} sao o mesmo dado com dois nomes.

- OPCAO 'Concluido' DESABILITADA PARA TODOS OS CASOS: AtendimentoConsultaOverviewSection.tsx:154 desabilita a opcao sempre que form.status !== 'Concluido', mas o backend so bloqueia a transicao direta quando existe agendamento_id (atendimento.py:2835-2846). Para atendimento sem agenda a UI proibe algo que a API aceita.

- escore_condicion_corpo: nome com erro de grafia (deveria ser 'condicao_corporal') propagado por modelo, migration 20260227_01, schema TriagemPayload, serializador e tipo Triagem do frontend - qualquer correcao exige migration + schema + FE em conjunto.

- exames.tipo_exame TEM min_length=2 NO SCHEMA (ExameSolicitacaoPayload) mas o frontend so filtra string nao vazia; um exame com 1 caractere gera 422 no save inteiro do atendimento. E _sync_exames aceita tipo_exame vazio quando ha catalogo_exame_id, gerando exame com tipo em branco que o proximo autosave apagaria.

### Referências

- `backend/app/models/atendimento_clinico.py:7-72 (AtendimentoClinico: 5 indices compostos + ux_atendimentos_clinicos_agendamento_unico parcial; paciente_id e veterinario_id NOT NULL; tutor_id/clinica_id/agendamento_id nullable; status default 'Triagem')`
- `backend/app/models/atendimento_clinico.py:74-91 (AnexoAtendimento: tipo/url NOT NULL, origem NOT NULL default 'externo', arquivo_hash String(64), dedupe_key String(96); nenhum __table_args__)`
- `backend/app/models/atendimento_clinico.py:94-125 (DocumentoAtendimentoTemplate e DocumentoAtendimento: status String(40) default 'rascunho')`
- `backend/app/models/atendimento_clinico.py:128-152 (UploadDedupeMetrica evento String(40); UploadDedupeCleanupRun executor/status String(20))`
- `backend/app/models/atendimento_clinico.py:155-183 (EvolucaoClinica, AlertaClinico)`
- `backend/app/models/atendimento_clinico.py:186-261 (Medicamento, PrescricaoClinica, PrescricaoItem com medicamento_nome NOT NULL, PrescricaoItemAjuste)`
- `backend/app/models/laudo.py:44-84 (Exame - tabela 'exames' compartilhada com o modulo de laudos; prioridade default 'Rotina', status default 'Solicitado', atendimento_id nullable e SEM index no modelo)`
- `backend/app/models/ordem_servico.py:10-23 (indices de OS incluindo ux_ordens_servico_agendamento_ativa parcial WHERE COALESCE(status,'') <> 'Cancelado')`
- `backend/app/schemas/atendimento.py:7-23 (ExameSolicitacaoPayload: tipo_exame min_length=2/max 120, prioridade default 'Rotina', status default 'Solicitado')`
- `backend/app/schemas/atendimento.py:26-42 (PrescricaoItemPayload e PrescricaoPayload - sem campos de calculo mg/kg)`
- `backend/app/schemas/atendimento.py:108-153 (AtendimentoCreatePayload, AtendimentoUpdatePayload, AtendimentoFinalizarPayload tipo_horario)`
- `backend/app/api/v1/endpoints/atendimento.py:145-157 (ATENDIMENTO_LOCAL_TZ, ATENDIMENTO_STATUS_CANONICOS, ATENDIMENTO_TIPOS_HORARIO, ATENDIMENTO_AGENDA_STATUS_TERMINAIS, ORIGEM_ATENDIMENTO_*)`
- `backend/app/api/v1/endpoints/atendimento.py:272-352 (normalizacao de status 422, validacao de primeira conclusao, tipo_horario, origem)`
- `backend/app/api/v1/endpoints/atendimento.py:428-485 (_carregar_e_validar_agendamento_atendimento: unicidade, paciente, clinica)`
- `backend/app/api/v1/endpoints/atendimento.py:552-574 (_to_iso vs _to_operational_iso - origem da divergencia de timezone)`
- `backend/app/api/v1/endpoints/atendimento.py:1393-1412 (_map_exame - campos e tipos serializados do exame)`
- `backend/app/api/v1/endpoints/atendimento.py:1447-1470 (_serialize_anexo - download_url, preview_disponivel, atendimento_id)`
- `backend/app/api/v1/endpoints/atendimento.py:1544-1557 (_map_prescricao_item)`
- `backend/app/api/v1/endpoints/atendimento.py:1574-1652 (_sync_exames incluindo o delete de exames ausentes)`
- `backend/app/api/v1/endpoints/atendimento.py:1655-1732 (_sync_prescricao e registro de ajustes)`
- `backend/app/api/v1/endpoints/atendimento.py:1734-1897 (_montar_detalhe_atendimento - contrato completo do GET /{id})`
- `backend/app/api/v1/endpoints/atendimento.py:1900-2016 (listar_atendimentos: filtros e shape {total, items})`
- `backend/app/api/v1/endpoints/atendimento.py:2340-2379 (GET /contexto e GET /{atendimento_id})`
- `backend/app/api/v1/endpoints/atendimento.py:2648-2651 (GET de PDF de documento com efeito colateral status='emitido')`
- `backend/app/api/v1/endpoints/atendimento.py:2903-2915 (loop de update com campos que o schema descarta)`
- `backend/app/api/v1/endpoints/atendimento.py:3060-3260 (finalizar_atendimento: lock, OS, agenda, resposta)`
- `backend/app/api/v1/endpoints/atendimento.py:3624-3687 (liberar_exame_no_portal - status 'Liberado no portal', datetime.utcnow())`
- `backend/app/api/v1/endpoints/atendimento.py:3836-3860 (upload_anexo grava origem='upload' e promove exame.status)`
- `backend/app/api/v1/endpoints/atendimento.py:4058-4200 (_montar_timeline_paciente; campo 'status' polissemico na linha 4143)`
- `backend/app/api/v1/endpoints/atendimento.py:4217-4330 (historico_paciente)`
- `backend/app/services/atendimento/document_crud_service.py:17-30,80-84 (serializacao de documento; status permitidos rascunho/emitido/arquivado)`
- `backend/app/services/medication_automation.py:45-82 (medication_to_dict) e :85-175 (analyze_prescription_items - apoio_clinico nao consumido)`
- `backend/app/services/exam_catalog_service.py:52-80,273-315 (catalogo_exame_to_dict com clinic_id; contexto {seed, categorias, exames, paineis})`
- `backend/app/services/clinical_phrase_service.py:16-28,45-57 (VALID_SECOES identicas ao ClinicalFieldKey do frontend)`
- `backend/app/services/atendimento_upload_service.py:25-55 (25MB, extensoes e mimes permitidos - identicos ao frontend)`
- `backend/app/core/portal_release.py:1-13 (PORTAL_RELEASED_STATUS = 'Liberado no portal')`
- `backend/app/api/v1/endpoints/portal.py:395-405,615-616 (portal filtra por Exame.status = PORTAL_RELEASED_STATUS)`
- `backend/migrations/versions/20260225_11_atendimento_clinico_module.py:41-105 (DDL original: status default 'Em atendimento', coluna legada diagnostico TEXT) e :262 (ix_exames_atendimento_id)`
- `backend/migrations/versions/20260227_01_atendimento_clinico_pro.py:27-53 (colunas de triagem/diagnostico adicionadas NULL; backfill status='Triagem')`
- `backend/migrations/versions/20260315_12_atendimento_clinico_intelligence.py:47-90 (colunas de farmacologia) e :96-140 (prescricao_item_ajustes)`
- `backend/migrations/versions/20260316_15_atendimento_uploads_exames.py:22-45 (exame_id, caminho_arquivo, origem NOT NULL DEFAULT 'externo')`
- `backend/migrations/versions/20260319_16_prescricao_item_apresentacao.py:20-35 (apresentacao_selecionada)`
- `backend/migrations/versions/20260322_17_atendimento_especie.py:20-33 (especie)`
- `backend/migrations/versions/20260404_21_atendimento_upload_hash_dedupe.py:20-40 (arquivo_hash + index composto)`
- `backend/migrations/versions/20260404_22_atendimento_upload_race_guard.py:20-93 (dedupe_key, backfill e UNIQUE ux_anexos_atendimentos_upload_dedupe ausente do modelo)`
- `backend/migrations/versions/20260501_33_atendimento_documentos_templates.py:104-230 (DDL de documentos + 6 templates seed e 6 indices)`
- `backend/migrations/versions/20260730_59_atendimento_agenda_transactional_finalization.py:70-105 (NOVA: guard de duplicidade + 2 unique indices parciais)`
- `backend/migrations/versions/20260222_04_exames_schema_alignment.py:18-35 e 20260324_19_exames_schema_drift_compat.py:26-140 (drift legado de exames; DROP NOT NULL em Postgres deixando tipo_exame/status potencialmente nulos)`
- `backend/migrations/versions/20260513_36_critical_composite_indexes.py:81-99 (indices compostos de atendimentos_clinicos)`
- `backend/migrations/runner.py:129-160 (execucao sequencial por nome, para na primeira falha)`
- `frontend/app/atendimento/page.tsx:104-540 (todos os tipos do modulo: Triagem, Diagnostico, Evolucao, Anexo, DocumentoAtendimento, ExameSolicitacao, PrescricaoItem, AtendimentoResumo, Medicamento, AtendimentoForm)`
- `frontend/app/atendimento/page.tsx:541-551 (STATUS_ATENDIMENTO, MUCOSAS, HIDRATACAO, PROGNOSTICO, ESCALA_ECC)`
- `frontend/app/atendimento/page.tsx:687-704 (emptyExam com prioridade 'Rotina' e status 'Solicitado')`
- `frontend/app/atendimento/page.tsx:920-933 (resolveExamFlowStatus / resolveExamBackendStatus - vocabulario de 3 status)`
- `frontend/app/atendimento/page.tsx:1064-1121 (hydrateExam e hydrateFormFromDetail)`
- `frontend/app/atendimento/page.tsx:1142-1209 (buildAtendimentoPayload - contrato exato enviado ao backend)`
- `frontend/app/atendimento/page.tsx:1226-1295 (buildPrescriptionMergeKey e mergeAutoSavedFormState - mantem estado local sobre o do servidor)`
- `frontend/app/atendimento/page.tsx:1863 e 2516 (aplicarCadastroComplementar com d.paciente/d.tutor inexistentes)`
- `frontend/app/atendimento/page.tsx:1948-1951 (data_fim T23:59:59) e 3805-3818 (mergeUploadedAnexo espelha status/data_resultado localmente)`
- `frontend/app/atendimento/components/component-props.ts:1 (LooseAtendimentoComponentProps = Record<string, any>)`
- `frontend/app/atendimento/components/AtendimentoExamesSection.tsx:149,438,505 e AtendimentoBibliotecasSection.tsx:102,368 (alias de props usado como tipo de callback)`
- `frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx:143-166 (select de status com 'Concluido' desabilitado)`
- `frontend/app/atendimento/components/AtendimentoDocumentosSection.tsx:479-490 (opcoes de tipo de anexo)`
- `frontend/lib/atendimento-utils.ts:1-73 (MODIFICADO: ATENDIMENTO_OPERATIONAL_TIME_ZONE America/Fortaleza, parseOperationalDate assume -03:00 para strings sem timezone, localInputToOperationalIso)`
- `frontend/lib/atendimento-clinical-notes.ts:1-57 (ClinicalFieldKey - 11 secoes identicas a VALID_SECOES do backend)`


---

## Testes e specs — cobertura real vs. prometida

<sub>`mapa:testes` · agente `af3ba2cc91c495ddf`</sub>

### Resumo

Mapeamento de TESTES e SPECS do modulo de Atendimento Clinico, lido no estado ATUAL do disco (working tree com ~819 linhas nao commitadas em atendimento.py, +9 no model, +8 no schema, mais a migration nova 20260730_59).

RESULTADO REAL DO PYTEST: o comando pedido literalmente FALHA por ambiente — "cd backend && python -m pytest tests/ -k atendimento -q --no-header" retorna "(eval):1: command not found: python". Nao existe binario "python" no PATH (so /usr/bin/python3 e o venv do projeto em backend/venv). Reexecutado com o interpretador correto: "cd /Users/martiniano/fortcordis-v2/backend && ./venv/bin/python -m pytest tests/ -k atendimento -q --no-header" => 62 passed, 454 deselected, 25 warnings in 3.59s. Zero falhas; os 25 warnings sao todos deprecations genericas (Pydantic V1 @validator, FastAPI on_event, declarative_base), nada especifico do modulo. Rodei tambem os 5 arquivos adjacentes que o filtro "-k atendimento" NAO captura (test_upload_dedupe_metrics_endpoint, test_upload_dedupe_cleanup_service, test_clinical_phrase_service, test_exam_catalog_service, test_tutor_complementar_persistencia): 20 passed. E test_migration_ci_cycle.py: FALHA, por causa externa ao Atendimento (detalhado nos pontos de atencao).

INVENTARIO DE TESTES: 11 arquivos test_atendimento_*.py = 58 testes. Os outros 4 dos 62 vem de test_agenda_busca_periodo_filtros, test_agenda_resumo_financeiro, test_agenda_sugestao_janela_operacional e test_fiscal_exportacao_consolidada (casam com "atendimento" por nome de teste/parametro, nao sao do modulo).
- transactional_finalization (12): commit unico, rollback por prontuario incompleto e por preco zero, idempotencia (mesma OS), OS cancelada nao bloqueia nova OS ativa, agenda terminal 409, paciente divergente 409, finalizacao sem agenda, 2a criacao para mesmo agendamento 409, bloqueio de "Realizado" e de "Desfazer realizado" pela Agenda legada, bloqueio de reabertura isolada.
- transactional_finalization_migration (3): upgrade cria os 2 indices unicos parciais; upgrade aborta com RuntimeError diagnostico sem apagar atendimentos duplicados; idem sem cancelar OS ativas duplicadas.
- upload_service (14) + upload_endpoint (6): dedupe_key, sha256 estavel, allowlist extensao/MIME, octet-stream com extensao valida, mismatch, limite exato e acima, 201 novo, 200 dedupe por precheck, 200 dedupe por IntegrityError (race), 400 tipo, 413 tamanho, 400 vazio, rejeicao antes de tocar o storage.
- clinical_lifecycle (8): criacao vazia como Concluido = 422 sem gravar, 1a transicao vazia preserva estado, conclusao valida normaliza "Concluído"->"Concluido" e marca consulta_concluida=1, legado concluido segue editavel, flags explicitas de triagem, status desconhecido 422, serializacao operacional America/Fortaleza sem deslocamento, contexto da agenda devolve inicio operacional.
- pdf_auth (6): access_token na query = 400 (mesmo com bearer valido), sem credencial = 401 com WWW-Authenticate, bearer invalido = 401, bearer valido = User, cookie valido = User, usuario inativo = 403.
- documentos (4): render de template com contexto, tutor atual sobrepondo tutor historico, re-render de rascunho nao editado no PDF, PDF com layout FortCordis (%PDF + >1000 bytes).
- portal_exam_release (2): liberar ECG importado normaliza tipo/categoria e publica; sem PDF = 422.
- custom_exam_panels (1): CRUD completo (criar/listar/atualizar/excluir logico) com codigo custom_*.
- patient_prescription_history (1): 2 receitas independentes por atendimento + exatamente 2 SELECTs (sem N+1).
- list_n_plus_one (1): listagem carrega exames e prescricao em lote (1 count + 1 distinct).

SPECS: 18 diretorios docs/specs/atendimento-* + 2 arch (arch-be-01-modularizar-atendimento-for37, arch-fe-01-modularizar-atendimento-for39). O que as specs prometem: (a) ciclo clinico com barreira minima de conclusao e horario operacional estavel; (b) fronteira transacional de finalizacao Atendimento+Agenda+OS atomica e idempotente, com indices unicos parciais; (c) documentos clinicos com templates, variaveis de contexto e PDF; (d) CRUD de paineis customizados de exames; (e) endurecimento de upload (allowlist, limite, dedupe por hash, race guard por dedupe_key unico, metricas de dedupe, retencao e auto-cleanup admin-only com lock, batch, jitter, timeout e alerta de 3 falhas); (f) PDF header-only sem access_token na URL; (g) fluxo longitudinal de prescricao com copia de receita historica; (h) lista com filtros de periodo/clinica/status/busca e paginacao; (i) UX: toasts, progresso, cancelamento, guarda de duplicidade no cliente, item manual de prescricao; (j) modularizacao (extracao de services no backend e de utilitarios no frontend).

Verifiquei a implementacao no codigo: NAO encontrei nenhum RF de spec sem implementacao visivel. Tudo que as specs prometem tem contraparte no disco (endpoints /paineis, /frases-clinicas, /documentos/templates, /documentos, /finalizar, /upload-metrics/dedupe[/cleanup][/status], filtros e paginacao em listar_atendimentos, services em app/services/atendimento/, painel_service com 422/403, template inativo 422, render que preserva variavel desconhecida, sucessoPopup/uploadProgressByKey/uploadAbortControllersRef/uploadSignature/prescricaoEditorManualAberto no page.tsx, "Concluido" desabilitado no seletor, Agenda tentando status operacional primeiro e so redirecionando no 409). O deficit real esta em COBERTURA DE TESTE, nao em implementacao.

### Fluxo

1. 1. Entrada pela Agenda ou pela lista: GET /atendimentos/contexto?agendamento_id=N devolve paciente, clinica, vinculo e inicio ja normalizado para -03:00 (America/Fortaleza). Abrir a tela com paciente_id/agendamento_id nao cria atendimento automaticamente (NFR-002 da lifecycle-foundation).

2. 2. Criacao: POST /atendimentos valida status canonico (Triagem, Em atendimento, Aguardando exames, Retorno agendado, Concluido), normaliza acentuacao/caixa, respeita triagem_concluida/consulta_concluida explicitos e rejeita agendamento_id ja usado com 409 informando o ID do prontuario existente.

3. 3. Preenchimento clinico: triagem, consulta, exames (catalogo + paineis customizados via /paineis), prescricao (banco de medicamentos + frases clinicas), documentos (templates com {{paciente_nome}}, {{tutor_nome}}, {{veterinario_nome}}, {{crmv}}), anexos e evolucoes. Autosave via PUT /atendimentos/{id}.

4. 4. Upload de anexo: POST /atendimentos/{id}/anexos/upload -> valida vazio (400), tipo/MIME por allowlist pdf/jpg/jpeg/png/webp (400), tamanho 25MB (413); calcula sha256, monta dedupe_key 'exame:<id|none>|sha256:<hash>'; precheck por hash devolve 200 com deduplicado=true sem gravar arquivo; colisao de indice unico (atendimento_id, origem, dedupe_key) faz rollback, remove o arquivo recem-gravado e tambem devolve 200 deduplicado. Cada caminho grava evento em upload_dedupe_metricas (upload_novo / dedupe_precheck / dedupe_collision).

5. 5. No cliente, antes do POST: assinatura em memoria bloqueia clique duplo com aviso neutro; AbortController por uploadKey permite cancelar; uploadProgressByKey mostra percentual (fallback indeterminado sem 'total'); assinatura e controller sao limpos no finally.

6. 6. Liberacao de exame no portal: POST /atendimentos/exames/{id}/portal/liberar exige PDF de resultado anexado (senao 422), normaliza ECG -> Eletrocardiograma/Cardiologia e move o exame para o status liberado.

7. 7. Finalizacao (fluxo transacional novo, ainda NAO commitado): a UI salva o conteudo atual, pede tipo_horario (comercial|plantao) e chama POST /atendimentos/{id}/finalizar. O backend adquire lock (pg_advisory_xact_lock no Postgres), faz SELECT FOR UPDATE do atendimento, revalida a barreira clinica minima (queixa + ao menos uma avaliacao + ao menos uma conclusao/conduta), valida agenda (mesmo paciente, base operacional compativel, servico e clinica presentes, status nao terminal), reutiliza OS ativa ou cria exatamente uma nova com preco calculado (>0, senao 422), marca Atendimento=Concluido + consulta_concluida=1 e Agenda=Realizado, tudo em UM commit; qualquer excecao antes do commit faz rollback total.

8. 8. Pos-commit: _emitir_efeitos_finalizacao registra auditoria (ATENDIMENTO_FINALIZADO ou ATENDIMENTO_FINALIZACAO_REPETIDA + AGENDAMENTO_REALIZADO_POR_ATENDIMENTO), publica status_changed no realtime da Agenda e dispara push de agenda e de OS gerada; falhas nesses efeitos sao apenas logadas.

9. 9. Guardas de reversao: a Agenda legada nao pode marcar Realizado nem Desfazer realizado num agendamento com Atendimento clinico vinculado (409 orientando o fluxo clinico); a reabertura isolada do Atendimento vinculado tambem retorna 409. A UI da Agenda tenta primeiro a transicao operacional normal e so redireciona para /atendimento quando o backend confirma o vinculo com 409.

10. 10. Leitura longitudinal: GET /atendimentos/paciente/{id}/historico traz cada atendimento com prescricao e itens carregados em lote (2 SELECTs). Copiar receita historica reconstroi itens sem id e sem historico_ajustes, mantendo apenas paciente_id/especie/clinica_id no formulario novo; 'Abrir original' volta ao registro de origem com confirmacao se houver rascunho.

11. 11. Listagem/painel de casos: GET /atendimentos com search, status, clinica_id, data_inicio, data_fim, limit e skip; exames e prescricao agregados em lote; UI mostra total e 'Pagina X de Y' com anterior/proxima bloqueando nos limites.

12. 12. PDFs (prescricao, solicitacao de exames, documento clinico): autenticacao header-only via _autenticar_usuario_pdf — access_token na query = 400, sem/invalido = 401 com WWW-Authenticate, usuario inativo = 403; rascunho de template ainda nao editado e re-renderizado com o contexto atual na geracao do PDF.

### Pontos de atenção (18, não verificados)

- ZERO infraestrutura de teste no frontend. frontend/package.json tem apenas dev/build/analyze/start/lint; nao existe nenhum arquivo *.test.*, *.spec.* nem diretorio __tests__ em todo o frontend. Consequencia: TODOS os criterios de aceitacao de UI das specs sao validados so por eslint, npm run build e checklist manual. As specs inteiramente frontend ficam sem nenhuma cobertura automatizada: atendimento-toast-feedback, atendimento-prescricao-item-manual, atendimento-upload-progress, atendimento-upload-cancel-retry, atendimento-upload-duplicate-guard, atendimento-lista-filtros-paginacao e arch-fe-01-modularizar-atendimento-for39. Em atendimento-lista-filtros-paginacao a unica evidencia registrada em verify.md e literalmente 'Revisao funcional do diff'.

- test_migration_ci_cycle.py FALHA de verdade (1 failed, 20 passed na minha execucao): migrations/runner.py:150 chama migration.upgrade(connection, dialect_name) enquanto backend/migrations/versions/20260730_58_portal_partner_auth.py:22 define upgrade(connection) — TypeError: upgrade() takes 1 positional argument but 2 were given. Confirma exatamente o 'bloqueio externo' descrito no verify.md da agenda-transactional-finalization: o arquivo e do pacote Portal, nao do Atendimento, e a migration nova do Atendimento (20260730_59...:70) tem a assinatura correta upgrade(connection, dialect=None). Efeito colateral relevante: como o ciclo quebra na 58, a migration 59 do Atendimento nunca chega a ser aplicada pelo runner real — os dois indices unicos parciais sao validados apenas pelo teste unitario que importa o modulo e chama upgrade() direto em SQLite, nunca no ciclo up/down/up.

- _emitir_efeitos_finalizacao e SEMPRE mockado (unico ponto: test_atendimento_transactional_finalization.py:133). Ou seja, o NFR-006 (auditoria da finalizacao, com a distincao ATENDIMENTO_FINALIZADO vs ATENDIMENTO_FINALIZACAO_REPETIDA), a publicacao realtime na Agenda e os dois pushes (agenda e OS gerada) nao tem nenhuma cobertura — inclusive a heuristica finalizacao_repetida, que compara status anterior + os_reutilizada e e facil de errar.

- _montar_detalhe_atendimento tambem e sempre substituido por lambda nos testes de lifecycle e de finalizacao. A serializacao real do detalhe do atendimento (o payload que a UI consome) nunca e exercida por teste.

- A barreira clinica minima e testada por apenas um caminho. _validar_primeira_conclusao_atendimento (atendimento.py:298) aceita alternativas por grupo — avaliacao entre anamnese/exame_fisico/dados_clinicos e conclusao entre diagnostico_principal/secundario/diferencial/plano_terapeutico — mas os testes so usam exame_fisico + diagnostico_principal. Anamnese, dados_clinicos, diagnostico_secundario, diagnostico_diferencial e plano_terapeutico como unico preenchimento do grupo nunca sao exercitados.

- _normalizar_tipo_horario_atendimento (atendimento.py:341) nao tem teste. A spec da finalizacao diz explicitamente 'Valores permitidos: comercial e plantao' e lista 422 para tipo de horario ausente/invalido, mas todos os testes passam apenas 'comercial' ou 'plantao'.

- NFR-002 (concorrencia) so e coberto de forma indireta. _adquirir_lock_finalizacao (atendimento.py:369) usa pg_advisory_xact_lock, que e no-op em SQLite — e toda a suite roda em SQLite temporario. Nenhum teste simula duas finalizacoes concorrentes; a idempotencia testada e sequencial. O mesmo vale para o lock advisory do upload_dedupe_cleanup_service (o proprio verify.md admite: 'testes atuais nao simulam multi-instancia real em Postgres').

- RF-003 da finalizacao promete validar que Atendimento e Agenda pertencem ao mesmo paciente E a uma base operacional compativel. O teste cobre apenas o paciente divergente (test_paciente_incompativel_preserva_estado). Clinica/base operacional divergente nao tem teste, embora _carregar_e_validar_agendamento_atendimento (atendimento.py:428) receba clinica_id.

- Casos de borda de atendimento-documentos-clinicos declarados na spec e sem teste, apesar de implementados: CB-001 template inativo (atendimento.py:2281, 422), CB-002 documento sem titulo/corpo (atendimento.py:2288, 422) e CB-003 variavel desconhecida permanecer no texto (document_context_service.py:127-133, regex que devolve o match quando a chave nao existe). Tambem sem teste: CA-002 (editar e salvar o corpo do documento) e CA-004 (criar/editar/desativar/reativar templates) — sao endpoints backend, perfeitamente testaveis, mas a evidencia no verify.md e apenas 'UI adicionada' e 'endpoints de CRUD/reativacao'.

- Casos de borda de atendimento-custom-exam-panels-crud sem teste, apesar de implementados: CB-001 payload sem exames retorna 422 (painel_service.py:71) e CB-002 painel nao customizado retorna 403 (painel_service.py:102). O unico teste do arquivo e o caminho felizde ponta a ponta. Alem disso o spec.md esta 'Status: done' enquanto o verify.md do mesmo pacote esta 'Status: in-progress' com risco residual 'validacao manual em stage ainda pendente'.

- Casos de borda de atendimento-pdf-auth-hardening sem teste explicito: CB-002 (header Authorization sem prefixo Bearer) e CB-003 (JWT valido para email de usuario inexistente). CB-004 (usuario inativo) esta coberto. Vale notar que o teste usa um _FakeDB, nao a sessao real.

- test_atendimento_portal_exam_release.py (2 testes) nao tem spec correspondente em docs/specs/atendimento-*/. E um comportamento de dominio do Atendimento (normalizacao de tipo de exame + exigencia de PDF antes de publicar) rastreado apenas pelas specs de Portal/Laudos. Inverso do problema usual: teste sem spec.

- Inconsistencia de rastreabilidade em atendimento-documentos-clinicos: o verify.md tem uma linha 'CA-005 | regressao' que nao existe no spec.md (a spec vai so ate CA-004). A matriz cita um criterio inexistente.

- Os comandos de validacao registrados nos verify.md nao sao reproduzives neste ambiente: apontam para caminhos Windows (backend/.venv/Scripts/python em upload-hardening, pdf-auth, upload-backend-dedupe, upload-race-guard, upload-dedupe-observability; backend/venv/Scripts/python.exe em upload-dedupe-retention-automation) e para 'python -m unittest' (binario 'python' inexistente aqui). Os numeros historicos citados (17, 19, 20, 23, 27 testes) tambem nao batem mais com a contagem atual (14 + 6 = 20 nos dois arquivos de upload).

- Numeros de suite completa afirmados no verify.md da finalizacao (506 testes backend, 92 testes de Agenda) NAO foram verificados por mim — rodei apenas o subconjunto -k atendimento (62) mais 6 arquivos adjacentes. A suite total tem 516 testes coletados (62 + 454 deselected).

- atendimento-toast-feedback e a unica spec do modulo sem NENHUMA aprovacao de release: verify.md com Status in-progress, CA-001..CA-004 e NFR-001..NFR-003 marcados 'pendente', e as tres caixas de decisao (stage/producao/nao aprovado) todas desmarcadas — apesar de o codigo estar no disco (sucessoPopup aparece 20 vezes em page.tsx). Formalmente e feature em producao sem gate fechado.

- Todo o pacote da finalizacao transacional esta NAO COMMITADO (atendimento.py +819/-32 linhas, atendimento_clinico.py, schemas/atendimento.py, page.tsx, AtendimentoConsultaOverviewSection.tsx, atendimento-utils.ts, agenda.py, agenda/page.tsx, mais a migration 20260730_59 e os 2 arquivos de teste novos, todos untracked/modified). As specs atendimento-agenda-transactional-finalization e atendimento-clinical-lifecycle-foundation estao marcadas 'Status: done' com verify.md completo, mas nada disso passou por commit — o risco de perda ou de divergencia com o que foi homologado e alto.

- atendimento-upload-hardening e atendimento-upload-progress continuam 'Aprovado para stage' e nao aprovados para producao nos verify.md, embora o registro operacional pos-release do upload-hardening (secao 9) descreva correcao de client_max_body_size aplicada em producao — ou seja, a feature esta em producao com o gate documental em stage.

### Referências

- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3060 — finalizar_atendimento, a transacao unica (lock, FOR UPDATE, validacao, OS, commit unico, rollback em HTTPException/IntegrityError/SQLAlchemyError)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2947 — _emitir_efeitos_finalizacao (auditoria + realtime + push): sempre mockado nos testes, cobertura zero`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:298 — _validar_primeira_conclusao_atendimento: grupos alternativos de avaliacao/conclusao parcialmente exercitados`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:341 — _normalizar_tipo_horario_atendimento: sem teste`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:369 — _adquirir_lock_finalizacao (pg_advisory_xact_lock): no-op em SQLite, nunca exercitado`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:428 — _carregar_e_validar_agendamento_atendimento: divergencia de clinica/base operacional sem teste`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:1900 — listar_atendimentos com data_inicio, data_fim, clinica_id, search, status, limit, skip (spec atendimento-lista-filtros-paginacao, zero teste)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:2281 e :2288 — CB-001 (template inativo 422) e CB-002 (sem titulo/corpo 422) de atendimento-documentos-clinicos: implementados, sem teste`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3529, :3597, :3616 — /upload-metrics/dedupe, /cleanup e /cleanup/status (cobertos por test_upload_dedupe_metrics_endpoint.py e test_upload_dedupe_cleanup_service.py, que o filtro -k atendimento NAO captura)`
- `/Users/martiniano/fortcordis-v2/backend/app/api/v1/endpoints/atendimento.py:3742 — upload_anexo: dedupe precheck, IntegrityError -> 200 deduplicado, remocao do arquivo orfao`
- `/Users/martiniano/fortcordis-v2/backend/app/services/atendimento/painel_service.py:71 e :102 — CB-001 (422 sem exames) e CB-002 (403 painel nao customizado) de atendimento-custom-exam-panels-crud: implementados, sem teste`
- `/Users/martiniano/fortcordis-v2/backend/app/services/atendimento/document_context_service.py:127 — substituir/regex que preserva variavel desconhecida (CB-003), sem teste`
- `/Users/martiniano/fortcordis-v2/backend/migrations/versions/20260730_59_atendimento_agenda_transactional_finalization.py:70 — upgrade(connection, dialect=None), assinatura CORRETA para o runner`
- `/Users/martiniano/fortcordis-v2/backend/migrations/versions/20260730_58_portal_partner_auth.py:22 — upgrade(connection): assinatura ERRADA, causa real da falha de test_migration_ci_cycle.py (arquivo do pacote Portal, nao do Atendimento)`
- `/Users/martiniano/fortcordis-v2/backend/migrations/runner.py:150 — migration.upgrade(connection, dialect_name), o call site que quebra na migration 58`
- `/Users/martiniano/fortcordis-v2/backend/tests/test_atendimento_transactional_finalization.py:133 — patch.object(atendimento, "_emitir_efeitos_finalizacao"): o ponto exato onde a auditoria sai da cobertura`
- `/Users/martiniano/fortcordis-v2/backend/tests/test_atendimento_transactional_finalization_migration.py:75 — MIGRATION.upgrade(connection) chamado direto, fora do ciclo real do runner`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/page.tsx:3709 — finalizarAtendimento (RF-011: salva, envia tipo_horario, exibe OS criada/reutilizada), sem teste automatizado`
- `/Users/martiniano/fortcordis-v2/frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx:148 e :155 — RF-012/CA-009: seletor desabilitado quando Concluido+agenda e opcao Concluido desabilitada como transicao manual`
- `/Users/martiniano/fortcordis-v2/frontend/app/agenda/page.tsx:1433 — RF-013/CA-011/CA-012: so o 409 do backend redireciona para o fluxo clinico de finalizacao`
- `/Users/martiniano/fortcordis-v2/frontend/package.json:2 — scripts sem qualquer runner de teste (dev, build, analyze, start, lint), origem da ausencia total de cobertura de UI`
- `/Users/martiniano/fortcordis-v2/docs/specs/atendimento-agenda-transactional-finalization/verify.md — secao 'Bloqueio externo observado' que eu confirmei experimentalmente`
- `/Users/martiniano/fortcordis-v2/docs/specs/atendimento-toast-feedback/verify.md — unica spec do modulo com todas as caixas de decisao de release desmarcadas`
- `/Users/martiniano/fortcordis-v2/docs/specs/atendimento-lista-filtros-paginacao/verify.md — evidencia registrada apenas como revisao de diff, sem teste`
- `/Users/martiniano/fortcordis-v2/docs/specs/atendimento-custom-exam-panels-crud/verify.md:4 — Status in-progress divergindo do spec.md:6 Status done`

