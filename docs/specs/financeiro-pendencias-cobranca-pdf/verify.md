# Verify - financeiro-pendencias-cobranca-pdf

Data: 2026-06-12
Responsavel: Martiniano + Codex
Status: done

## 1) Matriz de rastreabilidade

| ID | Tipo | Evidencia | Status |
| --- | --- | --- | --- |
| CA-001 | regressao | `_gerar_pdf_cobranca_pendencias` usa `pagesize=A4` sem referencia a `agrupar` | ok |
| CA-002 | regressao | teste focal gera bytes de PDF com item pendente de exemplo | ok |
| CA-003 | regressao | `frontend/app/financeiro/page.tsx` extrai `detail` de erro em `blob` para o PDF de pendencias | ok |
| HOTFIX-001 | ci | workflow `Deploy to VPS` apontou estrutura SDD incompleta; `intent.md` e `plan.md` adicionados ao mesmo diretorio da feature | ok |

## 2) Testes automatizados executados

Comandos previstos para este ciclo:

```bash
cd backend && ./venv/bin/python -m py_compile app/api/v1/endpoints/ordens_servico.py
cd backend && ./venv/bin/python - <<'PY'
from app.api.v1.endpoints.ordens_servico import _gerar_pdf_cobranca_pendencias

pdf = _gerar_pdf_cobranca_pendencias(
    itens=[
        {
            "chave": "id:1",
            "numero_os": "OS2026060044",
            "paciente": "TAPIOCA",
            "tutor": "IANA",
            "clinica_nome": "Petiatra Clinica",
            "clinica_telefone": "85 9633-9593",
            "servico": "Ecocardiograma",
            "data_atendimento": "2026-06-10T13:30:00",
            "valor_final": 180,
        }
    ],
    nome_empresa="Fort Cordis Cardiologia Veterinaria",
    contato_empresa="",
    texto_rodape="",
    filtros_texto="status=Pendente",
)
assert pdf.startswith(b"%PDF")
PY
cd frontend && npx eslint app/financeiro/page.tsx
cd frontend && npx tsc --noEmit
backend/venv/bin/python -m unittest backend/tests/test_sdd_guardrail.py
```

Resumo:
- `./venv/bin/python -m py_compile app/api/v1/endpoints/ordens_servico.py`: ok
- geracao focal de PDF com `_gerar_pdf_cobranca_pendencias`: ok (`%PDF`, 2816 bytes)
- `npx eslint app/financeiro/page.tsx`: ok
- `npx tsc --noEmit`: ok
- `backend/venv/bin/python -m unittest backend/tests/test_sdd_guardrail.py`: ok (`5 passed`)

## 3) Smoke manual recomendado

- Abrir Financeiro em producao/stage com OS pendentes.
- Clicar em `Baixar PDF` no card de uma clinica com pendencias.
- Confirmar que o arquivo PDF baixa e abre.
- Repetir no botao geral de pendencias, se houver mais de uma clinica filtrada.

## 4) Riscos residuais

- A validacao local nao substitui o smoke autenticado no ambiente publicado com dados reais.
