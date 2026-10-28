# Spec — tutores-rotina-agil

Data: 2026-10-27
Responsavel: Martiniano + Codex
Status: implemented-local

## Rotina sem interrupcoes

- RF-001: cadastro de tutor aceita apenas primeiro nome; novo paciente aceita
  nome do pet e primeiro nome do tutor, ou ID de tutor escolhido explicitamente.
  Nome completo, CPF, contato, origem e confirmacao nao sao requisitos de agenda.
  Regras existentes de horario/localizacao domiciliar e autorizacao permanecem.
  A formalizacao publica da reserva tambem aceita apenas os dois nomes, com
  telefone opcional e sem presumir especie/sexo. Convite consumido nao recria dados.
- RF-002: contato/documento da Agenda ficam recolhidos para novos tutores;
  endereco domiciliar permanece visivel quando necessario. Nao consultar
  duplicidades nem apresentar confirmacoes/pop-ups adicionais ao agendar.
- RF-003: Novo paciente oferece busca opcional com ID, contatos, origem e animais.
  Selecionar pessoa existente envia somente seu ID e nao sobrescreve seus dados.
  Criar outra pessoa limpa somente dados/vinculo do tutor e preserva o pet.
- RF-004: cadastrar animal na Agenda envia o ID do tutor escolhido, nunca apenas
  o nome. Especie/sexo desconhecidos seguem vazios/null, sem afirmar Canina/Macho.
- RF-005: Atendimento exibe pendencia de identificacao na complementacao ja
  existente. Revisao e consultas auxiliares so carregam quando abertas; nao
  bloqueiam salvar/continuar atendimento. Dados do tutor nao salvos precisam ser
  salvos antes da revisao da identidade; essa condicao nao trava a consulta.
  Atualizar tutor preserva rascunhos de paciente e conteudo clinico.

## Identidade, fila e contatos

- RF-006: GET /tutores aceita filtro pendentes, origem e ordenacao por proximo
  atendimento ou antiguidade. Busca aceita #ID, CPF e contatos normalizados.
  Filtrar pendencias e ordenar nao altera cadastros nem confirma identidades.
- RF-007: confirmar identidade exige acao especifica, metodo, evidencia e token
  da versao revisada. Registrar usuario/data/dados no evento privado; versao
  desatualizada retorna 409. Booleano legado sozinho nao confirma identidade.
  Edicoes significativas de nome/CPF/contato invalidam confirmacao anterior.
- RF-008: duplicidades sao candidatas sob demanda, com sinais explicados; nome
  sozinho nao basta. Cadastro sem contato/CPF continua permitido. Decisao humana
  de pessoas distintas pode ser registrada; mudanca dos sinais invalida descarte.
  Telefone compartilhado nao causa uniao nem autorizacao automatica.
- RF-009: manter contatos e origens alternativos. Mesclagem preserva contatos
  originais antes de consolidar vinculos. Contato alternativo nao vira principal
  nem concede permissao de envio de mensagens/documentos.
  Mesclar reabre a identificacao para revisao explicita posterior, com aviso na
  previa; nao oferece escolher um estado de confirmacao que nao sera preservado.

## Repeticao segura e correcao

- RF-010: POST /tutores, POST /pacientes, mesclar e reverter aceitam chave_operacao
  por usuario e tipo. Mesma chave/payload devolve resultado anterior; payload
  diferente retorna 409. Reserva e resultado pertencem a mesma transacao da
  escrita; nao existe commit intermediario que crie duplicata parcial.
  UI preserva chave apos falha de rede, guarda apenas assinatura/chave na sessao
  e conclui a intencao ao receber sucesso ou iniciar outra pessoa explicitamente.
- RF-011: reversao exige admin, previa atual, motivo e confirmacao. Registro
  original de mesclagem e imutavel; correcao produz novo registro administrativo.
  Reativar o ID secundario e restaurar campos/vinculos transferidos somente se
  hash do estado integral coincidir com estado apos mesclagem; alteracoes,
  exclusoes, novos vinculos e cadeias posteriores bloqueiam a operacao.
- RF-012: mesclagens anteriores a esta versao nao possuem hash de reversibilidade
  e exigem revisao tecnica. Nao tentar inferir historico faltante. Reversao nao
  funde animais, altera valores/textos/documentos emitidos nem reativa acessos
  revogados; identidade fica pendente para conferencia posterior.
- RF-013: historico de identificacao segue apenas cadeia ativa de mesclagens;
  correcao equivocada nao mistura eventos de pessoas separadas. Historico
  administrativo de mesclagens conserva operacao original e sua reversao.
- RF-014: migracoes 103/104 sao idempotentes e preservam dados. Remover somente
  unicidade historica do secundario para permitir nova mesclagem apos correcao.
  Novas tabelas privadas tem RLS e grants anon/public/authenticated revogados.

## Aceitacao

- CA-001: primeiro nome + pet bastam, sem dados clinicos presumidos e sem sugestoes automaticas.
- CA-002: selecao por ID preserva tutor; nova pessoa preserva pet e limpa dados anteriores.
- CA-003: identidade confirmada tem autor/data/evidencia; bypass e versao antiga rejeitados.
- CA-004: fila/busca normalizada funcionam; duplicidades sao explicadas e voluntarias.
- CA-005: retries/requisicoes concorrentes nao duplicam tutor/pet/mesclagem/reversao.
- CA-006: contatos/origens permanecem acessiveis sem ampliar canais de envio.
- CA-007: reversao preserva registros; mudancas posteriores, permissao insuficiente e falhas abortam.
- CA-008: identificacao no Atendimento e opcional e preserva rascunhos.
- CA-009: migracoes SQLite/PostgreSQL idempotentes com isolamento das tabelas privadas.

## Limites

Nao ha mesclagem automatica ou em massa, verificacao externa paga, envio real,
correcao arbitraria de vinculos modificados apos mesclar, fusao de animais ou
mudanca de regras clinicas/financeiras. Dados reais e publicacao fora desta etapa.
