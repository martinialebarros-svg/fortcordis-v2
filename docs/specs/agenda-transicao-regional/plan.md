# Plan - agenda-transicao-regional

Data: 2026-10-22
Responsavel: Codex
Status: in-progress

## Sequência

1. Trabalhar em worktree isolada de `stage` e inspecionar regras, ofertas e
   salvamento. Preservar alterações de outras sessões.
2. Adicionar parâmetros normalizados de política e controles de configuração.
3. Implementar avaliador único da sequência diária, usar nas ofertas e na
   validação de escritas, preservando regras de base, jornada e desvio.
4. Implementar oportunidades por clínica com histórico realizado de 60 dias,
   classificação por acréscimo de rota em faixas de dez minutos e então por
   recorrência, usando exclusivamente rotas salvas.
5. Executar testes focados, sintaxe, frontend e guardrail SDD. Revisar o diff.
6. Publicar o snapshot validado somente em stage e habilitar a política ali.
7. Reproduzir a sexta com o código instalado em schema descartável, registrar
   prova de SHA, remoção do schema, zero Google e zero mudanças operacionais.
8. Corrigir o P1 do PR #418: resolver ausência como estimativa desconhecida,
   rejeitar por candidato e preservar slots conhecidos. Acrescentar regressões
   de matriz dirigida incompleta e baseline desconhecido; publicar a correção
   somente em stage e repetir o canário instalado sem alterar a configuração.

## Plano de testes

As verificações unitárias cobrem helper, normalização, limites, quota diária,
cancelamentos, remarcações e recorrência. As verificações de integração chamam
geração de slots, revalidação de oferta e validador de salvamento com as mesmas
fixtures. O canário `scripts/agenda_regional_stage_canary.py --expected-sha <sha>`
recusa execução fora de `/var/www/fortcordis-stage`, `APP_ENV=stage`, projeto
PostgreSQL exato de stage e SHA esperado.

O canário cria somente tabelas em schema novo descartável. O cenário contém
Zoomare 09h–09h30, Celeiro cancelado às 09h45, jornada 08h–16h30, rotas de
33/41/42/50/51/54 minutos e histórico agregado reproduzido sem dados pessoais.
Chamadas externas são bloqueadas por mocks que falham se acionados. O relógio do
replay é fixado em 22/10/2026 para a reprodução continuar auditável depois da data.
O replay inclui uma consulta HTTP com âncora legada atravessando a meia-noite e
exige lista vazia sem primeira saída ou rede. O modo de oportunidades somente com
cache impede avaliação da base também nos cenários normais.

As regressões do P1 incluem direção ausente no primeiro e no último candidato,
preservação de slots já aprovados, trecho fixo desconhecido com inserção curta
conhecida e recusa de nova transição longa sem evidência suficiente. Também
mantêm o contador de clínicas sem estimativa isolado de clínicas parcialmente
avaliáveis e recusam atribuir custo incremental a trecho direto desconhecido.

## Rollback

A política permanece desativada por padrão. Desativá-la em stage restaura o teto
normal sem migração. Reversão do código usa o snapshot anterior de stage. A
transação dos dados operacionais existentes não é usada pelo canário; seu schema
é removido em `finally` inclusive quando um teste falha.

## Dependências e conclusão

- O avaliador precisa receber toda a sequência diária, incluindo vizinhos fora
  da janela solicitada pelo cliente.
- A prioridade depende de histórico real de `Realizado`; datas de criação ou
  reservas canceladas não equivalem a recorrência realizada.
- O recorte de 60 dias completos é relativo a hoje, em horário local, e não à
  data futura consultada. A consulta retorna sugestões sem reservas; a UI requer
  um serviço e um clique e cancela respostas de contextos antigos.
- A validação de stage usa rotas do cenário reproduzidas como fixtures. Não
  constitui consulta atual de trânsito nem confirmação de demanda das clínicas.
- Somente após prova instalada os critérios de stage podem ser marcados `ok` em
  `verify.md`. Produção permanece fora do escopo autorizado.
