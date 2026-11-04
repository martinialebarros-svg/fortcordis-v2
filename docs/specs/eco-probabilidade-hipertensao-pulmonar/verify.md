# Verificação — Probabilidade de HP

Implementação autorizada em 02/11/2026, validada localmente. Nenhuma publicação ou validação remota deste incremento deve ser inferida das entregas anteriores.

| ID | Status | Evidência |
| --- | --- | --- |
| HP-01 | aprovado local | Matriz e fronteiras em 52 casos compartilhados TS/Python; testes dos estados não mensurável, incompletos e aliases. |
| HP-02 | aprovado local | Qualidade, TRV positiva/finita, VSVD, revisão vigente e espécie bloqueiam classificações indevidas; sítio vazio não é normal. |
| HP-03 | aprovado local | Métricas só sugerem sinais positivos, cada sítio conta uma vez; aceitação ou exclusão explícita em testes de componente/helper. |
| HP-04 | aprovado local | RPAD parcial/inválido sem fallback; TA/TE no mesmo traçado; PR inicial separado; overflow/underflow AP/Ao bloqueado. Importação com rótulo/unidade e conflitos testados. |
| HP-05 | aprovado local | Mudanças relevantes e reimportação de mesmo valor invalidam; restore literal preserva. 50 stamps realmente gerados por TS foram aceitos por Python. |
| HP-06 | aprovado local | HTTP SQLite isolado: criação, reabertura, edição e atualização atômica/recuperação; codec protege zero, vazio e nota multilinha contra injeção de linhas. |
| HP-07 | aprovado local; remoto pendente | Renderer recalcula antes da normalização; loaders direto/portal convergem. PDFs sintéticos canino alta/pendente e felino descritivo extraídos/renderizados e inspecionados. Fontes ao final e conclusão preservada. |
| HP-08 | aprovado local | Matriz canina legada corrigida, graduação felina arbitrária removida e saneamento de graduações do provider nos dois canais de sugestão, inclusive fallback sem medidas. Preserva descrições/negação local e insere somente grau revisado determinístico. Foco final AI+HP: 85 testes aprovados. |
| HP-09 | aprovado local; stage pendente | Componente compartilhado testado com interação jsdom; SSR isolado inspecionado via CUA em desktop e 390px, sem overflow horizontal. Sem autenticação/persistência remota nesta prova. |
| HP-10 | aprovado local, com foco final após ajustes | Backend completo 2597 testes +2519 subtestes, 175 skips; frontend completo 2738 Vitest +23 Node. Tipos, lint e build45 aprovados. Após ajustes: frontend101, backend127 (PDF/extração/HP), AI+HP85 e TypeScript final aprovados; conjuntos se sobrepõem e não são somados. |

## Evidências e limites

- Worktree: `/Users/martiniano/.codex/worktrees/eco-pdf-image-flow/fortcordis-v2`, branch `codex/echo-pulmonary-probability-20261102`, base `461a1a414cbab64ea16217a0c263efdf27271198`.
- Backend completo executado com SQLite temporário, DNS/sockets bloqueados e sem chamadas a provedores. Log local ignorado pelo Git: `output/echo-hp-backend-full-tests.log`; primeira tentativa parou na coleta por PYTHONPATH legado, corrigido somente no ambiente. Skips são testes opt-in/dependências, não prova de PostgreSQL remoto.
- Frontend completo precedeu o ajuste descritivo para espécies não caninas; foco posterior cobre helper/componente/recovery. Backend completo precedeu os dois ajustes finais identificados em revisão; regressões pertinentes foram repetidas, sem alegar nova suíte global depois de cada detalhe.
- Stamps de interoperabilidade: `output/echo-hp-ui-20261102/client-review-stamps.json` (50 casos). Fixture pública final contém 52 casos, incluindo extremos numéricos acrescentados depois.
- Capturas CUA: `output/echo-hp-ui-20261102/painel-canino-compacto.png` e `painel-canino-390.png`. Viewport restaurado, aba temporária fechada e servidor local encerrado.
- PDFs: `output/pdf/hp-20261102/hp-canino-alta.pdf` (2 páginas), `hp-canino-revisao-pendente.pdf` (2 páginas) e `hp-felino-descritivo.pdf` (1 página). Revisão visual descobriu Spacer final que criava página vazia sem imagens; movido para o bloco de imagens, com regressão e nova renderização sem página vazia. Os arquivos antigos de render são intermediários; `final-*` e PDFs regenerados representam a versão final.
- Publicação, smoke autenticado de novos/edição em stage e download efetivo de PDF/portal são próxima homologação, dependente de pedido de publicação. Não houve commit, push, deploy ou modificação de laudo real nesta etapa.
- Revisão clínica independente conferiu matriz/sítios/limiares/fontes e reproduziu dois P2: AP/Ao derivado não finito e frase de graduação do provider fora da regex antiga. Ambos corrigidos com regressões; saneamento também cobre `conclusion_suggestion`, campo valvar e HP inativa/sem TRV. Dados e narrativa médica persistidos permanecem preservados.

Limites: a classificação canina não representa confirmação invasiva de HP nem graduação automática leve/moderada/grave. Felinos têm avaliação descritiva. Nenhum laudo real ou cadastro de produção integra os testes.

## Publicação autorizada em stage — 02/11/2026

O pedido “publique”, após a oferta explícita de homologação em stage, autoriza este ambiente. Produção permanece fora do escopo. Fetch inicial confirmou stage `461a1a414cbab64ea16217a0c263efdf27271198` e main `3f134432527b289fbaf1aeedc7f645d2e8a17961`; última publicação stage e checks terminais aprovados. Nenhum workflow recente em execução/fila foi observado. Branch de HP está nessa base, sem delta remoto a integrar. Commit inclui apenas HP; os documentos locais de laudo-fluxo-confeccao e output anteriores permanecem fora.

Estado inicial da publicação: PR/checks/deploy e homologação remota ainda não executados. Sucesso local não comprova instalação no servidor; substituir este estado somente com evidência terminal e smoke do SHA instalado.
