# Verify - eco-study-import

## Estado

Primeira entrega vertical publicada em stage; perfis GE LOGIQ e e GE Vivid IQ calibrados com estudos mantidos fora do repositorio.

## Evidencias automatizadas

- `venv/bin/python -m unittest tests.test_eco_study_extraction_service tests.test_eco_study_import_jobs tests.test_eco_study_import_migration tests.test_image_header_import_service tests.test_xml_import_jobs tests.test_sdd_guardrail -v`: 36/36 testes passaram.
- `venv/bin/python -m unittest tests.test_migration_ci_cycle -v`: ciclo completo de migracoes passou.
- `python3 -m py_compile ...`: arquivos backend alterados compilaram sem erro.
- Import de `app.main`: rotas `POST /api/v1/eco-study-import/jobs` e `GET /api/v1/eco-study-import/jobs/{job_id}` registradas.
- `./node_modules/.bin/eslint ... --max-warnings=0`: passou nos arquivos frontend afetados.
- `./node_modules/.bin/tsc --noEmit --pretty false`: passou.
- `npm run build`: build Next.js 15.5.14 concluido com sucesso, incluindo `/laudos/novo` e `/laudos/[id]/editar`.
- `git diff --check`: sem erros de whitespace.
- Tesseract 5.5.2 instalado localmente com idiomas `por` e `eng`.
- `venv/bin/python scripts/verify_eco_study_ocr.py`: imagem sintetica e PDF rasterizado reconheceram as 8 medidas esperadas; smoke terminou com `eco-study OCR smoke: ok`.
- `venv/bin/python -m unittest tests.test_eco_study_ocr_runtime ... -v`: OCR real, status de runtime presente/ausente e regressao do extrator passaram.
- `bash -n scripts/deploy_prod_vps.sh scripts/deploy_stage_vps.sh`: scripts de deploy validos; stage configura OCR como obrigatorio.
- `venv/bin/python -m unittest discover -s tests -p 'test_*.py'`: suite backend completa passou, 312/312 testes.
- `venv/bin/python scripts/evaluate_eco_study_ocr.py --study-a-dir <pasta-externa-a> --study-b-dir <pasta-externa-b>`: conjunto ouro local reconheceu 57/57 medidas (28/28 e 29/29), sem ausencias, divergencias ou campos inesperados; ambos os estudos foram classificados como `ge_logiq_e`.
- Cabecalhos dos dois estudos reais foram reconhecidos com presenca de paciente, tutor, idade, especie e data do exame; a verificacao registrou apenas indicadores booleanos, sem persistir os dados identificaveis.
- Testes unitarios cobrem cabecalho GE anonimizado, distincao entre `TRIV` e `E/TRIV`, apóstrofo curvo em `E/E’` e preferencia pela leitura de duas casas decimais quando uma variante perde o ultimo digito.
- Regressao de runtime reproduz a unidade systemd com `PATH` limitado ao venv e confirma a resolucao de `/usr/bin/tesseract`, inclusive quando `TESSERACT_CMD=tesseract` estiver definido.
- `venv/bin/python scripts/evaluate_ge_vivid_iq_ocr.py --study-a-dir <pasta-externa-a> --study-b-dir <pasta-externa-b> --report-pdf <pdf-externo>`: conjunto ouro GE Vivid IQ reconheceu 68/68 valores suportados, sem ausencias, divergencias, campos inesperados ou conflitos; capturas e PDF foram classificados como `ge_vivid_iq`.
- `venv/bin/python scripts/evaluate_eco_study_ocr.py ...`: regressao GE LOGIQ e permaneceu em 57/57 valores, sem ausencias, divergencias ou campos inesperados, com os dois estudos classificados como `ge_logiq_e`.
- Testes unitarios cobrem os aliases do Vivid IQ, a identificacao prudente de tela e relatorio, e a ausencia de inferencia de dados do paciente quando o layout nao os separa com seguranca.
- `venv/bin/python -m unittest tests.test_eco_study_extraction_service`: 18/18 testes passaram, cobrindo extracao de peso explicitamente rotulado, formatos comuns de `Birthdate`, calculo da idade em anos completos e, para pacientes com menos de um ano, em meses completos.
- Smoke com PDF real externo do Vivid IQ: perfil `ge_vivid_iq`, `Birthdate` calculado contra o campo `Date`, peso reconhecido e 25 medidas extraidas; o resultado identificavel nao foi persistido no repositorio.
- `npx eslint app/laudos/components/EcoStudyImportUploader.tsx --max-warnings=0`: passou; a interface identifica quando idade e/ou peso serao aplicados junto das medidas.
- Validacao de regressao: peso importado aceita `7,35 kg`, `7.35kg` ou numero puro; novo/editar usam o valor normalizado na busca de referencia e o componente recalcula ao mudar referencia ou medidas.
- Regressao do alias de refluxo tricuspide: `Vmax RT 3.53 m/s` e normalizado para `IT_Vmax = 3.53` tanto na extracao textual quanto no caminho de PDF.
- Smoke com PDF clinico externo `mee180726_20260718_120334.pdf`: perfil `ge_vivid_iq`, linha `Vmax RT 3.53 m/s` reconhecida como `IT_Vmax = 3.53`; o arquivo e os dados identificaveis permaneceram fora do repositorio.
- Regressao de cache: jobs concluidos sem `meta_importacao_estudo.versao_extrator` ou com versao anterior nao sao reutilizados; resultados da versao atual continuam elegiveis para deduplicacao pelo mesmo usuario e hash.

## Validacao manual pendente

- Importar o lote GE LOGIQ e pela interface e revisar a experiencia de selecao/aplicacao.
- Importar PDF com camada textual.
- Importar PDF rasterizado.
- Revisar sugestoes, conflitos e conversoes de unidade.
- Aplicar sugestoes e confirmar calculos derivados no editor.
- Importar o PDF clinico fornecido em stage e confirmar visualmente idade e peso antes de aplicar as sugestoes.

## Riscos residuais e pre-requisitos

- O ambiente backend de producao ainda precisa disponibilizar o comando `tesseract` com idiomas `por` e `eng` ou configurar `TESSERACT_CMD`/`TESSDATA_DIR`; o deploy de stage provisiona e exige esse requisito.
- PDF com camada textual e PDF rasterizado foram exercitados de ponta a ponta localmente.
- A metrica 57/57 mede somente os campos suportados e visiveis nos dois estudos GE LOGIQ e fornecidos; novos modelos de equipamento e layouts ainda exigem conjuntos ouro proprios revisados por veterinario.
- A identificacao inicial como Vivid IQ/GE Vet World foi corrigida: as imagens de calibracao vieram do GE LOGIQ e, enquanto `VET WORLD` e a clinica impressa no cabecalho.
- A metrica 68/68 mede somente os campos suportados e visiveis nas capturas e no relatorio GE Vivid IQ fornecidos; medidas sem campo canonico no editor continuam fora das sugestoes.
- O relatorio GE Vivid IQ fornecido possui camada textual; o caminho de PDF rasterizado continua coberto pelo smoke sintetico e deve ser ampliado quando houver um relatorio real sem camada textual.
- Imagens clinicas usadas na calibracao nao foram copiadas para o repositorio; somente os valores esperados anonimos fazem parte do avaliador local.
