# Spec - whatsapp-lembrete-prontidao-clinicas

## Requisitos funcionais

- RF-001: nova função `list_clinicas_prontidao_whatsapp_lembrete(db, *,
  janela_dias=60)` em `whatsapp_reminder_scheduler_service.py` percorre
  todas as clínicas `ativo=True`, resolve o destino que o lembrete usaria
  (mesma lógica de `_resolve_destination`: primeiro item não-vazio de
  `whatsapps`, com fallback para `telefone`) e classifica cada uma como
  pronta, sem número (`sem_numero`) ou número inválido
  (`numero_invalido`), usando `normalize_whatsapp_number` para a
  validação.
- RF-001a: para cada clínica, conta quantos `Agendamento` ela solicitou
  (por `created_at`, não pela data da consulta) dentro da janela de
  `janela_dias` dias (padrão 60), como `agendamentos_60_dias`.
- RF-001b: a lista retornada (`clinicas`) inclui **todas** as clínicas
  ativas (prontas e com problema), ordenadas por `agendamentos_60_dias`
  decrescente (empate por nome) — para o usuário priorizar a revisão
  pelas clínicas de maior movimento primeiro.
- RF-002: `GET /agenda/whatsapp/lembrete-clinicas-prontidao`
  (autenticado, mesmo padrão do endpoint de preview de agendamentos já
  existente) retorna `{janela_dias, total_clinicas_ativas,
  total_prontas, total_com_problema, clinicas: [{clinica_id,
  clinica_nome, motivo, valor_cadastrado?, agendamentos_60_dias}],
  problemas: [...]}` (`problemas` é o subconjunto de `clinicas` com
  `motivo` não nulo, mantido por conveniência).
- RF-003: somente leitura — não altera nenhum dado, não envia nenhuma
  mensagem.
- RF-004: na tela de Configurações, seção "Lembrete automático de
  consulta (WhatsApp)", um botão "Verificar números de WhatsApp das
  clínicas antes de habilitar" chama o endpoint sob demanda (não
  pré-carrega ao abrir a página) e exibe o resumo + a lista completa de
  clínicas (ordenada por movimento), cada uma com status visual
  (pronta/problema) e, quando houver problema, link direto para
  `/clinicas/:id` (tela de edição já existente).

## Requisitos não funcionais

- NFR-001: reaproveita `normalize_whatsapp_number` (já usada no envio
  real) em vez de duplicar a regra de validação, para que o relatório
  reflita exatamente o que funcionaria (ou não) no envio de fato.

## Contrato de API

### `GET /agenda/whatsapp/lembrete-clinicas-prontidao`

Resposta `200`:
```json
{
  "total_clinicas_ativas": 5,
  "total_prontas": 1,
  "total_com_problema": 4,
  "problemas": [
    {"clinica_id": 11, "clinica_nome": "Clinica X", "motivo": "sem_numero"},
    {"clinica_id": 7, "clinica_nome": "Clinica Y", "motivo": "numero_invalido", "valor_cadastrado": "123"}
  ]
}
```

## Critérios de aceitação

- CA-001: clínica ativa sem nenhum WhatsApp cadastrado e sem telefone
  aparece em `problemas` com `motivo: "sem_numero"`.
- CA-002: clínica ativa cujo número resolvido falha em
  `normalize_whatsapp_number` (ex.: poucos dígitos) aparece com
  `motivo: "numero_invalido"` e o valor cadastrado.
- CA-003: clínica ativa com WhatsApp válido (ou telefone válido como
  fallback, quando `whatsapps` só tem string vazia) conta em
  `total_prontas` e não aparece em `problemas`.
- CA-004: clínica inativa (`ativo=False`) nunca é considerada, mesmo sem
  número válido.
- CA-005: chamar o endpoint múltiplas vezes não gera nenhum efeito
  colateral (nenhuma escrita no banco, nenhum envio).
- CA-006: `agendamentos_60_dias` conta apenas agendamentos cujo
  `created_at` cai dentro da janela; agendamentos mais antigos que a
  janela não contam, mesmo que a clínica tenha histórico extenso.
- CA-007: a lista `clinicas` vem ordenada por `agendamentos_60_dias`
  decrescente, incluindo clínicas prontas e com problema juntas (não
  filtra as prontas para fora da lista).
