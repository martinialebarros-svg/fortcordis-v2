# Especificacao

## Contrato

- RF-001: somente `AgendamentoUpdate` aceita `confirmar_alteracao_retroativa: bool = false`. E controle da requisicao, nao coluna do agendamento.
- RF-002: PUT rejeita a flag verdadeira para qualquer usuario sem papel admin (403), antes de alterar o objeto. Admin recebe 422 se nao houver mudanca efetiva do inicio ou se o novo inicio estiver no futuro. Datetimes sao comparados no fuso local ja usado pela agenda.
- RF-003: sem a flag, preservar PRIMEIRA_SAIDA_INVIAVEL (409). Apenas para admin corrigindo inicio para o passado, acrescentar `confirmavel: true` e `confirmacao: confirmar_alteracao_retroativa`. Nao-admin, criacao e horario futuro continuam sem essa opcao.
- RF-004: a confirmacao valida dispensa somente a primeira saida na validacao do PUT; funcionamento, sobreposicao, regras de origem, reservas, alteracao de servico iniciado e conflitos com vizinhos continuam validados. Override de rota e confirmacoes de reserva continuam independentes.
- RF-005: registrar sucesso na auditoria normal e em AGENDAMENTO_HORARIO_RETROATIVO_CONFIRMADO, com autor, id, intervalo anterior/novo e identificacao da primeira saida dispensada. Nao criar excecao persistente de deslocamento por essa flag.
- RF-006: modal compartilhado da agenda reconhece o contrato especifico do servidor apenas em edicao por admin; pede confirmacao, cancela sem reenviar se recusada e reenvia flag somente apos aceite. Preservar confirmacoes independentes de reserva expirada e deslocamento (ate quatro tentativas: original + tres confirmacoes). Falha repetida nao causa novo aceite de deslocamento.

## Criterios de aceitacao

| ID | Criterio |
| --- | --- |
| CA-001 | Em banco sintetico, agenda 06h-16h, relogio 12h de 03/11/2026: editar 08h-09h30 para 07h-08h30 bloqueia inicialmente; admin confirmado salva e audita sem criar excecao de rota. |
| CA-002 | Nao-admin com flag recebe 403; sem flag recebe bloqueio nao confirmavel; sem autenticacao recebe 401. Falhas nao persistem horario nem auditoria de sucesso. |
| CA-003 | Horario futuro, inicio inalterado e criacao nao recebem dispensa por esta flag; override de rota existente sozinho nao dispensa primeira saida. |
| CA-004 | Slot ocupado, dia fechado e deslocamento insuficiente com proximo atendimento permanecem bloqueados. |
| CA-005 | Modal oferece confirmacao apenas ao admin elegivel, reenvia apos aceite, preserva dados no cancelamento/erro e nao reenvia indefinidamente. |
| CA-006 | Regressao de primeira saida, deslocamento persistente/regional, alteracao de servico, concorrencia e funcionamento continua passando. |
| CA-007 | Apos autorizacao e integracao/deploy em stage, homologar a correcao usando registros sinteticos com perfil admin, negar a mesma confirmacao a nao-admin e conferir a auditoria persistida. |

## Limites

Nao ha migracao, mudanca de papel, endpoint administrativo novo, deploy, merge ou alteracao real do atendimento 1801. O codigo precisa ser revisado, integrado em stage e validado no ambiente remoto antes de promover a producao pelo fluxo stage -> main.

CA-007 permanece pendente ate a homologacao remota; o gate de promocao deve bloquea-lo ate la.
