# Plan - agenda-visible-related-loading-phase2

Data: 2026-08-30

Responsavel: Codex / equipe FortCordis

Status: ready_for_review

## 1) Sequencia da entrega PERF-08

1. Criar endpoint autenticado de relacionados por IDs de agendamento.
2. Consolidar laudos, OS e enderecos no backend sem N+1.
3. Trocar as quatro leituras amplas da lista e do FullCalendar por chamadas agregadas em lotes de ate 100 IDs.
4. Tornar clinicas e servicos dos filtros independentes e sob demanda.
5. Cobrir limite, isolamento por IDs, deduplicacao e utilitarios frontend.
6. Executar testes, lint, build, diff check e guardrail SDD.
7. Abrir PR para `stage` e comparar a navegacao autenticada com a linha de base.

## 2) Tarefas

- [x] T2.1 Validar e deduplicar ate 100 IDs de agendamento.
- [x] T2.2 Retornar somente laudos, OS, clinicas e tutores relacionados.
- [x] T2.3 Preservar a escolha do registro mais recente.
- [x] T2.4 Consumir a resposta agregada na lista e no FullCalendar.
- [x] T2.5 Adiar catalogos dos filtros ate foco/interacao.
- [x] T2.6 Permitir retry apos falha e evitar requisicao duplicada em voo.
- [ ] T2.7 Registrar validacoes e evidencia stage.

## 3) Criterio de conclusao

- A carga inicial nao solicita catalogos completos de clinicas/servicos.
- Dados relacionados sao filtrados no servidor pelos IDs da pagina.
- A quantidade de consultas do endpoint agregado e constante por lote.
- Testes, lint, build e guardrail SDD passam.

## 4) Risco e rollback

- Risco: falha do endpoint agregado ocultar atalhos de laudo, OS ou rota.
- Mitigacao: lista principal permanece independente e a falha limpa apenas os mapas relacionados.
- Rollback: reverter o commit PERF-08; nao ha migracao ou alteracao persistente.
