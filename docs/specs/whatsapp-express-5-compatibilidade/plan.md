# Plan - whatsapp-express-5-compatibilidade

## Fases

1. Atualizar Express, os tipos correspondentes e o lockfile.
2. Corrigir incompatibilidades apontadas pelo compilador sem relaxar validacoes.
3. Criar smoke HTTP com o app real em porta efemera.
4. Executar o smoke no quality gate de stage e producao.
5. Validar localmente antes de enviar para `stage`.

## Criterios de conclusao

- `npm ci`, `npm run build` e os testes funcionais existentes passam.
- O smoke confirma `GET /health` com `200`/JSON e `GET /not-found` com `404`.
- `npm audit --omit=dev` nao reporta vulnerabilidades.
- A atualizacao nao envia dados para Meta nem requer banco acessivel.

## Rollback

Reverter o commit desta feature restaura o Express 4, seu lockfile e a lista
anterior de testes do workflow. Nao ha migracao, alteracao de dados ou de
configuracao externa para desfazer.
