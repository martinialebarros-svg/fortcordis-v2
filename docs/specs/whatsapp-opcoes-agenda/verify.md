# Verificação

## Preparação local de 13/09/2026

Tipagem explícita do histórico sintético em `AppointmentQueue.test.tsx` para
corrigir TS2322 na checagem completa de tipos. Sem alteração de código de runtime,
envios externos ou configuração. Revalidação aprovada: `npx tsc --noEmit`,
`npm test` (293 Vitest, incluindo os 7 testes de AppointmentQueue, e 9 Node),
lint, build e guardrail SDD. Nenhuma publicação nesta etapa.

Validação local concluída em 10/09/2026, sem mensagens reais, mudança de produção ou criação de agendamento real.

- Backend completo: 1275 testes e 278 subtestes aprovados; 7 ignorados conforme condições do ambiente. Log: `/private/tmp/fortcordis-opcoes-full-final.log`.
- Central WhatsApp: 73 testes aprovados em quatro arquivos, incluindo preferência destacada e invalidação após correção. Log: `/private/tmp/fortcordis-opcoes-ui-final.log`.
- Build frontend com lint e tipos aprovado. Log: `/private/tmp/fortcordis-opcoes-build.log`.
- `git diff --check` e guardrail SDD sobre arquivos modificados e novos aprovados.
- Casos de banco isolado usam SQLite; mecanismos existentes de lock e deduplicação são reaproveitados. Não foi executado teste em produção nesta etapa.


Cobertura: composição/duração exata, escopo, limite de três opções, corte de risco, preferências relativas, oferta não enviada/editada, expiração, número inválido, negação, pedido com atendente, complemento pendente, serviço alterado e reconsulta sem slot. Integração com motor real da agenda em SQLite isolado demonstra que um slot ocupado depois da oferta desaparece na revalidação. Preferência escolhida é idempotente e não altera o resumo nem vincula um agendamento. A interface destaca a escolha como sem reserva e retira o destaque após nova correção.

## Regressão da consulta de disponibilidade (25/09/2026)
- Reproduzido em produção: mensagem “Qual a disponibilidade pra eco?” gerou blocked/sem_fonte sem tentativa de ferramenta; nova pausa foi criada. Auditoria somente leitura.
- Implementado encaminhamento determinístico de perguntas curtas de disponibilidade e início explícito de pedido; sem depender do provider para esse caminho.
- Testes focados: 41 aprovados. Cobrem coleta sem promessa de horário, literal do exame, pedido anterior cancelado, comando novo pedido, ausência de chamada ao provider e rejeição de frases mistas/negações.
- Nenhuma mensagem real ou remoção de pausa nesta entrega. Publicação ainda não realizada.
- Suíte WhatsApp completa: 425 testes e 237 subtestes aprovados; 7 ignorados pelas condições do ambiente. Log `/private/tmp/whatsapp-disponibilidade-suite.log`.
- Suíte geral interrompida por `Fatal Python error: Segmentation fault`, com thread de `assistente_ia_autonomy._worker_main`/SQLAlchemy na pilha; não considerada aprovada. Log `/private/tmp/whatsapp-disponibilidade-full.log`. Causa não determinada nesta entrega.
- Guardrail SDD e `git diff --check` aprovados. Sem alterações frontend.
- Revalidação geral concluída: 1418 testes e 297 subtestes aprovados, sete ignorados conforme condições do ambiente, em 54,56 s. Executada com `FORTCORDIS_PROCESS_ROLE=api` e SQLite em arquivo temporário, seguindo a configuração de banco/perfil do CI. Log: `/private/tmp/whatsapp-disponibilidade-full-final.log`.
- A interrupção anterior não se repetiu com essa configuração. Isso não estabelece isoladamente a causa do erro nativo anterior.

## Disponibilidade natural e convite contextual (25/09/2026)

- Evidência do teste real: saudação “Bom dia” respondida e entregue às 08:57; pergunta “Qual a disponibilidade de horário pra eco” recebida às 08:58 e bloqueada por falta de fonte, com nova pausa. A variação não era reconhecida pela gramática anterior. Não houve criação de nova solicitação.
- Gramática ampliada com “de horário(s)”, disponibilidade/horários com tem/têm/há, “Vocês têm”, saudação inicial e cortesia final, sempre na mensagem integral. Exame permanece literal; negações, sintomas, perguntas de preço, datas e textos mistos não entram no atalho.
- Convite de novo pedido cancelado requer resposta enviada sem edição, recente e no mesmo escopo. “Sim” inicia coleta apenas do exame; “não” encerra o convite. ID/versão/status, agenda, tempo e resposta mais recente são revalidados. Nenhuma reserva ou pedido duplicado é criado na geração.
- Worker exercitado com geração real e transporte simulado: “sim”/“não” superam cortesia; pausa, responsável humano, janela fechada e emergência continuam impedindo o fluxo administrativo. Nenhuma chamada ao provider nessas respostas determinísticas.
- Testes focados: 60 aprovados, dois ignorados conforme condições do ambiente e 48 subtestes aprovados. Log: `/private/tmp/whatsapp-natural-focused.log`.
- Revisão independente identificou que eventos de supressão/handoff com clínica nula poderiam deixar um convite anterior acessível. A consulta agora considera a última resposta da identidade/conversa e só depois valida a clínica. Regressão aprovada para supressão, encaminhamento e bloqueio posteriores, inclusive com “quero sim”. Arquivo específico: 12 testes e 45 subtestes aprovados.
- Snapshot final: backend completo com 1431 testes e 348 subtestes aprovados, sete ignorados conforme condições do ambiente, em 54,93 s. Configuração `FORTCORDIS_PROCESS_ROLE=api` e SQLite temporário em arquivo. Log `/private/tmp/whatsapp-natural-full-final.log`.
- `git diff --check` e guardrail SDD aprovados sobre os arquivos modificados e novos.
- Nenhuma mensagem real, mudança de configuração, pausa de produção, commit ou publicação nesta etapa. Sem mudanças de frontend ou migração.
