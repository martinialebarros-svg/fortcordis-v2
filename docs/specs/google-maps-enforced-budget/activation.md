# Ativação — produção com custo adicional zero

## Decisão vigente

O usuário autorizou a publicação dos controles Maps em produção, sem ultrapassar o teto gratuito. A decisão de execução é **`cache_only`: zero novas chamadas Google e R$ 0 de custo adicional por novos envios deste backend**. Rotas Google persistidas ainda válidas e ajustes manuais já autorizados podem ser utilizados. Cache Google com TTL positivo e validade verificável é necessário; ajuste manual exige override autorizado. Cache ausente, expirado, heurístico, TTL não positivo ou cache de primeira saída sem timestamp/TTL suspende a operação dependente da rota, com explicação na tela.

A migração cria somente tabelas; não configura o modo, não aprova orçamento nem altera quota Google. As provas locais focadas e as suítes integrais estão aprovadas: backend 1.991 testes/69 skips e frontend 980 Vitest/23 Node. Publicação, configuração efetiva e quotas do novo modo permanecem pendentes de prova instalada. A autorização de produção não deve ser confundida com prova de ativação. `paid_budget` permanece disponível como mecanismo, mas não está autorizado para habilitação nesta publicação.

Custo zero de novos envios não apaga faturas, pagamentos ou consumo anteriores, e não controla outra aplicação que use a mesma chave fora deste backend. Uso já enviado pode aparecer depois no Billing. Uma reserva paga concluída antes da troca de modo pode já estar entre a autorização e o transporte ou ter resposta pendente; a troca não cancela essa chamada. Por isso, esta primeira ativação parte do guard sem orçamento habilitado e exige confirmar deploy/reinício dos processos antigos, além da segunda barreira nativa quando aplicada. Não alegar corte retroativo de chamadas em trânsito.

## Evidência que fundamenta a decisão

No console autenticado em 18/10/2026, a conta mostrava somente `fortcordis-maps`. O relatório de 1–18/10 exibia 6.114 Routes Compute Routes Essentials / R$ 0 e 21 Geocoding / R$ 0. A telemetria antiga do aplicativo mostrava 5.934 Routes na produção e zero no stage; a diferença de 180 eventos permanece sem conciliação causal.

A tabela pública oferece 10.000 eventos mensais gratuitos para Compute Routes Essentials; a franquia reinicia no primeiro dia do mês às 00:00 do Pacífico dos EUA. Isso não permite declarar 3.886 chamadas disponíveis agora: Billing tem atraso, os períodos/fusos precisam ser conciliados e a telemetria antiga tem lacunas. O novo modo garante ausência de novos envios sem depender desse saldo incerto. [Preços oficiais](https://developers.google.com/maps/billing-and-pricing/pricing), [franquia e reset mensal](https://developers.google.com/maps/billing-and-pricing/overview).

As quotas diárias observadas para Compute Routes e Compute Route Matrix estavam ilimitadas, com uso atual exibido zero; o limite por minuto observado era 3.000. Nenhuma quota foi alterada nessa coleta. O valor diário exibido não é consumo mensal. As evidências estão em `evidence/console-free-ceiling-20261018.sanitized.json` e `evidence/october-application-usage-20261018.sanitized.json`.

## Procedimento da publicação autorizada

1. Confirmar os SHAs de stage/main imediatamente antes da promoção. Isolar os 13 caminhos da revisão clínica felina da PR #391, mantendo-os iguais à produção `9137d39f`; o snapshot para restaurá-los posteriormente em stage é `cb93d4c6`. A autorização atual é para Maps. Não modificar registros reais ou sobrescrever dados de runtime com conteúdo de Git.
2. Validar o novo modo em stage com dados sintéticos e transportes Google simulados: cache válido/manual, miss/stale/heurística, primeira saída, acesso direto, jobs, concorrência, troca de modo, falha do banco e regressão do orçamento pago. Aguardar testes/gates terminais; a evidência de `paid_budget` anterior não substitui essa prova.
3. Promover pelo PR protegido com head `stage` e base `main`. Acompanhar migração aditiva, deploy terminal, preservação/restauração dos seis arquivos de runtime, health, smoke de domínios e API protegida. Confirmar que API e workers executam o snapshot aprovado após o reinício de deploy; conferir apenas o SHA no disco não atesta todos os processos vivos. Não enviar uma consulta ao Google para verificar o bloqueio. Uma requisição ao endpoint real da aplicação, com payload sintético, só deve ser usada depois da configuração zero comprovada e deve terminar na recusa anterior ao provedor.
4. Em **Configurações → Custos Google Maps**, selecionar **R$ 0 — somente cache** e salvar. O payload usa `operation_mode=cache_only`, `enabled=true`, limites de `calls=0` e `estimated_brl=0` em ação/dia/mês, além da revisão atual da configuração. `enabled=true` ativa o modo local, nunca a rede Google. Omitir preços USD, câmbio, multiplicador/validade de preço e campos de baseline; não inventar valores para satisfazer o formulário. O servidor preserva baseline/eventos anteriores, quando existirem.
5. Recarregar o painel, fazer GET administrativo em nova conexão e consultar o estado com engine/conexão independente para comprovar modo, `paid_calls_allowed=false` e limites; não reiniciar produção apenas para experimentar persistência. Confirmar, com transporte interceptado ou teste que falhe antes da rede, que APIs diretas e jobs não conseguem enviar Google. Uma leitura com cache permitido não deve pedir confirmação de custo: o preview é `required=false`, sem quote/grant pago e com teto zero. Sem rota confiável disponível, confirmar mensagem de bloqueio e ausência de alteração parcial de agendamento.
6. Avaliar quotas nativas zero como segunda barreira depois de instalar o guard e configurar `cache_only`: Compute Routes, Compute Route Matrix e Geocoding, conforme métricas editáveis aceitas pelo console. Conferir também o fallback **Distance Matrix legado**, que é API diferente de Compute Route Matrix. Qualquer mudança precisa de leitura posterior do valor efetivo, escopo/unidade e reset; até lá é somente planejada. Um formulário preparado/cancelado ou um alerta Billing não aplica corte de serviço. [Uso Routes](https://developers.google.com/maps/documentation/routes/usage-and-billing), [gestão de custos](https://developers.google.com/maps/billing-and-pricing/manage-costs).
7. Registrar configuração, quotas efetivas ou limitações, snapshot instalado e checks finais. Restaurar os 13 caminhos clínicos em stage a partir de `cb93d4c6` e validar a restauração sem promovê-los à produção.

## Uso diário e recuperação

- Novas rotas, refresh, consultas de coordenadas Google e fallback pago ficam bloqueados. Tarefas automáticas podem usar cache permitido, mas nenhuma política própria autoriza rede no modo R$ 0.
- Uma rota Google válida requer TTL configurado positivo e mantém seu timestamp original; a simples leitura não renova validade. TTL zero/negativo não significa cache eterno no modo R$ 0. O cache de primeira saída guardado na sessão sem timestamp/TTL é recusado, mesmo se rotulado como Google. Não inventar ajuste manual, distância ou duração para contornar falta de rota.
- A tela explica o impedimento no local da ação. As regras da agenda continuam valendo; uma pesquisa bloqueada não prova ausência de horário e não cria disponibilidade.
- Execuções iniciadas em `cache_only` continuam limitadas a zero mesmo diante de mudança concorrente para orçamento pago. Histórico não é apagado ao mudar modo ou recriar processo.
- Falha ao verificar o controle compartilhado suspende o envio. Manter a proteção e o modo R$ 0 em rollback; remover o guard com chave ativa reabre gasto e não faz parte desta autorização.
- Preservar ledger e autorizações nos backups. Restaurar um banco antigo exige conciliação antes de qualquer futura ativação paga.

## Eventual mudança futura para `paid_budget`

Não ativar este modo como parte da publicação atual. Ele exige nova decisão de gasto, limites de chamadas/BRL por ação/dia/mês, preços de todos os SKUs, câmbio superior, margem e validade, baseline explícito e confiável do dia/mês e política separada para automações. Os preços unitários não podem ser zerados para simular franquia. Sem esses dados, novos envios permanecem suspensos.

Cada ação humana com possibilidade de custo passa pelo popup “Cancelar” / “Confirmar esta ação”, com autorização finita e de uso único. Confirmar não aumenta os tetos globais. Franquia, faixas de volume, créditos e câmbio real da conta podem diminuir a fatura, mas não liberam saldo automaticamente no ledger conservador. As antigas opções numéricas de orçamento não foram aplicadas e foram substituídas nesta decisão por zero novos envios.

## Verificação reproduzível

- Backend: `python -m unittest discover -s backend/tests -p 'test_google_maps*.py' -v`; concorrência operacional utiliza PostgreSQL descartável com `MAPS_COST_TEST_POSTGRES_URL`. Acrescentar os testes específicos de `cache_only` e Agenda à evidência do novo ciclo.
- Frontend: `npx vitest run components/google-maps app/clinicas/geocode-explicit-action.test.tsx`, além de suíte, lint, tipos e build.
- `scripts/google_maps_stage_canary.py` inclui a prova nova de cache em API real com banco isolado, além do orçamento pago; separa `ledger_unavailable` de recusa por teto. Seus testes locais passaram, mas a execução do novo snapshot em stage continua pendente. O script é exclusivo de stage; não executá-lo em produção.
- Auditoria readonly: `backend/venv/bin/python scripts/google_maps_readonly_audit.py`; somente agregados, sem Google. Não usar telemetria antiga como saldo gratuito autorizado.
