# Spec - fiscal-numero-unico-for22

Data: 2026-05-12  
Responsavel: Codex  
Status: done

## Escopo

Aplicar unicidade de numero fiscal no modulo fiscal com foco em robustez de dados e concorrencia.

## Requisitos funcionais

- RF-001: numeros fiscais nao podem se repetir para valores preenchidos.
- RF-002: migration deve falhar de forma explicita se houver dados duplicados legados.
- RF-003: criacao de nota fiscal deve reprocessar automaticamente quando ocorrer colisao de numero.
- RF-004: API deve responder conflito quando nao for possivel gerar numero unico apos retries.

## Requisitos tecnicos

- RT-001: usar indice unico parcial (`numero` nao nulo e nao vazio) para compatibilidade com registros legados.
- RT-002: manter compatibilidade SQLite/PostgreSQL na migration.
- RT-003: tratar `IntegrityError` por unicidade em `fiscal_service.criar_nota_fiscal` com rollback e retry limitado.

## Criterios de aceitacao

- CA-001: migration cria indice unico `uq_notas_fiscais_numero` em base sem duplicidades.
- CA-002: migration aborta com erro descritivo quando ha duplicidades existentes.
- CA-003: insercao de novo registro com `numero` duplicado passa a falhar no banco.
- CA-004: fluxo de criacao de NF se recupera de uma colisao e persiste com novo numero.
