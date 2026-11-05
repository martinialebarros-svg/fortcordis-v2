# Especificação — Gestão administrativa

## Requisitos

- RF-001: seis indicadores em `/gestao`, exclusivos para usuários com papel admin; a API também verifica o papel.
- RF-002: filtros inclusivos de data (até 366 dias), clínica e região operacional (fallback cidade; ausente “Não informada”). A comparação usa a janela imediatamente anterior com a mesma quantidade de dias. Datas civis respeitam America/Fortaleza.
- RF-003: contribuição usa competência das OS não canceladas por data de atendimento, deduz tributos, taxas, repasses e custos variáveis. Divide por horas totais declaradas de atendimento, laudos e deslocamento. Não é lucro após custos fixos ou remuneração do proprietário. Custos/horas desconhecidos permanecem nulos; zeros exigem declaração explícita. Custos e tempo de rota são totais do recorte, incluídos uma vez, e não somas repetidas por OS.
- RF-004: ocupação utiliza jornada semanal, feriados, exceções e bloqueios ativos da Agenda; une intervalos sobrepostos. Duração de um atendimento realizado é o intervalo reservado, não duração cronometrada. Capacidade é da agenda única; filtros por clínica/região não multiplicam capacidade. Disponibilidade global considera todos os agendamentos que ocupam agenda, mesmo com filtro.
- RF-005: cancelamentos têm população única por agendamento e data marcada; estado atual Cancelado é separado de Expirado, Faltou e demais estados. Reativações/reagendamentos identificáveis pela auditoria não acrescentam linhas à população; não há reconstrução artificial de coortes históricas. Motivos livres não são expostos como dados estruturados.
- RF-006: prazo efetivo usa prestação até pagamento ativo, ponderado pelo valor parcial recebido; crédito e espelhos de transação não são dinheiro adicional. Cancelamento/estorno de transação retira seu pagamento ativo. OS legadas pagas sem comprovante não recebem data fictícia. Saldo aberto/vencido é situação atual, independente do prazo efetivo; vencimento só quando a fonte existe.
- RF-007: concentração usa receita de competência das OS, identifica clínicas inativas/ausentes e receita sem vínculo; Top 1/3/5 só quando houver clínicas suficientes; não qualifica risco sem meta/critério.
- RF-008: caixa = saldo inicial informado + entradas − saídas; semana e mês. Movimentos confirmados, previstos e manuais ficam distinguíveis. Saldo desconhecido permanece nulo. Despesas incompletas mantêm projeção parcial; recorrências mensais são premissas explícitas. Não é reconciliação bancária.
- RF-009: premissas são contextualizadas por datas/clínica/região. Simular não persiste; Salvar grava somente tabela própria e auditoria. Totais/horas/saldo não se transferem para a comparação anterior nem outro recorte. Revisão otimista evita sobrescrita silenciosa por administradores concorrentes.
- RF-010: fórmulas, fontes, atualização, limitações e detalhes sem identificação clínica. Carregamento, vazio, parcial, falha recuperável e resposta obsoleta tratados.

## Contrato e fontes

POST `/api/v1/gestao/painel` recebe `data_inicio`, `data_fim`, `clinica_id`, `regiao`, `premissas`; retorna `periodo`, `atual`, `anterior`, `filtros`, `comparacao`, `premissas_aplicadas`, `atualizado_em`. Não escreve nas tabelas consultadas. GET `/premissas` lê a versão salva; PUT `/premissas` exige `expected_revision`, `contexto`, `values` e grava de forma auditada e atômica.

Fontes: `ordens_servico`, `ordens_servico_pagamentos`, `transacoes`, `creditos_financeiros`, `contas_receber`, `contas_pagar`, `clinicas`, `agendamentos`, `configuracoes`, `agenda_bloqueios`, `auditoria_eventos`. Texto clínico livre, nome de paciente e tutor não compõem o painel.

Custos de frota existentes misturam custos fixos/variáveis e regras de rateio: não entram automaticamente na contribuição sem classificação confiável. A premissa de custo variável exige o total aplicável ao recorte. OS não têm vencimento próprio; a cobertura de vencimentos é indicada, sem converter pendente em vencido por idade.

NFR-001: leitura sem chamadas externas de rota/Maps, mensagens, fiscal ou alterações históricas. NFR-002: permissões no servidor e tabela de premissas bloqueada à Data API pública. NFR-003: erros não devolvem detalhes SQL/segredos. NFR-004: execução local usa somente SQLite/dados sintéticos.

## Reconciliação e limites de leitura

- Pagamentos ativos exigem transação de entrada recebida/paga. A mesma combinação OS/transação é contada uma vez; alocação bruta/líquida acima da transação de origem é sinalizada e excluída até conferência. Crédito quitado não é entrada de dinheiro.
- No caixa, a ordem de precedência é composição de pagamento da OS, conta vinculada, transação avulsa. Marcadores exatos das transações geradas por contas evitam somar espelhos; sem vínculo suficiente, a fonte é sinalizada como incerta. Transação cancelada prevalece sobre conta ainda marcada paga.
- Parcial recebido com várias contas pendentes e sem vínculo pagamento/parcela não recebe rateio inventado: saldo conhecido permanece sem distribuição de vencimento. O cartão de vencidos refere-se às OS prestadas no recorte; contas avulsas entram no caixa.
- Valores ausentes/negativos não se tornam receita zero completa. Taxas ou líquidos ausentes ficam parciais. Duração atravessando dias é repartida por interseção diária; a população de cancelamentos permanece definida pelo início, sem duplicação.
- A tabela de premissas mantém um único cenário-base compartilhado, substituído apenas por ação explícita. O contexto salvo é preservado e mostrado; não há salvamento automático.
- Cada cálculo financeiro faz sete leituras com colunas mínimas e reconcilia a carteira atual em memória (14 leituras ao comparar). Sem N+1. Não houve ensaio de carga com a base real. Detalhes financeiros exibem até 250 registros, com aviso e contagem total; o administrador deve reduzir o recorte para inspecionar os demais. Totais não são truncados. A UI pagina as tabelas em blocos menores.
- Capacidade histórica usa configuração vigente, sem prometer reconstrução histórica ou vaga logisticamente viável. Motivos de cancelamento e mudanças exclusivamente em campos legados de data/hora não são inferidos. Não há coleta de tempos reais de execução neste escopo.

RF-011: o quality-gate de stage executa explicitamente os testes de Gestão backend (incluindo funções pytest de API) e interface/navegação antes da instalação. O workflow de produção não é alterado.
