# Verificação

## Casos automatizados

- Novo laudo canino começa com as seis escolhas da imagem, sem medidas numéricas.
- Importação e edição de valores mantêm as escolhas; derivação e remoção de AE/Ao continuam corretas.
- Métodos alternativos, ondas fundidas e escolha vazia sobrevivem a nova importação e renderização.
- Novo laudo felino, desconhecido ou de outra espécie começa sem protocolo canino.
- Troca de espécie remove as escolhas caninas e preserva valores; retorno a cão reinicializa os padrões. Fusão observada e separação não confirmada sobrevivem nas duas direções.
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

A suíte completa do primeiro CI identificou cinco falhas: quatro expectativas anteriores de campos vazios nos novos laudos caninos e uma regressão de fusão após troca de espécie. A política agora preserva fusão observada/separação não confirmada, com teste de regressão próprio; os testes de salvamento foram alinhados aos padrões caninos. Nova execução integral aprovada antes da integração: 2.403 testes Vitest + 23 testes Node, além dos 76 testes focados de páginas e estado do formulário.

## Evidência do Stage isolado

PR #529 integrado em `fcb37b1a73671c4824e72723ba5ea6684e1aadeb`. Run `41200322212` concluído com sucesso: quality-gate, SDD, diagnóstico de persistência e deploy; canário autenticado e backup/restore aprovados.

Smoke de 31/10/2026: domínios `app.stage.fortcordis.com.br`, `stage.fortcordis.com.br` e `www.stage.fortcordis.com.br` responderam 200 na entrada e redirecionaram o novo laudo para login sem sessão; API de laudos retornou 401. O manifesto instalado identificou os chunks da rota; o objeto completo dos seis padrões foi confirmado no chunk público `2851-36a8146690704a2f.js`. A sessão Safari não estava autenticada no Stage; a verificação visual autenticada fica para a sessão existente de produção.

PR #530 promoveu somente os dez arquivos da entrega para produção, commit `336a0e25837781edb8c5d928594e57836f790c16`. Esta restauração do Stage será integrada após o término e a conferência do deploy de produção. A árvore preservada mantém as funcionalidades anteriores de homologação e os novos padrões, com ancestralidade de produção.
