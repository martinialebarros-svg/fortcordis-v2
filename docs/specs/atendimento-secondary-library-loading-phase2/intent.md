# Intent - PERF-09 Atendimento: bibliotecas secundarias sob demanda

## Problema

A montagem de `/atendimento` requisitava simultaneamente todos os pacientes (`limit=1000`), medicamentos (`limit=500`) e frases clinicas (`limit=1000`). Essas bibliotecas nao determinam se a lista ou o formulario essencial do atendimento pode abrir, mas prolongavam a espera percebida e construíam indices de busca no navegador antes da primeira interacao.

## Objetivo

Manter a abertura do Atendimento limitada aos dados essenciais e carregar cada biblioteca somente quando o operador a utilizar, com resultados paginados e busca no servidor.

## Escopo

- Paciente: consulta remota apos dois caracteres, limitada a oito sugestoes.
- Medicamentos: pagina de no maximo 100 itens ao abrir Prescricao ou Bibliotecas; novas buscas usam o servidor e a Biblioteca permite carregar a proxima pagina.
- Frases clinicas: endpoint com `skip` e `total`; editor busca somente as secoes visiveis e Biblioteca pagina os registros administrativos.
- Atualizar o plano colaborativo para registrar PERF-08 em producao e PERF-09 em validacao local.

## Fora de escopo

- Alterar regras clinicas, calculos de dose, autorizacoes ou dados ja salvos.
- Mudar o contrato de criacao/edicao/desativacao de medicamentos ou frases.
- Implementar cache persistente entre navegacoes (PERF-10).
