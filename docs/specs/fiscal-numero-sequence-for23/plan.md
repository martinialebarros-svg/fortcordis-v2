# Plan - fiscal-numero-sequence-for23

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Tarefas

- [x] Criar migration para tabela de sequencia fiscal por ano.
- [x] Backfill da sequencia a partir dos numeros ja existentes em `notas_fiscais`.
- [x] Atualizar service fiscal para usar sequencia atomica com fallback legado.
- [x] Validar concorrencia com testes automatizados.
