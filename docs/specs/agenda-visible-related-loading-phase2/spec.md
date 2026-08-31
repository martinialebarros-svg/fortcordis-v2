# Spec - agenda-visible-related-loading-phase2

Data: 2026-08-30

Responsavel: Codex / equipe FortCordis

Status: ready_for_review

## 1) Escopo funcional

Implementar o PERF-08 da trilha de desempenho da Agenda, reduzindo transferencia e concorrencia sem alterar a lista principal, regras de negocio ou permissoes.

## 2) Requisitos funcionais

- RF-001: `GET /agenda/relacionados` deve receber IDs positivos, unicos e limitados a 100.
- RF-002: a resposta deve ignorar IDs inexistentes e nao retornar dados de agendamentos fora do lote.
- RF-003: laudos devem ser resumidos pelo maior ID de cada par agendamento/tipo.
- RF-004: OS devem ser resumidas pelo maior ID de cada agendamento.
- RF-005: clinicas e tutores devem conter somente os campos de endereco/rota usados pela pagina.
- RF-006: `/agenda` deve usar uma chamada agregada em vez das quatro listagens amplas.
- RF-006.a: `/agenda/fullcalendar` deve dividir periodos com mais de 100 itens em lotes e usar o mesmo contrato agregado.
- RF-007: catalogos de clinicas e servicos dos filtros devem carregar separadamente, somente na primeira interacao.
- RF-008: chamadas concorrentes do mesmo catalogo devem compartilhar a requisicao em voo; falha deve liberar retry.

## 3) Requisitos nao funcionais

- NFR-001 (performance): nenhuma carga inicial baixa catalogo completo sem uso imediato.
- NFR-002 (escala): o endpoint agregado deve usar numero constante de consultas por lote, sem consulta por agendamento.
- NFR-003 (seguranca): o novo endpoint usa `get_current_user` e nao introduz escrita.
- NFR-004 (resiliencia): falha relacionada nao bloqueia os agendamentos ja carregados.
- NFR-005 (compatibilidade): payloads e regras dos endpoints existentes permanecem inalterados.

## 4) Contratos tecnicos

### API

`GET /api/v1/agenda/relacionados?agendamento_ids=1,2,3`

Resposta:

```json
{
  "agendamento_ids": [1, 2, 3],
  "laudos": [],
  "ordens_servico": [],
  "clinicas": [],
  "tutores": []
}
```

- Limite: 100 IDs validos e unicos.
- Erro de formato/limite: HTTP 400.
- IDs inexistentes: omitidos de `agendamento_ids` e dos dados relacionados.

### Banco/migracoes

- Tabelas lidas: `agendamentos`, `pacientes`, `laudos`, `ordens_servico`, `clinicas`, `tutores`.
- Escritas: nenhuma.
- Migracao: nenhuma.

### Frontend

- `frontend/app/agenda/page.tsx`: chamada agregada e filtros lazy.
- `frontend/app/agenda/fullcalendar/page.tsx`: chamada agregada em lotes de ate 100 IDs.
- `frontend/lib/agenda-loading.ts`: normalizacao testavel de IDs e opcoes.
- O modal de novo/editar agendamento permanece fora desta alteracao.

## 5) Criterios de aceitacao

- CA-001: teste prova validacao, deduplicacao e limite de IDs.
- CA-002: teste prova que dados de agendamento fora do lote nao vazam na resposta.
- CA-003: teste prova escolha do laudo/OS mais recente.
- CA-004: teste prova quantidade constante de consultas por lote.
- CA-005: teste frontend prova normalizacao de IDs e opcoes.
- CA-006: inspecao e smoke autenticado provam ausencia das leituras iniciais amplas.
- CA-007: testes, lint, build e guardrail SDD passam.

## 6) Casos de borda

- CB-001: lista de agenda vazia nao chama endpoint relacionado e limpa mapas antigos.
- CB-002: tutor herdado do paciente deve ser resolvido quando `agendamentos.tutor_id` estiver vazio.
- CB-003: catalogo vazio e sucesso sao marcados como carregados.
- CB-004: falha de catalogo permite retry na proxima interacao.
- CB-005: reabertura do mesmo filtro nao repete requisicao bem-sucedida.
- CB-006: periodo do FullCalendar acima de 100 itens e dividido sem truncar IDs.
