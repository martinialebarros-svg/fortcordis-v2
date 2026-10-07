# Spec - agenda-novo-agendamento-searchable-selects

Data: 2026-04-18  
Atualizacao: 2026-10-06 (busca remota de animais)
Responsavel: Codex  
Status: validado localmente

## 1) Escopo funcional

Este ciclo melhora a experiencia do modal de novo agendamento em `frontend/app/agenda/NovoAgendamentoModal.tsx`. Os campos de `Tutor`, `Animal` e `Clinica` deixam de depender apenas de `select` nativo e passam a usar selecao pesquisavel no frontend. A busca do campo `Animal` tambem consulta a API quando o termo digitado pode identificar um paciente ou tutor fora dos 1.000 itens inicialmente carregados. A entrega mantem os endpoints e payloads de agendamento existentes, sem alterar suas regras de negocio.

## 2) Requisitos funcionais (RF)

- RF-001: o campo `Tutor` deve permitir busca textual por nome e, quando disponivel, por telefone.
- RF-002: o campo `Animal` deve permitir busca por nome ou ID do animal ou tutor em toda a carteira ativa via API. Especie e raca continuam pesquisaveis localmente nos itens ja carregados.
- RF-003: o campo `Animal` deve continuar respeitando o filtro existente por tutor selecionado.
- RF-004: o campo `Clinica` deve exibir endereco explicito nas opcoes do dropdown.
- RF-005: o campo `Clinica` deve permitir busca textual por nome da clinica e pelo endereco formatado.
- RF-006: um animal retornado pela busca remota deve poder ser selecionado e manter os IDs corretos de paciente e tutor ao salvar o agendamento ou a reserva.
- RF-007: ao selecionar um tutor, o campo `Animal` deve consultar os animais desse tutor para exibir os que nao estavam entre os 1.000 inicialmente carregados, mesmo sem termo digitado.
- RF-008: ao editar agendamento vinculado a animal fora da carga inicial, o modal deve hidratar o animal pelo ID e mostrar o cadastro selecionado sem apagar campos ja editados.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a busca local permanece para os itens ja carregados; a busca remota de `Animal` deve ter debounce, limitar os resultados retornados e ignorar respostas obsoletas, sem requisicao a cada tecla digitada.
- NFR-002 (seguranca/permissoes): preservar autenticacao e permissao; a listagem e a busca continuam retornando apenas pacientes ativos. A consulta por ID pode mostrar um paciente ja vinculado a agendamento em edicao, mesmo que ele tenha sido desativado depois. O filtro opcional `tutor_id` estende a listagem sem alterar a resposta para clientes atuais.
- NFR-003 (observabilidade): a mudanca deve ser validavel por lint do arquivo alterado e por inspecao do diff.

## 4) Contratos tecnicos

### API

- Endpoint: `/tutores?limit=1000`, `/pacientes?limit=1000`, `/clinicas?limit=1000`; busca adicional em `GET /pacientes` com `search` e `limit=50`, ou com `tutor_id` e paginas de `limit=100` apos escolher um tutor; `GET /pacientes/{id}` para hidratar a selecao durante edicao
- Metodo: `GET`
- Payload: sem body; `search` aceita nome ou ID de animal ou tutor pelo contrato existente de pacientes; `tutor_id` filtra exatamente o tutor escolhido
- Resposta: sem mudanca; a tela reutiliza `items`, inclusive `id`, `tutor_id`, `tutor`, `especie` e `raca`

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma
- Indices/constraints: nenhum
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/agenda/NovoAgendamentoModal.tsx`
- Estados de UI: aberto/fechado do dropdown, filtro de busca textual, busca remota em andamento, item selecionado, lista vazia
- Regras de exibicao/erro:
  - `Tutor` mostra busca por nome/telefone
  - `Animal` mostra busca local por nome/tutor/especie/raca e acrescenta resultados remotos para nome/ID de animal ou tutor
  - `Animal` continua mostrando somente animais do tutor selecionado quando esse filtro esta ativo
  - `Clinica` mostra nome e endereco formatado
  - se nao houver correspondencia, o componente informa que nenhum item foi encontrado

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; o envio do formulario e os IDs selecionados continuam os mesmos
- Feature flag (se houver): nao
- Estrategia de rollback: reverter a alteracao do modal e o filtro opcional `tutor_id` da listagem, preservando os dados existentes

## 6) Criterios de aceitacao (CA)

- CA-001: o usuario consegue localizar tutor digitando nome ou telefone no modal.
- CA-002: o usuario consegue localizar animal digitando nome do animal ou nome do tutor, mantendo o filtro por tutor quando aplicavel.
- CA-003: o dropdown de clinica mostra endereco legivel em cada opcao.
- CA-004: o item de clinica selecionado continua exibindo o endereco apos a escolha.
- CA-005: o arquivo alterado passa em `eslint` sem erros.
- CA-006: com mais de 1.000 pacientes ativos, um animal ausente da carga inicial aparece apos buscar pelo nome e pode ser selecionado.
- CA-007: ao selecionar esse animal, o formulario envia `paciente_id` e `tutor_id` correspondentes ao cadastro encontrado.
- CA-008: ao selecionar um tutor com animal fora da carga inicial, esse animal aparece no seletor sem precisar digitar um termo.
- CA-009: durante a edicao, um animal fora da carga inicial aparece selecionado apos `GET /pacientes/{id}`, com tutor correto e sem perder observacoes alteradas antes da resposta.

## 7) Casos de borda

- CB-001: tutores sem telefone continuam selecionaveis e pesquisaveis por nome.
- CB-002: clinicas sem endereco completo devem continuar aparecendo, com fallback textual coerente.
- CB-003: quando um tutor e selecionado, animais de outros tutores nao devem aparecer na lista filtrada.
- CB-004: uma resposta atrasada de busca anterior nao deve substituir os resultados da busca mais recente.

## 8) Fora de escopo

- Navegacao por paginas ou scroll infinito dentro do dropdown de `Animal`.
- Alterar o cadastro rapido de clinica, tutor ou animal neste ciclo.
