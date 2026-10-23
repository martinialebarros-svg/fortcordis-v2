# Registro de entrega restrita a stage

Este documento descreve a otimização de egress de #448, que permanece somente em stage. A promoção Maps de 23/10 mantém estes artefatos SDD para preservar a estrutura documental, mas não inclui o código dessa otimização em produção. A restauração de stage recuperará o registro original.

# Especificação

## Leituras de configuração

- A consulta de habilitação dos lembretes seleciona somente a flag necessária.
- Os gates de habilitação, modo institucional e participação do bot selecionam
  somente sua respectiva coluna. Não selecionam `logomarca_dados` nem
  `assinatura_dados`, e não materializam a entidade inteira `Configuracao`.
- As leituras não utilizam cache entre requisições. Desligamento, modo e
  participação continuam sendo percebidos na próxima leitura.
- Ausência de configuração, valores inválidos, precedência dos modos e
  comportamento de falha permanecem compatíveis com o contrato anterior.
- Os caminhos que efetivamente geram ou servem imagens/documentos permanecem
  capazes de acessar os binários originais; os dados armazenados não mudam.

## Verificações de estrutura

- O status de migrações consulta a existência de `schema_migrations`, sem
  enumerar todas as tabelas. As versões aplicadas continuam sendo lidas a cada
  verificação; não há cache de prontidão ou de versões.
- As verificações da Mente consultam apenas as tabelas de seu contrato e usam
  a conexão da própria sessão, evitando outro checkout durante a operação.
- Schema ausente ou falha de consulta mantém o comportamento seguro anterior.
  Criação/remoção de tabelas e alteração das versões aplicadas devem ser
  percebidas em uma verificação subsequente.
- A cadência e o conteúdo dos trabalhos automáticos não são alterados. Esta
  mudança reduz dados de catálogo retornados e checkouts redundantes.

## Limites da publicação e da evidência

- Publicação somente em Stage; nenhuma promoção a `main` ou alteração de
  produção, plano, cobrança, credenciais ou regras de autorização.
- Não há migração de schema ou dados nesta entrega.
- Os testes não enviam WhatsApp, e-mail, push nem chamadas pagas de IA/Maps.
- O wrapper Stage mantém o smoke mutante de WhatsApp desligado por padrão.
  A opção explícita para executá-lo permanece disponível em outra operação
  autorizada. Health e os testes isolados de CI continuam obrigatórios.
- A evidência ao vivo usa agregados e contadores de consultas, sem conteúdo
  pessoal, binários, parâmetros, credenciais ou reset de estatísticas.
- Contadores cumulativos não equivalem ao tráfego de um ciclo. A publicação
  não promete desbloqueio da quota de tráfego já consumida.

Referência: [otimização de egress Supabase](https://supabase.com/docs/guides/platform/manage-your-usage/egress).
