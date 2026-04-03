# Specs no projeto

Use esta pasta para registrar cada feature pelo fluxo SDD.

## Como criar uma nova spec

1. Escolha um slug curto e descritivo.
- Exemplo: `agenda-bloqueio-feriados`.

2. Crie a pasta da feature.

```powershell
$slug = "agenda-bloqueio-feriados"
New-Item -ItemType Directory -Path "docs/specs/$slug" -Force | Out-Null
```

3. Copie os templates.

```powershell
Copy-Item "docs/specs/templates/*" "docs/specs/$slug"
```

4. Preencha na ordem:
- `intent.md`
- `spec.md`
- `plan.md`
- `verify.md` (durante e no fim da implementacao)

## Convencoes

- Um diretorio por feature.
- Requisitos com IDs (`RF-001`, `NFR-001`, `CA-001`).
- Fases pequenas e com rollback claro.
- Sem PR sem links para os artefatos SDD.
