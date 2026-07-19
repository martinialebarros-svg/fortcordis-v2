# Spec - agenda-reserva-whatsapp-manual

Data: 2026-07-19
Responsavel: Martiniano + Codex
Status: approved

## 1) Escopo funcional

Ao marcar um novo agendamento como reserva, o modal deve solicitar destinatario e prazo de confirmacao. Depois que a API confirmar a criacao, o frontend deve mostrar a mensagem pronta e permitir copia-la ou abrir o WhatsApp com o texto preenchido. O envio permanece deliberadamente manual enquanto a conta oficial aguarda aprovacao da Meta.

## 2) Requisitos funcionais (RF)

- RF-001: o fluxo deve aparecer apenas na criacao de agendamento com `marcar_como_reserva=true`.
- RF-002: a secretaria deve escolher `clinica` ou `tutor` conforme os cadastros selecionados no formulario.
- RF-003: o prazo de confirmacao deve ser obrigatorio, futuro e anterior ao inicio do atendimento.
- RF-004: a mensagem deve conter data, hora, prazo e regra de possivel liberacao do horario sem confirmacao.
- RF-005: apos salvar, a operacao deve conseguir abrir `wa.me` com telefone e mensagem preenchidos ou copiar a mensagem.
- RF-006: na ausencia de telefone, a reserva deve continuar sendo criada e o WhatsApp deve abrir sem destinatario predefinido para selecao manual.
- RF-007: prazo e tipo de destinatario devem ser registrados nas observacoes do agendamento para rastreabilidade operacional.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): o payload publico da API de agenda nao deve ganhar campos temporarios desta solucao manual.
- NFR-002 (privacidade): a mensagem nao deve expor dados clinicos nem detalhes de exames.
- NFR-003 (ux operacional): a tela deve informar que envio e liberacao continuam manuais.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /api/v1/agenda`.
- Metodo: preservado sem alteracao.
- Payload: campos temporarios de mensagem ficam somente no frontend; prazo/destinatario entram como trilha textual em `observacoes`.
- Resposta: preservada.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Telas afetadas: `frontend/app/agenda/NovoAgendamentoModal.tsx` e integracao de sucesso em `frontend/app/agenda/fullcalendar/page.tsx`.
- Estados de UI: destinatario manual, prazo de confirmacao e entrega manual pos-criacao.
- Regras de exibicao/erro: telefone ausente nao bloqueia; prazo invalido bloqueia o submit com mensagem explicita.
- Callback de sucesso: aceita opcao interna para manter o modal aberto somente durante a entrega manual da reserva.

## 5) Compatibilidade e rollout

- Backward compatibility: agendamentos normais e edicao permanecem inalterados.
- Feature flag: nao; o fluxo e condicionado ao status `Reservado`.
- Estrategia de rollback: reverter frontend e remover estes artefatos SDD.

## 6) Criterios de aceitacao (CA)

- CA-001: ao marcar reserva, aparecem destinatario e prazo com valor inicial de duas horas.
- CA-002: prazo passado ou posterior/igual ao atendimento impede salvar.
- CA-003: reserva salva apresenta mensagem pronta com data, hora e prazo.
- CA-004: `Abrir WhatsApp` usa telefone normalizado com DDI 55 quando aplicavel e texto codificado.
- CA-005: `Copiar mensagem` grava exatamente o texto apresentado.
- CA-006: telefone ausente permite abrir o compartilhamento do WhatsApp sem destinatario fixo.
- CA-007: observacoes registram prazo e destinatario sem alterar o contrato da API.
- CA-008: agendamento comum e edicao nao exibem nem acionam a entrega manual.

## 7) Casos de borda

- CB-001: reserva sem tutor permite somente clinica quando houver clinica selecionada.
- CB-002: atendimento domiciliar permite somente tutor.
- CB-003: falha de clipboard exibe orientacao sem desfazer a reserva criada.
- CB-004: fechamento da tela pos-criacao nao cria uma segunda reserva.

## 8) Fora de escopo

- Envio automatico pela Meta.
- Expiracao automatica e reabertura do slot.
- Processamento de botoes ou respostas recebidas no WhatsApp.
