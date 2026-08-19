# Verify - whatsapp-lembrete-prontidao-clinicas

## Matriz de aceitação

| Critério | Evidência | Resultado |
|---|---|---|
| CA-001 | `test_list_clinicas_prontidao_whatsapp_lembrete_classifica_por_motivo`: clínica sem número → `motivo: "sem_numero"` | passou |
| CA-002 | mesmo teste: clínica com `whatsapps=["123"]` → `motivo: "numero_invalido"` | passou |
| CA-003 | `test_list_clinicas_prontidao_whatsapp_lembrete_usa_telefone_como_fallback`: `whatsapps=[""]` + `telefone` válido → conta em `total_prontas` | passou |
| CA-004 | mesmo teste de classificação: clínica `ativo=False` sem número não aparece nem em `total_clinicas_ativas` nem em `problemas` | passou |
| CA-005 | função é puramente de leitura (`db.query(...).all()`); nenhum `db.add`/`db.commit` no código | revisão de código |

## Comandos executados

```bash
cd backend
DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=... venv/bin/python -m unittest tests.test_whatsapp_reminder_scheduler_service -v
DATABASE_URL=sqlite:///./fortcordis-ci.db SECRET_KEY=... venv/bin/python -m unittest discover -s tests -p "test_*.py"

cd ../frontend
npx tsc --noEmit
npx eslint app/configuracoes/page.tsx --max-warnings=0
npx next build
```

## Resultado - 2026-08-19

- `test_whatsapp_reminder_scheduler_service.py`: 11 testes passaram (2
  novos desta feature, sem regressão nos 9 já existentes).
- Suíte completa do backend: 815 testes, todos passaram.
- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`: todos
  passaram sem avisos.

## Verificação manual (login local + browser real)

1. Login local com usuário admin (`admin@fortcordis.com`), backend e
   frontend rodando localmente (`fortcordis.db` de desenvolvimento, com
   5 clínicas de teste cadastradas).
2. Aba Empresa em Configurações → seção "Lembrete automático de consulta
   (WhatsApp)" → clique em "Verificar números de WhatsApp das clínicas
   antes de habilitar".
3. Resultado exibido: "1 de 5 clínicas ativas prontas para o lembrete
   automático", com 2 clínicas problemáticas listadas (ambas
   `sem_numero`, nomes de teste).
4. Confirmado via `read_page` que os links "Corrigir" apontam
   corretamente para `/clinicas/11` e `/clinicas/7` (ids reais das
   clínicas problemáticas no banco local).

Risco residual: o relatório valida apenas o número que **seria
efetivamente usado** (primeiro válido da lista, com fallback para
telefone) — clínicas com múltiplos WhatsApps cadastrados não têm os
demais números validados, por não serem relevantes para o envio real
(decisão de escopo, ver intent.md).

## Priorização por volume de agendamentos - 2026-08-19

Usuário pediu para focar a revisão pelas clínicas de maior movimento.

- `test_list_clinicas_prontidao_whatsapp_lembrete_conta_e_ordena_por_agendamentos_60_dias`:
  3 clínicas com 5, 1 e 0 agendamentos dentro da janela (mais 1 fora da
  janela de 60 dias, que não deve contar) — confirma contagem exata por
  clínica e ordem decrescente. Passou.
- Suíte completa do backend: 816 testes (1 novo), sem regressão.
- `tsc --noEmit`, `eslint --max-warnings=0`, `next build`: sem erros.
- Verificação manual (browser real, login local): botão exibe a lista
  completa (não só problemas), cada linha com contagem e status visual
  (verde/âmbar) — dados locais têm 0 agendamentos vinculados, então a
  ordenação por contagem não pôde ser visualmente confirmada em produção
  local, mas a lógica de contagem/ordenação já está coberta pelo teste
  automatizado acima com dados fabricados.
