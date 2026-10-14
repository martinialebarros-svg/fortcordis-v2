# Plan - vivid-iq-cine-viewer

Data: 2026-10-13
Responsavel: Codex
Status: done

## 1) Sequencia de fases

- Fase 1 (SDD/parser): especificar e implementar leitura DICOM privada segura.
- Fase 2 (frontend): construir canvas, controles e estados da pagina.
- Fase 3 (integracao): adicionar menu e mensagens de prudencia clinica.
- Fase 4 (verificacao): fixture sintetica, arquivo externo real, lint e build.
- Fase 5 (release): publicar com guardrails em stage e promover o snapshot
  validado para producao.
- Fase 6 (correcao de proporcao): usar a regiao 2D do DICOM para compensar
  pixels privados GE nao quadrados na apresentacao.
- Fase 7 (auditoria de uso): corrigir contraste e recuperacao, manter controles
  no fullscreen, implementar trecho A-B/loop, identificacao local opcional e
  captura PNG com contexto; reforcar validacao de contagens do parser.
- Fase 8 (ergonomia): priorizar imagem, adicionar foco/zoom/navegacao precisa,
  marcar trecho na barra e reforcar recuperacao e teclado.

## 2) Tarefas por fase

### Fase 1

- [x] T1.1 Documentar escopo, privacidade e limite clinico.
- [x] T1.2 Implementar parser com limites de profundidade/elementos.
- [x] T1.3 Implementar testes com fixture sintetica.
- Criterio de conclusao: dimensoes, quadros e timestamps extraidos sem ler PII.
- Risco: variacao de firmware.
- Rollback: remover biblioteca e teste isolados.

### Fase 2

- [x] T2.1 Implementar selecao e arraste de arquivo sem extensao.
- [x] T2.2 Implementar canvas e controles temporais.
- [x] T2.3 Implementar brilho, contraste, fullscreen e captura PNG.
- Criterio de conclusao: cine real navegavel e reproduzivel.
- Risco: uso de memoria em arquivo grande.
- Rollback: remover nova rota.

### Fase 3

- [x] T3.1 Adicionar item no menu autenticado.
- [x] T3.2 Exibir privacidade local e bloqueio de medicoes.
- Criterio de conclusao: acesso descobrivel e limites claros.
- Risco: confusao com ferramenta diagnostica.
- Rollback: ocultar item e rota.

### Fase 4

- [x] T4.1 Executar teste sintetico e smoke externo.
- [x] T4.2 Executar ESLint, TypeScript e build Next.js.
- [x] T4.3 Executar `git diff --check` e guardrail SDD.
- Criterio de conclusao: evidencias registradas em `verify.md`.
- Risco: dependencias ausentes no worktree.
- Rollback: interromper a promocao se qualquer validacao falhar.

### Fase 5

- [x] T5.1 Rebasear sobre o `origin/stage` atual e repetir as validacoes locais.
- [x] T5.2 Publicar em stage, aguardar workflows terminais e executar smokes.
- [x] T5.3 Mesclar o stage validado em worktree limpo de `origin/main`.
- [x] T5.4 Aguardar workflows de producao e executar smokes dos hosts e chunks.
- Criterio de conclusao: CI/deploy verdes, rota `200`, API protegida `401` sem
  credencial e marcadores presentes nos chunks servidos.
- Risco: divergencia entre `stage` e `main` durante a promocao.
- Rollback: nao promover se o SHA remoto mudar; em producao, reverter o merge
  de release se for constatada regressao.

### Fase 6

- [x] T6.1 Ler `Sequence of Ultrasound Regions` e selecionar a regiao com
  `Region Spatial Format = 1`.
- [x] T6.2 Aplicar a proporcao corrigida somente na apresentacao e na captura
  PNG, preservando o buffer e as dimensoes brutas.
- [x] T6.3 Adicionar fallback para proporcao nativa e testes sinteticos.
- [x] T6.4 Validar arquivos reais `2D+Trace` e `2D+Trace+MM` e medir o canvas no
  navegador.
- Criterio de conclusao: o cine 326x144 usa a regiao 324x263 e aparece em
  aproximadamente 1,23:1 sem erros de console.
- Risco: arquivos sem regiao 2D valida.
- Rollback: manter o fallback automatico para a proporcao bruta.

### Fase 7 - 2026-10-10

- Corrigir empacotamento RGBA com arredondamento anterior a replicacao dos canais.
- Cancelar leitura via FileReader.abort e invalidar resultados antigos.
- Tornar o player completo o alvo fullscreen, com aviso, controles e atalhos.
- Reproduzir trecho inclusivo A-B, em loop opcional, segundo timestamps.
- Ler nome/data somente por acao local explicita, respeitando charset,
  precisao temporal, ausencia de fuso e escopo top-level do DICOM.
- Informar divergencias de contagens e limitar objetos de quadros.
- Acrescentar proveniencia e ajustes a captura PNG, sem dados identificaveis.
- Verificar regressao com fixtures sinteticas, componente React, arquivos reais,
  lint, typecheck, build e guardrail SDD do diff de trabalho.
- Entrega local validada; publicacao desta fase e um passo separado.

### Fase 8 - 2026-10-13

- [x] T8.1 Compactar cabecalho e posicionar player antes dos metadados no DOM.
- [x] T8.2 Implementar modo foco, foco contido, Escape e fallback de fullscreen.
- [x] T8.3 Ampliar/mover imagem apenas visualmente, com PNG integral.
- [x] T8.4 Saltar para quadro validado e destacar/navegar trecho A-B.
- [x] T8.5 Pausar aba oculta, repetir mesmo arquivo e manter atalhos em botoes.
- [x] T8.6 Testar componente, arquivo real, desktop/mobile/landscape e qualidade.
- Criterio de conclusao: navegacao/zoom/foco comprovados com geometria e PNG
  preservados; `spec.md` e `verify.md` alinhados ao diff de trabalho.
- Risco: diferentes navegadores/fullscreen e janelas baixas.
- Rollback: reverter a camada de ergonomia, conservando parser e controles basicos.
- Entrega local; nenhuma publicacao implicita nesta fase.

## 3) Plano de testes

- Teste unitario Node para parser, pixels, timestamps e erros controlados.
- Smoke somente leitura com o arquivo real externo fornecido pelo usuario.
- ESLint direcionado e completo, TypeScript sem emissao e build de producao.
- Revisao manual da rota com o servidor local, quando disponivel.

## 4) Dependencias e bloqueios

- Navegador moderno com `FileReader`, canvas e rolagem/Pointer Events.
- Fullscreen nativo e opcional; modo foco funciona na propria janela.
- O arquivo clinico real deve continuar montado no volume externo para o smoke.

## 5) Checklist para iniciar execucao

- [x] `intent.md` aprovado.
- [x] `spec.md` aprovado.
- [x] Fases e rollback revisados.
- [x] Ambientes de teste definidos (worktrees isolados, stage e producao).
