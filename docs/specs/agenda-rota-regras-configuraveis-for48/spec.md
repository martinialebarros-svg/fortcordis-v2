# Spec - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: done

## 1) Escopo funcional

Adicionar suporte completo a regras configuraveis de rota da agenda, incluindo persistencia em configuracoes, normalizacao backend/frontend, aplicacao das regras na sugestao de horarios, politicas de oferta por distancia/frequencia e painel visual em Configuracoes para ajuste operacional (incluindo overrides por clinica).

## 2) Requisitos funcionais (RF)

- RF-001: sistema deve armazenar `agenda_rota_regras` em `configuracoes` com defaults e normalizacao.
- RF-002: sugestao de horarios deve considerar limiares de margem segura, deslocamento maximo por trecho vizinho, desvio maximo de insercao e preferencia por clinicas proximas da base no fim de rota.
- RF-003: sugestao de proximidade deve retornar politica aplicada (dias preferenciais, sinalizacao de distancia/frequencia e override por clinica).
- RF-004: UI de Configuracoes deve permitir editar base, thresholds, politicas e overrides por clinica, incluindo o limite `max_neighbor_travel_min` como "Deslocamento maximo entre atendimentos".
- RF-005: em slots fechados da agenda, apenas perfil `admin` pode abrir excecao diretamente pelo clique no slot (agenda normal e fullcalendar), com confirmacao explicita.
- RF-006: estado de agenda fechada/janela especial deve ficar explicito tambem na visao Lista da agenda para todo o periodo selecionado.
- RF-007: acoes de navegacao para clinica devem oferecer Waze e Google Maps nas interfaces de agenda.
- RF-008: Agenda (visao Lista) deve permitir receber pagamento da OS vinculada ao agendamento, com selecao de forma de pagamento, alinhando o fluxo da FullCalendar.
- RF-009: regras de transicao de status, fluxo de acoes e formas de pagamento devem ser compartilhadas entre Agenda Lista e FullCalendar para evitar divergencia funcional.
- RF-010: Agenda Lista e FullCalendar devem permitir alternancia direta de visao mantendo contexto operacional minimo (data e status via query string), reduzindo ruptura de fluxo.
- RF-011: leitura inicial do contexto por query string nas telas de Agenda deve ser compatível com build de producao do Next.js sem exigir boundary adicional de suspense.
- RF-012: mensagens do assistente inteligente de proximidade devem detalhar a composicao do deslocamento usando nomes das clinicas envolvidas (anterior/destino/posterior), indicar quando nao ha agendamento vizinho e mostrar a data com dia da semana para evitar ambiguidade operacional.
- RF-013: `safe_margin_min` deve ser aplicado como margem obrigatoria no salvamento e nas sugestoes de horario; slots com folga menor que `duracao_deslocamento + safe_margin_min` devem ser rejeitados.
- RF-014: `max_neighbor_travel_min` deve bloquear salvamento e sugestoes quando o deslocamento entre a clinica candidata e o vizinho imediato anterior ou posterior exceder o limite configurado, mesmo que exista folga suficiente no relogio.
- RF-015: quando um agendamento ja registrado foi mantido como ancora operacional por excecao previa, um slot livre adjacente a essa ancora pode ser sugerido e salvo se o deslocamento real ate a ancora couber na folga do slot e estiver dentro de `nearby_anchor_max_travel_min`; nesse caso, o trecho nao adjacente herdado da excecao pode ser desconsiderado apenas para ranking/limite de proximidade, sem liberar slots que nao encostem na ancora.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): manter fluxo de sugestao com cache local de duracoes por request.
- NFR-002 (seguranca/permissoes): reaproveitar permissoes existentes de configuracoes; sem ampliacao de superficie publica.
- NFR-003 (observabilidade): erros de conflito manter codigo semantico `CONFLITO_DESLOCAMENTO` com detalhes de diagnostico.
- NFR-004 (seguranca/permissoes): usuarios nao-admin nao podem executar abertura rapida de excecao; interface deve manter estado de bloqueio para papeis sem permissao.
- NFR-005 (ux operacional): sinalizacao de fechamento precisa ser visivel sem clique em slot para reduzir risco de agendamento indevido.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /configuracoes`, `PUT /configuracoes`, `GET /agenda/configuracao`, `POST /agenda/sugestoes-horario`, `POST /agenda/sugestao-proximidade`
- Metodo: GET/PUT/POST
- Payload: incluir bloco `agenda_rota_regras` normalizado.
- Resposta: incluir metadados de regras aplicadas e politica de oferta nos endpoints de sugestao.
- Resposta (proximidade): incluir detalhamento textual de deslocamento total e sua composicao por trecho, quando houver agendamentos vizinhos.

### Banco/migracoes

- Tabelas/colunas afetadas: `configuracoes.agenda_rota_regras` (TEXT).
- Indices/constraints: nao aplicavel.
- Migracao necessaria: sim.

### Frontend

- Telas afetadas: `Configuracoes > Funcionamento da Agenda`, `Agenda` e `Agenda FullCalendar`.
- Estados de UI: leitura/escrita, formularios de thresholds/politicas, lista dinamica de overrides e fluxo de abertura rapida de excecao para `admin`.
- Regras de exibicao/erro: manter modo somente leitura para perfis sem permissao de configuracao, manter slots fechados sem acao para perfis nao-admin e exibir alertas de agenda fechada/janela especial no modo Lista.

## 5) Compatibilidade e rollout

- Backward compatibility: defaults cobrem cenarios sem configuracao previa.
- Feature flag (se houver): nao.
- Estrategia de rollback: remover commit e ignorar coluna nova sem impacto em leitura legada.

## 6) Criterios de aceitacao (CA)

- CA-001: salvar configuracoes persiste e retorna `agenda_rota_regras` sem quebrar os campos antigos.
- CA-002: agendamento com insercao claramente ineficiente ou com trecho vizinho acima do limite retorna conflito com dados de diagnostico.
- CA-003: painel de configuracoes expõe edicao de regras, incluindo `max_neighbor_travel_min`, e overrides por clinica.
- CA-004: ao clicar em slot fechado, `admin` consegue abrir excecao e seguir para criacao de agendamento; nao-admin permanece bloqueado.
- CA-005: visao Lista mostra claramente dias fechados e janelas especiais dentro do periodo aplicado.
- CA-006: agenda normal e fullcalendar exibem opcao de abrir rota no Google Maps alem do Waze.
- CA-007: Agenda Lista permite recebimento de pagamento da OS quando existir vinculo e status pendente, atualizando o estado para pago apos confirmacao.
- CA-008: menus de status e recebimento de pagamento exibem o mesmo comportamento funcional entre Agenda Lista e FullCalendar, usando a mesma base de regras compartilhada.
- CA-009: botao de alternancia entre Lista e FullCalendar preserva data (e status quando aplicavel), abrindo a outra visao no mesmo contexto.
- CA-010: `npm run build` do frontend conclui sem erro de prerender relacionado a leitura de query string na rota `/agenda`.
- CA-011: mensagem de proximidade exibe composicao do deslocamento com nomes das clinicas e total estimado, incluindo indicacao explicita de ausencia de agendamento anterior/posterior e data com dia da semana.
- CA-012: com `safe_margin_min=5`, um slot com 40 minutos de folga para deslocamento de 39 minutos deve ser bloqueado no salvamento e nao deve aparecer nas sugestoes.
- CA-013: com `max_neighbor_travel_min=45`, um trecho vizinho de 62 minutos deve ser bloqueado no salvamento e nao deve aparecer nas sugestoes, mesmo quando a folga de agenda for suficiente.
- CA-014: com `max_neighbor_travel_min=30`, um slot livre imediatamente antes/depois de uma ancora ja registrada deve ser sugerido e validado quando o trecho ate a ancora for proximo (ex.: 5 min) e couber na folga, mesmo que o outro vizinho do dia tenha sido mantido por excecao e exceda o limite por trecho.

## 7) Casos de borda

- CB-001: clinicas sem coordenadas validas devem cair em comportamento seguro sem bloquear indevidamente.
- CB-002: listas de dias a frente com valores invalidos devem ser normalizadas para fallback valido.

## 8) Fora de escopo

- Solver de roteirizacao multi-parada com otimizaçao global.
- Geocodificacao automatica de endereco para lat/lng nesta entrega.
