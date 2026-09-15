# Plan - PERF-09 Atendimento: bibliotecas secundarias sob demanda

1. Remover pacientes, medicamentos e frases clinicas da carga base; manter clinicas, catalogo de exames e lista de atendimentos.
2. Reutilizar os filtros existentes de pacientes e medicamentos no servidor, com limites pequenos e descarte de respostas obsoletas.
3. Estender frases clinicas com `skip` e `total`, mantendo ordenacao, filtros de secao, busca e `include_inactive`.
4. Carregar frases apenas para os campos da etapa clinica ativa; manter as frases padrao como fallback ate a resposta chegar.
5. Expor paginas adicionais somente nas Bibliotecas, sem impedir a prescricao ou o editor clinico.
6. Validar testes frontend/backend, lint, build, guardrail SDD e smoke autenticado em stage antes de qualquer promocao.
