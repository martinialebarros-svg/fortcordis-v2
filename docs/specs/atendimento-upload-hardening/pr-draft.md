## Resumo da mudanca

Implementa o piloto SDD para hardening de upload de anexos no modulo de atendimento, com:
- fluxo de especificacao (`intent/spec/plan/verify`) aprovado em stage;
- allowlist conservadora de arquivos (`pdf`, `jpg/jpeg`, `png`, `webp`);
- validacao backend de tipo/tamanho com mapeamento explicito de erro (`400`/`413`);
- logs de rejeicao para observabilidade;
- alinhamento de UX no frontend (`accept` + mensagem local);
- popup de erro na tela de atendimento para melhorar visibilidade.

## Artefatos SDD (obrigatorio)

- [x] `intent.md` linkado: `docs/specs/atendimento-upload-hardening/intent.md`
- [x] `spec.md` linkado: `docs/specs/atendimento-upload-hardening/spec.md`
- [x] `plan.md` linkado: `docs/specs/atendimento-upload-hardening/plan.md`
- [x] `verify.md` linkado: `docs/specs/atendimento-upload-hardening/verify.md`

## Escopo e fora de escopo

- Escopo desta PR:
- Hardening de upload de anexos de atendimento (backend + frontend + testes).
- Governanca SDD no repositório (workflow, templates e template de PR).

- Fora de escopo:
- Reestruturação total de storage de anexos.
- Streaming/chunk upload completo.
- Aprovação para produção (apenas stage aprovado).

## Checklist SDD

- [x] Requisitos funcionais (RF) implementados ou justificados.
- [x] Requisitos nao funcionais (NFR) validados ou marcados como N/A com justificativa.
- [x] Criterios de aceitacao (CA) verificados.
- [x] Casos de borda validados.
- [x] Mudanca de banco/migracao tem estrategia de rollback.
- [x] Impacto em permissoes/seguranca revisado.
- [x] Impacto em observabilidade/logs revisado.

## Testes executados

Comandos:

```bash
# backend (venv do projeto)
backend/.venv/Scripts/python -m unittest backend/tests/test_atendimento_upload_service.py backend/tests/test_atendimento_upload_endpoint.py -v

# frontend
npm --prefix frontend run lint -- --file app/atendimento/page.tsx
```

Resultados:
- Backend: 14 testes executados, 14 pass.
- Frontend: lint sem warnings/erros.
- Manual local/stage: 4 cenarios de upload aprovados (valido PDF, valido imagem, tipo invalido, acima de 25MB).

## Risco e plano de deploy

- Nivel de risco: medio (restricao de tipos pode bloquear formatos antes aceitos).
- Plano de deploy: stage validado; promover para prod em janela controlada com checklist operacional.
- Plano de rollback: revert do commit desta feature.

## Arquivos principais desta PR

- `.github/pull_request_template.md`
- `docs/SDD-WORKFLOW.md`
- `docs/specs/README.md`
- `docs/specs/templates/intent.md`
- `docs/specs/templates/spec.md`
- `docs/specs/templates/plan.md`
- `docs/specs/templates/verify.md`
- `docs/specs/atendimento-upload-hardening/intent.md`
- `docs/specs/atendimento-upload-hardening/spec.md`
- `docs/specs/atendimento-upload-hardening/plan.md`
- `docs/specs/atendimento-upload-hardening/verify.md`
- `backend/app/services/atendimento_upload_service.py`
- `backend/app/api/v1/endpoints/atendimento.py`
- `backend/tests/test_atendimento_upload_service.py`
- `backend/tests/test_atendimento_upload_endpoint.py`
- `frontend/app/atendimento/page.tsx`
- `README.md`
