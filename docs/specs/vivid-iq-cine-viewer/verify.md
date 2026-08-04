# Verify - vivid-iq-cine-viewer

Data: 2026-08-04
Responsavel: Codex
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `node --test frontend/lib/vivid-iq-dicom.test.mjs` | ok |
| CA-002 | aceitacao | tres cenarios de erro controlado na suite Node | ok |
| CA-003 | aceitacao | smoke externo: 1.279 quadros, 536x195, 10,02 s, 127,56 fps | ok |
| CA-004 | aceitacao | arquivo real sem extensao carregado pelo seletor local | ok |
| CA-005 | aceitacao | navegador: play chegou ao quadro 114 e passo 1 -> 2 | ok |
| CA-006 | aceitacao | nenhuma API de upload; `File.arrayBuffer()` local | ok |
| CA-007 | aceitacao | aviso experimental visivel antes e depois do carregamento | ok |
| CA-008 | aceitacao | link ativo `Visualizador Vivid IQ` no menu Clinica | ok |
| CA-009 | aceitacao | canvas real 326x144 exibido em 603x490 (1,232:1) | ok |
| CA-010 | aceitacao | `PAME5GG2`: 2.962 quadros em dois tamanhos exatos, sem warning | ok |
| CA-011 | aceitacao | `PAME5GG2`: 20,0436 s e taxa media de 147,728 fps | ok |
| CA-012 | aceitacao | setor vertical 465x493 derivado localmente da previa | ok |
| CA-013 | aceitacao | conversao setorial e inversao lateral sem alterar o buffer | ok |
| NFR-001 | privacidade | parser coleta apenas tags tecnicas e retorna zero PII | ok |
| NFR-002 | prudencia | nenhuma ferramenta de medida; alerta persistente | ok |
| NFR-003 | memoria | um `ArrayBuffer` fonte e um `ImageData` reutilizado | ok |
| NFR-004 | seguranca | limite 512 MB, 100 mil elementos e 48 niveis | ok |

## 2) Testes automatizados executados

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

## 3) Testes manuais

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

### Evidencias de release

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

## 4) Regressao e riscos residuais

- Novas versoes de firmware GE exigirao arquivos de homologacao adicionais.
- Traces e sobreposicoes privadas nao sao reconstruidos nesta entrega.
- Escala espacial permanece indisponivel; medicoes ficam fora do produto.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [x] Aprovado para producao.
- [ ] Nao aprovado.

### Correcao de proporcao visual

- [x] Validada localmente.
- [x] Aprovada tecnicamente para rollout protegido `stage -> producao`.
