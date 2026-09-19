# Intent — Busca e resumo remotos de OS

Preparar a paginação segura de Ordens e Cobranças: busca e totais devem considerar
toda a relação filtrada, não os primeiros 500 itens baixados pela interface.

Este incremento entrega o contrato de leitura do backend, a paginação da aba
Ordens (100 OS) e resumos remotos de Cobranças (50 destinatários). Os detalhes
de um destinatário são carregados somente quando solicitados, sem liberar ações
sobre um conjunto parcial. Validação publicada e medição de latência permanecem pendentes.
