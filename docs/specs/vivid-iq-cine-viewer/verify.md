# Verify - vivid-iq-cine-viewer

Data: 2026-10-14
Responsavel: Codex
Status: implementado e validado localmente; publicacao stage -> producao autorizada em 2026-10-14

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

## 7) Decisao atual - melhorias de 2026-10-10 e 2026-10-13

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
