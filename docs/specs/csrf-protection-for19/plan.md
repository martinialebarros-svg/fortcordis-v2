# Plan - csrf-protection-for19

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Tarefas

- [x] Adicionar middleware CSRF para requests mutating com cookie de sessao.
- [x] Definir cookie CSRF nao-HttpOnly no login e limpeza no logout.
- [x] Enviar header CSRF no cliente axios para metodos mutating.
- [x] Cobrir regras principais com testes unitarios focados.
