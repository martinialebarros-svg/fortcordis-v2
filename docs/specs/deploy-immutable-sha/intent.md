# Intent — deploy-immutable-sha

Data: 2026-10-22
Status: autorizado para implementação e teste em stage

## Problema

Os gates avaliam `github.sha`, mas os workflows extraem o instalador de
`origin/main` ou `origin/stage` e o instalador volta a resolver essa ponta.
Quando a branch avança durante a fila, outra revisão pode ser instalada. A
assertiva posterior de SHA da sincronização de presets detecta a diferença
depois da instalação.

## Objetivo e limites

Vincular checkout, scripts extraídos e código instalado ao SHA completo do run,
em stage e produção. Preservar os gates, a assertiva da sincronização, os seis
arquivos runtime e o rollback. A homologação de stage terminou no SHA `d1e81bba`. A autorização posterior de
22/10/2026 permite publicar isoladamente esta correção em produção, com backup,
rollback e validação do SHA instalado. Não mudar Auth, dados, catálogo,
serviços, segredos ou o comportamento dos presets.

Chamadas manuais também exigem SHA e ref: não há resolução implícita da ponta.
Antes de configurar qualquer arquivo de ambiente na VPS, os workflows verificam
o objeto aprovado e sua presença na história da branch esperada. Esta etapa
atualiza apenas metadados Git, sem alterar checkout, runtime ou serviços.
