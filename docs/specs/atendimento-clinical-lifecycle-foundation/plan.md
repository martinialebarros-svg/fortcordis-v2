# Plan - atendimento-clinical-lifecycle-foundation

## Etapas

- [x] Mapear os estados, contratos, datas e indicadores atuais.
- [x] Documentar a barreira clinica minima e os itens fora de escopo.
- [x] Normalizar estados no backend.
- [x] Bloquear criacao concluida e primeira transicao invalida.
- [x] Persistir os indicadores explicitos de conclusao.
- [x] Normalizar datas clinicas no horario operacional.
- [x] Preencher a data/hora a partir do contexto da Agenda.
- [x] Tornar o ID do agendamento somente leitura e rotular os controles.
- [x] Criar regressao backend focada.
- [x] Executar testes direcionados e suite completa.
- [x] Executar ESLint, TypeScript e build.
- [x] Realizar smoke autenticado em copia isolada.
- [x] Atualizar `verify.md` com as evidencias.
- [ ] Publicar em stage somente mediante solicitacao explicita.

## Arquivos principais

- `backend/app/api/v1/endpoints/atendimento.py`
- `backend/app/schemas/atendimento.py`
- `backend/tests/test_atendimento_clinical_lifecycle.py`
- `frontend/app/atendimento/page.tsx`
- `frontend/app/atendimento/components/AtendimentoConsultaOverviewSection.tsx`
- `frontend/lib/atendimento-utils.ts`

## Estrategia de verificacao

1. Testar regras puras e endpoints de criacao/atualizacao.
2. Rodar toda a suite do modulo Atendimento.
3. Rodar a suite backend completa.
4. Validar runtime do utilitario de datas.
5. Executar lint, TypeScript e build.
6. Reproduzir a tentativa vazia e a conclusao valida pelo navegador.
7. Confirmar no banco isolado que o horario nao se desloca.
8. Executar o avaliador SDD sobre todos os arquivos deste pacote.
