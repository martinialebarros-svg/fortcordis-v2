# Spec - frontend-next-deps-security-upgrade

Data: 2026-10-16
Responsavel: Equipe FortCordis
Status: preparada e validada localmente; PR draft autorizado, deploy nao autorizado

## Ciclo de seguranca de outubro de 2026 (contrato vigente)

### Evidencia e escopo

- Base: `origin/stage` em `77f65b3de020680aed579780945094988755686a`.
- Base observada: Next.js e eslint-config-next `15.5.23`, sharp `0.34.5`.
- [Comunicado oficial de 14/10/2026](https://nextjs.org/blog/nextjs-security-update-october-14-2026) e [GHSA-2464-fhr4-w9xw / CVE-2026-96889](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw), revalidados em 16/10/2026, recomendam Next.js `15.5.28` e sharp efetivamente usado pelo Next `>=0.35.5`.
- O advisory descreve possivel RCE no otimizador de imagens em Linux glibc. A presenca de dependencias afetadas nao comprova exposicao efetiva nem comprometimento do Fort Cordis.
- Preparacao em clone e branch locais isolados, preservando o checkout principal e as outras tarefas. A busca inicial em PRs abertos, branches remotas e historico local nao identificou correcao equivalente.

### Requisitos da atualizacao

- OUT-RF-001: fixar `next` e `eslint-config-next` em `15.5.28`.
- OUT-RF-002: adicionar `sharp` como dependencia direta exata `0.35.5` e comprovar que essa e a copia resolvida a partir do modulo Next. O intervalo opcional publicado pelo Next (`^0.34.3 || ^0.35.5`) ainda aceita a versao anterior; o bump isolado do framework nao basta como evidencia.
- OUT-RF-003: regenerar o lockfile via npm, preservar entradas nativas Linux x64/arm64 e validar instalacao limpa sem atualizar dependencias nao relacionadas.
- OUT-RF-004: preservar codigo, configuracoes de seguranca, autenticacao, regras da Agenda, dados clinicos, uploads e geracao de laudos.
- OUT-RF-005: executar lint, TypeScript, suites frontend, build e verificacoes locais aplicaveis dos workflows; registrar falhas ou limitacoes sem substitui-las por aprovacao.
- OUT-RF-006: exercitar o otimizador real com imagem institucional local e revisar login/roteamento, Agenda, imagens clinicas e laudos com fixtures sinteticas.
- OUT-RF-007: registrar auditoria npm antes/depois; alertas remanescentes de outras dependencias nao significam que a auditoria inteira passou.

### Compatibilidade e criterios de aceite

| ID | Criterio |
| --- | --- |
| OUT-CA-001 | Next/eslint-config `15.5.28`; sharp carregado pelo Next `0.35.5`; uma unica resolucao e binarios Linux presentes no lock |
| OUT-CA-002 | Instalacao limpa, lint, TypeScript, testes frontend e build aprovados; qualquer repeticao justificada registrada |
| OUT-CA-003 | Smoke HTTP local e otimizacao nativa de imagem aprovados; cobertura e limites de login/Agenda/laudos descritos |
| OUT-CA-004 | Gates agregados locais e SDD executados; bloqueios externos/plataforma discriminados |
| OUT-CA-005 | Auditoria comparativa registrada, sem alegacao de ausencia de todos os riscos |
| OUT-CA-006 | Antes do rollout: validar Node >=20.9.0 e Linux glibc >=2.28 no ambiente de destino; smoke representativo de imagem e fluxos autenticados em stage |

`sharp@0.35.5` exige Node `>=20.9.0`, mais restritivo que o Next isolado. CI declara Node 20; a versao realmente instalada no VPS precisa ser conferida na preparacao de publicacao. Os pacotes Linux x64 exigem SSE4.2. O smoke macOS nao comprova execucao em Linux glibc. Referencias: [metadados Next](https://registry.npmjs.org/next/15.5.28), [metadados sharp](https://registry.npmjs.org/sharp/0.35.5), [instalacao sharp](https://sharp.pixelplumbing.com/install/).

### Limites de entrega e publicacao

Em 16/10/2026, o usuario autorizou commit da correcao, push da branch `codex/next-security-20261016` e abertura de PR **draft** com base `stage`, incluindo acompanhamento dos checks. Essa autorizacao nao cobre merge, deploy, promocao para producao, mudancas de credenciais/seguranca ou dados clinicos. Aguardar autorizacao especifica antes de implantar em stage ou producao. A aprovacao de abril registrada abaixo e historica e nao se aplica a este ciclo.

O futuro rollout deve instalar pelo lockfile (`npm ci`), manter dependencias nativas opcionais e verificar a resolucao a partir de `next`. O rollback tecnico restaura package.json/lockfile anteriores, mas reintroduz versoes afetadas; precisa de decisao operacional consciente. Next 16, upgrade major de PDF.js e saneamento geral do tooling ficam fora desta correcao especifica.

## Historico: contrato do ciclo de abril de 2026

O conteudo abaixo descreve exclusivamente a entrega anterior, concluida em 05/04/2026.

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
