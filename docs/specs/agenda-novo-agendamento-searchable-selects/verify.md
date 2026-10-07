# Verify - agenda-novo-agendamento-searchable-selects

Data: 2026-04-18  
Atualizacao: 2026-10-06 (busca remota de animais)
Responsavel: Codex  
Status: validado localmente

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/app/agenda/NovoAgendamentoModal.tsx` cria `SearchableSelect` para `Tutor` com busca por nome/telefone | ok |
| CA-002 | aceitacao | `frontend/app/agenda/NovoAgendamentoModal.tsx` cria `SearchableSelect` para `Animal` com busca e preserva `pacientesFiltradosPorTutor` | ok |
| CA-003 | aceitacao | `frontend/app/agenda/NovoAgendamentoModal.tsx` usa `formatarEnderecoClinica` nas opcoes de `Clinica` | ok |
| CA-004 | aceitacao | `frontend/app/agenda/NovoAgendamentoModal.tsx` usa `showSelectedDescription` para manter endereco visivel apos selecao | ok |
| CA-005 | aceitacao | `npx eslint app/agenda/NovoAgendamentoModal.tsx` | ok |
| CA-006 | aceitacao | `NovoAgendamentoModal.paciente-busca-remota.test.tsx` simula 1.299 pacientes, com o animal buscado ausente dos primeiros 1.000 | ok |
| CA-007 | aceitacao | mesmo teste seleciona o resultado remoto, busca outro termo vazio e confere rotulo selecionado, `paciente_id`, `tutor_id` e observacoes preservadas no `PUT /agenda/{id}` | ok |
| CA-008 | aceitacao | segundo caso do teste seleciona tutor e exige busca por `tutor_id=11`, `skip=0`, `limit=100` antes de exibir o animal | ok |
| CA-009 | aceitacao | terceiro caso aguarda `GET /pacientes/1299` na edicao, altera observacoes antes da resposta e confere animal/tutor selecionados com texto preservado | ok |
| NFR-001 | nao funcional | busca local preservada; `NovoAgendamentoModal.tsx` aplica debounce de 250 ms, limite de 50 e descarta respostas obsoletas por cleanup do efeito | ok |
| NFR-002 | nao funcional | `test_pacientes_listagem.py` verifica filtro exato, busca combinada, pacientes ativos e ordenacao estavel; autenticacao existente em `listar_pacientes`. A consulta por ID so hidrata o vinculo ja existente na edicao | ok |
| NFR-003 | nao funcional | `eslint` do modal e teste novo, TypeScript, build, `git diff --check` e avaliacao SDD dos arquivos alterados | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
python -m pytest tests/test_pacientes_listagem.py -q  # ambiente virtual do backend ativo

cd ../frontend
npx eslint app/agenda/NovoAgendamentoModal.tsx app/agenda/NovoAgendamentoModal.paciente-busca-remota.test.tsx --max-warnings=0
npx vitest run app/agenda/NovoAgendamentoModal.paciente-busca-remota.test.tsx app/agenda/NovoAgendamentoModal.reserva-expirada.test.tsx
npx tsc --noEmit
npm run build
```

Resumo dos resultados:
- Backend: 3 testes de `test_pacientes_listagem.py` passaram no ambiente virtual do backend; `py_compile` e `git diff --check` passaram.
- Frontend: antes da implementacao, 2 testes novos falharam pela ausencia das chamadas remotas. Apos a mudanca, 5 testes focados passaram; ESLint, TypeScript, build de producao e `git diff --check` passaram.
- SDD: `evaluate_guardrail` aprovou os seis arquivos alterados, incluindo `spec.md` e `verify.md`; o comando CI por commits sera executavel apos criar um commit.

## 3) Testes manuais

- Cenario 1: abrir modal de novo agendamento e buscar tutor por nome. Resultado esperado: lista filtrada sem scroll manual.
- Cenario 2: selecionar tutor e buscar animal por nome/tutor. Resultado esperado: apenas animais do tutor selecionado aparecem.
- Cenario 3: abrir dropdown de clinica e validar nome + endereco visivel nas opcoes e no item selecionado.
- Cenario 4: em carteira com mais de 1.000 animais, buscar e selecionar animal fora da carga inicial. Resultado esperado: opcao aparece, tutor correto e vinculado, e os IDs corretos sao enviados ao salvar.
- Cenario 5: selecionar um tutor com animal fora da carga inicial. Resultado esperado: animal aparece no seletor sem digitacao.
- Cenario 6: editar agendamento vinculado a animal fora da carga inicial. Resultado esperado: nome do animal e tutor aparecem corretamente apos hidratar o cadastro, sem apagar observacoes ja alteradas.

Observacao: os cenarios manuais ficaram pendentes de validacao visual no navegador durante este ciclo local.

## 4) Regressao e riscos residuais

- Risco residual 1: o dropdown customizado pode precisar ajuste fino de UX em dispositivos com viewport menor.
- Risco residual 2: descricoes muito longas de endereco podem exigir truncamento adicional dependendo da base real.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Pronto para revisao de publicacao apos validacao local.
- [ ] Publicado em stage.
- [ ] Publicado em producao.
