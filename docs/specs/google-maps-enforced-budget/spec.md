# Especificação — autorização e orçamento Google Maps

## Contrato

- RF-001: todo envio Google exige reserva persistida antes do I/O, inclusive fallbacks, chamadas diretas e workers. Cache já persistido não consome uma nova chamada.
- RF-002: configuração inicial não contém orçamento aprovado. Sem configuração válida, consentimento ou acesso ao ledger, a operação paga é suspensa. Nenhuma flag permite ignorar a proteção.
- RF-003: limites de chamadas e custo estimado em BRL por ação, dia e mês; cada tentativa enviada consome reserva conservadora inclusive timeout/erro, pois não é possível provar ausência de cobrança. Não estornar automaticamente tentativas incertas.
- RF-004: preview autenticado não consulta Google; identifica ação/serviço, teto verificável de chamadas, faixa de custo, incerteza, consumo, limites e saldo. Esse teto limita a execução; não promete completar uma busca que precise de mais chamadas.
- RF-005: confirmação explícita gera autorização curta, vinculada ao usuário e hash da requisição exata (método, caminho, parâmetros e corpo). Uma autorização permite uma única execução, com quantidade e valor finitos. Repetição, alteração de payload, expiração e concorrência não renovam o teto.
- RF-006: o servidor revalida saldo global a cada reserva. Confirmação não aumenta teto diário/mensal, mesmo quando foi obtida antes de outra ação consumir saldo.
- RF-007: automações precisam de política nominada, desabilitada inicialmente, com orçamento próprio dentro do global e identidade estável da execução. Repetir o mesmo job não cria autorização nova ilimitada.
- RF-008: UI exibe “Cancelar” e “Confirmar esta ação” antes de executar. Cancelar/fechar/abortar não dispara a operação. Sem “não perguntar novamente”. Erros ficam visíveis na tela atual, acima de modais.
- RF-009: administração restrita mostra configuração, consumo estimado e histórico de bloqueios sanitizado. Configuração não é equivalente a cobrança conciliada Google.
- RF-010: bloqueio de custo não se transforma em distância zero, heurística ou oferta fictícia. A mensagem informa o impedimento; regras existentes de agenda permanecem autoritativas.
- RF-011: revalidação Google bem-sucedida renova o timestamp do cache mesmo com valores iguais. Ajustes manuais protegidos continuam preservados.
- RF-012: a primeira habilitação exige baseline explícito de chamadas/custo do dia e mês, data atual em Fortaleza e base da apuração. O baseline é somado uma vez e não pode ser reduzido por editar configuração; a base sintética é recusada em produção.
- RF-013: o catálogo público de 18/10/2026 impede preços unitários abaixo de USD 0,005 para Essentials/Geocoding e USD 0,01 para Pro/Advanced. Preços de contratos descontados não são usados para liberar saldo conservador. Câmbio superior e validade são escolhas explícitas da administração.
- RF-014: o cache consultado durante validação de escrita da agenda faz flush sem commit; somente o endpoint pode confirmar agendamento e cache depois de completar todas as validações. Bloqueio intermediário reverte a escrita operacional, preservando as reservas financeiras já consumidas.

## Modelo financeiro e limites

SKU é determinado pelo provedor e pelo modo de tráfego efetivamente enviados. Geocoding e Distance Matrix também são controlados, embora o Billing fornecido destaque Routes Essentials. A estimativa conservadora reserva a tarifa superior configurada por evento multiplicada por um câmbio superior explícito. Não presume franquia livre do projeto, porque franquias/faixas podem ser compartilhadas pela conta de faturamento. A faixa exibida pode começar em zero; o bloqueio usa o extremo superior.

A cobrança efetiva depende de SKU, consumo dos demais projetos, contrato/faixas, créditos, câmbio/impostos e processamento tardio do Billing. O ledger é evidência de reservas/tentativas controladas pela aplicação, não uma reprodução da fatura. O histórico anterior à ativação precisa ser conciliado; não se pode chamar o contador novo de consumo integral do mês da conta Google.

Quotas nativas são segunda barreira por projeto/API e métrica que o console realmente permita editar. Quota por minuto limita velocidade, não garante teto mensal. Alertas de budget não interrompem serviço. Restringir chaves e separar projetos/chaves de stage/produção, conferir quotas Routes e legacy/geocoding, e registrar a evidência efetiva antes de ativar produção.

## Persistência e segurança

Migração aditiva para política, autorizações, contadores e eventos. Serialização compartilhada em transação independente impede que rollback da agenda apague gasto já autorizado. Não guardar corpo/endereço/chave no ledger; somente hashes e identificadores operacionais necessários. Erros de transporte geocoding são sanitizados para não divulgar URL/chave/endereço.

Rotas administrativas são autenticadas e restritas a administrador. A autenticação normal da ação continua exigida. Um token financeiro não concede permissão funcional.

## Aceitação

CA-001: cancelar → zero execução da ação e zero envio pago. CA-002: concorrência em conexões/processos distintos nunca supera chamadas/BRL. CA-003: pedido direto sem grant e worker sem política não enviam Google. CA-004: replay e payload alterado recusados. CA-005: limites persistem após recriar sessão/processo. CA-006: falha de banco fecha o transporte. CA-007: TTL estável é renovado e segunda sessão reutiliza rota. CA-008: UI/servidor mantêm privacidade e não produzem disponibilidade por fallback financeiro. CA-009: stage validado com dados sintéticos; produção pendente de escolha e autorização.
