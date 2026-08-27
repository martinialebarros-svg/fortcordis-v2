# Plan - atendimento-catalogo-exames-customizados

Data: 2026-08-26
Status: implementacao

1. Definir payload e identidade `custom_exam_` para itens criados pelo usuario.
2. Criar endpoints autenticados para cadastrar, editar e desativar somente
   exames customizados.
3. Remover associacoes do item desativado com paineis, preservando solicitacoes
   clinicas historicas e exames padrao.
4. Incluir no modal de paineis o formulario "+ Novo exame" e controles de
   edicao/exclusao apenas nos itens customizados.
5. Atualizar e ordenar alfabeticamente o catalogo no frontend, selecionando
   automaticamente o exame recem-criado para o painel em edicao.
6. Cobrir backend e frontend com testes, lint, TypeScript, build e guardrail SDD.
