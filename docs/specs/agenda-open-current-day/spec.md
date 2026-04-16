# Spec - agenda-open-current-day

Data: 2026-04-15  
Responsavel: Codex  
Status: done

## 1) Escopo funcional

Este ciclo ajusta a inicializacao da tela de agenda em `frontend/app/agenda/page.tsx` para que a visualizacao em lista abra no dia atual. A data inicial deixa de nascer vazia, a consulta inicial da lista passa a usar um intervalo fechado no mesmo dia e o campo de data volta para hoje se o input for limpo pelo navegador. Nenhum endpoint, payload ou contrato de backend e alterado.

## 2) Requisitos funcionais (RF)

- RF-001: ao abrir `/agenda`, a visualizacao em lista deve iniciar com a data local atual preenchida no filtro.
- RF-002: a primeira carga da lista deve buscar apenas os agendamentos do dia corrente.
- RF-003: se o campo de data ficar vazio por interacao do navegador, a tela deve restaurar a data atual para manter o estado consistente.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (performance): a mudanca nao deve adicionar chamadas extras relevantes nem loops de recarga.
- NFR-002 (seguranca/permissoes): a tela deve continuar usando os mesmos endpoints e controles de autenticacao existentes.
- NFR-003 (observabilidade): a alteracao deve ser verificavel por lint, TypeScript e validacao manual do fluxo inicial da agenda.

## 4) Contratos tecnicos

### API

- Endpoint: `GET /agenda` e `GET /agenda/resumo-financeiro`.
- Metodo: sem alteracao.
- Payload: sem alteracao; apenas passa a enviar `data_inicio` e `data_fim` com a data selecionada ao abrir a lista.
- Resposta: sem alteracao.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao

### Frontend

- Telas afetadas: `frontend/app/agenda/page.tsx`.
- Estados de UI: `filtroData` inicializado com `hojeLocal()`; lista usa periodo do proprio dia; input de data nao permanece vazio.
- Regras de exibicao/erro: ao abrir a agenda em lista, mostrar os agendamentos do dia atual; navegacao manual por data continua disponivel.

## 5) Compatibilidade e rollout

- Backward compatibility: mantida; a unica diferenca e a carga inicial da agenda em lista.
- Feature flag (se houver): nao.
- Estrategia de rollback: reverter o commit da agenda e restaurar a inicializacao vazia anterior.

## 6) Criterios de aceitacao (CA)

- CA-001: `filtroData` inicia com a data local atual ao abrir a tela de agenda.
- CA-002: a visualizacao em lista consulta e exibe apenas agendamentos do dia atual na primeira carga.
- CA-003: limpar o input de data nao deixa a tela em estado inconsistente; a data atual e restaurada.

## 7) Casos de borda

- CB-001: abertura da tela perto da meia-noite deve usar a data local resolvida no navegador.
- CB-002: alternar entre lista, panoramica-dia e panoramica-semana deve continuar respeitando a data selecionada.
- CB-003: navegadores que permitirem limpar o `input[type=date]` nao podem disparar consulta ampla por ausencia de filtro.

## 8) Fora de escopo

- Persistencia de filtros por usuario.
- Alteracoes na agenda FullCalendar.
- Mudancas de backend na regra de filtragem por data.
