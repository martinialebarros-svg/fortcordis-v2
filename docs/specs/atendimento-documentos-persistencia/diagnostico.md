# Diagnostico tecnico - persistencia de documentos

A investigacao somente de leitura do banco ativo PostgreSQL, da auditoria e dos logs HTTP identificou exclusao definitiva por DELETE autenticado, anterior ao salvamento posterior do atendimento. A aba original conservou o documento em memoria e tentou salvar o ID ja removido, recebendo 404.

A criacao, as atualizacoes e a resposta HTTP 200 do PDF foram reconstruidas a partir dos logs. A auditoria preservava o corpo excluido, comparado integralmente com o arquivo local fornecido. Conta autenticada nao identifica qual aba, gesto ou pessoa originou a acao. HTTP 200 nao comprova download ou abertura do arquivo original.

O template era um recurso independente e permaneceu cadastrado. Nao foi observada exclusao pelo PUT do atendimento nem desvinculacao do documento para outro atendimento.

## Deploy e persistencia

Os cinco arquivos investigados coincidiram com o commit implantado. A restauracao dos arquivos de runtime e o reinicio do backend antecederam as operacoes posteriores de atualizacao, emissao e exclusao. O SQLite legado restaurado pelo script nao era o banco ativo desse fluxo. Nao houve evidencia de restauracao do PostgreSQL como causa do desaparecimento.

A cronologia detalhada, os identificadores internos, os dados da conta e o hash do texto clinico permanecem exclusivamente na pasta local privada de evidencias. Nao integram este repositorio publico.

## Riscos confirmados e reproducao

- Exclusao definitiva sem recuperacao pela interface.
- Ausencia de precondicao de versao contra estados antigos.
- Auditoria em transacao separada e best-effort, sem eventos proprios de criacao e emissao.
- Datas UTC sem offset, interpretadas no frontend como horario de Fortaleza; cartao de emitido mostrava updated_at.
- URL do PDF revogada imediatamente, mensagem que confundia emissao com entrega e fallback de sucesso sem ID confirmado na listagem.

Antes da correcao, um documento emitido sintetico foi removido pelo service em banco descartavel; nova sessao encontrou zero documentos e tentativa pelo ID retornou 404. O diagnostico completo foi preservado localmente; nenhum registro real foi restaurado ou reemitido.
