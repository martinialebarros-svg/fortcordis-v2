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
- RF-010: reconhecer o perfil GE LOGIQ e em imagens exportadas, lendo cabecalho e quadros de medidas nas regioes conhecidas sem depender de XML; `VET WORLD` identifica a clinica exibida no cabecalho, nao o modelo do equipamento.
- RF-011: preencher apenas dados textualmente presentes no arquivo; achados, diagnostico e conclusao permanecem sob revisao do veterinario.
- RF-012: reconhecer o perfil GE Vivid IQ em capturas de tela e relatorios PDF exportados, usando regioes e aliases proprios sem misturar essa calibracao com o perfil GE LOGIQ e.
- RF-013: no perfil GE Vivid IQ, reconhecer abreviacoes exibidas pelo equipamento para raiz aortica, atrio esquerdo, E/A, tempo de desaceleracao, gradientes de VSVE/VSVD, velocidade de refluxo mitral e DIVdN.
- RF-014: em PDFs com camada textual, extrair peso quando estiver explicitamente identificado por `Peso`/`Weight` e calcular a idade a partir de `Birthdate`/`Data de nascimento`, usando a data do exame como referencia quando disponivel e a data da importacao como fallback; preencher os campos correspondentes somente ao aplicar as sugestoes.
- RF-015: quando o PDF rasterizado nao disponibilizar idade ou peso na camada textual, realizar uma tentativa adicional de OCR para esses campos sem inferir valores clinicos sem rotulo.
- RF-016: normalizar o peso importado com virgula, ponto e sufixo `kg` antes de consultar a tabela de referencia; na edicao, dados demograficos ausentes no arquivo nao podem apagar os dados existentes do paciente.

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
- NFR-011 (runtime): o backend deve localizar o Tesseract instalado em caminhos absolutos usuais mesmo quando o servico systemd restringir o `PATH` ao ambiente virtual.
- NFR-012 (separacao de perfis): a identificacao do GE LOGIQ e pelo cabecalho tem precedencia; o GE Vivid IQ usa marcadores do painel exportado ou a combinacao de cabecalho e medidas do relatorio GE.

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
- CA-007: imagens GE LOGIQ e reconhecem paciente, tutor, idade, especie e data quando esses textos estiverem legiveis no cabecalho.
- CA-008: `E/TRIV` nao pode ser interpretado como uma segunda medida de TRIV.
- CA-009: apóstrofo curvo em `E/E’` deve ser aceito e a leitura completa com duas casas decimais deve prevalecer sobre variante truncada.
- CA-010: com `PATH` contendo apenas `backend/venv/bin`, uma instalacao executavel em `/usr/bin/tesseract` deve ser localizada e usada pelo extrator e pelo diagnostico de runtime.
- CA-011: capturas GE Vivid IQ reconhecem as medidas suportadas nas caixas laterais, preservando casas decimais e retornando `perfil = ge_vivid_iq`.
- CA-012: relatorio PDF GE Vivid IQ com camada textual reconhece o perfil e as medidas suportadas sem exigir OCR da pagina.
- CA-013: dados identificaveis nao confirmados pelo layout do Vivid IQ nao sao inferidos nem preenchidos automaticamente.
- CA-014: PDF com `Birthdate`, data do exame e `Peso: 7,35 kg` retorna `paciente.idade` em anos completos e `paciente.peso = 7.35`, preservando a aplicacao sob revisao do usuario; abaixo de um ano, a idade e retornada em meses completos.
- CA-015: aplicar medidas com peso importado em formato `7,35 kg` dispara novamente a busca por referencia e recalcula as comparacoes; importacao parcial no laudo existente preserva especie, peso e identificacao anteriores quando ausentes no arquivo.
