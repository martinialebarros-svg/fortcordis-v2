# Intent — Paginação de Transações

Reduzir a carga inicial de Transações de 500 para até 100 itens, sem tornar
registros antigos inacessíveis. A busca deve consultar a base inteira e os
totais financeiros devem permanecer autoritativos no backend.

Escopo incremental: Transações. Ordens e Cobranças ficam para uma entrega
separada que preserve agrupamentos por destinatário, seleção em lote e recibos.
