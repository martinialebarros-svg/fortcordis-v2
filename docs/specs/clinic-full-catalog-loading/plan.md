# Plan - clinic-full-catalog-loading

Data: 2026-07-05  
Responsavel: Codex  
Status: done

1. Mapear telas que consultam `/clinicas` sem `limit` e dependem de busca local.
2. Criar helper frontend para varrer todas as paginas de `GET /clinicas` em lotes controlados.
3. Substituir os carregamentos simples nas telas afetadas pelo helper compartilhado.
4. Validar lint/build do frontend e registrar o guardrail SDD para release.
