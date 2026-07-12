# Verify - eco-study-import

## Estado

Primeira entrega vertical implementada localmente e perfil GE Vet World calibrado com dois estudos mantidos fora do repositorio; validacao em stage permanece pendente.

## Evidencias automatizadas

- `venv/bin/python -m unittest tests.test_eco_study_extraction_service tests.test_eco_study_import_jobs tests.test_eco_study_import_migration tests.test_image_header_import_service tests.test_xml_import_jobs tests.test_sdd_guardrail -v`: 22/22 testes passaram.
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
- `venv/bin/python -m unittest discover -s tests -p 'test_*.py'`: suite backend completa passou, 303/303 testes.
- `venv/bin/python scripts/evaluate_eco_study_ocr.py --study-a-dir <pasta-externa-a> --study-b-dir <pasta-externa-b>`: conjunto ouro local reconheceu 57/57 medidas (28/28 e 29/29), sem ausencias, divergencias ou campos inesperados; ambos os estudos foram classificados como `ge_vet_world`.
- Cabecalhos dos dois estudos reais foram reconhecidos com presenca de paciente, tutor, idade, especie e data do exame; a verificacao registrou apenas indicadores booleanos, sem persistir os dados identificaveis.
- Testes unitarios cobrem cabecalho GE anonimizado, distincao entre `TRIV` e `E/TRIV`, apóstrofo curvo em `E/E’` e preferencia pela leitura de duas casas decimais quando uma variante perde o ultimo digito.
- Regressao de runtime reproduz a unidade systemd com `PATH` limitado ao venv e confirma a resolucao de `/usr/bin/tesseract`, inclusive quando `TESSERACT_CMD=tesseract` estiver definido.

## Validacao manual pendente

- Importar o lote GE Vet World pela interface e revisar a experiencia de selecao/aplicacao.
- Importar PDF com camada textual.
- Importar PDF rasterizado.
- Revisar sugestoes, conflitos e conversoes de unidade.
- Aplicar sugestoes e confirmar calculos derivados no editor.

## Riscos residuais e pre-requisitos

- O ambiente backend de producao ainda precisa disponibilizar o comando `tesseract` com idiomas `por` e `eng` ou configurar `TESSERACT_CMD`/`TESSDATA_DIR`; o deploy de stage provisiona e exige esse requisito.
- PDF com camada textual e PDF rasterizado foram exercitados de ponta a ponta localmente.
- A metrica 57/57 mede somente os campos suportados e visiveis nos dois estudos GE Vet World fornecidos; novos modelos de equipamento e layouts ainda exigem conjuntos ouro proprios revisados por veterinario.
- Imagens clinicas usadas na calibracao nao foram copiadas para o repositorio; somente os valores esperados anonimos fazem parte do avaliador local.
