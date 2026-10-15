# Especificação

## Contrato

- RF-01: XML v1/v2 e extração PDF/OCR usam quatro pares independentes:
  `Vmax_VSVE/Grad_VSVE`, `Vmax_aorta/Grad_aorta`,
  `Vmax_VSVD/Grad_VSVD`, `Vmax_pulmonar/Grad_pulmonar`.
- RF-02: associação exige rótulo explícito do local; RVOT/VSVD não é pulmonar.
  Não criar medidas ausentes em outros locais nem derivar velocidade de gradiente.
- RF-03: cada medida importada conserva `<chave>_origem=importado` e, quando
  disponível, `<chave>_rotulo_origem` com o rótulo original. Edição manual
  identifica `informado`; cálculo identifica `calculado`.
- RF-04: gradiente preenchido tem precedência sobre 4 × V². Valores
  arredondados de velocidade não substituem a precisão do gradiente de origem.
  Fallback somente quando ausente; atualizar/limpar derivados já identificados
  quando a velocidade muda/desaparece. Valores preenchidos inválidos não são
  substituídos silenciosamente.
- RF-05: os quatro locais são editáveis nas duas telas e independem da espécie.
  Salvar/reabrir preserva valores e proveniência. Prévia e PDF distinguem
  informação importada/informada do cálculo, sem apresentar fórmula em gradiente
  informado. Metadados não viram medidas numéricas adicionais.
- RF-06: registro legado sem proveniência mantém nomes e valores, especialmente
  `Vmax_pulmonar`; origem não confirmada é sinalizada sem inferir aquisição.
- RF-07: títulos qualitativos respeitam o texto salvo, sem reatribuir VSVD a
  pulmonar ou VSVE a fluxo aórtico.
- RF-08: conflitos do mesmo campo preservam marcador textual e evidência de
  origem; não viram gradiente ausente para cálculo. Rótulos compostos
  ambíguos não geram número. Duplicatas equivalentes não duplicam medida.
- RF-09: novos imports/PDFs usam cache versionado sem alterar resultados
  históricos nem reutilizar a interpretação antiga.

## Critérios de aceitação

| ID | Critério |
| --- | --- |
| CA-01 | Quatro locais separados e simultâneos em importação e apresentação |
| CA-02 | 1,01 m/s + 4,11 mmHg conserva 4,11; 0,80 + 2,57 conserva VSVD |
| CA-03 | Gradiente ausente calcula 4,08 para 1,01 e identifica cálculo |
| CA-04 | Salvar/reabrir preserva precisão e metadados; edição é reversível |
| CA-05 | Legado permanece na chave histórica, sem migração nem simetria |
| CA-06 | Qualitativa conserva títulos/locais explícitos |
| CA-07 | Testes, checagens locais e revisão visual de PDF documentados |
