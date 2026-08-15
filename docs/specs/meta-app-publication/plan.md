# Plan - meta-app-publication

Data: 2026-08-12
Responsavel: Martiniano + Codex

## Implementacao

- [x] Criar componente visual compartilhado para documentos publicos.
- [x] Criar `/privacidade` com controlador, dados, finalidades, compartilhamento, retencao, seguranca e direitos.
- [x] Criar `/termos` com finalidade, uso aceitavel, disponibilidade, privacidade e aviso de canal nao emergencial.
- [x] Criar `/exclusao-de-dados` com canal, dados minimos, validacao, prazo e hipoteses de retencao.
- [x] Adicionar metadados especificos para cada rota.
- [x] Registrar `intent.md`, `spec.md`, `plan.md` e `verify.md` no mesmo ciclo.

## Validacao local

- [x] Executar TypeScript sem emissao.
- [x] Executar ESLint sem avisos.
- [x] Executar build Next.js e confirmar as tres rotas estaticas.
- [x] Revisar ausencia de segredos e dados pessoais no diff.
- [ ] Executar guardrail SDD no snapshot final.

## Validacao em stage

- [ ] Publicar o commit exato em `origin/stage` sem sobrescrever mudancas concorrentes.
- [ ] Aguardar `quality-gate`, `sdd-guardrail`, `Migration CI` e deploy em estado terminal verde.
- [ ] Confirmar `200` anonimo nas tres URLs HTTPS.
- [ ] Preencher as URLs no app FortZap e concluir a publicacao somente depois do smoke.
