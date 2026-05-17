# Plan - arch-be-02-modularizar-relatorios-for38

Data: 2026-05-17  
Responsavel: Martiniano Edvirgenes Alencar Barros  
Status: in-progress

## Fases

1. Mapeamento
- Identificar blocos de helper em `relatorios.py` sem dependência de contexto de rota.

2. Extração
- Criar `relatorios_helpers.py` com constantes e funções auxiliares.
- Migrar dataclass de agregação e utilitários de seção/export.

3. Integração
- Substituir implementações locais por imports em `relatorios.py`.

4. Validação
- Compilar módulos Python alterados.
- Rodar testes de relatório quando ambiente possuir `pytest`.

5. Rollout
- Commit limpo da fatia e push para `stage`.

## Riscos

- Erros de importação/nomes após extração.
- Diferenças sutis em cálculos de distância/normalização.

## Mitigações

- Reuso literal da implementação extraída (sem alteração de regra).
- Validação via `py_compile` e testes automatizados quando disponíveis.
