# Verificação — Google Maps

Status do incremento atual: produção Maps autorizada com gasto adicional zero; `cache_only` implementado e aprovado nas suítes locais integrais de backend e frontend, além dos testes focados. Configuração efetiva, publicação e prova do novo modo em stage/produção permanecem **pendentes**. Os resultados do ciclo anterior, preservados abaixo, não provam o novo modo nem publicação em produção.

## Decisão e observações anteriores à publicação do modo R$ 0

- O usuário autorizou produção sem ultrapassar o teto gratuito. Decisão: `operation_mode=cache_only`, zero novos envios Google; usar somente rota Google persistida ainda válida ou override manual já autorizado. `paid_budget` não está autorizado para ativação nesta promoção.
- Console Google autenticado observado em 18/10/2026 às 21:41 UTC: a conta mostra somente o projeto `fortcordis-maps`; relatório de 1–18/10 registra Routes Compute Routes Essentials 6.114 / R$ 0 e Geocoding 21 / R$ 0. O inventário de projetos é atual, não histórico. Não declarar 3.886 chamadas como saldo gratuito verificado: Billing pode chegar com atraso e o uso de quota diária não é o ledger mensal.
- Quotas observadas: Compute Routes por dia ilimitado, Compute Route Matrix por elemento/dia ilimitado, uso atual exibido zero; limite por minuto observado 3.000. Nenhuma quota foi alterada até essa coleta. Um formulário com valor zero foi preparado e cancelado, o que não aplica bloqueio. Avaliar limites nativos zero depois da proteção em produção continua **planejado**, sujeito à comprovação do valor efetivo por API/métrica.
- SQL readonly às 18:36 de Fortaleza: produção `9137d39f` contém 5.934 registros Routes `routes_api_basic/ok` em outubro; stage `cb93d4c6`, zero. Hoje, zero registros nos dois. A diferença de 180 para o relatório Google não foi conciliada nem atribuída a um defeito. Geocoding/primeira saída e persistência da telemetria têm lacunas conhecidas.
- `created_at` real é `timestamp without time zone DEFAULT CURRENT_TIMESTAMP`; a sessão consultada está em UTC. O agregado supondo UTC→Fortaleza e o agregado bruto mantêm 5.934 no mês, mas não provam o fuso histórico. A franquia mensal Google reinicia às 00:00 do Pacífico dos EUA no primeiro dia, enquanto o ledger operacional usa Fortaleza.
- Produção ainda não tinha tabelas do guard na coleta; stage tinha zero configurações e somente bloqueios, sem reservas. Esses dados descrevem o estado anterior à nova publicação, não sua conclusão.
- Os 13 caminhos clínicos restaurados pela PR #391 foram isolados no candidato local, iguais à produção `9137d39f`. Restaurá-los em stage a partir de `cb93d4c6` depois da promoção continua obrigatório. A alteração de payload clínico/avisos felinos não integra a autorização Maps.
- Evidências sanitizadas: `evidence/console-free-ceiling-20261018.sanitized.json`, `evidence/october-application-usage-20261018.sanitized.json` e `evidence/clinical-isolation-for-maps.json`. A auditoria histórica em `audit.md` permanece um retrato anterior à implementação.

## Aceitação do incremento `cache_only` — local versus instalado

| Verificação | Estado |
|---|---|
| Configurar sem preços/FX/baseline; limites zero; preservar eventos e baseline anterior sem inventar consumo | Local aprovado; instalação pendente |
| Preview `required=false`, sem quote/token/popup pago; uso de rota Google válida/manual sem transporte | Local aprovado; instalação pendente |
| Cache ausente, expirado, heurístico, TTL não positivo, manual sem override e primeira saída sem TTL bloqueiam com motivo; agenda preservada | Local aprovado; instalação pendente |
| Acesso direto, jobs, force refresh e todos os providers não enviam Google; falta de key/flag não libera fallback, mudança de modo revalida a política | Local aprovado; instalação pendente |
| Concorrência/reconexão/banco indisponível não abrem autorização; regressão `paid_budget` preservada | Local aprovado em SQLite/PostgreSQL descartável; instalação pendente |
| Testes frontend, painel sem campos financeiros fabricados, bloqueio visível, build e regressões | Local aprovado; bundle instalado pendente |
| Gates e deploy terminal em stage do novo modo, transporte simulado e dados sintéticos | Pendente |
| Promoção isolada stage→main; runtime preservado; configuração cache-only relida e smoke instalado sem Google real | Pendente |
| Segunda barreira nativa com valores efetivos comprovados e restauração dos 13 caminhos em stage | Pendente |

## Resultados locais do incremento `cache_only` — 18/10/2026

- Backend focado: 74 testes Maps, sem skips, incluindo PostgreSQL descartável e prova do canário com API real/banco isolado; mais dez casos Agenda/IA de atomicidade, 26 de primeira saída e dez de logística, todos aprovados. Incluem atualização de modo, cancelamento/replay pago, providers/jobs negados, histórico preservado, TTL não positivo, fonte manual sem override e cache de sessão da primeira saída sem validade verificável. As contagens são de conjuntos executados, não uma soma livre de sobreposição com a suíte integral.
- Suíte integral backend do candidato clínico isolado: **1.991 testes, 69 skips, zero falhas/erros, 94,142 s**. A primeira execução final teve 24 erros porque fixtures antigas de Agenda não criavam as tabelas/engine do controle compartilhado; as fixtures passaram a usar ledger SQLite vazio isolado e cleanup de engine. Após isso, 208 testes Agenda e 20 WhatsApp Opções passaram e a suíte integral foi repetida com sucesso. O guard permaneceu exigindo validade verificável para primeira saída, sem afrouxar o bloqueio.
- Frontend: 980 testes Vitest em 107 arquivos e 23 testes Node aprovados, com dois workers; 20 testes focados Maps, ESLint, TypeScript e build aprovados. Uma primeira execução ampla encontrou quatro timeouts de 5 s em testes fora de Maps; a repetição com concorrência reduzida passou sem mudança no código. Os casos novos comprovam payload zero sem preços/FX/baseline, preservação do histórico, troca para pago com valores explícitos, preview sem popup/token e bloqueio de cache sem repetir/confirmar.
- Revisão independente do script operacional local de ativação: payload mínimo, validação de destino/SHA, rejeição de configuração paga habilitada, revisão otimista, recarga independente, tripwires dos três providers, HTTP sintético negado, snapshots agregados e hashes dos seis arquivos de runtime. Somente análise estática/AST; o script **não foi executado** e não prova configuração em produção.
- Os testes usam dados sintéticos e transportes interceptados. Não houve envio Google para validar esse incremento local. Resumo sanitizado e hashes dos logs em `evidence/cache-only-local-validation.json`; os logs integrais ficam fora do Git.

## Evidências de entrada

- Billing fornecido pelo usuário, projeto `fortcordis-maps`, SKU Routes: Compute Routes Essentials: julho 13.062 / R$ 90,12; agosto 22.806 / R$ 372,45.
- Evidência original privada permanece fora do Git; diagnóstico sanitizado em `audit.md`.
- Código base stage `74f0148c`; produção observada readonly `9137d39f`.

## Casos obrigatórios do controle pago preservado

- Cancelamento/abort do popup não executa ação; confirmação não é lembrada.
- Concorrência de reservas em SQLite e PostgreSQL descartáveis; persistência/replay.
- Limite por ação/dia/mês e custo conservador por SKU; política automática própria.
- Chamadas reais dos três providers interceptadas antes do transporte; zero rede nos testes.
- Erros de orçamento não causam fallback Distance Matrix nem heurística.
- Cache: uma consulta sintética renova registro expirado de valores idênticos e outra sessão reutiliza sem consulta.
- Permissões administrativas, vínculo de usuário/payload e política ausente/expirada.
- Build/lint/frontend, regressões backend, migração aditiva, guardrail SDD.

## Limites da prova

Uma reserva paga anterior à troca para `cache_only` pode já ter passado pela checagem e estar em trânsito. Trocar o modo não cancela retroativamente esse transporte. A primeira ativação exige verificar guard inicialmente sem orçamento habilitado, deploy/reinício dos processos no snapshot aprovado e estado efetivo da segunda barreira nativa quando aplicada. SHA do checkout sozinho não atesta todos os workers vivos. Nenhuma dessas etapas está comprovada por testes locais.

Mocks provam envio/cancelamento no transporte da aplicação, não tarifação real do Google. Nenhum teste deve enviar uma chamada paga ao Google. Métricas antigas não trazem action_id; o defeito do cache é reproduzido, mas não autoriza atribuir toda a diferença histórica à mesma causa. Quotas nativas só podem ser consideradas ativas após verificar o projeto no console. SQLite comprova invariantes do núcleo; com a transação operacional aberta, sua contenção de escrita pode bloquear uma segunda reserva por indisponibilidade do ledger. A pilha operacional de stage/produção usa PostgreSQL; sucesso integrado com múltiplas pernas deve ser provado nesse banco.

## Resultados locais do primeiro ciclo — 18/10/2026, anteriores a `cache_only`

- Núcleo de orçamento: 40 testes em SQLite e PostgreSQL 16 descartável, todos aprovados. Incluem seis processos simultâneos com teto de duas reservas e oito claims concorrentes com somente um aceito, replay/reabertura de conexão, saldo inicial imutável, permissões, falha do banco, limite por SKU, mensal independente do diário e política automática própria.
- Providers/cache: cinco testes aprovados, incluindo bloqueio antes dos três transportes, ausência de fallback pago, mensagens sem chave/endereço, TTL renovado para valores idênticos e override manual preservado.
- Agenda e IA transacionais: dez casos aprovados com HTTP/DB sintéticos, duas pernas e bloqueio na segunda, cobrindo clínica/domicílio, reativação, reabilitação, preparação/aprovação pela IA e sucesso. Reload confirma ausência de alteração parcial; validação de oferta propaga bloqueio financeiro em vez de anunciar indisponibilidade genérica.
- Integração PostgreSQL real: dois casos adicionais exercitam API Agenda, middleware, preview/confirmação, duas pernas de rota e ledger real. Sucesso confirma negócio/cache juntos; limite na segunda perna mantém agendamento original e cache vazio, com a primeira reserva financeira persistente após reconexão. Um observador independente prova reserva anterior ao transporte e ausência de commit parcial. Zero Google.
- Suíte backend integral final: 1.962 testes em 96,477 s, 44 skips, zero falhas, mais os dois testes integrados PostgreSQL adicionados ao fechamento. Uma execução anterior usou SECRET_KEY sintética com menos de 32 caracteres e falhou em três fixtures do worker; corrigido o ambiente de teste, sem reduzir a validação de segurança. A suíte final usou chave sintética válida.
- Frontend: 1.042 testes Vitest e 23 testes Node aprovados; build de produção, TypeScript e ESLint aprovados. Casos focados incluem cancelamento/abort, erro de preflight, replay, fila de popups, config explícita e geocodificação apenas por ação.
- Migrações: ciclo up/down/up SQLite aprovado; migração 99 testada idempotente/aditiva e RLS/revogação PostgreSQL.
- Navegador real com API sintética e hosts externos bloqueados: cancelar em Logística e Agenda enviou zero operações originais; popup acima do modal real; painel desktop/mobile sem overflow horizontal nem erro JS. Rodapé mobile corrigido e revalidado: Cancelar/Confirmar permanecem visíveis. Evidência em `evidence/browser-synthetic.json` e imagens `.synthetic.png`.

O JSON de auditoria agregada foi coletado readonly de produção/stage. Nenhuma chave, endereço ou dado clínico foi versionado.

## Validação de stage — snapshot `53307512`

- [PR #392](https://github.com/martinialebarros-svg/fortcordis-v2/pull/392) integrado em stage; [deploy 39164041129](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/39164041129) concluído com sucesso. Migração 99 aplicada; arquivos de runtime preservados/restaurados e `Backup restore drill OK`.
- Quality gate: 1.964 testes backend, 67 skips no ambiente CI; etapa específica PostgreSQL executou 47 testes sem skips/falhas. Frontend CI, Migration CI, Google Maps Cost Control e SDD concluídos com sucesso.
- Checkout stage conferido `53307512d361e1259562d256fc2a9d8f8ab08a67`; produção permanece `9137d39fea18c795bb1cb7b1cc9bc204dce05d69`. Não houve publicação em produção.
- HTTP: `app.stage.fortcordis.com.br`, `stage.fortcordis.com.br` e `www.stage.fortcordis.com.br` retornaram 200 na rota de Configurações, com aliases redirecionados ao canônico. API administrativa sem autenticação retorna 401. Fluxos de preview/confirm/status e botão de confirmação encontrados entre os 15 chunks servidos.
- Navegador com bundle real de stage e todas as APIs substituídas por fixtures: 27 assets reais, 44 requests de API simulados, dois previews, zero confirmações e zero ações enviadas após cancelar. Popup acima do modal real de Agenda, botões mobile visíveis, sem overflow ou erro JavaScript. Nenhuma API real ou Google foi chamada nesse teste de UI.
- Evidências sanitizadas: `evidence/stage-workflows.json`, `evidence/stage-http-smoke.json`, `evidence/stage-browser-synthetic.json`.
- A primeira execução do canário concorrente interrompeu por `ledger_unavailable` ao abrir conexões no banco remoto. A política bloqueou as operações; esse resultado não foi contado como prova de sucesso do canário. O diagnóstico e a repetição controlada são registrados na evidência final do canário.
- Repetição controlada do canário, com candidato executado em memória sobre o código implantado: oito reservas concorrentes, quatro envios simulados e quatro recusas `ledger_unavailable`; diagnóstico sanitizado `connection_capacity` na abertura de conexões. Nenhum preenchimento sequencial foi necessário. A tentativa seguinte retornou `day_limit`; replay retornou `invalid_grant`; tarefa sem política retornou `automatic_policy_required`. Uso persistiu após reconexão. Zero Google real, zero alteração em registros operacionais existentes, zero schemas temporários restantes. Evidência: `evidence/stage-canary.json`.
- O ajuste do canário separa claim de autorização da disputa de reservas e registra indisponibilidade como recusa, sem alterar o guard, timeout ou limite. Cinco testes aprovados garantem que excesso real, motivo inesperado ou diagnóstico inseguro continuam reprovando a prova. A falha de capacidade observada neste teste não é atribuída ao aumento histórico de julho/agosto.
