# Verify - laudo-phrase-library

Data: 2026-08-11
Responsavel: Codex  
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | aceitacao | `frontend/app/laudos/novo/page.tsx` e `frontend/app/laudos/[id]/editar/page.tsx` adicionam aba `biblioteca`. | ok |
| CA-002 | aceitacao | `EcocardiogramaEstruturadoBiblioteca.tsx` agrupa frases por patologias e usa grupo `Sem patologia`. | ok |
| CA-003 | aceitacao | formulario de frase salva `patologias`, `tags`, `ordem`, `aspecto`, `titulo`, `texto` e `ativo`. | ok |
| CA-004 | aceitacao | testes `test_renaming_phrase_updates_preset_reference_title` e `test_moving_phrase_updates_preset_selection_aspect`. | ok |
| CA-005 | aceitacao | endpoints e testes cobrem soft delete/restauracao de frases e presets. | ok |
| CA-006 | aceitacao | UI de presets mostra aviso `usa frase inativa`. | ok |
| CA-007 | aceitacao | teste `test_minimal_store_is_auto_recovered_from_rich_runtime_backup`. | ok |
| CA-008 | aceitacao | teste `test_save_blocks_unexpected_store_shrink`. | ok |
| CA-009 | aceitacao | `EcocardiogramaEstruturadoEditor.tsx` usa seletor pesquisavel, filtros por grupo clinico e resultados agrupados. | ok |
| CA-010 | aceitacao | `EcocardiogramaEstruturadoBiblioteca.tsx` renderiza cabecalhos de patologia como botoes expansivos com chevron, contagem e conteudo condicional. | ok |
| CA-011 | aceitacao | busca e filtros de patologia/tag forcam a expansao dos grupos resultantes. | ok |
| CA-012 | aceitacao | validacao operacional do JSON e da API publica de stage confirma 15 titulos renomeados, 112 conclusoes preservadas, 6 referencias sincronizadas e zero referencias quebradas. | ok |
| CA-013 | aceitacao | `SeletorFraseConclusao.tsx` substitui o `select` apenas quando `aspecto.key === "conclusao"`, agrupando por patologia com contagem e controles expansivos. | ok |
| CA-014 | aceitacao | busca normalizada cobre titulo, texto, patologias e tags; busca/atalho ativos forcam a expansao dos grupos resultantes. | ok |
| CA-015 | aceitacao | o seletor chama somente `setFraseSelecionadaPorAspecto`; `aplicarFraseDoAspecto` continua vinculado exclusivamente ao botao `Usar frase`. | ok |
| CA-016 | aceitacao | historico em `localStorage` limita-se a cinco IDs e descarta referencias inativas/ausentes ao renderizar. | ok |
| CA-017 | aceitacao | ramo alternativo em `EcocardiogramaEstruturadoEditor.tsx` preserva o `select` existente para os demais aspectos. | ok |
| NFR-001 | compatibilidade | teste `test_normalize_adds_phrase_pathologies_and_order`. | ok |
| NFR-003 | resiliencia | testes verificam backups runtime em alteracoes. | ok |
| NFR-004 | integridade | guarda de persistencia no `_save_store` bloqueia shrink acidental fora de `import/recovery`. | ok |
| NFR-005 | acessibilidade | cabecalhos usam `aria-expanded` e `aria-controls` em botoes nativos. | ok |
| NFR-006 | acessibilidade | seletor fecha por Escape/clique externo; gatilho e grupos expõem estado expandido e todos os comandos usam botoes/input nativos. | ok |
| NFR-007 | privacidade | chave local `fortcordis:eco:conclusoes-recentes` recebe somente array de IDs, sem texto do laudo ou identificadores do paciente. | ok |
| NFR-008 | responsividade | painel e renderizado em portal no `document.body`, usa coordenadas fixas e calcula lado, largura e `maxHeight` a partir do gatilho e do viewport. | ok |
| NFR-009 | seguranca | router depende de `get_current_user`; regressao cobre 12 chamadas anonimas e confirma modulo/acoes da matriz `frases`. | ok local |
| CA-018 | aceitacao | cabecalho e `shrink-0`; lista usa `min-h-0`, `flex-1` e `overflow-y-auto`, mantendo o final rolavel dentro da altura calculada. | ok |
| CA-019 | aceitacao | listeners de resize/scroll reposicionam o painel; eventos de scroll originados dentro do proprio painel nao recalculam a ancora. | ok |
| CA-020 | seguranca | `test_todas_as_rotas_exigem_autenticacao`, `test_usuario_autenticado_consegue_carregar_payload` e smoke anonimo em stage. | ok |

## 2) Testes automatizados executados

Comandos:

```bash
cd backend
venv/bin/python -m pytest tests/test_frases_ecocardiograma_estruturado_auth.py
venv/bin/python -m pytest tests/test_frases_ecocardiograma_estruturado_teste_service.py tests/test_frases_ecocardiograma_estruturado_import.py
venv/bin/python -m py_compile app/api/v1/endpoints/frases_ecocardiograma_estruturado_teste.py app/services/frases_ecocardiograma_estruturado_teste_service.py
venv/bin/python -m py_compile sync_frases_store.py
cd ../frontend
npx eslint app/laudos/components/EcocardiogramaEstruturadoEditor.tsx
npx eslint app/laudos/components/EcocardiogramaEstruturadoBiblioteca.tsx
npx tsc --noEmit --pretty false
npm run build

```

Resumo dos resultados:
- Backend: 12 testes passaram; `py_compile` passou na validacao original da feature.
- Frontend deste ciclo: ESLint direcionado passou; `tsc --noEmit --pretty false --incremental false` passou; `npm run build` compilou, validou tipos e gerou 39 paginas com sucesso.
- Frontend do seletor de Conclusao: ESLint direcionado dos dois componentes passou; TypeScript sem emissao passou; o novo build de producao compilou, validou tipos e gerou 39 paginas.
- Hotfix de viewport do seletor: ESLint direcionado passou; TypeScript sem emissao passou; build de producao compilou e gerou 39 paginas.
- Store runtime de stage: 15 titulos renomeados para `DMVM`, 6 referencias de presets sincronizadas, 112 titulos unicos e zero referencias quebradas; producao permaneceu com o hash anterior.
- Seguranca da API: 15 testes direcionados passaram (3 de autenticacao/autorizacao, 11 do servico e 1 de importacao); a mesma execucao da esteira (`pytest tests`) passou com 711 testes; CI, deploy e Migration CI de stage passaram no SHA `2a16925c`.

## 3) Testes manuais

- Cenario 1: em stage, abrir novo laudo e confirmar aba Biblioteca.
- Cenario 2: editar frase com patologia/tag e confirmar persistencia apos recarregar.
- Cenario 3: desativar/restaurar frase e confirmar aviso em preset que a utiliza.
- Cenario 4: aplicar preset na aba Qualitativa apos alteracao da Biblioteca.
- Cenario 5: abrir a aba Qualitativa, pesquisar preset por texto, filtrar por grupo clinico e selecionar um resultado agrupado.
- Cenario 6: na Biblioteca, confirmar grupos recolhidos por padrao, expandir/recolher uma patologia e validar contagem.
- Cenario 7: pesquisar `DMVM` e confirmar que os grupos resultantes abrem automaticamente.
- Cenario 8: verificar no store vivo de stage que nenhum titulo de conclusao contem `Endocardiose de mitral` ou `Endocardiose mitral`.
- Cenario 9: no aspecto Conclusao, confirmar grupos recolhidos, contagens e expansao individual por patologia.
- Cenario 10: buscar uma conclusao por titulo/texto/tag, usar atalho clinico e confirmar expansao automatica dos resultados.
- Cenario 11: selecionar uma frase, conferir a previa e verificar que o texto so muda apos clicar em `Usar frase`.
- Cenario 12: reabrir o seletor e confirmar o grupo Recentes com no maximo cinco frases validas.
- Cenario 13: abrir Conclusao proximo ao rodape da janela e confirmar que o painel cabe abaixo ou inverte para cima, sem esconder o fim da barra de rolagem.
- Cenario 14: rolar a lista ate a ultima patologia e redimensionar a janela, confirmando que o painel permanece contido no viewport.
- Cenario 15: chamar GET e cada familia de mutacao da API sem cookie/token e confirmar `401`.
- Cenario 16: com sessao e permissao do modulo `frases`, carregar a biblioteca e aplicar/salvar uma alteracao controlada em stage.

Resultado operacional ja confirmado para o cenario 8: arquivo runtime e API publica de stage retornam zero titulos legados e 112 conclusoes integras. Os cenarios 6 e 7 serao repetidos no frontend publicado apos o workflow de deploy.

Os cenarios 9 a 12 dependem do primeiro deploy desta iteracao em stage e serao repetidos no frontend servido antes de qualquer promocao para producao.

O smoke de seguranca em stage confirmou `401 Credenciais invalidas` tanto no GET do payload quanto no POST com payload invalido. As rotas `/` e `/laudos/novo` retornaram `200` nos hosts `stage.fortcordis.com.br` e `app.stage.fortcordis.com.br`. Nenhuma mutacao clinica foi usada no smoke vivo.

## 4) Regressao e riscos residuais

- Risco residual 1: validacao visual completa depende do deploy stage concluir.
- Risco residual 2: a primeira normalizacao adiciona campos ao JSON runtime; backups sao preservados pelo servico.
- Risco residual 3: autorecovery depende da existencia de backup runtime valido e mais rico no ambiente.
- Risco residual 4: a validacao visual dos menus expansivos depende do deploy de stage concluir.
- Risco residual 5: o historico Recentes e local a cada navegador e nao sincroniza entre dispositivos, por desenho.
- Risco residual 6: usuarios autenticados sem permissao configurada no modulo `frases` passam a receber `403`, comportamento intencional da matriz existente.

## 5) Itens fora de escopo entregues

- Nenhum.

## 6) Decisao de release

- [x] Aprovado para stage.
- [ ] Aprovado para producao.
