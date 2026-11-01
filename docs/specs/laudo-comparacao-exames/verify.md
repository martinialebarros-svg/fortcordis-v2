# Verify — escopo da comparacao de exames nesta publicacao

Esta pasta conserva a especificacao de uma entrega exclusiva de stage. A
publicacao de 28/10/2026 foi autorizada somente para tutores: o servico, a rota,
o componente e os helpers da comparacao de exames nao estao nesta arvore.
Nao ha aprovacao nem promocao dessa funcionalidade clinica para producao.

A matriz original de homologacao foi preservada integralmente no
[snapshot de stage 07317874](https://github.com/martinialebarros-svg/fortcordis-v2/blob/07317874b7b09eb7e8e1e076e9db4acc1294c90f/docs/specs/laudo-comparacao-exames/verify.md).
Ela registra CA-006 como **pendente visual** e CA-007 como **pendente**; essas
pendencias continuam existentes. As evidencias locais nao foram convertidas
em aprovacao de producao. O arquivo original sera restaurado em stage junto
com seu codigo apos a promocao de tutores.

| Criterio desta publicacao isolada | Evidencia | Status |
| --- | --- | --- |
| Excluir codigo de comparacao da promocao | Arvore main 9569b111 + feature de tutores 53603958; nenhum arquivo clinico da comparacao no delta de codigo para main | aprovado |
| Preservar homologacao original | Snapshot 07317874 e branch codex/stage-before-tutores-rotina-20261028 | aprovado |

Os criterios funcionais CA-001 a CA-007 da comparacao nao sao aplicaveis a esta
arvore, pois o recurso esta ausente. Continuam exigidos no ciclo proprio de
publicacao dessa feature. Nenhum gate foi desabilitado ou recebeu excecao.
