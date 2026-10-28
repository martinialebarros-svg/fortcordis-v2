# Plan — tutores-rotina-agil

1. Partir do stage atual em branch propria, preservando entregas paralelas.
2. Acrescentar tabelas privadas para eventos, contatos, origens, decisoes de
   duplicidade, idempotencia e reversoes; migracoes 103 e 104 aditivas e idempotentes.
3. Centralizar confirmacao rastreavel e repeticao segura em servico de tutor,
   incluindo a criacao inline em Pacientes. Nao confirmar pelo booleano legado.
4. Integrar seletor opcional em Novo paciente, campos adicionais recolhidos na
   Agenda e revisao sob demanda na complementacao existente do Atendimento.
5. Oferecer fila, candidatos explicados e contatos alternativos em Tutores;
   permitir reversao somente quando o estado posterior nao mudou.
6. Validar fixtures sinteticas SQLite/PostgreSQL, contrato UI/API, regressoes,
   tipos, lint, build e SDD. Publicacao requer etapa propria autorizada.

Falha segura: rollback unico de criacao, mesclagem e reversao; retry devolve o
resultado anterior quando chave e payload coincidem. Mudancas posteriores
bloqueiam reversao e exigem analise especifica, preservando todos os registros.
