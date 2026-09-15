# Spec - atendimento-catalogo-exames-customizados

Data: 2026-08-26

## Requisitos funcionais

- RF-001: o modal de criar/editar painel deve oferecer "+ Novo exame" sem
  obrigar o usuario a sair do fluxo.
- RF-002: o cadastro exige nome e categoria e aceita subcategoria, sinonimos,
  preparo e observacoes padrao opcionais.
- RF-003: o exame criado deve entrar imediatamente no catalogo, em ordem
  alfabetica, e ficar selecionado no painel atual.
- RF-004: exames customizados devem oferecer edicao e desativacao no modal.
- RF-005: exames padrao devem permanecer visiveis, mas sem controles de edicao
  ou desativacao.
- RF-006: a API deve rejeitar nomes duplicados entre itens ativos e impedir
  edicao/desativacao de exames padrao.
- RF-007: desativar um exame customizado deve retira-lo dos paineis, sem apagar
  solicitacoes clinicas historicas que ja referenciem seu `id`.

## Seguranca e autorizacao

Os endpoints permanecem autenticados e sujeitos a matriz de permissoes do
modulo `atendimento_clinico`: POST/PUT exigem `editar` e DELETE exige `excluir`.
A protecao adicional por prefixo `custom_exam_` impede que o fluxo altere o
catalogo institucional.

## Criterios de aceitacao

- CA-001: criar um exame customizado devolve `customizado=true`, codigo unico e
  dados normalizados.
- CA-002: editar o item customizado atualiza o catalogo e os paineis que o usam.
- CA-003: desativar o item o remove da listagem ativa e de `painel_exames_itens`.
- CA-004: PUT/DELETE sobre item padrao respondem 403.
- CA-005: nome ativo duplicado responde 409.
- CA-006: testes focados, lint, TypeScript, build e guardrail SDD passam.
