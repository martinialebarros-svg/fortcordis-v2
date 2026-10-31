# Verificação

## Casos automatizados

- Novo laudo canino começa com as seis escolhas da imagem, sem medidas numéricas.
- Importação e edição de valores mantêm as escolhas; derivação e remoção de AE/Ao continuam corretas.
- Métodos alternativos, ondas fundidas e escolha vazia sobrevivem a nova importação e renderização.
- Novo laudo felino, desconhecido ou de outra espécie começa sem protocolo canino.
- Troca de espécie remove as escolhas caninas e preserva valores; retorno a cão reinicializa os padrões.
- Laudos existentes continuam sem preenchimento automático e mantêm invalidação de aquisição.
- Regressões: seletores diastólicos reais, proveniência de unidades, derivação AE/Ao e comparação clínica.

## Execução local

- Vitest: 148 testes aprovados em sete arquivos (hook de medidas, seletores diastólicos, proveniência de unidades, comparação de referências, protocolo felino, referências diastólicas caninas e apresentação do laudo/PDF).
- ESLint dos cinco arquivos TypeScript/TSX alterados: aprovado, sem warnings.
- Guardrail SDD aplicado ao conjunto de arquivos locais alterados e novos: aprovado.
- `git diff --check`: aprovado.
- TypeScript do frontend (`tsc --noEmit -p frontend/tsconfig.json`): aprovado.

Nenhum laudo real foi salvo ou publicado durante a implementação local.

## Publicação autorizada em 31/10/2026

O usuário solicitou a publicação. Base de produção: `8467a2a4522932a5607272a61cb508cd87d7d354`. Snapshot de homologação a preservar: `eb2e8caede40f146394a885d2321e434dd007e37`.

A entrega usa Stage para validar uma árvore isolada composta da produção atual e desta alteração. Após produção e smoke, Stage recupera a árvore de homologação com os novos padrões integrados. Os resultados de CI/deploy/smoke serão registrados ao final, sem gravação de laudos reais.
