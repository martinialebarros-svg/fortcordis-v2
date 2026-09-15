# Intent - pacientes-busca-carteira-completa

Data: 2026-09-02  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

A tela `/pacientes` carregava somente os primeiros 1.000 pacientes ativos e aplicava a busca no navegador. A carteira possui mais registros do que esse teto, fazendo pacientes válidos ligados a agenda e atendimento não aparecerem na busca.

## 2) Objetivo

Permitir localizar qualquer paciente ativo por nome, tutor ou identificador, independentemente da posição alfabética na carteira, sem carregar a carteira inteira no navegador.

## 3) Nao objetivos

- Reativar automaticamente pacientes desativados.
- Alterar os dados clínicos, agenda ou atendimento do paciente.
- Mudar as regras de exclusão lógica de pacientes.

## 4) Contexto e restricoes

- Restricoes tecnicas: reutilizar o parâmetro autenticado `search` já existente em `GET /api/v1/pacientes`.
- Restricoes de prazo: correção pontual da carteira de pacientes.
- Restricoes regulatorio/operacional: manter a listagem limitada a pacientes ativos e não expor dados além da permissão atual.

## 5) Impacto esperado

- Usuarios impactados: equipe interna que pesquisa pacientes.
- Modulos impactados: Pacientes e API de pacientes.
- Risco de regressao: paginação e seleção em lote da página atual.

## 6) Riscos iniciais

- Uma resposta de busca fora de ordem pode substituir resultados mais recentes.
- O total da busca não deve ser confundido com o total de pacientes ativos.

## 7) Perguntas abertas

- Nenhuma para esta correção; o contrato de busca já existe.

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
