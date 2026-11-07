# Verificação — Painel de gestão

Base: origin/main `6d77526db9c5ebf9b7c6457362d153903c7cda7a`. Implementação isolada em `/Users/martiniano/.codex/worktrees/painel-gestao/fortcordis-v2`. Checkout original e trabalho clínico concorrente preservados. Entrega inicialmente validada localmente, antes da solicitação de publicação em stage.

## Evidência local

- **60 testes backend passaram**: `tests/test_gestao_api.py`, `tests/test_gestao_agenda.py`, `tests/test_gestao_financeira.py`, `tests/test_migration_ci_cycle.py`. Executados com SQLite sintético e segredo de teste, sem `.env` real.
- **17 testes frontend passaram**: `app/gestao/page.test.tsx`, `lib/host-routing.test.ts`, `lib/dashboard-shell-routes.test.ts`, via Vitest.
- TypeScript e ESLint focado passaram; `npm run build` completo passou, incluindo lint, tipos e página `/gestao`.
- `git diff --check` passou. Guardrail SDD foi avaliado com lista de arquivos modificados e não rastreados (sem fazer commit/stage), qualificando `painel-gestao`.
- Navegador Chrome em execução local, com API isolada em memória: seis indicadores renderizados, premissas simuladas e salvas, reload preservando valores, mudança de clínica limpando premissas de outro recorte. Sem exceções de página; viewport móvel 390×844 sem overflow horizontal.

## Casos cobertos

Permissão admin no servidor/UI, cálculo HTTP integrado sem escrita, campos vazios versus zero, valores inválidos/não finitos/booleanos, datas e período máximo, janela equivalente anterior sem vazamento de premissas, salvas com contexto, revisão concorrente 409, rollback se auditoria falha, migração idempotente e ciclo completo do runner.

Jornada, exceções, feriados, bloqueios sobrepostos, capacidade global sob filtros, falta de duração, estados desconhecidos, reservas vencidas, cancelamentos, reativações, reagendamentos, intervalos atravessando meia-noite e bordas do recorte, datas legadas/fuso, denominador vazio e ausência de dados sensíveis.

Competência, parciais, agrupados, duplicatas, estornos e novos recebimentos, crédito, legado sem comprovação, precedência OS/contas/transações, parcelas sem vínculo, vencidos, ausência de vencimento, clínicas inativas/ausentes, concentração sem denominador, taxas/líquidos/valores ausentes, recorrência mensal no dia 31, totais completos com 250 detalhes e ausência de N+1/escritas.

Na interface: erros recuperáveis, não admin, serviço de premissas indisponível com simulação mantida, conflito de revisão, respostas antigas, mudança de filtros, vazio e indicadores parciais. Middleware redireciona `/gestao` de domínio institucional para app, preservando filtros e exigindo login.

## Limitações e publicação

Validação exclusivamente local. Nenhuma instalação em stage/produção, consulta ao banco real, alteração de OS/pagamento/agendamento, mensagem, emissão fiscal ou movimentação financeira. A proteção PostgreSQL (RLS e revoke de privilégios) segue o padrão existente e foi revisada no código; sua execução real aguarda a etapa de publicação/homologação. Não houve ensaio de carga com a carteira real. Permanecem avisos de depreciação preexistentes de Pydantic/SQLAlchemy e aviso de catálogo Browserslist antigo, sem falha de build.

Após instalação autorizada, acesso por **Gestão → Gestão do negócio** (`/gestao`) com perfil administrador. O deploy deverá executar a migração `20261025_101`; se ela faltar, salvar/ler premissas apresenta erro recuperável, sem bloquear a consulta simulada. Para conferir visualmente esta entrega, a demonstração local usa apenas parceiros/valores fictícios e não compartilha a base operacional.

## Preparação stage — 26/10/2026

Publicação autorizada exclusivamente em stage. Base remota conferida: `9f9afe2e9d0be0e53552b9e1f23b9622098e2caa`; main observado: `1fb920c2711b5776f095bfb8e6d06d7f7ece76b5`. A maior migração remota é `20261025_100`; `20261025_101` permanece livre. Revisão de compatibilidade das fontes Agenda/Financeiro não encontrou mudanças conflitantes. A alteração de transporte Meta da PR #472 já está integrada e o deploy anterior de stage terminou com sucesso; nenhuma modificação desse transporte faz parte deste painel. A instalação e os testes remotos ainda serão confirmados. Artefatos de demonstração, servidores sintéticos e screenshots locais não integram o pacote publicado.

Revalidação após integração da base stage: 60 testes backend, 17 frontend, lint completo e TypeScript passaram. Pipeline stage passa a executar explicitamente os testes do painel. Pré-verificação remota somente leitura: stage instalado no SHA `9f9afe2e`, produção instalada no SHA `0561a168c449aeb5b763b0fc3b7699c594200654`; o sync felino já existente informou “Nenhuma alteração necessária”. Transporte Meta stage permanece desligado. Nenhum conteúdo ou segredo de produção foi copiado para stage.

## Publicação e comprovação em stage — 26/10/2026

PR [#485](https://github.com/martinialebarros-svg/fortcordis-v2/pull/485) integrada exclusivamente em stage no SHA `0cf39a58a800b025361189fc0e99693595898146`. [Deploy 40381395318](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/40381395318) terminou `success`: quality-gate, SDD, diagnósticos e instalação concluídos. Migration CI, Frontend CI e Google Maps Cost Control também passaram no snapshot. Testes específicos de gestão foram executados pelo quality-gate.

- Checkout remoto confirmou o SHA aprovado; API, frontend e worker stage ativos; `/health` e `/ready` retornaram 200.
- PostgreSQL confirmou migração `20261025_101`, RLS e ausência de privilégios PUBLIC/anon/authenticated na tabela de premissas.
- Canário administrativo somente leitura: GET premissas 200 e POST painel 200, com as seis estruturas atuais e anteriores. A consulta do painel levou aproximadamente 444 ms em uma amostra; não constitui benchmark de carga. Usuário não administrador recebeu 403 nas duas rotas; acesso anônimo recebeu 401.
- Antes/depois: zero premissas, revisão zero e zero eventos de auditoria de gestão, com fingerprints internos idênticos. Não houve PUT, cadastro de fixture, alteração financeira ou de agenda neste canário.
- Chrome real em `https://app.stage.fortcordis.com.br/gestao`: documento 200, seis cartões, atualização de filtro, desktop 1440 px e móvel 390 px. Sem erros de JavaScript, respostas HTTP de erro ou overflow horizontal. Revisão das premissas preservada. Doze scripts presentes no documento renderizado responderam 200; hashes registrados no artefato local.
- Domínios `app.stage`, `stage` e `www.stage` encaminharam corretamente ao login com retorno para `/gestao`.
- Produção comparada antes/depois desta instalação: SHA `1fb920c2711b5776f095bfb8e6d06d7f7ece76b5`, PIDs/início dos três serviços, BUILD_ID, configuração e arquivos runtime idênticos; código de gestão ausente. Um deploy de produção anterior, independente deste painel, já havia terminado antes dessa baseline. Não houve promoção deste painel a main.

Evidências locais sanitizadas em `output/gestao/stage-api-evidence.json`, `stage-browser-evidence.json`, `stage-public-evidence.json` e snapshots runtime. Screenshots locais `stage-desktop.png` e `stage-mobile.png` foram inspecionados. Dados financeiros, tokens e identidades não foram incluídos nos relatórios JSON.

A restauração paralela `a93390d3` foi conferida: os 26 caminhos da entrega permanecem literalmente iguais ao snapshot validado. Essa restauração e posteriores publicações têm sua própria verificação; não foram confundidas com o SHA instalado nesta evidência. Salvamento de cenário foi validado localmente; não se gravaram premissas reais de stage para testar persistência.

## Correção de rastreabilidade dos movimentos do caixa

Apontamento P2 da PR #509, `discussion_r4395903511`: a descrição era salva na premissa, mas descartada ao criar as ocorrências da projeção. Correção preparada sobre stage `ccc3a6f7`: transportar descrição em cada detalhe manual/recorrente e exibi-la na interface, preservando origem/ID e compatibilidade com linhas sem o campo. Sem migração ou alteração de cálculos.

Regressões cobrem duas premissas do mesmo valor com descrições diferentes, recorrência no fim do mês, filtro de região, totais semanais/mensais e contrato HTTP com normalização da descrição sem gravações ou extrapolação ao período anterior. Interface cobre descrições distintas, ocorrências mensais, legado sem campo e HTML renderizado como texto.

Validação local: 59 testes backend de Gestão, 20 testes frontend de Gestão/navegação/host, lint completo, TypeScript e `git diff --check` passaram. Revisão independente do backend não identificou regressão. A sessão administrativa existente em stage foi localizada para o smoke após deploy. Baseline remota somente leitura: stage `ccc3a6f7`, produção `9569b111`, serviços ativos e painel ausente da produção. Publicação comprovada na seção seguinte, em 28/10/2026.

## Comprovação da correção em stage — 28/10/2026

PR [#518](https://github.com/martinialebarros-svg/fortcordis-v2/pull/518), head `813fe2f4c882171ab28b6a689bc9f32a6008bd20`, integrada em stage no SHA `1c78e6405910749d6e014b4ac8cc7a69a6c7c55c`. [Deploy 40699890630](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/40699890630), Frontend CI, Migration CI e Maps Cost Control terminaram `success`.

Antes do smoke final, a PR #519 de Laudos avançou stage para `07317874b7b09eb7e8e1e076e9db4acc1294c90f`, confirmado no checkout remoto. O diff desde o merge da Gestão altera apenas Laudos e preserva os caminhos desta entrega. O [deploy posterior 40703813787](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/40703813787) e seus três CIs também terminaram `success`. As verificações abaixo correspondem a esse snapshot posterior, sem atribuí-lo ao merge original.

- API, frontend e worker stage ativos; `/health` e `/ready` retornaram 200. Migração 101, RLS e revogações de acesso direto confirmadas.
- Canário administrativo somente leitura: GET premissas e POST painel 200; não administrador 403. Estruturas dos seis indicadores válidas nos períodos atual e anterior.
- Cenário sintético 01/10–30/11: duas saídas de R$ 100 em 10/10, com descrições diferentes, uma mensal e outra única. API e tela autenticada mostraram as duas ocorrências de outubro e a mensal de novembro, cada qual com descrição e origem/ID; total por premissas R$ 300, sem extrapolação ao período anterior.
- Navegador confirmou a coluna Descrição e a simulação não salva. A aba temporária foi fechada; a aba original do usuário foi preservada. Nenhum erro de console capturado. Screenshots locais inspecionados; esta rodada não incluiu novo ensaio móvel.
- Canários antes e depois da interação: zero premissas, revisão zero e zero eventos de auditoria de Gestão. Fingerprints internos idênticos em cada canário; nenhum PUT, fixture persistida ou movimentação financeira.
- Domínios `app.stage`, `stage` e `www.stage` redirecionaram `/gestao` ao login preservando o retorno. GET premissas e POST painel anônimos retornaram 401 nos três hosts.
- Assets servidos: os cinco scripts presentes no DOM responderam 200. Os nove chunks de `/gestao/page` no manifest responderam 200 e tiveram SHA-256 idêntico ao arquivo instalado em stage. `app/gestao/page-b3f20735aac8d953.js` contém os marcadores Descrição, Não informada, Movimentos por origem e acesso ao campo `descricao`.
- Produção: snapshot anterior/posterior idêntico, SHA `9569b1113945c453108cfef247b7c70c985d879b`, PIDs/início dos serviços, BUILD_ID e hashes dos arquivos runtime/configuração preservados. Código de Gestão continua ausente; nenhuma promoção a main.

Evidências sanitizadas em `output/gestao/description-{api,api-after-ui,browser,public,bundle}-evidence.json`, snapshots `description-runtime-{before,after}.json` e imagem `description-stage-proof.png`. Valores do cenário são fictícios e não foram salvos. Evidência final registrada localmente após a instalação.

## Recebimento da conta sem composição OS — 31/10/2026

Apontamento P2 [PR #528, discussion_r4431491305](https://github.com/martinialebarros-svg/fortcordis-v2/pull/528#discussion_r4431491305). Na conferência atual, o PR já está integrado exclusivamente em stage (`eb2e8cae`, 31/10 às 08h22 de Fortaleza); a discussão permanece aberta. `main` permanece em `8467a2a4` e não contém `backend/app/services/gestao_financeira.py`. O recebimento por `financeiro.receber_conta` cria transação recebida com marcador da conta e não cria `OrdemServicoPagamento`; compartilhar o agendamento não comprova substituição dessa entrada por um pagamento da OS.

Reprodução com SQLite em memória: conta de R$100 recebida, ligada à OS pendente sem composição, gera R$0 de entradas confirmadas no código anterior. As regressões também reproduziram a perda de recebimento independente e do resíduo de uma transação parcialmente alocada à OS. Carregar a implementação anterior de `origin/stage` em um módulo temporário, sem trocar arquivos, produziu sete falhas nos 31 testes financeiros da primeira rodada; a implementação corrigida passou os 31.

Correção local na branch `codex/gestao-conta-recebida-caixa`: conta recebida segue sua evidência própria; a mesma transação alocada à OS só contribui na conta pelo resíduo líquido. A dedução das alocações é global, antes dos filtros. Transações independentes continuam independentes, mesmo com valor/data/agendamento iguais. Líquido ausente ou rateio inconsistente não reaparecem como recebimento avulso. Contas pendentes conservam o tratamento anterior, sem nova previsão duplicada. Sem atualização de status, saldo ou vínculo financeiro persistido; a reconciliação do caixa não cria composição de pagamento da OS.

Validação final: **72 testes backend de Gestão passaram**, incluindo os 35 financeiros, contrato HTTP, permissões administrativas, filtros, ausência de escrita e fontes da Agenda. Foram cobertos filtros de clínica/região/data antes e depois da alocação, taxas, pagamentos parciais, alocação integral, legado, estorno, rateio inconsistente, líquido desconhecido e preservação das pendências. `git diff --check` e guardrail SDD passaram; sem mudanças de frontend, migração ou contrato HTTP. Permanecem somente os avisos preexistentes de depreciação de Pydantic/SQLAlchemy.

A validação usa ambiente limpo, SQLite sintético e segredo de teste, sem `.env`, banco real ou rede. Revisão independente confirmou a causa e os limites da deduplicação. Um caso contraditório de conta pendente com transação recebida foi excluído da ampliação desta mudança para preservar o tratamento anterior. Nenhuma consulta a dados operacionais, alteração financeira, migração, envio de mensagem, push, integração ou deploy faz parte desta correção local. A discussão do PR não foi respondida nem resolvida automaticamente.


## Preparação da publicação financeira — 01/11/2026

Usuário autorizou integrar a correção e publicar exclusivamente em Stage, repetindo a validação financeira e preservando produção. Base `a7b97cff25a10fb6dd61fdc11dc75f949b2a0b72`; produção `7430d5d8f9054f80cb9ee61e284462c4b6226892`. O patch de 31/10 foi aplicado nesta base sem conflito, preservando o worktree original e suas alterações locais.

A revisão independente reproduziu uma dupla contagem quando uma composição da OS referencia a segunda transação automática da mesma conta. A reconciliação passou a considerar todos os espelhos identificados pelo marcador exato da conta; coincidências de data, valor ou agendamento continuam sem definir duplicidade.

Composições que, somadas entre espelhos exatos da mesma conta, excedem o bruto da obrigação/transação ou seu líquido agora excluem o grupo do caixa com lacuna explícita, antes de filtros. Foram acrescentadas regressões para segundo espelho, agregação parcial, excesso bruto/líquido, filtros, ausência de líquido e independência de contas diferentes. A correção não cria pagamentos OS nem altera o saldo/status persistido: caixa confirmado e composição da OS continuam fontes distintas.

Validação desta base: **83 testes de Gestão passaram, incluindo 46 financeiros e cinco subcasos**; lint frontend completo, TypeScript, AST Python e `git diff --check` passaram. Guardrail SDD aprovado. Revisão independente concluiu sem achado bloqueante neste escopo. O canário administrativo remoto anterior ao deploy retornou 200 para GET premissas/POST painel e 403 para não admin, com seis métricas válidas e premissas/revisão/auditoria inalteradas. Nenhuma fixture financeira persistida.

Pré-verificação remota: destino e banco Stage distintos da produção, autenticação legada, migrações existentes aplicadas, OCR por/eng disponível e nenhum override de worker herdado na sessão SSH. Wrapper fixa serviços/portas Stage, não recarrega Nginx e mantém Meta desligado. Baseline de produção contém SHA, serviços, BUILD_ID, configuração e dez hashes de arquivos, incluindo os seis artefatos de runtime preservados pelo deploy. Nenhuma migração nova ou mudança de frontend. Validação e publicação finais ainda serão registradas após os respectivos resultados.

## Publicação financeira em Stage — 01/11/2026

PR [#535](https://github.com/martinialebarros-svg/fortcordis-v2/pull/535), head `7a65796236c3b7095fc32c6f1063e91906f1a175`, integrada exclusivamente em Stage no SHA `4a7e24d6c33aadbcf3d629fe4dbd1233694ac61b`. Os cinco checks da PR passaram; revisão Codex terminou sem achados no head aprovado. Revisão Claude foi dispensada pelo provedor por limite de uso, sem ser contada como aprovação.

[Deploy 41333933065](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/41333933065) terminou `success`, com quality-gate, SDD, diagnósticos e instalação concluídos. Frontend CI `41333933023`, Migration CI `41333933075` e Maps Cost Control `41333933111` também terminaram `success` no mesmo SHA.

- Checkout remoto confirmou o merge aprovado. API, frontend e worker Stage ativos e reiniciados; Meta Stage permanece inativo.
- **46 testes financeiros passaram novamente com o código instalado**, sem falhas ou erros. Serviço e teste foram comparados byte a byte com o commit instalado e copiados para diretório temporário; origem do módulo importado e hash foram conferidos. Execução em SQLite em memória, com ambiente mínimo e sem copiar `.env` ou dados reais. Diretório temporário removido ao concluir.
- API instalada: GET premissas e POST painel administrativos 200; não administrador 403 em ambas. Seis estruturas atuais/anteriores válidas; descrições/recorrência da simulação preservadas. Antes/depois do canário: zero premissas, revisão zero, zero auditorias de Gestão e fingerprints internos iguais. Sem PUT nem movimentação financeira real.
- Produção comparada antes da publicação, imediatamente antes do merge e após instalação: SHA `7430d5d8f9054f80cb9ee61e284462c4b6226892`, PIDs/início dos três serviços, BUILD_ID e dez hashes idênticos; código de Gestão ausente. Nenhuma promoção para main.
- Limite da sondagem pública: consultas diretas ao domínio canônico terminaram em login 200, preservando `/gestao`; GET/POST anônimos retornaram 401 após instalação. Outras tentativas de conexão HTTPS e SSH expiraram antes da resposta. A causa da intermitência não foi estabelecida. A sondagem combinada de aliases e de todos os chunks **não concluiu** e não foi contada como aprovada. O SHA/manifest permaneceu estável nas leituras que concluíram. Não houve nova validação visual autenticada; esta mudança não altera frontend.

Evidências locais: `output/gestao/recebimentos-installed-suite.json`, `recebimentos-api-{before,after}.json`, `recebimentos-runtime-{before,at-merge,after}.json`, `recebimentos-release.json` e tentativas de `recebimentos-public-evidence.json`. Publicação e regressões financeiras concluídas; permanece a repetição da sondagem pública completa quando a conectividade estabilizar. Registro final mantido localmente após a instalação.

## Candidata isolada e homologação — 06/11/2026

Autorização: preparar e homologar Gestão preservando os trabalhos paralelos de Stage; produção não autorizada. Candidata em `codex/gestao-candidata-20261106`, base main `ebec9de6aaa8c52109873d9febd00947cd4b9bf7`, fontes próprias trazidas de Stage `90bd01cac3913e51c33fddc210e8e7e6fbd5d70e`. O runner de migrações permanece o de main; a otimização paralela de catálogo não é necessária. A implementação de Gestão permanece igual à origem, com testes PostgreSQL adicionais e cobertura de navegação preservada para Tutores e Gestão.

Validação local concluída até esta preparação:
- 98 testes passaram mais cinco subcasos: 83 de Gestão, nove PostgreSQL e seis de migração. PostgreSQL 16.13 descartável comprovou persistência entre sessões, contexto, zero versus ausente, duas conexões concorrentes (um 200/um 409), rollback após flush da auditoria, ausência de SQL para não administrador, simulação das seis estruturas sem escrita, RLS/revokes e aplicação tardia da migração101 após107. Roles/esquemas preservados e cluster encerrado/removido.
- Primeira execução do novo harness teve duas falhas de asserção (representação do fuso e dataclass imutável), corrigidas apenas no teste; evidência original preservada.
- Frontend completo: 2.631 Vitest e 23 Node passaram. Build incluindo tipos passou; ESLint completo passou. A navegação complementar é verificada separadamente após a ampliação dos cenários.
- Suíte geral backend executou 2.586 testes, com 146 skips de integrações opcionais e um erro OCR do ambiente macOS ao acessar caminho temporário `/tmp`. O arquivo de aplicação não mudou: repetição focada dos três testes OCR com TMPDIR físico descartável passou. A falha original permanece no relatório; não é contada como execução geral integralmente verde.
- Revisões independentes da integração e da nova suíte PostgreSQL não encontraram achados materiais.

Instrumentos e evidências em `output/gestao-candidata-20261106/`, incluindo `backend-qa/summary.json`, logs completos e o snapshot de escopo. O singleton de premissas é homologado com gravação apenas em banco sintético descartável; Stage operacional recebe somente consultas. Homologação visual final, instalação temporária da candidata em Stage e restauração paralela serão registradas após seus resultados, sem antecipar aprovação.

Homologação local integrada concluída:
- API e interface reais sobre banco SQLite em arquivo descartável: 29 valores/condições comparados com um oráculo calculado independentemente, abrangendo os seis indicadores, capacidade global, janela anterior e separação das fontes de caixa. Sem mutação das tabelas operacionais na consulta.
- Navegador: 74 verificações de fluxo, dez após reinício efetivo da API e oito verificações visuais passaram. Incluem simulação sem escrita, salvamento/reload, contexto de clínica/região/período sem herdar premissas, nulos versus zeros explícitos, conflito409 entre dois administradores, recuperação503, descrição HTML tratada como texto, acesso não administrador e ausência de requisições externas inesperadas.
- Após reinício, o cenário e todas as tabelas fictícias permaneceram idênticos. Recuperação de cenário feita pelo PUT com revisão atual, mantendo auditoria monotônica no banco descartável.
- Capturas desktop e móvel390×844 inspecionadas; campos e cartões acessíveis, sem overflow horizontal. A primeira captura móvel registrou a transição do menu; substituída por evidência com menu fechado. Falhas iniciais de seletores do harness foram preservadas e corrigidas sem mudança de aplicação.
- TypeScript completo (`tsc --noEmit`) passou. Os dez cenários parametrizados de roteamento de Tutores/Gestão passaram após a ampliação; a suíte geral anterior não é somada a esta repetição.
- Prova de fontes: os15 caminhos de aplicação/migração/navegação permanecem byte a byte iguais ao Stage de origem. Revisões independentes sem achado material, SDD pré-commit aprovado. Evidências em `frontend-qa/{initial-result,restart-result,visual-result,api-oracle}.json` e `application-source-proof.json`.

Este resultado conclui a homologação local da candidata. A instalação/homologação pública em Stage e a restauração paralela ainda dependem do fechamento da janela já ocupada por Laudos; não houve instalação remota nem mudança de produção nesta preparação.


## Homologação da candidata instalada em Stage — 07/11/2026

Após liberação da janela de Laudos, Stage foi salvo em `2b04bacb8696b42f1afd3d8e9702768aded9271c`, incluindo a mesclagem de pacientes da PR #574. [PR #572](https://github.com/martinialebarros-svg/fortcordis-v2/pull/572) instalou `480170a1491ec8784125b008eae60d1b0c3b8939`. O código, testes, migrações e workflows são idênticos à candidata `052f3080`; a única diferença de árvore são quatro documentos SDD da mesclagem, preservados do snapshot para não remover uma feature documental inteira durante a janela. Não houve bypass do guardrail.

[Deploy 42380921681](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/42380921681), Frontend CI, Migration CI e Maps terminaram com sucesso no merge instalado. A suíte geral Linux executou 2.586 testes com 147 skips, sem falhas; o problema OCR local do Mac não se repetiu. Gestão passou 83 testes com cinco subcasos e nove testes PostgreSQL no quality-gate. O Deploy Discard Guard foi pulado por condição e não é contado como validação.

- Código financeiro instalado conferido por hash e executado em cópia temporária sem `.env`: 46 testes passaram, sem falhas ou erros, SQLite em memória e limpeza concluída.
- API instalada: GET premissas e POST painel administrativos retornaram 200; não administrador recebeu 403 em ambos. As seis métricas atuais e anteriores, período, descrições e recorrência da simulação foram conferidos. Premissas, revisão e eventos de auditoria de Gestão permaneceram em zero; fingerprints internos antes/depois idênticos, sem PUT ou mutação financeira.
- Sondagem pública: três domínios de Stage preservaram o retorno de `/gestao` ao login; GET premissas e POST painel anônimos retornaram 401 no canônico. Os nove chunks do manifest retornaram 200 com SHA-256 idêntico aos instalados e os marcadores esperados. Quinze requisições HTTP, nenhum retry de transporte, SHA/manifest estáveis. A amostra não estabelece causa ou resolução permanente dos timeouts históricos.
- Snapshots antes, durante e após instalação confirmaram produção `ebec9de6`, serviços/PIDs/início, BUILD_ID e hashes medidos preservados. Nginx, arquivos runtime de Stage e configuração de Stage exceto o identificador esperado da release também permaneceram idênticos.
- Migração 108 já aplicada foi mantida durante o isolamento: coluna/tabela, RLS/revogações, onze triggers de vínculo, um de preservação e funções/definições com fingerprints idênticos. Nenhum downgrade ou remoção de proteção.
- A validação visual autenticada desta instalação não foi concluída: a sessão do navegador expirou e permanece na tela de login. Entrada solicitada ao usuário, sem solicitar credenciais no chat. A UI local já passou 74 verificações, dez após reinício e nove visuais/móveis; esse resultado não é apresentado como navegação autenticada em Stage.

Evidências sanitizadas em `output/gestao-candidata-20261106/`: `api-isolated-candidate.json`, `financial-installed-candidate.json`, `public-isolated-candidate.json`, snapshots runtime/migração108, qualidade CI e `release-plan.json`. A restauração está preparada pela [PR #573](https://github.com/martinialebarros-svg/fortcordis-v2/pull/573), conservando 2.664 caminhos paralelos do snapshot; sua instalação terminal será registrada no relatório da execução. Produção não foi autorizada nem alterada.


### Correção do teste de migrações na restauração — 07/11/2026

A primeira restauração, merge `32793943` da PR #573, teve deploy impedido pelo quality-gate `42382707168`: a suíte geral passou 2.652 testes com 147 skips, mas o teste PostgreSQL novo comparava a versão corrente com o literal 107 enquanto Stage contém 108. Oito testes PostgreSQL passaram e um falhou; a instalação não começou, mantendo a candidata `480170a1` no servidor. O log original foi preservado, sem rerun cego nem bypass.

Correção exclusiva do teste: comparar a versão corrente com a maior versão descoberta e já registrada; verificar essa condição antes e depois de aplicar a 101, quantidade total aplicada, pendências zero, segunda execução zero, timestamps e dado de preservação idênticos. Aplicação, migrações e workflow não foram alterados.

Reprodução em exportação da árvore restaurada `32793943`: original com oito sucessos e uma falha idêntica ao CI; correção com nove sucessos. Na base isolada da candidata, os mesmos nove testes corrigidos passaram. Todos em PostgreSQL local descartável, sem skips/erros nas execuções corrigidas, roles e schemas preservados, clusters encerrados/removidos e exportação limpa. Fontes backend fora do teste permaneceram idênticas. Evidências em `backend-qa/migration-order-restore-20261107/` dentro da pasta da homologação. Uma nova PR de Stage levará somente teste e estes dois documentos, mantendo o restante da restauração.
