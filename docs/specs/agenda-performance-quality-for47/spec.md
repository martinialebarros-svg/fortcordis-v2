# Especificacao

## Requisitos funcionais
- RF-01: manter API `GET /agenda` com o mesmo contrato de entrada/saida.
- RF-02: suportar filtros combinados de periodo, status, clinica, servico, paciente e tutor.
- RF-03: manter ordenacao estavel por `inicio ASC, id ASC`.
- RF-04: manter paginacao consistente (`skip`/`limit`) sem duplicacao ou perda de itens entre paginas.

## Requisitos nao funcionais
- RNF-01: evitar N+1 em relacoes (`paciente`, `tutor`, `clinica`, `servico`).
- RNF-02: reduzir custo de listagem ampla com estrategia em duas fases:
  1. consulta de IDs paginados e total com filtros;
  2. hidratacao dos relacionados apenas para IDs da pagina.
- RNF-03: manter custo de queries constante sob filtros combinados.

