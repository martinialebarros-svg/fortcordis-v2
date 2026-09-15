# Spec — Contrato remoto de leitura de OS

Data: 2026-09-15
Status: backend e interfaces de Ordens e Cobranças implementados localmente.

## Contrato

`GET /ordens-servico` mantém dependências de autenticação, filtros, ordenação
`data_atendimento DESC, id DESC`, `skip`, `limit`, `total` e `items`.

- RF-1: `search` opcional consulta número da OS, paciente, tutor, serviço e nome
  da clínica antes de contar/paginar. Trim, case-insensitive conforme o banco;
  sem normalização de acentos nova. `%`, `_` e barra invertida são literais.
- RF-2: clínica ausente em OS domiciliar é pesquisável pelo rótulo visível
  `Atendimento domiciliar`; joins externos preservam registros sem cadastro relacionado.
- RF-3: `incluir_resumo=true` acrescenta `resumo` com `pendentes`, `pagas`,
  `canceladas`, `valor_pendente` e `valor_recebido`. Agrega toda a relação que
  corresponde a todos os filtros e busca, independentemente de `skip/limit`.
- RF-4: sem a opção, a resposta permanece exatamente `{total, items}`. Nenhum
  consumidor atual paga o custo do novo agregado sem solicitá-lo.
- RF-5: vazio retorna contagem e valores zero; página além do fim retorna itens
  vazios e mantém o resumo da relação filtrada.
- RF-6: soma de `valor_final` acontece no SQL; conversão numérica apenas na
  resposta, seguindo a convenção existente. Não recalcula preço, taxa ou baixa.

## Aceitação

1. Busca encontra OS fora das primeiras 500 e combina todos os filtros existentes.
2. Totais idênticos nas páginas e última página vazia; canceladas não integram
   valores pendentes/recebidos.
3. Campos ausentes e caracteres especiais não ampliam indevidamente a busca.
4. Duas consultas SELECT com resumo (agregado e lista), sem N+1 e sem escrita.
5. Contrato antigo e testes existentes de OS permanecem válidos.

## Limites e segurança

### Interface de Ordens

- Busca remota com debounce de 300 ms, 100 itens por página e total/resumo do servidor.
- Mudança de filtros/busca volta à página 1; falha não exibe linhas antigas nem
  vazio confirmado. Nova tentativa e cancelamento reaproveitam a carga por seção.
- Seleção por ID persiste entre páginas; snapshots selecionados são separados
  da página visível. Selecionar pendentes/recebidas adiciona a página atual.
- Mudança de filtros ou aba limpa a seleção com essa regra informada na tela.
- Antes de abrir/confirmar baixa em lote e de gerar/compartilhar recibo, releitura
  de todos os IDs (até cinco simultâneos). Status, valor e campos de destinatário
  divergentes bloqueiam a operação inteira, sem descarte silencioso de IDs.
- Snapshot incompleto, OS removida ou falha de releitura também bloqueiam. Uma
  nova tentativa exige revisar/limpar a seleção, não aceitar silenciosamente mudanças.
- Revalidação não é lock nem compare-and-swap: concorrência entre GET e mutação
  continua sendo responsabilidade dos endpoints existentes. Não foi acrescentada
  garantia transacional nem alterada a política de envio externo.
- Link `?os_id=` usa filtro remoto por ID, sem depender dos 100 primeiros resultados;
  botão permite voltar à listagem completa. API combina `os_id` com demais filtros.
- Backend e frontend precisam ser publicados juntos (ou backend primeiro). Ausência
  de total/resumo válido falha explicitamente em vez de apresentar zero incorreto.

### Agrupamentos de cobrança

`GET /ordens-servico/cobrancas` recebe os mesmos filtros e `search`, com
`skip >= 0` e `limit` de 1 a 100 (padrão 50). Retorna grupos, não OS individuais:
`{total, total_os, pendentes, total_pendente, items}`. Cada item traz `chave`,
`nome_destinatario`, `tipo_destinatario`, `quantidade_total`, `quantidade_os`
(pendentes) e `total_pendente`. Os totais externos são da relação completa filtrada,
independentes da página de destinatários. Canceladas são excluídas; grupos contendo
apenas pagas permanecem visíveis, como no frontend atual.

Chaves são `tutor:<id>` para domiciliar e `clinica:<id>` para parceiros. Sem ID,
usa-se `tutor-nome:<nome normalizado>` ou `clinica-nome:<nome normalizado>` com os
mesmos rótulos de ausência usados na tela. Tipos distintos nunca compartilham chave.
Ordenação: total pendente decrescente, chave crescente como desempate.

Na listagem de OS, `destinatario_chave` opcional restringe os detalhes ao grupo,
excluindo canceladas. O cliente deve repetir os mesmos filtros e busca ao abrir
os detalhes. A lista continua paginada, com resumo opt-in da relação completa.
O endpoint de grupos realiza duas consultas agregadas SQL, não materializa todas
as OS e não inclui contatos nem dados individuais no resultado de agrupamento.

Sem migration, mudança de autorização, regra financeira, endpoint de mutação ou
envio externo. Resumo não é total global: é o total dos filtros atuais.
Contagem e página são leituras separadas e podem refletir concorrência; não
prometem snapshot transacional. A autorização existente permanece, sem alegação
de que este incremento tenha auditado integralmente isolamento multiempresa.

Cobranças abre com 50 resumos por página, sem baixar OS individuais. Busca e
totais são remotos. Abrir destinatário busca suas OS em lotes de 100, repetindo
filtros e chave. Só expõe ações após verificar quantidade, IDs únicos, status,
destinatário e valor pendente contra o resumo. Erro, divergência ou cancelamento
não deixam detalhes parciais acionáveis. Troca de filtro/página fecha detalhes
e limpa seleção; respostas antigas não reabrem o grupo. Um grupo aberto por vez.
Leitura limitada a 10000 OS e 30 segundos; acima disso, solicitar filtros menores.
Esse limite evita leitura indefinida, mas não substitui medição de grupos grandes.
PDF aceita `search` literal e `destinatario_chave` com o mesmo escopo dos grupos;
parâmetros legados permanecem compatíveis. PDF global independe de abrir detalhes.
Política de WhatsApp não muda, testes não enviam mensagens. Observabilidade e
aceite autenticado permanecem pendentes. Leituras múltiplas não são snapshot
transacional; mudanças concorrentes que preservem contagens/somas não são detectadas
pela conferência agregada, e ações financeiras mantêm a revalidação individual.
Rollback: reverter primeiro a interface ou ambos os lados juntos; não remover
o contrato novo enquanto a interface paginada ainda depende dele.
