# Intent - atendimento-longitudinal-prescription-workflow

Data: 2026-07-16
Responsavel: Codex
Status: done

## Problema

Ao retornar com o mesmo paciente, o usuario nao tinha um caminho explicito para criar um novo atendimento e uma nova prescricao. A tela favorecia a reabertura do registro anterior, e o historico nao exibia o conteudo terapeutico salvo. Isso tornava facil substituir a receita do encontro antigo e misturava ferramentas administrativas com o fluxo clinico principal.

## Resultado esperado

- Cada encontro permanece como um registro longitudinal independente.
- O usuario inicia um novo atendimento para o mesmo paciente em um clique.
- Receitas anteriores ficam visiveis, podem ser abertas e podem ser copiadas sem reutilizar IDs persistidos.
- O layout prioriza Consulta, Exames, Prescricao e Documentos; casos recentes, cadastro completo e bibliotecas ficam disponiveis sob demanda.
