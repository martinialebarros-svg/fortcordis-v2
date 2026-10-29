# Plan — Comparação com exames anteriores

1. Reutilizar worktree isolada, partindo de `origin/stage` (`ccc3a6f7`); preservar o clone principal e os artefatos de QA anteriores.
2. Consultar laudos pelo `paciente_id`, com GET protegido pela permissão de visualização existente e sem autoflush, persistência ou geração de PDF.
3. Projetar somente identidade, estado, datas e medidas necessárias. Manter os 18 comprimentos e as unidades explícitas no contexto do detector de ambiguidade; renderizar somente 12 dimensões do VE e AE/Ao.
4. Escolher a última data anterior confirmada; empate exige seleção. Data ausente/futura, mesmo dia, outra modalidade, rascunho e paciente diferente não geram comparação automática.
5. Implementar painel recolhido no visualizador, consulta sob demanda, timeout de 8 segundos, cancelamento, proteção contra resposta obsoleta, erro local e nova tentativa.
6. Uniformizar os aliases caninos exatos já reconhecidos pelo backend nos consumidores frontend. Manter espécie original no payload, fórmulas, domínios, medidas, unidades e salvamento existentes.
7. Testar serviço/rota com SQLite descartável, cálculo e validação frontend, componente e páginas reais. Conferir interface local com dados sintéticos e executar lint, TypeScript, build e guardrail SDD.
8. Entregar resultado local e limitações. Sem commit, push ou deploy neste ciclo.

## Publicação autorizada em 28/10/2026

O ciclo local acima foi concluído. Após o pedido `Deploy origin stage`: conferir referências remotas e fila compartilhada, commitar somente os caminhos validados, abrir PR com base stage, aguardar checks/revisões e merge protegido, aguardar workflow terminal e verificar SHA instalado, runtime e assets servidos. Atualizar a evidência sem marcar conferência visual/autenticada como aprovada se o navegador continuar indisponível. Não promover a main.
