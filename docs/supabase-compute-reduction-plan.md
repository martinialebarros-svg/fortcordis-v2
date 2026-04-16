# Plano de reducao de custo do Supabase

## Diagnostico

O comportamento atual da plataforma indica que a organizacao paga `Compute` por projeto ativo. Nas docs oficiais do Supabase:

- Billing FAQ: projetos ativos geram cobranca de compute por hora; projetos pausados nao geram custo.
  https://supabase.com/docs/guides/platform/billing-faq
- Invoice docs: o credito mensal de compute do plano Pro cobre um unico projeto no compute padrao `Nano` ou `Micro`; projetos adicionais entram como custo extra.
  https://supabase.com/docs/guides/platform/your-monthly-invoice

Ponto importante:

- Nao e possivel misturar projetos pagos e gratuitos dentro da mesma organizacao.
- E possivel transferir projetos para outra organizacao.

## Objetivo

Manter somente a producao no ambiente pago e retirar stage/dev/demo da conta que esta cobrando `Micro Compute`.

## Plano operacional

1. Abrir `Organization > Usage` no Supabase e confirmar quantos projetos ativos estao aparecendo em `Compute`.
2. Abrir `Organization > Billing` e anotar a organizacao paga atual.
3. Listar todos os projetos da organizacao e classificar:
   - `producao`
   - `stage`
   - `dev/teste`
   - `projetos esquecidos`
4. Manter somente a producao na organizacao paga.
5. Para cada projeto nao produtivo:
   - se ainda for necessario: transferir para uma nova organizacao `Free`
   - se nao for necessario: pausar ou remover
6. Revisar se existe algum recurso de preview/branching criando projetos extras temporarios.
7. Conferir o compute size do projeto de producao em `Project settings` e reduzir se estiver acima do necessario.
8. Depois do deploy das otimizacoes do app, acompanhar `Usage` por 24 a 48 horas.

## Mudancas aplicadas neste repositorio

1. A agenda deixou de recarregar `laudos`, `ordens-servico` e `clinicas` a cada evento realtime. Agora o refresh automatico recarrega apenas a lista principal de agendamentos.
2. O stream realtime da agenda agora pausa quando a aba fica em background e reconecta com backoff progressivo.
3. O polling dos jobs de XML e PDF ficou menos agressivo, reduzindo consultas repetidas ao backend.

## Checklist de execucao

- Confirmar qual projeto e a producao
- Transferir `stage` para organizacao `Free` ou pausar
- Transferir `dev/teste` para organizacao `Free` ou remover
- Revisar previews/branches ativos
- Fazer deploy desta branch
- Monitorar `Compute` e `Database` no painel do Supabase
