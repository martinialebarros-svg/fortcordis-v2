# Plan - Persistencia dos documentos clinicos

1. Correlacionar banco PostgreSQL ativo, auditoria, logs HTTP e deploy; comparar arquivos implantados com a base local isolada.
2. Reproduzir a sequencia de exclusao e 404 com dados sinteticos.
3. Preservar documentos por arquivamento/restauracao; exigir versao em alteracoes, arquivo/restauracao e geracao PDF; serializar concorrencia com lock no PostgreSQL.
4. Auditar criacao, alteracao, emissao, arquivo e restauracao na transacao do documento. Bloquear exclusao do atendimento que possui documentos.
5. Publicar timestamps UTC explicitos na API dos documentos; mostrar emitido_at no cartao. Validar PDF recebido e conservar URL para abrir/baixar novamente.
6. Testar API com sessoes independentes, concorrencia PostgreSQL e interface real com banco local descartavel; baixar, abrir, extrair texto e renderizar PDF sintetico.
7. Alinhar SDD e registrar limites de verificacao. Entregar diff local sem commit, push ou deploy.
