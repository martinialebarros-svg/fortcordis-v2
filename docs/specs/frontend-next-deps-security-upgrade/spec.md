# Spec - frontend-next-deps-security-upgrade

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: draft

## 1) Escopo funcional

Atualizar Next.js e dependencia de lint acoplada para versao segura recomendada por auditoria, mantendo compatibilidade com o frontend atual e validando build/lint/deploy.

## 2) Requisitos funcionais (RF)

- RF-001: atualizar `next` de `14.2.5` para `15.5.14`.
- RF-002: atualizar `eslint-config-next` para `15.5.14` para alinhar com `next`.
- RF-003: atualizar `package-lock.json` de forma deterministica apos upgrade.
- RF-004: garantir `npm run build` com sucesso apos upgrade.
- RF-005: garantir `npm run lint` com sucesso apos upgrade.
- RF-006: reduzir vulnerabilidades de runtime em `npm audit --omit=dev`.
- RF-007: ajustar paginas dinamicas client-side com `useParams` para compatibilidade de tipagem no Next 15.
- RF-008: corrigir erros de lint bloqueantes no dashboard (`Link` interno em vez de `<a>`).
- RF-009: reduzir ruida de lockfile root no build/lint configurando `outputFileTracingRoot`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (estabilidade): sem alteracao funcional de UI/fluxos.
- NFR-002 (seguranca): remover vulnerabilidades conhecidas de runtime da versao antiga do Next.
- NFR-003 (operacao): deploy automatico de stage e main deve permanecer verde.
- NFR-004 (rollback): rollback simples por revert de commit.

## 4) Contratos tecnicos

### Frontend

- Arquivos alvo:
- `frontend/package.json`
- `frontend/package-lock.json`

### CI/CD

- Nenhuma mudanca obrigatoria de contrato; validar apenas execucao de deploy apos upgrade.

## 5) Compatibilidade e rollout

- Estrategia: upgrade para 15.x (menor versao que remove risco de runtime identificado no audit).
- Rollout: primeiro `stage`, depois promocao para `main`.
- Rollback: `git revert` do commit de upgrade.

## 6) Criterios de aceitacao (CA)

- CA-001: `next --version` resolve para `15.5.14` no lockfile.
- CA-002: `npm run build` conclui sem erro.
- CA-003: `npm run lint` conclui sem erro.
- CA-004: `npm audit --omit=dev` nao reporta vulnerabilidade critica em `next`.
- CA-005: deploy de `stage` concluido com sucesso.
- CA-006: deploy de `main` concluido com sucesso apos promocao.

## 7) Casos de borda

- CB-001: dependencia transitiva introduz conflito de peer dependency.
- CB-002: lockfile local diverge de ambiente de deploy.
- CB-003: build passa local, mas falha no VPS por cache/ambiente.

## 8) Fora de escopo

- Major upgrade para Next 16.
- Revisao completa de vulnerabilidades apenas de dev tooling.
