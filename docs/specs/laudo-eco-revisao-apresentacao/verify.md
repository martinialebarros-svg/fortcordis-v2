# Verify - Revisão da apresentação do laudo ecocardiográfico

Data: 2026-09-25
Status: validação local concluída

Base do worktree isolado: `origin/stage` em `370507c8`; os commits de WhatsApp, Agenda e documentação incorporados desde a validação anterior não se sobrepõem aos arquivos deste laudo. A suíte completa do frontend foi executada em `ffb4a723`; a integração posterior de Agenda será coberta pelos checks do PR.

| Critério | Evidência | Status |
| --- | --- | --- |
| CA-001 | Teste `echo-report-presentation.test.ts` com medida e peso do caso auditado; navegador local exibiu aviso de conflito sem alterar o valor salvo | ok |
| CA-002 | Testes de seleção modo M/2D na prévia e PDF | ok |
| CA-003 | Teste de faixa ausente/incompleta no PDF e na prévia | ok |
| CA-004 | Teste de PDF com somente DIVEd | ok |
| CA-005 | Teste de separação de observações; navegador local exibiu seções clínicas e operacionais distintas | ok |
| CA-006 | Extração de texto confirma conclusão única antes da análise quantitativa; PNG da primeira página conferido | ok |
| CA-007 | Teste de legenda opcional no editor e persistência de configuração temporária antes de associar ao laudo | ok |
| CA-008 | Teste de seis imagens numeradas, identificação do paciente/data, legenda ausente e texto escapado; segunda página renderizada e inspecionada | ok |
| CA-008 (continuação) | Legendas legadas extensas dividem uma grade de seis imagens; teste confere título, paciente e data em ambas as páginas de imagens | ok |
| CA-009 | Testes de edição da descrição, preservação quando omitida e isolamento por sessão/laudo | ok |
| CA-010 | PDF curto gera uma página; com seis imagens gera duas, sem página narrativa quase vazia | ok |
| CA-011 | Testes de parser multiline na prévia/backend e de presença dos itens no PDF | ok |
| RF-015 | Inspeção dos dois caminhos de PDF: mesma seleção de referência e metadados de imagem | ok |
| CA-012 | Regressão de paginação moderada, com e sem imagens; PDF sintético final renderizado e conferido | ok |
| CA-013 | Teste do helper e PDF: MAPSE medido sem referência cadastrada mostra traço, TAPSE fora de 3–45 kg não reaproveita a extremidade, 45 kg usa a linha publicada e faixas cadastradas são preservadas | ok |
| NFR-001 | Revisão de fluxo: busca de referência apenas na visualização; configuração confirmada no salvamento somente quando há imagens | ok |
| NFR-002 | Nenhuma escrita de medidas no helper; somente cópia para apresentação | ok |
| NFR-003 | Inspeção do diff, testes focados e build | ok |
| NFR-004 | `_esc` aplicado à legenda no PDF; imagem sem legenda recebe somente número | ok |

## Comandos locais

- `frontend: vitest run lib/echo-qualitative.test.ts lib/echo-report-presentation.test.ts app/laudos/components/ImageUploader.test.tsx` — 9 testes aprovados.
- `frontend: vitest run --maxWorkers=2` — suíte completa aprovada: 426/426. A tentativa anterior com quatro trabalhadores teve um timeout em Financeiro fora do diff; esse arquivo passou isoladamente (18/18) antes da repetição completa.
- `frontend: node --test` — 9 testes aprovados.
- `frontend: tsc --noEmit` — aprovado.
- `frontend: eslint` dos arquivos modificados de laudo, upload e helpers — aprovado.
- `backend: python -m unittest tests.test_ecocardiograma_qualitativa tests.test_pdf_laudo_echo_measurements tests.test_referencia_eco_defaults` — 15 testes aprovados, incluindo 13 imagens em três páginas consecutivas, relatório moderado sem página isolada de assinatura e MAPSE sem faixa auxiliar inadequada.
- `backend: python -m unittest tests.test_pdf_laudo_echo_measurements` após a correção da continuação — 10 testes aprovados, incluindo a regressão com seis imagens e legendas extensas que antes deixava a última página sem identificação.
- `backend: python -m unittest tests.test_pdf_laudo_echo_measurements tests.test_ecocardiograma_qualitativa tests.test_referencia_eco_defaults tests.test_imagens_configuracao_pdf tests.test_ecocardiograma_medidas` — 26 testes aprovados após a correção. As páginas sintéticas 2 e 3 com legenda extensa foram renderizadas e conferidas visualmente.
- `backend: python -m unittest tests.test_imagens_configuracao_pdf tests.test_ecocardiograma_medidas` — 10 testes aprovados em ambiente Python 3.12 temporário com as dependências de API; os 25 testes focados também passaram juntos no venv local antes do push.
- `frontend: npm run lint` — aprovado.
- `frontend: npm run build` — aprovado, 43 páginas geradas.
- `scripts/ci/check_sdd_guardrail.py::evaluate_guardrail` — aprovado para os arquivos alterados neste worktree.
- `git diff --check` e `py_compile` dos módulos backend alterados com Python 3.12 — aprovados.
- Navegador local em `/laudos/999` com API sintética isolada — prévia exibiu grupos, unidades, faixas, alerta de DIVEd, múltiplos itens qualitativos e observações separadas; nenhum laudo real foi alterado.
- PDF sintético adicional (`laudo-eco-referencia-sintetica.pdf`) com TAPSE/MAPSE medidos e faixa MAPSE ausente no cadastro — extração confirmou TAPSE 9,20–14,70 mm para 10 kg e traço para MAPSE, sem ocultar o valor MAPSE medido; página renderizada e inspecionada visualmente.

## Auditoria de faixas auxiliares

- TAPSE: a tabela de 3 a 45 kg coincide com os intervalos de predição por peso apresentados na Tabela 5 do trabalho primário de Visser et al. (J Vet Cardiol, 2015; DOI: 10.1016/j.jvc.2014.10.003; [tese com a tabela](https://etd.ohiolink.edu/acprod/odb_etd/ws/send_file/send?accession=osu1397419619&disposition=inline)). A linha de 45 kg foi acrescentada e o fallback agora se limita aos pesos tabulados. O estudo mediu TAPSE predominantemente por modo M; a técnica usada na aquisição do exame individual não é armazenada para conferir compatibilidade.
- MAPSE: Schober e Luis Fuentes (Vet Radiol Ultrasound, 2001; DOI: 10.1111/j.1740-8261.2001.tb00904.x) publicaram 0,65–0,75, 1,03–1,13 e 1,21–1,81 cm como **intervalos de confiança de 95% das médias**, não como intervalos de referência individuais. O antigo fallback convertia esses limites em milímetros e os apresentava como faixa de referência. O preenchimento automático foi retirado, sem apagar valores cadastrados.
- O modelo e a importação CSV das referências não registram fonte, método de aquisição nem população por faixa. Há seleção da linha de peso mais próxima sem limite máximo de distância. As faixas persistidas de MAPSE e dos demais parâmetros precisam de auditoria clínica de origem antes de receber atribuição bibliográfica ou regra nova.

## Limite da evidência

O snapshot anterior foi publicado em stage e sua prévia autenticada foi conferida; a correção de continuação de imagens ainda requer publicação. PDF sintético de duas páginas com seis imagens renderizado; ambas as páginas foram conferidas visualmente. O smoke do navegador usou somente dados sintéticos e não mede a latência real da confirmação de imagem ao salvar. O cadastro de referências ainda não registra bibliografia por faixa, portanto o PDF informa a origem operacional sem atribuição bibliográfica específica. O ambiente Python 3.9 local existente não importa módulos do backend que usam sintaxe mais nova; o teste da API foi executado com Python 3.12 e dependências temporárias em `/tmp`.
