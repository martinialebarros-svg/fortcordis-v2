# Intent - agenda-transicao-regional

Data: 2026-10-22
Responsavel: Codex
Status: approved

## Problema e objetivo

Um compromisso isolado em região distante pode bloquear as ofertas para outras
clínicas pelo teto habitual de 30 minutos, mesmo com tempo livre suficiente no
restante do expediente. O caso de referência é sexta-feira, 23/10/2026: Zoomare
das 09h às 09h30; Celeiro às 09h45 está cancelado; encerramento às 16h30.

Permitir completar o dia com uma única transição entre atendimentos de até 50
minutos, exigindo mais 15 minutos de margem total nesse trecho. Entre alternativas
de rota semelhantes, priorizar clínicas com mais dias distintos de atendimentos
realizados nos últimos 60 dias completos.

## Autorização e limites

O usuário autorizou implementar a regra e validar em stage, sem alterar produção.
O pedido não autoriza criar reservas reais, mudar compromissos existentes, enviar
mensagens nem promover a implementação para `main`.

A base continua com sua validação própria de primeira saída e não consome a
transição entre atendimentos. A exceção regional não reduz a duração dos exames,
não ultrapassa o expediente e não libera dois trechos longos no mesmo dia.

## Impacto e riscos

Agenda, assistente de ofertas e configuração de rotas devem usar os mesmos
parâmetros. A validação do salvamento deve recalcular a sequência do dia para
impedir ofertas que consumiriam uma segunda transição. Cancelamentos, reservas
expiradas e exclusão do próprio registro em remarcações precisam ser tratados.

O histórico prioriza destinos e não prova demanda futura. Tempos salvos usados na
reprodução não representam atualização de trânsito. O canário deve usar somente
clínicas/horários/rotas e histórico agregado reproduzido em fixtures descartáveis,
sem copiar pacientes, tutores, telefones ou observações.

## Definition of Ready

- [x] Problema, objetivo e parâmetros autorizados são explícitos.
- [x] Produção e alterações operacionais reais estão fora do escopo.
- [x] Riscos de quota, margem, histórico e privacidade estão registrados.
- [x] Stage é o único destino de publicação autorizado nesta entrega.
