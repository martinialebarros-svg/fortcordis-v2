# Intent - Persistencia dos documentos clinicos

Data: 2026-09-29. Escopo autorizado: diagnostico somente de leitura em producao e correcao local, sem publicacao nem recuperacao de registros reais.

Investigar o desaparecimento do documento de um atendimento sem presumir a causa. Preservar documentos apos salvar o atendimento e entre sessoes, impedir que estados antigos sobrescrevam ou apaguem conteudo, e distinguir PDF gerado de arquivo efetivamente recebido pelo navegador.

A investigacao identificou exclusao explicita do documento investigado (DELETE 200 e evento de auditoria), seguida do salvamento do atendimento e tentativas com ID antigo. O arquivo fornecido corresponde integralmente ao corpo na auditoria. Nao foi observada uma exclusao causada pelo PUT do atendimento.

A correcao substitui remocao definitiva por arquivamento reversivel, mantem vinculo e texto, introduz precondicao de versao e auditoria transacional, e corrige datas e tratamento do download. Conteudo clinico, templates e dados de producao nao sao modificados.
