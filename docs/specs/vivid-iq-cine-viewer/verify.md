# Verify - vivid-iq-cine-viewer

Data: 2026-10-26
Responsavel: Codex
Status: fase 9 validada em stage; promocao isolada para producao autorizada em 2026-10-26

## Release da fase 9 — 2026-10-26

O usuario autorizou publicar as melhorias do visualizador em producao. Essa
autorizacao nao inclui os demais recursos atualmente em stage. A entrega usa
PR direto stage -> main, sem bypass dos checks ou excecao de criterios.

### Evidencia de stage concluida

- A restauracao PR #479 instalou `a93390d326f6ff0133eed41e7cab45ecda6d687c`.
  Workflow `40383527861` terminou com quality-gate, SDD e deploy aprovados;
  logs confirmaram SHA instalado, seis arquivos runtime preservados/restaurados,
  canario autenticado, integridade SQLite e drill de restore aprovados.
- Os 12 caminhos do visualizador (fonte, testes e SDD) dessa restauracao sao
  identicos aos aprovados em `6ca18d7741f2a2978baa3df9ce6d4ac7f0a83712`.
  Parser, geometria, viewport e helper de reproducao nao mudaram nesta fase.
- Em sessao stage ja autorizada, dois DICOM sinteticos sem extensao abriram
  com input multiple, 30 quadros e 2,90 s. O primeiro reproduziu ate 30/30.
  Navegacao anterior/proximo e abertura direta trocaram o arquivo pausado no
  primeiro quadro; adicionar preservou o ativo e substituir descartou a lista.
- Arquivo sintetico invalido mostrou erro controlado e retentativa; navegar
  ao anterior recuperou o cine valido. Remover arquivo inativo preservou o
  ativo; remover o ativo abriu o arquivo anterior. Limpar exame deixou zero
  colecao e zero player; a aba temporaria foi encerrada.
- Os dois dominios de stage responderam corretamente: raiz 200, redirecionamento
  do viewer ao login sem sessao, API anonima `/api/v1/auth/me` 401. Todos os
  15 assets observados no DOM autenticado retornaram 200. O chunk do viewer
  continha `Arquivos selecionados`, `Adicionar arquivos`, `Arquivo anterior`
  e `Substituir arquivos` (SHA256 `d5ad0972db19e8566b3ebc0d5571ebf68298f86f88ffdd66d62fe13175dc7547`).
- Evidencia visual sintetica local: `/tmp/fortcordis-vivid-stage-validado-20261026.png`.
  Nenhum exame real foi usado nessa verificacao remota. A evidencia nao e
  homologacao clinica de geometria, orientacao, escala ou medidas.

### Composicao isolada da promocao

- Na composicao isolada, a suite completa passou: 123 arquivos Vitest / 1.428
  testes, mais 23 testes Node, total 1.451. Vitest usou dois workers, sem
  alterar timeout ou codigo. Lint, TypeScript, build (43 paginas; viewer
  20 kB / first load 159 kB), 10 checks do auth-proxy-smoke e os guardrails
  SDD/promocao passaram. So avisos nao bloqueantes de Browserslist/jsdom.

- Baseline de producao: `7124680b8312f0bef0c9cc799f7a4ce8a0024602`.
- Snapshot stage preservado: `4cd0e899915e625bcd971f214bc34ce09feabea1`.
  O diff tinha 64 caminhos; apenas seis pertencem a esta autorizacao:
  pagina, teste da pagina e os quatro documentos SDD do visualizador.
- Os outros 58 caminhos ficam temporariamente no baseline de producao durante
  a promocao e devem ser restaurados byte a byte a partir do snapshot preservado
  por PR separado para stage. Incluem Gestao/migracao 101, Agenda, Maps e
  configuracao; nao sao promovidos como parte do visualizador.
- A arvore candidata deve diferir de producao somente nesses seis caminhos.
  Nao alterar o publicador padrao, parser, autenticacao, backend, migrations,
  dados, presets ou frases em producao. O rascunho frontend-only antigo nao e
  usado nesta entrega; o pipeline padrao mantem seus checks e preservacao runtime.
- A evidencia de producao e da restauracao final de stage sera registrada nos
  PRs/workflows apos os resultados terminais; este preflight nao afirma que a
  promocao ja ocorreu. Revalidar refs/escopo imediatamente antes de cada merge.

## 0) Validacao da fase 9 - 2026-10-25

Escopo: abrir e navegar uma colecao local de varios arquivos, mantendo somente
o cine ativo decodificado. As matrizes e autorizacoes de release anteriores
abaixo sao historicas; nao comprovam nem autorizam publicacao desta fase.

| ID | Tipo | Evidencia nesta rodada | Status |
| --- | --- | --- | --- |
| CA-031 | aceitacao | testes de input multiple/drop e ordem recebida; navegador abriu primeiro DICOM sem extensao pausado | ok local |
| CA-032 | aceitacao | testes de adicao preservando ativo/ajustes/reproducao e leitura pendente; seletor principal substitui colecao | ok local |
| CA-033 | aceitacao | testes de selecao e limites; navegador avancou para B e voltou a B apos arquivo invalido | ok local |
| CA-034 | aceitacao | testes aceitam 100 e recusam lote inicial/adicao/substituicao excedentes sem alterar colecao/ativo | ok local |
| CA-035 | aceitacao | testes do limite 512 MB por ativo, erro/cancelamento/retentativa; navegador manteve lista apos erro | ok local |
| CA-036 | aceitacao | testes de abort/requestId, callbacks/PNG tardios e reset; troca em foco no navegador fechou dialogo e liberou rolagem/inert | ok local |
| CA-037 | aceitacao | testes de remocao ativa/inativa/ultima, renumeracao e limpeza durante leitura pendente | ok local |
| CA-038 | aceitacao | testes confirmam leitura apenas do ativo e nova leitura ao retornar, sem cache de cines | ok local |
| CA-039 | privacidade | testes mantem parser/PNG genericos e identidade opt-in; nomes somente na interface local da sessao | ok local |
| CA-040 | regressao | 23 testes anteriores da pagina, 12 do helper e 23 do parser verdes; navegador confirmou foco/geometria/mobile | ok local |
| NFR-003 | memoria | estado de um buffer ativo, descartado na troca/limpeza; testes sem leitura antecipada dos inativos | ok local |
| NFR-008 | colecao local | testes do teto de 100 referencias File e cancelamento/invalidez de callbacks ao limpar | ok local |

### Testes automatizados e qualidade

- [x] 75/75 testes focados: 23 Node do parser, 12 Vitest do helper e 40 Vitest
  da pagina (23 anteriores e 17 novos). Fixtures versionadas sao sinteticas.
  Incluem arquivo inativo >512 MB recusado antes de novo FileReader,
  remocao durante leitura pendente com callback tardio e drop na colecao
  preservando reproducao do ativo.
- [x] ESLint completo e TypeScript sem emissao passaram.
- [x] Build de producao passou: 43 paginas, rota do visualizador de 20 kB e
  first load de 159 kB. Build e testes repetidos apos o ajuste responsivo final.
- [x] `git diff --check` e guardrail SDD do diff de trabalho passaram.
- [x] Smoke local de navegacao, recuperacao e responsividade com fixtures
  sinteticas, sem dados identificaveis reais nos logs.

### Navegador local e limites da evidencia

- Previa isolada em `http://127.0.0.1:4317`, com o componente real e um layout
  stub, sem conexao ao backend. Nao e prova do dashboard autenticado publicado.
- Colecao com tres arquivos sinteticos: dois DICOM sem extensao, com 30 quadros
  cada, e um arquivo invalido. O input possui `multiple`; o primeiro abriu
  pausado. Proximo arquivo abriu B; o invalido exibiu erro isolado; Anterior
  arquivo recuperou B, sem autoplay nem perda da lista.
- Mobile 390x844 sem overflow horizontal: largura de conteudo/viewport util
  de 375/375 px, descontada a barra de rolagem de 15 px. Canvas intrinseco
  200x100, proporcao 2:1 preservada.
- Modo foco em 390x844 manteve largura 390/390 px. Anterior arquivo em foco
  abriu A e encerrou esse modo: dialogo ausente, `body.style.overflow` vazio
  e nenhum elemento residual com `inert`. A troca desmonta o alvo anterior
  tambem para encerrar tela cheia; esta rodada nao repete o smoke nativo de
  fullscreen registrado em 13/10.
- Landscape 844x390 sem overflow horizontal: largura util 829/829 px. O
  cabecalho responsivo preserva nome e navegacao sem colapsar no mobile.
  Override de viewport restaurado ao finalizar; evidencia visual sintetica
  local em `/tmp/fortcordis-vivid-multifile.d2peE5/preview.png`.
- Na primeira rodada o SanDisk estava desconectado; foram usadas somente
  fixtures sinteticas. A rodada real apos reconexao esta documentada abaixo.
- Fonte do parser inalterada. Sem backend, migracao, persistencia de arquivos,
  commit ou publicacao nesta etapa; as autorizacoes anteriores nao se estendem
  automaticamente a esta entrega.

### Complemento: SanDisk reconectado - 2026-10-25

- Parser normal, chamado com nome generico `arquivo local`, abriu os quatro
  arquivos abaixo sem avisos. Nao foi chamado o helper de identificacao nem
  copiado DICOM para repositorio, backend ou diretorio temporario.

| Arquivo tecnico | Quadros | Duracao | Dimensoes brutas por bloco | Canvas no navegador |
| --- | ---: | ---: | --- | --- |
| PAME5GG2 | 2.962 | 20,04357 s | 493x126 -> 493x138 | 465x493 |
| PAME5KO4 | 2.651 | 15,45978 s | 493x138 -> 490x138 -> 506x138 | 625x506 |
| PAME8PH0 | 2.861 | 20,01996 s | 326x144 | 408x659 |
| Q1TBHPGK | 1.279 | 10,02053 s | 536x195 | 761x589 |

- Na previa isolada com o componente real, a selecao multipla dos tres
  primeiros arquivos, da mesma pasta, abriu somente o primeiro. Os demais
  permaneceram `Nao aberto` ate serem selecionados. A pasta nao foi usada
  como prova de identidade do paciente ou StudyInstanceUID comum.
- Os quatro cines reproduziram com contador/tempo avancando. A troca durante
  reproducao abriu o seguinte pausado, no primeiro quadro, com zoom 1x e
  trecho integral. Voltar ao anterior releu esse arquivo e reiniciou o cine.
- Ampliacao 2x de PAME5GG2 manteve canvas intrinseco 465x493. PAME5KO4
  permitiu salto ao quadro 2.300, tempo 13,45 s, sem alerta. Modo foco exibiu
  imagem, navegacao, controles e aviso experimental. Ao avancar para PAME8PH0,
  encerrou foco, sem dialogo/inert residual e com overflow da pagina restaurado.
- Remover PAME5GG2, inativo e anterior ao ativo, apenas renumerou a colecao;
  PAME8PH0 continuou reproduzindo (quadro 765 / 5,35 s), com canvas 408x659.
- Q1TBHPGK foi aberto separadamente pelo seletor de substituicao, sem manter
  os arquivos anteriores na colecao. Iniciou pausado em 1/1.279 e reproduziu.
- Identificacao permaneceu fechada em toda a rodada. Nenhum nome de paciente
  ou data clinica foi extraido/exposto no registro. Os originais nao foram
  alterados. Ao finalizar, `Limpar exame` deixou zero canvas, nenhuma colecao
  ou painel de identificacao, nenhum alerta e nenhum elemento `inert`.
- Evidencia visual local sem identificacao em
  `/tmp/fortcordis-vivid-multifile.d2peE5/real-cine.png` (imagem de PAME5KO4).
  Nao ha DICOM real versionado. Fonte e testes nao foram alterados nesta
  rodada; os 75 testes/qualidade da implementacao permanecem a evidencia
  automatizada acima. `git diff --check` e guardrail SDD repetidos apos registro.
- Resultado observado: sem falha nova nos fluxos exercitados. E validacao
  funcional local, nao homologacao clinica de orientacao, escala ou medidas,
  nem prova do dashboard autenticado ou de stage/producao. Fullscreen nativo
  nao repetido; sem commit, push ou publicacao.

### Publicacao autorizada em origin/stage - 2026-10-25

- Autorizacao do usuario: `Deploy origin stage`. Limitada a stage; nenhuma
  promocao para main/producao esta autorizada nesta rodada.
- Base stage observada no preflight: `30388824e0f5fe1777c545188087a297d5fa0894`.
  Main observado: `6d77526db9c5ebf9b7c6457362d153903c7cda7a`.
- Escopo: pagina e testes do visualizador, mais os quatro documentos SDD;
  sem alteracao de parser, backend, migrations, autenticacao ou workflows.
  Preservar integralmente as mudancas paralelas ja presentes em stage.
- Revalidar o snapshot integrado antes do PR; aguardar Frontend CI, Migration
  CI, SDD Guardrail e Deploy to Stage (VPS) terminais. Conferir SHA instalado,
  preservacao/restauracao de runtime, canary e drill de restore.
- Smoke esperado: `/visualizador-vivid-iq` em ambos os dominios de stage,
  marcadores `Arquivos selecionados` e `Adicionar arquivos DICOM` nos chunks
  servidos, e API protegida com `401` sem credenciais. UI autenticada somente
  com sessao stage ja autorizada; registrar eventual lacuna sem usar dados reais
  em requisicoes ou contornar autenticacao.
- Esta secao e preflight, nao declaracao de deploy concluido. PR, SHAs finais,
  workflows e evidencia terminal serao registrados no PR e no resultado da
  publicacao. As observacoes de ausencia de commit/push acima sao historicas
  das rodadas locais, anteriores a esta autorizacao.

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `node --test frontend/lib/vivid-iq-dicom.test.mjs` | ok |
| CA-002 | aceitacao | tres cenarios de erro controlado na suite Node | ok |
| CA-003 | aceitacao | smoke externo: 1.279 quadros, 536x195, 10,02 s, 127,56 fps | ok |
| CA-004 | aceitacao | arquivo real sem extensao carregado pelo seletor local | ok |
| CA-005 | aceitacao | navegador: play chegou ao quadro 114 e passo 1 -> 2 | ok |
| CA-006 | aceitacao | `FileReader` local; teste do componente verifica ausencia de fetch/XHR | ok |
| CA-007 | aceitacao | aviso experimental visivel antes e depois do carregamento | ok |
| CA-008 | aceitacao | link ativo `Visualizador Vivid IQ` no menu Clinica | ok |
| CA-009 | aceitacao | canvas real 326x144 exibido em 603x490 (1,232:1) | ok |
| CA-010 | aceitacao | `PAME5GG2`: 2.962 quadros em dois tamanhos exatos, sem warning | ok |
| CA-011 | aceitacao | `PAME5GG2`: 20,0436 s e taxa media de 147,728 fps | ok |
| CA-012 | aceitacao | setor vertical 465x493 derivado localmente da previa | ok |
| CA-013 | aceitacao | conversao setorial e inversao lateral sem alterar o buffer | ok |
| CA-014 | aceitacao | LUT exaustiva em 31 contrastes x 3 brilhos x 256 intensidades; PNG real cinza em 1,05x | ok |
| CA-015 | aceitacao | testes de cancelamento, arquivo >512 MB, erro/retentativa e callbacks atrasados | ok |
| CA-016 | aceitacao | componente e navegador in-app confirmam fullscreen com aviso/controles, entrada e saida | ok local |
| CA-017 | aceitacao | testes de timestamps, velocidades, limites e loop; navegador repetiu quadros 2-3 | ok |
| CA-018 | aceitacao | helper somente por acao explicita; ocultar/limpar/trocar descarta identificacao | ok |
| CA-019 | aceitacao | fixtures sinteticas de PN/charset, DA/TM/DT, fuso, duplicatas e sequencias | ok |
| CA-020 | aceitacao | teste de contagens divergentes explicita o quadro omitido sem perder os demais | ok |
| CA-021 | aceitacao | teste do componente e PNG real 480x589 com rodape, sem identificacao | ok |
| CA-022 | aceitacao | teste do limite de 100 mil quadros retorna erro controlado | ok |
| CA-023 | aceitacao | testes de foco/Tab/Escape/inert e restauracao; navegador confirma Escape de input | ok |
| CA-024 | aceitacao | recusa simulada de fullscreen ativa modo foco e status recuperavel | ok |
| CA-025 | aceitacao | zoom 3x em CSS mantem canvas/PNG integrais; novo exame e ajuste restauram 1x | ok |
| CA-026 | aceitacao | cinco entradas invalidas e salto valido com pausa; real quadro 1500 conferido | ok |
| CA-027 | aceitacao | teste de visibilitychange pausa sem retomada automatica; retry do mesmo arquivo | ok |
| CA-028 | aceitacao | faixa inclusiva e atalhos A/B; navegador selecionou 1500-1600, 101 quadros | ok |
| CA-029 | aceitacao | testes de setas/F nos botoes e preservacao de Space nativo/campos/selects | ok |
| CA-030 | aceitacao | navegador 390x844 e 844x390, foco e proporcao sem overflow horizontal | ok |
| NFR-001 | privacidade | parser normal sem PII; helper opcional local; testes de ausencia de identidade no PNG/rede | ok |
| NFR-002 | prudencia | nenhuma ferramenta de medida; alerta persistente | ok |
| NFR-003 | memoria | um `ArrayBuffer` fonte e um `ImageData` reutilizado | ok |
| NFR-004 | seguranca | limite 512 MB, 100 mil elementos/quadros e 48 niveis | ok |

## 2) Validacao atual - 2026-10-13

Escopo da rodada: ergonomia, foco/ampliacao, salto preciso, faixa A-B,
recuperacao do mesmo arquivo, atalhos e pausa da aba oculta.

- 58/58 testes focados passaram: 23 Node do parser, 12 Vitest do helper e
  23 Vitest da pagina. Testes da pagina cobrem comportamento observado, incluindo traps
  de foco e preservacao do canvas/exportacao durante ampliacao.
- ESLint completo, TypeScript sem emissao e build de producao passaram.
  Next.js 15.5.23 gerou 43 paginas; rota 18,7 kB / first load 155 kB.
- Guardrail SDD avaliado no diff de trabalho incluindo arquivos novos; nenhum
  staging/commit necessario para essa verificacao. `git diff --check` passou.
- `PAME5GG2` aberto localmente na previa isolada, com 2.962 quadros e canvas
  465x493. Salto para quadro 1.500 mostrou tempo 9,90 s; faixa de A=1.500
  a B=1.600 mostrou 101 quadros e navegacao direta ao extremo A.
- Amplificacao 2x e Ajustar imagem conferidos; dimensoes intrinsecas 465x493
  permaneceram constantes. Foco abriu com fundo inerte e Escape a partir do
  campo de salto devolveu o foco ao botao de origem.
- Tela cheia nativa entrou e saiu no navegador in-app, exibindo imagem, aviso
  e controles. Essa verificacao supersede a limitacao automatizada da rodada
  de 10/10 abaixo; outros navegadores continuam sujeitos a suporte/permissoes.
- Console da previa local sem warnings/erros apos a verificacao.
- Teste responsivo: modo foco em 390x844 e 844x390 manteve imagem proporcional,
  sem overflow horizontal nem sobreposicao de controles. Na janela baixa,
  controles rolam em area propria. Override de viewport restaurado ao terminar.
- A leitura continua local; nao houve backend, prontuario, novos identificadores,
  persistencia, arquivos clinicos no repositorio ou publicacao nesta rodada.

### Evidencias da rodada anterior - 2026-10-10

Escopo: contraste, leitura cancelavel, fullscreen/atalhos, trecho A-B/loop,
identificacao opt-in, PNG com proveniencia e avisos de contagens divergentes.
As evidencias de agosto abaixo sao historicas; nao comprovam a publicacao
destas melhorias.

### Testes automatizados e qualidade

```bash
node --test frontend/lib/vivid-iq-dicom.test.mjs
frontend/node_modules/.bin/vitest run --root frontend frontend/lib/vivid-iq-player.test.ts frontend/app/visualizador-vivid-iq/page.test.tsx
cd frontend && npm run lint
cd frontend && ./node_modules/.bin/tsc --noEmit --incremental false --pretty false
cd frontend && npm run build
git diff --check
```

- 46/46 testes focados passaram: 23 do parser, 12 de imagem/reproducao e
  11 do componente. Fixtures versionadas sao sinteticas, sem dados clinicos.
- ESLint e TypeScript completos passaram.
- Build Next.js 15.5.23 passou, com 43 paginas; rota do visualizador 15,3 kB
  e first load de 152 kB. Aviso nao bloqueante sobre base Browserslist antiga.
- `git diff --check` passou. A funcao `evaluate_guardrail` do guardrail SDD
  foi aplicada ao diff de trabalho, incluindo arquivos novos, sem staging ou
  commit: feature `vivid-iq-cine-viewer` qualificada.

### Arquivos reais e navegador

- Leitura somente local dos dois arquivos externos: `PAME5GG2` com 2.962
  quadros/20,04357 s, sendo 1.098 em 493x126 e 1.864 em 493x138; `Q1TBHPGK`
  com 1.279 quadros/10,02053 s em 536x195. Sem warnings e com todos os buffers
  de quadros consistentes. Nenhum original foi copiado ao repositorio.
- Ambos possuem nome/data/aquisicao; o fuso nao esta informado. Apenas
  presenca e coerencia dos campos foram registradas, sem nomes nos logs.
- Previa isolada local do componente real, sem conexao ao backend, carregou
  `PAME5GG2`, exibiu setor 465x493 e contraste 1,05x em cinza. Painel opcional
  mostrou data do estudo correta e fuso explicitamente ausente; foi ocultado
  depois da verificacao. Nao houve vinculacao a prontuario.
- Trecho A=2/B=3 permaneceu nesses quadros durante o loop e pausou normalmente.
- Download real inspecionado: PNG 480x589, com quadro 465x493 centralizado
  sem deformacao e rodape de 96 px. Indica captura derivada nao calibrada,
  quadro 2/2962, tempo 0,01 s, brilho 0, contraste 1,05x e inversao nao aplicada;
  nao inclui nome nem data do paciente.
- A solicitacao nativa de fullscreen foi recusada na sessao automatizada e
  exibiu erro recuperavel. O alvo completo e a alternancia foram validados em
  teste de componente; ativacao nativa ainda precisa de verificacao manual
  em navegador com gesto do usuario. Nao ha alegacao de prova ponta a ponta
  desse modo nem do dashboard autenticado nesta entrega local.

## 3) Historico de testes automatizados - 2026-08-04

Comandos executados:

```bash
node --test frontend/lib/vivid-iq-dicom.test.mjs
cd frontend && npm run lint
cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false
cd frontend && npm run build
git diff --check
python3 scripts/ci/check_sdd_guardrail.py --base-sha origin/stage --head-sha HEAD
```

Resultados:

- Parser: 5/5 testes passaram, incluindo proporcao 2D, fallback nativo,
  pixels/timestamps e tres falhas controladas.
- Smoke externo somente leitura: `Q1TBHPGK`, GE Vingmed Ultrasound / Vivid iq,
  `2D+Trace`, preview 1016x708, cine 536x195, 1.279 quadros, 10,0205 s e
  127,5595 fps; nenhum dado identificavel foi impresso ou persistido.
- ESLint completo: passou sem warnings.
- TypeScript: passou sem erros.
- Build Next.js 15.5.14: 40 paginas geradas; `/visualizador-vivid-iq` compilou
  como rota estatica de 8,99 kB apos a correcao.
- `git diff --check`: passou.
- Guardrail SDD: passou contra o `origin/stage` atualizado; somente a feature
  `vivid-iq-cine-viewer` foi qualificada no diff final.

## 4) Historico de testes manuais - 2026-08-04

- Carregar o DICOM real externo sem extensao: concluido no navegador local.
- Reproduzir e navegar quadro a quadro: concluido; reproducao atingiu o quadro
  114 na primeira observacao, terminou no 1.279 e o passo unitario mudou 1 -> 2.
- Alterar velocidade: concluido; seletor confirmou `2x`.
- Confirmar ausencia de erro de console: concluido; zero warnings/erros.
- Confirmar ausencia de requisicao de upload: concluido por arquitetura e
  inspecao do fluxo local; o dashboard manteve apenas suas requisicoes normais
  de autenticacao/branding.
- Revisao visual inicial: cine exibido com controles responsivos.

### Correcao de proporcao visual - 2026-08-04

- O arquivo real `Q1TBHPGK` manteve os pixels brutos 536x195 e passou a usar a
  regiao 2D 761x589, alterando somente a apresentacao de 2,749:1 para 1,292:1.
- Um arquivo real `2D+Trace+MM` do mesmo conjunto manteve os pixels brutos
  326x144 e usou a regiao 2D 324x263, alterando somente a apresentacao de
  2,264:1 para 1,232:1.
- No navegador local, o canvas 326x144 mediu 603x490 CSS (1,23195:1), com
  proporcao coincidente com a regiao do equipamento e sem erros de console.
- O arquivo permaneceu local; apenas metadados tecnicos seguros foram impressos
  durante o smoke.

### Correcao multibloco e orientacao setorial - 2026-08-04

- A suite sintetica passou em 9/9 cenarios: pixels/timestamps, mudanca de
  dimensao entre blocos, extracao local da previa JPEG, mapa setorial,
  estimativa prudente da proporcao e falhas controladas.
- `PAME5GG2` passou de uma leitura incorreta de 2.863 quadros em 493x138 para
  2.962 quadros exatos: 1.098 em 493x126 e 1.864 em 493x138. O aviso de buffer
  incompleto desapareceu e a transicao 1.098 -> 1.099 foi inspecionada sem
  deslocamento dos pixels.
- A linha temporal de `PAME5GG2` permaneceu em 20,04357 s e a taxa media passou
  a 147,728 fps. A proporcao 0,943:1 foi obtida na memoria local a partir da
  maior regiao neutra da previa encapsulada; o canvas derivado ficou 465x493.
- A conversao profundidade x feixes para setor vertical foi inspecionada em
  `PAME5GG2`, em um cine `2D+Trace+MM` 326x144 e em `Q1TBHPGK` 536x195. Os
  quadros derivados mostraram apice superior, profundidade vertical e arco
  inferior, mantendo as medicoes desativadas.
- Smoke em lote somente leitura: 34/34 arquivos de outubro de 2025 e 54/54 de
  janeiro de 2026 foram analisados sem erro. Quatro cines com dimensoes variaveis
  foram preservados por bloco; nenhum arquivo clinico foi copiado ao repositorio
  ou enviado ao backend.
- Regressao real: `Q1TBHPGK` permaneceu com 1.279 quadros, 10,0205 s e regiao
  761x589; `Q1TBJA8U` permaneceu com 1.421 quadros, 10,0183 s e regiao 324x263.
- `npm run lint`, `tsc --noEmit`, build Next.js 15.5.14 e `git diff --check`
  passaram. A rota compilada passou a 10,8 kB, com 40 paginas estaticas geradas.

### Evidencias de release historico - 2026-08-04

- Stage publicou o snapshot `99781bc067494243cf346aab92019b4428d3c462`.
- `Migration CI` (`30876545082`) e `Deploy to Stage (VPS)` (`30876545092`)
  terminaram com sucesso; neste ultimo, `sdd-guardrail`, `quality-gate`, deploy
  e canario tambem ficaram verdes.
- Em stage, os hosts `stage.fortcordis.com.br` e
  `app.stage.fortcordis.com.br`, inclusive a rota
  `/visualizador-vivid-iq`, responderam `200`; `/api/v1/auth/me` sem token
  respondeu `401`.
- Os 13 chunks JavaScript referenciados pela pagina de stage foram baixados e
  inspecionados; dois continham os marcadores esperados do visualizador.
- Producao recebeu o merge `26a1ac21c97aa0e43c8b11916f14a990a4e37271`,
  contendo integralmente o snapshot validado de stage.
- `Migration CI` (`30877169340`) e `Deploy to VPS` (`30877169321`) terminaram
  com sucesso; `sdd-guardrail`, `quality-gate` e deploy ficaram verdes.
- Em producao, `app.fortcordis.com.br`, `fortcordis.com.br` e
  `www.fortcordis.com.br`, inclusive a rota do visualizador, responderam
  `200`; `/api/v1/auth/me` sem token respondeu `401`.
- Os 13 chunks JavaScript referenciados pela pagina de producao foram baixados
  e inspecionados; dois continham os marcadores esperados do visualizador.

## 5) Regressao e riscos residuais

- Novas versoes de firmware GE exigirao arquivos de homologacao adicionais.
- Traces e sobreposicoes privadas nao sao reconstruidos nesta entrega.
- Escala espacial permanece indisponivel; medicoes ficam fora do produto.
- Proporcao e orientacao estimada nao equivalem a calibracao clinica; o aviso
  permanece no player e no PNG.
- Identificacao vem apenas das tags do arquivo e nao confirma identidade no
  prontuario; fuso ausente nao e inferido pelo navegador.
- Fullscreen nativo validado localmente no navegador in-app em 13/10. Smoke
  autenticado do ambiente publicado fica para um eventual ciclo de release.

## 6) Itens fora de escopo entregues

- Nenhum.

## 7) Decisao historica - melhorias de 2026-10-10 e 2026-10-13

- [x] Implementacao e validacao local concluidas, com limitacoes acima.
- [ ] Publicado em stage.
- [ ] Publicado em producao.

As rodadas de implementacao de 10/10 e 13/10 foram locais. Em 14/10, o usuario
autorizou explicitamente publicar estas melhorias em stage e depois em producao.
O release deve usar PR da feature para stage, validar o snapshot instalado e
promove-lo por PR direto stage -> main. Evidencias de deploy e smoke serao
registradas ao concluir cada ambiente; nenhum status pendente e prova de release.

### Decisao historica de release - 2026-08-04

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.

### Correcao de proporcao visual

- [x] Validada localmente.
- [x] Aprovada tecnicamente para rollout protegido `stage -> producao`.
