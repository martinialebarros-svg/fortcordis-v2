# Spec - eco-study-import

## Requisitos funcionais

- RF-001: aceitar imagem ou PDF em endpoint autenticado dedicado.
- RF-002: limitar o arquivo a 30 MB e o PDF a 20 paginas.
- RF-003: deduplicar jobs ativos ou concluidos pelo par usuario/hash.
- RF-004: retornar estado `pending`, `processing`, `completed` ou `failed`.
- RF-005: mapear rotulos reconhecidos para as chaves canonicas de medidas do editor.
- RF-006: preservar valor e unidade originais, valor normalizado, pagina, linha e confianca.
- RF-007: nao incluir medidas conflitantes no conjunto sugerido para aplicacao.
- RF-008: exibir as sugestoes para revisao antes de alterar o formulario.
- RF-009: manter XML e importacao de cabecalho funcionando sem mudanca de contrato.
- RF-010: reconhecer o perfil GE Vet World em imagens exportadas, lendo cabecalho e quadros de medidas nas regioes conhecidas sem depender de XML.
- RF-011: preencher apenas dados textualmente presentes no arquivo; achados, diagnostico e conclusao permanecem sob revisao do veterinario.

## Requisitos nao funcionais

- NFR-001 (seguranca): jobs so podem ser consultados pelo usuario solicitante.
- NFR-002 (rastreabilidade): cada medida deve apontar para sua origem textual e pagina.
- NFR-003 (prudencia clinica): nenhum resultado pode finalizar ou publicar um laudo automaticamente.
- NFR-004 (idempotencia): repeticao do mesmo arquivo pelo mesmo usuario deve reutilizar resultado valido.
- NFR-005 (compatibilidade): valores lineares sao normalizados para mm, velocidades para m/s e tempos para ms, preservando a unidade original na evidencia.
- NFR-006 (operacao): falha de OCR ou dependencia de PDF deve produzir mensagem controlada.
- NFR-007 (observabilidade): o runtime deve informar disponibilidade, versao e idiomas obrigatorios do Tesseract sem impedir os demais modulos quando OCR estiver ausente.
- NFR-008 (deploy): stage deve provisionar e exigir Tesseract com `por` e `eng` antes de reiniciar o backend.
- NFR-009 (privacidade): o conjunto de calibracao pode permanecer em volume externo; imagens clinicas nao devem ser copiadas para o repositorio nem incorporadas aos testes.
- NFR-010 (calibracao): perfis de fabricante devem ser avaliados por conjunto ouro versionado apenas como valores esperados anonimos.

## Contrato de resultado

```json
{
  "paciente": {},
  "medidas": {"DIVEd": 32.4},
  "medidas_extraidas": [
    {
      "campo": "DIVEd",
      "rotulo": "DIVEd",
      "valor": 32.4,
      "unidade": "mm",
      "valor_original": 3.24,
      "unidade_original": "cm",
      "confianca": 0.92,
      "pagina": 1,
      "texto_origem": "LVIDd 3.24 cm",
      "status": "sugerida"
    }
  ],
  "meta_importacao_estudo": {
    "formato": "pdf",
    "paginas": 1,
    "medidas_sugeridas": 1,
    "conflitos": 0,
    "perfil": "generico"
  }
}
```

## Criterios de aceitacao

- CA-001: texto `LVIDd 3.24 cm` resulta em `DIVEd = 32.4` mm com evidencia original.
- CA-002: aliases de FE, FS, AE/Ao, Doppler e dimensoes principais sao normalizados.
- CA-003: duas ocorrencias incompatíveis do mesmo campo ficam como conflito e nao sao aplicadas.
- CA-004: imagem invalida, extensao invalida, PDF excessivo e arquivo acima do limite falham de forma controlada.
- CA-005: o novo componente aparece em novo e editar laudo.
- CA-006: medidas so entram no formulario depois de clicar em aplicar sugestoes.
- CA-007: imagens GE Vet World reconhecem paciente, tutor, idade, especie e data quando esses textos estiverem legiveis no cabecalho.
- CA-008: `E/TRIV` nao pode ser interpretado como uma segunda medida de TRIV.
- CA-009: apóstrofo curvo em `E/E’` deve ser aceito e a leitura completa com duas casas decimais deve prevalecer sobre variante truncada.
