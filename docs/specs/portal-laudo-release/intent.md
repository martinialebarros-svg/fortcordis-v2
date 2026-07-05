# Intent - portal-laudo-release

Data: 2026-07-05
Responsavel: Equipe FortCordis
Status: approved

## 1) Problema

O portal da clinica parceira ja possui autenticacao, filtros e escopo por unidade, mas ainda nao havia uma acao operacional clara para decidir quando um laudo/exame pode aparecer no portal. Com isso, o acesso ficava dependente apenas do vinculo tecnico com a clinica, o que aumenta o risco de expor um exame antes da revisao final.

## 2) Objetivo

Adicionar uma liberacao explicita no fluxo de laudos para que a equipe Fort Cordis publique o exame no portal somente apos revisar o laudo. A liberacao deve marcar o laudo, criar ou atualizar o registro de exame consultado pelo portal e impedir que registros internos nao liberados aparecam para tutor ou clinica.

## 3) Usuarios Impactados

- Equipe medica/operacional que finaliza e libera laudos.
- Clinicas parceiras que consultam exames liberados no portal.
- Tutores que acessam exames pelo portal do pet.

## 4) Resultado Esperado

O fluxo diario passa a ser: elaborar laudo, revisar, clicar em liberar para o portal da clinica, e entao a clinica consegue localizar o exame no painel. Exames concluidos internamente, mas sem liberacao explicita, permanecem fora do portal.
