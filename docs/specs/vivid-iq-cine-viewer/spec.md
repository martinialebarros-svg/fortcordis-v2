# Spec - vivid-iq-cine-viewer

Data: 2026-10-25
Responsavel: Codex
Status: fase 9 validada localmente; publicacao autorizada somente em stage em 2026-10-25

## 1) Escopo funcional

Criar uma pagina autenticada que leia localmente um DICOM do GE Vivid iq,
identifique o cine `GEMS_Ultrasound_MovieGroup_001`, extraia dimensoes,
timestamps e quadros em tons de cinza, e ofereca reproducao e navegacao sem
upload para o backend.
Na fase 9, aceitar uma colecao local de arquivos e navegar entre seus cines,
decodificando apenas o arquivo ativo e preservando a ordem de selecao.

## 2) Requisitos funcionais (RF)

- RF-001: aceitar arquivo DICOM Part 10 com ou sem extensao.
- RF-002: validar assinatura `DICM`, sintaxe de transferencia, fabricante/modelo
  e o criador privado `GEMS_Ultrasound_MovieGroup_001`.
- RF-003: localizar dimensoes em `(7FE1,xx86)`, contagem dos blocos em
  `(7FE1,xx37)`, timestamps em `(7FE1,xx43)` e voxels em `(7FE1,xx60)`.
- RF-004: montar uma linha temporal monotona, informando dimensoes, quantidade
  de quadros, duracao e taxa media estimada.
- RF-005: reproduzir/pausar o cine, ir ao inicio/fim, avancar/retroceder um
  quadro e buscar por uma barra temporal.
- RF-006: permitir velocidade de reproducao, brilho e contraste apenas para
  visualizacao, sem alterar o arquivo fonte.
- RF-007: permitir baixar o quadro visivel como PNG, identificado como captura
  derivada e nao como DICOM original, aplicando a mesma proporcao visual usada
  na tela.
- RF-008: disponibilizar a pagina `Visualizador Vivid IQ` no menu autenticado.
- RF-009: exibir erros controlados para arquivos invalidos, formatos nao
  suportados, blocos incompletos e ausencia do cine privado.
- RF-010: quando existir uma regiao ultrassonografica 2D em `(0018,6011)`, usar
  `Region Location Min/Max X/Y` para corrigir a proporcao visual dos pixels
  privados da GE sem modificar o quadro fonte.
- RF-011: resolver as dimensoes de cada bloco de voxels de forma independente,
  preservando mudancas de largura/altura dentro do mesmo cine. Divergencias
  entre tamanho declarado, buffer e timestamps devem produzir aviso com as
  contagens afetadas, nunca descarte silencioso. Preservar quadros completos
  com timestamps disponiveis; a declaracao isolada nao deve apagar quadros
  cujos pixels e tempos concordam. Sem timestamps, aplicar o fallback explicito.
- RF-012: para imagens `CurvedSurface`, converter a matriz bruta profundidade x
  feixes para uma apresentacao setorial com profundidade vertical, respeitando
  a proporcao da regiao 2D do equipamento.
- RF-013: quando a regiao 2D nao existir, estimar localmente a proporcao do
  setor a partir da maior regiao neutra da previa JPEG encapsulada, sem exibir,
  persistir ou transmitir essa previa; oferecer inversao lateral manual.
- RF-014: brilho/contraste devem preservar R=G=B em todos os niveis; arredondar
  a intensidade antes de empacotar RGBA e manter as bordas externas pretas.
- RF-015: permitir cancelar leitura, trocar arquivo e recuperar de arquivo
  invalido/grande demais. Respostas de leituras antigas nao podem substituir
  estudo, erro, identificacao ou estado de carregamento atuais.
- RF-016: fullscreen inclui imagem, controles e aviso experimental. Atalhos
  no player: Espaco reproduz/pausa, setas navegam e F alterna fullscreen;
  inputs, selects e campos editaveis preservam seus atalhos nativos.
- RF-017: selecionar inicio A e fim B pelo quadro atual e repetir opcionalmente
  o trecho inclusivo; usar timestamps e a duracao do ultimo quadro no loop.
- RF-018: revelar opcionalmente nome, data/hora do estudo, aquisicao, conteudo
  e fuso do arquivo. Ler apenas tags top-level, com charset suportado e valores
  validados; separar data do estudo de aquisicao e nao inferir fuso ausente.
  Ocultar/limpar/trocar exame descarta a identificacao exibida.
- RF-019: PNG conserva a imagem apresentada e inclui rodape de captura derivada
  nao calibrada, quadro, tempo, brilho, contraste e inversao aplicada. Nao
  inclui identificacao do paciente; pausa a reproducao no instante da captura.
- RF-020: indicar separadamente proporcao obtida da regiao 2D e orientacao
  estimada; mostrar o estado de inversao lateral de forma visivel.
- RF-021: colocar imagem e controles antes da identificacao e dos detalhes
  tecnicos, tanto visualmente como na ordem do DOM. Recolher ajustes avancados
  por padrao e manter aviso experimental no player.
- RF-022: oferecer modo foco na janela, com Escape para sair, foco de teclado
  contido no player, fundo inerte e restauracao do foco/rolagem ao fechar.
  Se fullscreen nativo for recusado, abrir modo foco com mensagem recuperavel.
- RF-023: permitir ampliacao visual de 1x a 4x, centralizar proporcionalmente
  no ajuste inicial e mover imagem ampliada por mouse, toque ou botoes.
  O zoom nao altera pixels intrinsecos do canvas, orientacao ou PNG integral.
- RF-024: saltar para um numero inteiro de quadro entre 1 e N, validando no
  formulario. Valor invalido nao muda o quadro; salto valido pausa o cine.
- RF-025: mostrar o intervalo A-B na barra e sua quantidade inclusiva de
  quadros; oferecer navegacao direta para A e B.
- RF-026: pausar quando a aba ficar oculta, conservando o quadro e exigindo
  retomada explicita; permitir repetir a selecao do mesmo arquivo apos erro.
- RF-027: manter setas/F funcionais apos clicar em botoes, preservando
  Espaco/Enter nativos dos botoes e atalhos proprios dos campos/selects.
- RF-028: aceitar selecao multipla e arraste de varios arquivos com ou sem
  extensao. A nova colecao mantem a ordem recebida e abre o primeiro arquivo
  sem iniciar reproducao automaticamente; essa ordem nao indica cronologia.
- RF-029: oferecer uma lista com nome e posicao do arquivo ativo, selecao
  direta e controles anterior/proximo arquivo distintos dos controles de
  quadro. Nao assumir que a lista pertence ao mesmo paciente ou estudo.
- RF-030: o seletor principal substitui a colecao; a acao Adicionar arquivos
  acrescenta entradas ao fim, preservando o arquivo ativo, sua reproducao e
  seus ajustes. Nao ler os arquivos adicionados enquanto nao forem abertos.
- RF-031: limitar a colecao a 100 referencias `File`. Se o lote recebido
  ultrapassar esse teto, recusar o lote inteiro com mensagem acessivel,
  preservando a colecao e o ativo anteriores; nao truncar silenciosamente.
- RF-032: validar o limite de 512 MB apenas ao abrir cada arquivo ativo.
  Erro ou cancelamento mantem a colecao acessivel, com retentativa e navegacao
  para outro arquivo; nenhum erro pode iniciar o proximo cine automaticamente.
- RF-033: permitir remover arquivos e limpar toda a colecao. Remover o ativo
  abre pausado o proximo da lista, ou o anterior se o removido era o ultimo;
  remover a ultima entrada devolve o estado vazio. Remover entrada inativa
  preserva a leitura/reproducao e os ajustes do ativo.
- RF-034: toda troca de ativo interrompe reproducao/leitura, invalida respostas
  anteriores e reinicia quadro, trecho A-B, brilho/contraste, inversao, zoom e
  identificacao. Encerra foco/tela cheia ao desmontar o alvo anterior, tornando
  explicita a mudanca de contexto. Nao conservar cache de cines decodificados.
- RF-035: exibir nomes de arquivo somente na interface local da sessao. O parser
  continua recebendo um nome generico; nomes nao entram no PNG, nome de download,
  logs, armazenamento ou requisicoes. Identificacao DICOM permanece opt-in
  exclusivamente para o arquivo ativo, sem extracao automatica da colecao.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (privacidade): nenhuma parte do arquivo deve ser enviada ao backend;
  o parsing normal nao extrai dados de paciente. Nome e datas sao lidos somente
  quando o usuario abre o painel opcional, permanecem em memoria, nao sao
  persistidos/logados e nao entram em PNG, nome de download ou requisicoes.
- NFR-002 (prudencia clinica): a interface deve informar permanentemente que a
  funcao e experimental e nao pode ser usada para medicoes.
- NFR-003 (memoria): limitar cada arquivo aberto a 512 MB e manter apenas o
  `ArrayBuffer` fonte do ativo e o quadro RGBA corrente, sem duplicar o cine
  nem reter buffers dos demais arquivos da colecao.
- NFR-004 (seguranca): limitar profundidade e quantidade de elementos durante o
  parsing e quantidade total de quadros para evitar travamento por arquivo
  malformado. Retornar erro controlado ao exceder limites.
- NFR-005 (compatibilidade): o parser deve ignorar metadados DICOM nao usados e
  falhar de modo explicito quando a estrutura privada conhecida nao estiver
  presente.
- NFR-006 (rastreabilidade): o arquivo clinico real permanece externo; testes
  versionados usam apenas um DICOM sintetico sem identificadores.
- NFR-007 (desempenho): reutilizar o `ImageData` e um mapa de conversao espacial
  por dimensao de bloco, sem reconstruir a geometria a cada quadro.
- NFR-008 (colecao local): manter no maximo 100 referencias `File` em memoria
  da sessao, sem leitura antecipada ou cache de cines; limpar/sair descarta a
  colecao e cancela a leitura. Nenhum nome ou conteudo e persistido/transmitido.

## 4) Contratos tecnicos

### API

- Endpoint: nenhum.
- Metodo: processamento local por `FileReader.readAsArrayBuffer()` cancelavel.
- Payload: nenhum dado sai do navegador.
- Resposta: objeto local com metadados tecnicos e offsets; helper separado
  `getVividIqIdentification(study)` retorna identificacao somente sob acao local.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Tela: `/visualizador-vivid-iq`.
- Biblioteca: `frontend/lib/vivid-iq-dicom.mjs`.
- Estados: vazio, lendo, pronto, reproduzindo e erro.
- A colecao e o arquivo selecionado sao estados locais separados do estudo
  decodificado. Entradas inativas conservam somente referencia `File`; leitura
  usa `FileReader.abort()` e identificador de requisicao para rejeitar retornos
  obsoletos. Erro/cancelamento nao removem a lista nem autorizam autoplay.
- A fase 9 nao altera o contrato do parser nem cria API, backend ou migracao.
- O canvas usa os timestamps do equipamento para escolher o quadro
  correspondente ao relogio de reproducao, respeita as dimensoes declaradas de
  cada bloco e aplica uma conversao setorial somente na camada de apresentacao.

## 5) Compatibilidade e rollout

- Backward compatibility: adicao isolada, sem alterar contratos existentes.
- Feature flag: nao; a pagina exige a autenticacao ja aplicada pelo dashboard.
- Estrategia de rollback: remover a rota, item de menu e biblioteca do parser.
- Fase 9: implementacao/validacao locais; publicacao exige ciclo separado.
  Seu rollback e restrito a camada de colecao e recupera a abertura individual.

## 6) Criterios de aceitacao (CA)

- CA-001: fixture sintetica sem extensao abre e devolve dois quadros 2x2 com os
  pixels e timestamps esperados.
- CA-002: assinatura ausente, cine privado ausente e buffer inconsistente
  produzem mensagens controladas.
- CA-003: o arquivo clinico externo `Q1TBHPGK` e reconhecido como Vivid iq,
  `2D+Trace`, 1.279 quadros de 536x195, duracao aproximada de 10,02 s e taxa
  media aproximada de 127,6 fps.
- CA-004: o arquivo sem extensao pode ser escolhido ou arrastado para a pagina.
- CA-005: play/pause, seek, primeiro/ultimo e passo de um quadro atualizam o
  canvas e o contador.
- CA-006: nenhuma requisicao de rede e iniciada pelo carregamento do arquivo.
- CA-007: aviso de uso experimental e proibicao de medicoes permanecem visiveis
  durante toda a visualizacao.
- CA-008: o menu autenticado contem acesso direto a pagina.
- CA-009: um cine `2D+Trace+MM` com pixels brutos 326x144 e regiao 2D 324x263
  e exibido em aproximadamente 1,23:1, sem o alongamento horizontal de 2,26:1.
- CA-010: `PAME5GG2` e montado com 2.962 quadros, sendo 1.098 em 493x126 e
  1.864 em 493x138, sem deslocamento do inicio dos quadros nem aviso falso de
  buffer incompleto.
- CA-011: a linha temporal real de `PAME5GG2` permanece em aproximadamente
  20,04 s e informa taxa media de aproximadamente 147,7 fps.
- CA-012: a apresentacao de `PAME5GG2` usa setor vertical em aproximadamente
  0,94:1, estimado apenas na memoria local a partir da previa encapsulada.
- CA-013: cines com regiao 2D valida usam sua proporcao na conversao setorial e
  permitem inversao lateral sem alterar o buffer fonte.
- CA-014: todos os pixels de origem 0..255 permanecem R=G=B em contrastes
  0,5..2,0 com passo 0,05 e brilhos -100, 0 e 100, inclusive no PNG.
- CA-015: cancelar leitura ou rejeitar arquivo >512 MB durante leitura pendente
  devolve seletor utilizavel; conclusao antiga nao reabre o exame anterior.
- CA-016: alvo fullscreen contem aviso e controles; teclado do player funciona
  e nao interfere com sliders, checkbox de repeticao ou seletor de velocidade.
- CA-017: trecho A-B respeita limites em reproducao, loop, troca de velocidade
  e timestamps irregulares; limpar/trocar exame restaura os limites e ajustes.
- CA-018: painel oculto nao chama helper de identificacao; revelar mostra
  somente campos validados; ocultar/limpar/trocar remove identificacao anterior.
- CA-019: nome UTF-8/Latin1, datas invalidas/ausentes, tempo de precisao parcial,
  charset desconhecido e identificacao em sequencia aninhada nao geram dados
  inventados nem substituem os campos top-level.
- CA-020: conflito de tres quadros completos e dois timestamps resulta em dois
  quadros preservados e aviso explicito do quadro omitido e das contagens.
- CA-021: PNG possui rodape de proveniencia/ajustes, mantem proporcao e nao
  contem nome/data do paciente mesmo com painel de identificacao aberto.
- CA-022: limite de 100 mil quadros produz erro controlado sem estouro de pilha.
- CA-023: modo foco inclui imagem/aviso/controles, limita Tab ao player e
  permite Escape mesmo a partir de um input; fechar/desmontar restaura fundo,
  foco e overflow da pagina.
- CA-024: recusa da API fullscreen ativa modo foco sem perder o exame.
- CA-025: zoom muda somente dimensoes CSS; Ajustar imagem ou novo exame
  restaura 1x. O PNG continua usando todo o canvas intrinseco.
- CA-026: saltos vazios, fracionarios, zero, negativos e maiores que N exibem
  erro acessivel no formulario sem mover a imagem; salto valido pausa e navega.
- CA-027: ocultar a aba interrompe RAF e conserva quadro; voltar nao retoma
  automaticamente. Selecionar o mesmo arquivo depois de erro inicia nova leitura.
- CA-028: faixa A-B e navegacao para extremos permanecem coerentes com os
  quadros marcados, inclusive apos mudar os limites.
- CA-029: atalhos de setas e F funcionam com foco nos botoes do player, sem
  suprimir Espaco nativo nem capturar teclas de campos e selects.
- CA-030: modo normal e foco preservam proporcao e controles acessiveis em
  tela estreita e janela baixa, sem overflow horizontal da pagina.
- CA-031: selecao multipla e drop sem extensao criam lista na ordem recebida,
  abrem somente o primeiro arquivo e deixam o cine pausado.
- CA-032: Adicionar arquivos preserva ativo, quadro, reproducao, A-B e ajustes;
  seletor principal substitui a colecao e abre o primeiro da nova lista pausado.
- CA-033: selecao direta e anterior/proximo arquivo atualizam nome e posicao
  ativa; extremos sao limitados e controles de quadro continuam independentes.
- CA-034: ate 100 entradas sao aceitas; lote que excede 100 na substituicao
  ou adicao e recusado inteiro, com aviso e colecao/ativo anteriores preservados.
- CA-035: arquivo >512 MB e recusado somente ao abri-lo, antes da leitura;
  erro/cancelamento permite tentar novamente ou escolher outro sem perder lista.
- CA-036: troca rapida durante leitura ou reproducao aborta/invalida a anterior;
  retornos tardios de leitura, previa ou PNG nao substituem nem exportam o ativo
  anterior. Novo ativo reinicia A-B, ajustes, zoom e identificacao e fica pausado.
  A troca encerra foco/tela cheia, libera o fundo inerte e restaura a rolagem.
- CA-037: remover ativo seleciona proximo, ou anterior no final; remover
  inativo preserva o ativo. Remover ultimo ou limpar colecao libera lista,
  estudo e identificacao, sem resultado atrasado reabrir o arquivo.
- CA-038: apenas o arquivo ativo chama `readAsArrayBuffer`/parser; navegar
  novamente exige nova leitura, sem cache de `ArrayBuffer` de outros cines.
- CA-039: nome do arquivo aparece somente na UI local, e nao no parser, PNG,
  nome de download, rede ou armazenamento; carregar a colecao nao le identidade
  DICOM nem afirma que os arquivos pertencem ao mesmo paciente/exame.
- CA-040: fluxo individual, controles de quadro, A-B/loop, foco/fullscreen,
  geometria, contraste em cinza e PNG integral continuam funcionando.

## 7) Casos de borda

- CB-001: timestamps ausentes ou nao monotonicos usam uma linha temporal
  sintetica prudente de 30 fps e exibem aviso.
- CB-002: bloco cujo buffer nao corresponde exatamente a nenhuma dimensao 2D
  declarada e ignorado como componente auxiliar; o cine falha se nenhum bloco
  2D exato permanecer.
- CB-003: troca de arquivo interrompe a reproducao anterior e libera a
  referencia ao buffer anterior.
- CB-004: arquivo acima de 512 MB e recusado antes da leitura integral.
- CB-005: se a sequencia de regiao ultrassonografica 2D estiver ausente ou for
  invalida, a exibicao tenta a geometria da previa local e usa setor 1:1 como
  fallback prudente quando a previa nao puder ser decodificada.
- CB-006: mudanca de dimensao entre blocos preserva a continuidade dos
  timestamps e reutiliza um mapa espacial separado para cada tamanho.
- CB-007: fuso nao informado permanece explicitamente desconhecido; a UI nao
  converte datas/horas do equipamento para o fuso do navegador.
- CB-008: parar no final do trecho sem loop mantem o ultimo quadro; trecho de
  um quadro com loop mantem a imagem e continua cancelavel.
- CB-009: janela baixa permite rolar controles separadamente, com limite
  de altura proporcional a janela e area de imagem reduzivel, sem sobreposicao.
- CB-010: resposta tardia de fullscreen recusado depois de trocar/limpar o
  exame nao pode reabrir modo foco.
- CB-011: cancelar o seletor ou receber lote vazio nao modifica a colecao.
  Rejeicao pelo limite de 100 ocorre antes de cancelar/trocar o arquivo atual.
- CB-012: arquivo ilegivel/invalido permanece selecionavel para retentativa ou
  remocao; falha isolada nao remove os demais arquivos nem os le em antecipacao.
- CB-013: adicionar/remover entrada inativa nao reinicia a identidade da leitura
  ativa; trocar/remover o ativo invalida callbacks, inclusive durante cancelamento.

## 8) Fora de escopo

### Limite da publicacao autorizada em 2026-10-26

Somente a colecao local de cines desta fase e seus quatro artefatos SDD podem
ser promovidos. Preservar as outras entregas no snapshot stage
`4cd0e899915e625bcd971f214bc34ce09feabea1` e restaura-las em stage depois da
promocao protegida. O diff final contra main deve conter exatamente pagina,
teste da pagina e intent/plan/spec/verify do visualizador, sem backend,
migrations, configuracao, workflows ou novos comportamentos clinicos.

- Medicoes calibradas ou diagnostico automatizado.
- Persistencia, compartilhamento, DICOMweb, PACS ou vinculo com paciente/laudo.
- Suporte a MovieGroup 3D/4D ou reconstrucao de traces da GE.
- Medicao ou homologacao geometrica da conversao setorial experimental.
- Agrupamento automatico por paciente/estudo, ordenacao clinica por datas,
  comparacao simultanea de varios cines e carregamento antecipado da colecao.
