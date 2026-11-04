# Intent — Preservar Nginx em publicação delimitada

A promoção autorizada da conferência/prévia do laudo deve preservar a configuração Nginx já operacional do Atendimento. O workflow de produção atual força HTTP2=1 e usa reload1; adicionar um opt-out por commit é necessário para esta entrega, sem alterar arquivos Nginx ou os defaults de outras publicações.
