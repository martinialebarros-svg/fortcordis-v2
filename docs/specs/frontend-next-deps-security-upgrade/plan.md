# Plan - frontend-next-deps-security-upgrade

Data: 2026-04-05  
Responsavel: Equipe FortCordis  
Status: done

## 1) Sequencia de fases

- Fase 1 (spec baseline): registrar intent/spec/plan.
- Fase 2 (implementacao): aplicar upgrade de dependencias e lockfile.
- Fase 3 (validacao local): build/lint/audit runtime.
- Fase 4 (operacao): push stage, deploy stage, promocao main, deploy main.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Criar pasta de spec e arquivos `intent.md`, `spec.md`, `plan.md`.
- Criterio: escopo e criterios de aceitacao claros.

### Fase 2

- [x] T2.1 Atualizar `next` para `15.5.14`.
- [x] T2.2 Atualizar `eslint-config-next` para `15.5.14`.
- [x] T2.3 Regenerar `package-lock.json`.
- [x] T2.4 Ajustar rotas dinamicas para compatibilidade de tipagem no Next 15.
- [x] T2.5 Corrigir lint bloqueante no dashboard.
- [x] T2.6 Ajustar `next.config.js` para `outputFileTracingRoot`.
- Criterio: dependencias atualizadas sem conflito.

### Fase 3

- [x] T3.1 Rodar `npm run build`.
- [x] T3.2 Rodar `npm run lint`.
- [x] T3.3 Rodar `npm audit --omit=dev` e registrar resultado.
- [x] T3.4 Rodar `npm audit` completo e registrar resultado.
- Criterio: build/lint verdes e risco critico de runtime mitigado.

### Fase 4

- [x] T4.1 Commit e push em `stage`.
- [x] T4.2 Confirmar deploy stage verde.
- [x] T4.3 Promover para `main`.
- [x] T4.4 Confirmar deploy main verde.
- Criterio: ciclo completo fechado com deploys bem-sucedidos.

## 3) Plano de testes

- Local:
- `npm run build`
- `npm run lint`
- `npm audit --omit=dev`
- Operacional:
- acompanhar GitHub Actions de stage e main.

## 4) Dependencias e bloqueios

- Dependencia: acesso ao registry npm durante upgrade.
- Dependencia: deploy VPS disponivel.
- Bloqueio potencial: incompatibilidade inesperada de dependencia transitiva.

## 5) Checklist de inicio de execucao

- [x] Spec criada.
- [x] Versao-alvo definida (15.5.14).
- [x] Criterios de aceite definidos.
