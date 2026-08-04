# Spec - vivid-iq-cine-viewer

Data: 2026-08-02
Responsavel: Codex
Status: done

## 1) Escopo funcional

Criar uma pagina autenticada que leia localmente um DICOM do GE Vivid iq,
identifique o cine `GEMS_Ultrasound_MovieGroup_001`, extraia dimensoes,
timestamps e quadros em tons de cinza, e ofereca reproducao e navegacao sem
upload para o backend.

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
  derivada e nao como DICOM original.
- RF-008: disponibilizar a pagina `Visualizador Vivid IQ` no menu autenticado.
- RF-009: exibir erros controlados para arquivos invalidos, formatos nao
  suportados, blocos incompletos e ausencia do cine privado.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (privacidade): nenhuma parte do arquivo deve ser enviada ao backend;
  nenhum metadado de paciente deve ser coletado ou exibido.
- NFR-002 (prudencia clinica): a interface deve informar permanentemente que a
  funcao e experimental e nao pode ser usada para medicoes.
- NFR-003 (memoria): limitar o arquivo a 512 MB e manter apenas o `ArrayBuffer`
  fonte e o quadro RGBA corrente, sem duplicar todo o cine.
- NFR-004 (seguranca): limitar profundidade e quantidade de elementos durante o
  parsing para evitar travamento por arquivo malformado.
- NFR-005 (compatibilidade): o parser deve ignorar metadados DICOM nao usados e
  falhar de modo explicito quando a estrutura privada conhecida nao estiver
  presente.
- NFR-006 (rastreabilidade): o arquivo clinico real permanece externo; testes
  versionados usam apenas um DICOM sintetico sem identificadores.

## 4) Contratos tecnicos

### API

- Endpoint: nenhum.
- Metodo: processamento local por `File.arrayBuffer()`.
- Payload: nenhum dado sai do navegador.
- Resposta: objeto local com metadados tecnicos seguros e offsets dos quadros.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: nenhum.
- Migracao necessaria: nao.

### Frontend

- Tela: `/visualizador-vivid-iq`.
- Biblioteca: `frontend/lib/vivid-iq-dicom.mjs`.
- Estados: vazio, lendo, pronto, reproduzindo e erro.
- O canvas renderiza um quadro nativo por vez e usa os timestamps do equipamento
  para escolher o quadro correspondente ao relogio de reproducao.

## 5) Compatibilidade e rollout

- Backward compatibility: adicao isolada, sem alterar contratos existentes.
- Feature flag: nao; a pagina exige a autenticacao ja aplicada pelo dashboard.
- Estrategia de rollback: remover a rota, item de menu e biblioteca do parser.

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

## 7) Casos de borda

- CB-001: timestamps ausentes ou nao monotonicos usam uma linha temporal
  sintetica prudente de 30 fps e exibem aviso.
- CB-002: quantidade declarada maior que o buffer usa somente quadros completos.
- CB-003: troca de arquivo interrompe a reproducao anterior e libera a
  referencia ao buffer anterior.
- CB-004: arquivo acima de 512 MB e recusado antes da leitura integral.

## 8) Fora de escopo

- Medicoes calibradas ou diagnostico automatizado.
- Persistencia, compartilhamento, DICOMweb, PACS ou vinculo com paciente/laudo.
- Suporte a MovieGroup 3D/4D ou reconstrucao de traces da GE.
