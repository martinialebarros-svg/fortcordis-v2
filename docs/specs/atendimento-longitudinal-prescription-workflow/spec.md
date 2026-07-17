# Spec - atendimento-longitudinal-prescription-workflow

Data: 2026-07-16
Responsavel: Codex
Status: done

## 1) Requisitos funcionais

- RF-001: o historico do paciente deve retornar a prescricao e seus itens associados a cada atendimento.
- RF-002: o frontend deve distinguir visualmente um registro existente de um novo atendimento.
- RF-003: a acao `Novo atendimento deste paciente` deve manter apenas o contexto cadastral do paciente e da clinica, limpando triagem, consulta, exames, documentos e prescricao.
- RF-004: uma receita historica pode ser usada como base de um novo atendimento, mas IDs da prescricao, itens e ajustes nao podem ser reaproveitados.
- RF-005: abrir um registro historico a partir de um rascunho clinico deve exigir confirmacao antes de descartar o rascunho.
- RF-006: alteracoes pendentes de um atendimento persistido devem ser salvas antes da troca para um novo atendimento; uma sincronizacao em curso bloqueia temporariamente a troca.
- RF-007: a navegacao principal deve expor apenas Consulta, Exames, Prescricao e Documentos.
- RF-008: casos recentes, bibliotecas clinicas, cadastro complementar e triagem detalhada devem permanecer acessiveis sob demanda.

## 2) Requisitos nao funcionais

- NFR-001 (desempenho): prescricoes e itens do historico devem ser carregados em lote, sem N+1 por atendimento.
- NFR-002 (integridade): copiar receita historica deve criar novos itens no primeiro salvamento do novo atendimento.
- NFR-003 (compatibilidade): nenhuma migracao de banco e nenhuma quebra dos campos existentes do endpoint de historico.
- NFR-004 (usabilidade): a tela deve manter o contexto essencial do paciente visivel e reduzir secoes administrativas abertas por padrao.

## 3) Contratos

### API

`GET /api/v1/atendimentos/paciente/{paciente_id}/historico`

Cada item de `atendimentos` passa a incluir:

```json
{
  "tem_prescricao": true,
  "prescricao": {
    "id": 10,
    "orientacoes_gerais": "...",
    "retorno_dias": 7,
    "total_itens": 1,
    "itens": []
  }
}
```

### Banco

- Sem alteracao de schema.
- `prescricoes_clinicas.atendimento_id` continua sendo a fronteira de separacao longitudinal.

### Frontend

- O formulario novo conserva `paciente_id`, `especie` e `clinica_id` quando iniciado a partir do atendimento atual.
- Sinais vitais e demais dados clinicos nunca sao copiados automaticamente.
- Itens historicos sao reconstruidos sem `id` e sem `historico_ajustes`.

## 4) Criterios de aceitacao

- CA-001: duas consultas do mesmo paciente exibem duas receitas independentes no historico.
- CA-002: criar a segunda consulta nao modifica a prescricao da primeira.
- CA-003: copiar uma receita abre um formulario novo e mostra a origem para revisao.
- CA-004: o registro original continua acessivel pela acao `Abrir original`.
- CA-005: o fluxo principal apresenta quatro areas clinicas; ferramentas auxiliares ficam recolhidas.
- CA-006: o endpoint executa somente uma consulta de prescricoes e uma de itens para o conjunto de atendimentos retornado.
