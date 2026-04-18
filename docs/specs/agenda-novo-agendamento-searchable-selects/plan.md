# Plan - agenda-novo-agendamento-searchable-selects

Data: 2026-04-18  
Responsavel: Codex  
Status: done

## Fases

- Fase 1 (descoberta): localizar o modal de novo agendamento, inspecionar os dados carregados e confirmar se a API de clinicas ja devolve endereco suficiente.
- Fase 2 (frontend): substituir os `select` de tutor, animal e clinica por um combobox leve com busca textual e suporte a descricao por opcao.
- Fase 3 (SDD/validacao): registrar a feature em `docs/specs` e validar o arquivo alterado com lint.

## Tarefas

- [x] T1.1 Localizar `frontend/app/agenda/NovoAgendamentoModal.tsx`.
- [x] T1.2 Confirmar que `/clinicas?limit=1000` retorna endereco, numero, bairro, cidade, estado e cep.
- [x] T2.1 Implementar componente local de selecao pesquisavel no modal.
- [x] T2.2 Aplicar busca em `Tutor` por nome e telefone.
- [x] T2.3 Aplicar busca em `Animal` por nome, tutor, especie e raca.
- [x] T2.4 Exibir endereco da clinica nas opcoes e no item selecionado.
- [x] T2.5 Preservar o filtro existente de animais por tutor selecionado.
- [x] T3.1 Atualizar `spec.md` e `verify.md` da feature.
- [x] T3.2 Executar `npx eslint app/agenda/NovoAgendamentoModal.tsx`.

## Riscos e rollback

- Risco: regressao de usabilidade no dropdown customizado em telas menores.
- Risco: descricao muito longa de clinica ocupar espaco visual excessivo.
- Rollback: reverter o commit que introduz o combobox local no modal de agendamento.

## Dependencias

- Os endpoints atuais de `tutores`, `pacientes` e `clinicas` continuam respondendo com a estrutura ja usada pela tela.
- O modal permanece como componente client-side com `useState` e `useEffect`.
