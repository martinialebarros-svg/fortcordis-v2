# Spec - whatsapp-customer-service-window

Data: 2026-08-16
Responsavel: Martiniano + Codex
Status: local-implemented

## Requisitos funcionais

- RF-001: uma mensagem recebida registra `last_inbound_at` usando o timestamp assinado do webhook da Meta, com horario de recebimento como fallback.
- RF-002: a janela expira exatamente 24 horas depois de `last_inbound_at`.
- RF-003: a listagem de conversas e o historico da conversa retornam o inicio, o vencimento e o estado da janela.
- RF-004: a interface mostra `Pode responder normalmente ate <data e hora>` enquanto a janela esta aberta.
- RF-005: a interface mostra que a janela encerrou e orienta o uso de modelo aprovado depois do prazo.
- RF-006: sem mensagem recebida, a interface informa que precisa aguardar o contato da clinica.
- RF-007: o campo e o botao de texto livre ficam bloqueados fora da janela.
- RF-008: o backend rejeita texto livre fora da janela com HTTP `409` e codigo `CUSTOMER_SERVICE_WINDOW_CLOSED` antes de persistir ou chamar a Meta.
- RF-009: eventos de status de mensagens enviadas nao reabrem nem prorrogam a janela.
- RF-010: a migracao preenche `last_inbound_at` de conversas historicas a partir da mensagem recebida mais recente.

## Requisitos nao funcionais

- NFR-001 (fail closed): data ausente ou invalida mantem a resposta livre bloqueada.
- NFR-002 (fonte de verdade): a protecao do backend nao depende do relogio do navegador.
- NFR-003 (tempo): o navegador reavalia o prazo periodicamente sem recarregar a pagina.
- NFR-004 (privacidade): o novo estado nao persiste conteudo nem telefone adicional.
- NFR-005 (compatibilidade): claim, unclaim, leitura do historico e envio por template permanecem disponiveis fora da janela.

## Criterios de aceitacao

- CA-001: antes de 24 horas o indicador fica aberto e o compositor habilitado.
- CA-002: exatamente no vencimento o indicador fica encerrado e o compositor bloqueado.
- CA-003: conversa sem mensagem recebida nao permite texto livre.
- CA-004: tentativa direta pela API fora da janela recebe `409` sem criar mensagem pendente.
- CA-005: nova mensagem recebida atualiza o prazo com o timestamp do provedor.
- CA-006: testes TypeScript, frontend, lint, build e guardrail SDD passam.
