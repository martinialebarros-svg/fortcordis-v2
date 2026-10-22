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

A regra original foi publicada pelo PR #418. Em 22/10/2026, o usuário autorizou
corrigir o P1 de rotas ausentes, incluir testes e validar a correção em stage.
Após a homologação do PR #420 em `f93a455f`, autorizou publicar essa correção em
produção e validar Completar dia na sexta-feira com Zoomare, sem alterar
agendamentos. O pacote deve partir do main atual `4aa1364a` e conter somente os
oito caminhos do P1, preservando Maps, PDFs, autenticação, deploy e incrementos
clínicos de outras sessões. Criar reservas reais ou enviar mensagens continua
fora do escopo.

Uma estimativa dirigida ausente pode inviabilizar um horário, mas não deve
interromper a busca de toda a clínica nem apagar horários já validados. Trechos
desconhecidos que permanecem na rota não concedem uma nova exceção regional;
inserções normais com viagens conhecidas seguem as regras habituais.

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
- [x] Publicação do P1 em produção está autorizada; validação operacional é somente leitura.
- [x] Riscos de quota, margem, histórico e privacidade estão registrados.
- [x] Stage foi homologado; produção deve seguir o fluxo protegido com pacote isolado.
