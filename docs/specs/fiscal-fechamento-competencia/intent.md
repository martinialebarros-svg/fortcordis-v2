# Intenção — fechamento fiscal por competência

Data: 2026-10-14. Autorizado pelo usuário nesta conversa: implementar competência, exclusão de canceladas, prevenção de duplicidade e pacote para contador; publicar somente em stage para teste.

Preparar informações de serviços para o contador, mantendo mês de prestação separado da geração do arquivo e do recebimento. Não emitir NFS-e, calcular tributação presumida, enviar mensagens ou publicar em produção.

Riscos: data da OS pode refletir agendamento ou upload; exportação histórica não prova encaminhamento; concorrência pode repetir serviços. Preservar histórico legado, exigir conferência das datas e persistir pacote/seleção com exclusividade por OS.
