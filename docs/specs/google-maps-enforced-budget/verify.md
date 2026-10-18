# Verificação — Google Maps

Status: implementação e verificações locais concluídas; validação de stage em andamento. Produção não autorizada.

## Evidências de entrada

- Billing fornecido pelo usuário, projeto `fortcordis-maps`, SKU Routes: Compute Routes Essentials: julho 13.062 / R$ 90,12; agosto 22.806 / R$ 372,45.
- Evidência original privada permanece fora do Git; diagnóstico sanitizado em `audit.md`.
- Código base stage `74f0148c`; produção observada readonly `9137d39f`.

## Casos obrigatórios

- Cancelamento/abort do popup não executa ação; confirmação não é lembrada.
- Concorrência de reservas em SQLite e PostgreSQL descartáveis; persistência/replay.
- Limite por ação/dia/mês e custo conservador por SKU; política automática própria.
- Chamadas reais dos três providers interceptadas antes do transporte; zero rede nos testes.
- Erros de orçamento não causam fallback Distance Matrix nem heurística.
- Cache: uma consulta sintética renova registro expirado de valores idênticos e outra sessão reutiliza sem consulta.
- Permissões administrativas, vínculo de usuário/payload e política ausente/expirada.
- Build/lint/frontend, regressões backend, migração aditiva, guardrail SDD.

## Limites da prova

Mocks provam envio/cancelamento no transporte da aplicação, não tarifação real do Google. Nenhum teste deve usar chave paga. Métricas antigas não trazem action_id; o defeito do cache é reproduzido, mas não autoriza atribuir toda a diferença histórica à mesma causa. Quotas nativas só podem ser consideradas ativas após verificar o projeto no console. SQLite comprova invariantes do núcleo; com a transação operacional aberta, sua contenção de escrita pode bloquear uma segunda reserva por indisponibilidade do ledger. A pilha operacional ativada usa PostgreSQL; sucesso integrado com múltiplas pernas deve ser provado nesse banco.

## Resultados locais observados em 18/10/2026

- Núcleo de orçamento: 40 testes em SQLite e PostgreSQL 16 descartável, todos aprovados. Incluem seis processos simultâneos com teto de duas reservas e oito claims concorrentes com somente um aceito, replay/reabertura de conexão, saldo inicial imutável, permissões, falha do banco, limite por SKU, mensal independente do diário e política automática própria.
- Providers/cache: cinco testes aprovados, incluindo bloqueio antes dos três transportes, ausência de fallback pago, mensagens sem chave/endereço, TTL renovado para valores idênticos e override manual preservado.
- Agenda e IA transacionais: dez casos aprovados com HTTP/DB sintéticos, duas pernas e bloqueio na segunda, cobrindo clínica/domicílio, reativação, reabilitação, preparação/aprovação pela IA e sucesso. Reload confirma ausência de alteração parcial; validação de oferta propaga bloqueio financeiro em vez de anunciar indisponibilidade genérica.
- Integração PostgreSQL real: dois casos adicionais exercitam API Agenda, middleware, preview/confirmação, duas pernas de rota e ledger real. Sucesso confirma negócio/cache juntos; limite na segunda perna mantém agendamento original e cache vazio, com a primeira reserva financeira persistente após reconexão. Um observador independente prova reserva anterior ao transporte e ausência de commit parcial. Zero Google.
- Suíte backend integral final: 1.962 testes em 96,477 s, 44 skips, zero falhas, mais os dois testes integrados PostgreSQL adicionados ao fechamento. Uma execução anterior usou SECRET_KEY sintética com menos de 32 caracteres e falhou em três fixtures do worker; corrigido o ambiente de teste, sem reduzir a validação de segurança. A suíte final usou chave sintética válida.
- Frontend: 1.042 testes Vitest e 23 testes Node aprovados; build de produção, TypeScript e ESLint aprovados. Casos focados incluem cancelamento/abort, erro de preflight, replay, fila de popups, config explícita e geocodificação apenas por ação.
- Migrações: ciclo up/down/up SQLite aprovado; migração 99 testada idempotente/aditiva e RLS/revogação PostgreSQL.
- Navegador real com API sintética e hosts externos bloqueados: cancelar em Logística e Agenda enviou zero operações originais; popup acima do modal real; painel desktop/mobile sem overflow horizontal nem erro JS. Rodapé mobile corrigido e revalidado: Cancelar/Confirmar permanecem visíveis. Evidência em `evidence/browser-synthetic.json` e imagens `.synthetic.png`.

O JSON de auditoria agregada foi coletado readonly de produção/stage. Nenhuma chave, endereço ou dado clínico foi versionado.
