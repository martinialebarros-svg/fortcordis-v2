# Registro de entrega restrita a stage

Este documento descreve a otimização de egress de #448, que permanece somente em stage. A promoção Maps de 23/10 mantém estes artefatos SDD para preservar a estrutura documental, mas não inclui o código dessa otimização em produção. A restauração de stage recuperará o registro original.

# Intenção

Reduzir tráfego de banco nas verificações recorrentes do Fort Cordis Stage.
Leituras de flags carregavam logo e assinatura binários sem utilizá-los, e
verificações de existência traziam o catálogo completo de tabelas.

A entrega deve preservar os controles de ativação, os trabalhos automáticos e
a prontidão da aplicação. A autorização desta rodada limita a publicação ao
Stage e não inclui mudança de plano, serviço pago ou produção.
