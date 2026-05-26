# Spec - agenda-sugestoes-janela-operacional-for49

Data: 2026-05-18  
Responsavel: Martiniano + Codex  
Status: in-progress

## 1) Escopo funcional

Ajustar o backend de sugestao de agendamento para respeitar integralmente agenda fechada e janelas operacionais no fluxo do assistente inteligente, evitando sugestoes em datas/horarios indisponiveis por configuracao.

## 2) Requisitos funcionais (RF)

- RF-001: validacao de ancora em D+2 nao deve considerar agendamentos de datas fechadas.
- RF-002: endpoint `POST /agenda/sugestao-proximidade` deve ignorar agendamentos fora da janela operacional ativa do dia.
- RF-003: endpoint `POST /agenda/sugestao-proximidade` deve ignorar agendamentos em datas fechadas (feriado, dia inativo ou excecao inativa).
- RF-004: endpoint `POST /agenda/sugestoes-horario` deve desconsiderar agendamentos legados fora da janela operacional ativa ao calcular vizinhos e score.
- RF-005: resposta de `POST /agenda/sugestao-proximidade` deve expor metrica de itens ignorados por janela (`itens_ignorados_janela`) para observabilidade operacional.
- RF-006: endpoint `POST /agenda/sugestoes-horario` nao deve sugerir horarios retroativos quando a data selecionada for o dia atual; deve partir do proximo slot futuro valido.
- RF-007: para clinica classificada como distante + baixa frequencia sem ancora valida em D+2, `POST /agenda/sugestao-proximidade` deve restringir sugestao as `datas_preferenciais` da politica e evitar proposta fora desse conjunto.
- RF-008: validacao de ancora D+2 deve ter fallback operacional quando matriz de deslocamento estiver indisponivel, aceitando ancora se houver ao menos 1 agendamento pre-agendado na mesma cidade/UF e dentro da janela operacional.
- RF-009: no ranking de candidatos de proximidade, priorizar menor deslocamento antes da preferencia de data para evitar sugerir data "preferencial" com desvio excessivo quando houver opcao operacionalmente superior.
- RF-010: ancoras de proximidade devem considerar status operacionais alem de pre-agendados (ex.: `Em atendimento`), excluindo apenas estados inelegiveis (`Cancelado`, `Faltou`).
- RF-011: fallback de ancora sem matriz deve ser resiliente a inconsistencias de cidade/UF, com normalizacao textual e agrupamento geografico por proximidade (cluster local).
- RF-012: `POST /agenda/sugestao-proximidade` nao deve considerar ancora em horario passado, inclusive quando a data-base da consulta for o dia atual.
- RF-013: suite automatizada de agenda deve usar datas de cenario estaveis para evitar flakiness temporal no CI quando regras de "horario passado" evoluirem.
- RF-014: `POST /agenda/sugestao-proximidade` deve validar aderencia operacional com a mesma logica de `POST /agenda/sugestoes-horario`, ignorando ancoras sem slot viavel na data sugerida.
- RF-015: `POST /agenda/sugestoes-horario` nao pode sugerir slot ocupado quando houver drift legado entre `agendamentos.data/hora` e `agendamentos.inicio/fim`; a deteccao de conflito deve normalizar o intervalo local pelo `data+hora` do agendamento.
- RF-016: `POST /agenda/sugestoes-horario` nao pode perder conflito por causa de `agendamentos.data` legado invalido (ex.: `DD/MM/YYYY`); a selecao de ocupacao deve considerar tambem a data derivada de `inicio`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (compatibilidade): manter contrato atual dos endpoints sem quebrar consumidores existentes.
- NFR-002 (performance): reutilizar cache de janelas por data na filtragem para evitar repeticao de parse/lookup.
- NFR-003 (seguranca funcional): sugestao nunca deve induzir a criacao de agendamento em periodo explicitamente fechado pela configuracao da agenda.
- NFR-004 (consistencia de UX): mensagem do card "Assistente inteligente" deve ser coerente com o resultado do "Assistente guiado" para a mesma clinica/data.

## 4) Contratos tecnicos

### API

- Endpoint: `POST /agenda/sugestao-proximidade`
- Alteracao: resposta inclui campo adicional `itens_ignorados_janela`, passa a filtrar candidatos por janela operacional e recebe parametros opcionais de contexto operacional (`servico_id`, `duracao_minutos`, `intervalo_minutos`, `limite_sugestoes_operacionais`) para validar slot viavel antes de sugerir ancora.

- Endpoint: `POST /agenda/sugestoes-horario`
- Alteracao: conflitos de ocupacao passam a considerar toda agenda ativa do dia; a filtragem por janela operacional fica restrita ao calculo de vizinhos/score e heuristicas de rota.

### Backend

- Arquivo principal: `backend/app/api/v1/endpoints/agenda.py`.
- Funcoes novas: cache de janela por data e filtro de agendamentos por janela operacional.

## 5) Compatibilidade e rollout

- Backward compatibility: respostas antigas seguem validas; novo campo e opcional para consumidores.
- Rollout: habilitacao imediata via deploy de backend; sem migracao de banco.
- Rollback: revert do commit da FOR-49.

## 6) Criterios de aceitacao (CA)

- CA-001: `_existe_ancora_proxima_no_dia` retorna `False` quando o dia esta fechado, mesmo havendo agendamento gravado.
- CA-002: `POST /agenda/sugestao-proximidade` ignora ancora fora da janela ativa e seleciona apenas ancoras validas.
- CA-003: quando houver descartes por agenda fechada/janela, resposta de proximidade retorna `itens_ignorados_janela > 0`.
- CA-004: `POST /agenda/sugestoes-horario` nao usa legados fora da janela ativa para distorcer vizinhos/score, mas continua bloqueando conflito real de ocupacao no mesmo horario.
- CA-005: para data de hoje, `POST /agenda/sugestoes-horario` retorna apenas slots futuros (com arredondamento para o proximo intervalo configurado).
- CA-006: clinica distante/baixa frequencia sem ancora D+2 nao recebe sugestao de proximidade em D+2; resposta preserva `datas_preferenciais` para oferta em D+3/D+4.
- CA-007: quando nao houver duracao confiavel na matriz para D+2, mas existir ao menos 1 agendamento pre-agendado na mesma cidade/UF, a politica deve considerar `ancora_d2=true` e permitir oferta em D+2.
- CA-008: com candidatos em datas diferentes, o ranking deve priorizar menor deslocamento antes de preferencia de data quando a politica nao exigir restricao absoluta por `datas_preferenciais`.
- CA-009: `_existe_ancora_proxima_no_dia` deve considerar `Em atendimento` como ancora valida quando dentro da janela operacional.
- CA-010: fallback de ancora sem matriz deve reconhecer cluster local por proximidade geografica mesmo com cidade/UF divergente no cadastro.
- CA-011: `POST /agenda/sugestao-proximidade` nao retorna sugestao baseada em ancora passada no mesmo dia; quando nao houver ancora futura valida, deve retornar `sugerir=false`.
- CA-012: testes de janela/sugestao mantem resultado deterministico ao longo do tempo (nao quebram apenas pela data corrente do runner).
- CA-013: `POST /agenda/sugestao-proximidade` deve descartar ancora quando `POST /agenda/sugestoes-horario` nao encontra slot operacional aderente a essa ancora na mesma data.
- CA-014: se existir agendamento com `data/hora` ocupando um slot e `inicio/fim` driftado para outro dia, o assistente nao deve ofertar esse slot como livre.
- CA-015: se existir agendamento com `inicio` no dia e `data` legado em formato invalido, o assistente ainda deve bloquear esse horario como ocupado.

## 7) Casos de borda

- CB-001: dia com excecao ativa de janela reduzida (ex.: 08:00-12:00).
- CB-002: dia com excecao inativa (agenda fechada total).
- CB-003: periodo de busca contendo agendamentos antigos fora da janela atual apos mudanca de configuracao.
- CB-004: clinicas no mesmo bairro/regiao com cadastro textual divergente de cidade/UF.
- CB-005: data-base igual ao dia atual com ultimo atendimento ja encerrado (evitar oferta de horario vencido).
- CB-006: ancora com deslocamento "bom", mas sem nenhum slot operacional viavel na data (janela curta, conflito de folga ou desvio).
- CB-007: agendamento legado com coluna `data` fora do padrao ISO (ex.: `26/05/2026`) deve continuar bloqueando o slot real ocupado.

## 8) Fora de escopo

- Fluxo guiado completo do wizard de secretaria (FOR-50).
- Politicas de aceite/recusa com UI de excecao (FOR-51).
