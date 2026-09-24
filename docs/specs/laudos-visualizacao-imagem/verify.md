# Verify - Visualização de imagem no laudo

## Rodada atual: zoom, reordenação e seleção para o PDF

- O visualizador oferece zoom de 100% a 400%, restauração e deslocamento por arraste sem modificar o arquivo.
- Imagens novas e persistidas podem ser reordenadas por arrastar; as setas permanecem como alternativa de teclado.
- `Incluir no PDF` é persistido separadamente da existência da imagem. Desmarcar não exclui nem oculta a imagem na edição.
- A migração aditiva usa `true` como padrão para manter os PDFs legados inalterados.
- O SQL da migração usa o literal booleano nativo `TRUE` no PostgreSQL e `1` no SQLite.
- O cache do PDF incorpora a ordem e a seleção de todas as imagens ativas.

## Evidências automatizadas

- `vitest run app/laudos/components/ImagePreviewModal.test.tsx app/laudos/components/ImageUploader.test.tsx`: 4/4 testes passaram, cobrindo abertura, navegação, fechamento por `Esc`, zoom/restauração, seleção para o PDF e reordenação por arraste.
- `python -m unittest tests.test_imagens_configuracao_pdf tests.test_ecocardiograma_medidas tests.test_pdf_laudo_echo_measurements tests.test_migration_ci_cycle tests.test_sdd_guardrail -v`: 16/16 testes passaram, incluindo persistência atômica, isolamento por sessão, associação temporária, filtro/cache do PDF, compatibilidade da migração e guardrail SDD.
- `python -m unittest discover -s tests -p 'test_*.py'`: 1.420 testes passaram; 7 foram ignorados pela própria suíte.
- ESLint dirigido dos componentes e das telas de novo/editar laudo passou sem avisos.
- `tsc --noEmit --pretty false` passou.
- `npm run build` concluiu com sucesso, incluindo `/laudos/novo` e `/laudos/[id]/editar`.
- `git diff --check` passou sem erros de whitespace.

## Segurança clínica

- Nenhum dado clínico, arquivo, vínculo ou ordem é modificado pelo visualizador.
- A imagem usa ajuste proporcional (`object-contain`), sem recorte na visualização ampliada.
- A seleção para o PDF não representa descarte clínico: o registro e o conteúdo da imagem permanecem vinculados ao exame.

## Validação manual recomendada

- Em novo laudo, carregar várias imagens, abrir uma miniatura e navegar entre elas.
- Em editar laudo, abrir uma imagem já persistida e confirmar o fechamento por botão, fundo e `Esc`.
- Confirmar zoom, restauração e deslocamento em imagem ecocardiográfica de alta resolução.
- Reordenar e desmarcar imagens, gerar o PDF e confirmar que a galeria mantém todas enquanto o documento respeita a seleção.
