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
