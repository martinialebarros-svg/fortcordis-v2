# Spec - whatsapp-central-atendimento-ui

## Requisitos funcionais

- RF-001: a central deve exibir fila, conversa selecionada e painel de contexto
  em uma composição responsiva.
- RF-002: a fila deve pesquisar `wa_phone_number`, `subject` e o corpo da última
  mensagem, com filtros de status e atribuição.
- RF-003: cada conversa deve exibir nome/assunto quando disponível, telefone,
  última mensagem, status traduzido, atendente e última atividade.
- RF-004: a API deve retornar nome e email do atendente atribuído sem alterar o
  contrato existente de `last_agent_id`.
- RF-005: um operador deve poder alterar o status apenas para `open`, `pending`
  ou `closed`; a operação deve produzir auditoria.
- RF-006: os controles de atribuição devem usar os termos `Assumir conversa`,
  `Transferir` e `Liberar`, mantendo os endpoints de claim/unclaim existentes.
- RF-007: o compositor deve aceitar múltiplas linhas, enviar com
  `Ctrl/Cmd+Enter` e respeitar a janela de atendimento de 24 horas.
- RF-008: respostas rápidas devem apenas preencher o rascunho e nunca enviar
  automaticamente.
- RF-009: a API deve listar o catálogo local de modelos configurados com nome,
  conteúdo, quantidade/rótulos de variáveis, respostas rápidas, categoria e
  necessidade de documento.
- RF-010: a UI deve permitir preencher variáveis e visualizar o texto final do
  modelo. Durante janela aberta, o texto pode ser copiado para o compositor
  como resposta livre, deixando explícito que isso não é um envio por modelo.
- RF-011: fora da janela de 24 horas, a UI deve orientar o uso do fluxo de
  Agenda, Laudos ou Financeiro correspondente, sem contornar a política da
  Meta.
- RF-012: o backend principal deve normalizar o telefone da conversa e procurar
  correspondência exata nos números ativos de clínicas e tutores.
- RF-013: uma única correspondência direta deve resolver o tipo raiz como
  `clinica` ou `tutor`; zero correspondências deve retornar `not_found` e mais
  de uma deve retornar `ambiguous` sem seleção implícita.
- RF-014: para um vínculo resolvido, o contexto deve retornar listas limitadas
  de clínicas, tutores, pets, agendamentos relevantes e OS recentes, com nomes,
  IDs e estados operacionais, sem observações clínicas.
- RF-015: o painel lateral deve apresentar o estado do vínculo, os cadastros
  relacionados e atalhos para clínica, paciente, agenda e financeiro.
- RF-016: trocar a conversa selecionada deve cancelar logicamente respostas
  atrasadas, impedindo que o contexto de um telefone apareça em outro.

## Requisitos não funcionais

- NFR-001 (segurança): todos os endpoints permanecem sob `requireApiAuth`.
- NFR-002 (privacidade): IDs internos/Meta ficam recolhidos em detalhes
  técnicos; nenhum segredo é enviado ao frontend.
- NFR-003 (compatibilidade): `phone` continua aceito como filtro legado, embora
  a nova UI use `search`.
- NFR-004 (desempenho): listagem mantém paginação e limita a busca de conteúdo
  à última mensagem por conversa.
- NFR-005 (acessibilidade): controles possuem rótulos, foco visível e estados
  vazios/carregando compreensíveis.
- NFR-006 (responsividade): em telas menores os três painéis passam a fluxo
  vertical sem perda das ações principais.
- NFR-007 (auditoria): alteração de status grava `conversation_status_changed`
  em `audit_logs` com estado anterior e novo.
- NFR-008 (separação de dados): a resolução consulta o backend principal; o
  serviço WhatsApp não replica entidades do domínio.
- NFR-009 (determinismo): a normalização adota DDI 55 para números brasileiros
  com 10/11 dígitos e exige equivalência canônica integral.
- NFR-010 (minimização): o contrato não retorna observações, documentos,
  conteúdo clínico nem dados financeiros além do número/status/valor da OS.
- NFR-011 (desempenho): agendamentos e OS retornam listas limitadas; clínicas,
  tutores e pets relacionados são deduplicados antes da resposta.
- NFR-012 (entrega): os quality gates de stage e produção devem compilar e testar
  os contratos do serviço WhatsApp com PostgreSQL antes do deploy.

## Contratos de API

### `GET /conversations`

Novos parâmetros e campos:

- `search`: pesquisa telefone, assunto ou última mensagem;
- `assigned_agent_name` e `assigned_agent_email`;
- `last_message_from_me` e `last_message_type`.

### `PATCH /conversations/:id/status`

Corpo:

```json
{ "status": "pending" }
```

Respostas: `200` com conversa atualizada, `404` quando inexistente e `422` para
estado inválido.

### `GET /automation/templates`

Retorna somente metadados não secretos do catálogo compilado. O campo
`meta_approval_live` deve ser `null`, deixando explícito que o endpoint não
consulta a Meta em tempo real.

### `GET /api/v1/whatsapp-contexto?telefone=<numero>`

Endpoint autenticado do backend principal. Retorna:

- `resolution`: `matched`, `ambiguous` ou `not_found`;
- `match_type`: `clinica`, `tutor` ou `null`;
- `clinicas`, `tutores`, `pets`, `agendamentos` e `ordens_servico`;
- `normalized_phone`, apenas para diagnóstico do vínculo.

O endpoint é somente leitura. Em `ambiguous`, retorna apenas os candidatos
diretos e não expande agendamentos/OS.

## Critérios de aceitação

- CA-001: a busca encontra conversa por nome/assunto, telefone ou última
  mensagem e mantém paginação.
- CA-002: a tela não apresenta `claim`, `unclaim`, `wa_id` ou estados em inglês
  no fluxo principal.
- CA-003: atribuir, transferir e liberar continuam usando os locks e a auditoria
  existentes.
- CA-004: a mudança de status aceita somente os três estados previstos e gera
  auditoria.
- CA-005: texto livre fica desabilitado fora da janela de 24 horas.
- CA-006: o catálogo informa que configuração local não equivale à aprovação
  atual na Meta.
- CA-007: copiar o preview para o compositor só é possível com todas as
  variáveis preenchidas e janela aberta.
- CA-008: testes frontend, TypeScript frontend, build backend e testes de
  contratos WhatsApp passam.
- CA-009: um telefone exclusivo de clínica resolve a clínica e relaciona os
  tutores/pets presentes em agenda/OS recentes.
- CA-010: um telefone exclusivo de tutor resolve o tutor, seus pets e os
  agendamentos/OS correspondentes.
- CA-011: número duplicado retorna ambiguidade e a UI não afirma que o cadastro
  foi vinculado.
- CA-012: ao alternar a conversa, a UI não reaproveita o contexto da seleção
  anterior.
