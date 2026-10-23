# Spec - PERF-09 Atendimento: bibliotecas secundarias sob demanda

## Contrato de carga inicial

`carregarBase` nao pode requisitar `/pacientes`, `/atendimentos/medicamentos/banco` ou `/atendimentos/frases-clinicas`. A carga inicial continua responsavel por clinicas, catalogo de exames e lista paginada de atendimentos.

## Pacientes

- A busca inicia somente com dois ou mais caracteres normalizados.
- A chamada usa `GET /pacientes?search=<termo>&limit=8`.
- Uma resposta anterior nao pode substituir o resultado do termo mais recente.
- Quando um paciente ja esta selecionado por Agenda ou URL, a carga individual do cadastro o mantem disponivel para exibicao local.

## Medicamentos

- Toda pagina usa `GET /atendimentos/medicamentos/banco?skip=<n>&limit=100`, com `search` quando houver termo.
- Prescricao e Bibliotecas disparam a primeira pagina somente quando abertas.
- A busca no item de receita, a busca rapida e a busca da Biblioteca aguardam 250 ms antes de consultar o servidor.
- A Biblioteca mostra quantos registros foram carregados e oferece proxima pagina enquanto houver total pendente.

## Frases clinicas

- `GET /atendimentos/frases-clinicas` aceita `skip >= 0` e retorna `total`, sem mudar os filtros ja existentes (`secao`, `search`, `include_inactive`, `limit`).
- O editor de consulta requisita apenas as secoes dos campos da etapa visivel, em paginas de no maximo 100 registros.
- Antes da resposta, cada campo continua usando suas frases padrao; a falha de uma biblioteca nao bloqueia o formulario clinico.
- A Biblioteca consulta paginas de 100 itens, permite nova busca e apresenta acao para carregar mais resultados.

## Compatibilidade e seguranca

Os endpoints continuam autenticados. Operacoes de escrita nao recebem retry automatico. A paginacao nao expõe dados alem dos ja autorizados e nao altera prescricao, anamnese, prontuario ou regras de finalizacao.

## Conexao da biblioteca de frases (2026-10-22)

- A verificacao da tabela de frases usa `inspect(db.connection())`: reutiliza a conexao da sessao da requisicao, inclusive quando a autenticacao ja ocupou um slot do pool.
- A leitura nao deve solicitar outra conexao para introspeccao, aumentar o pool, criar cache global de esquema ou alterar o ciclo de vida da sessao.
- Conteudo, ordenacao, filtros, paginacao e seed idempotente continuam com o contrato existente. Com o banco ja semeado, a consulta nao realiza DML nem confirma ou descarrega trabalho pendente de outra operacao da sessao.
- A prova de concorrencia ocupa os tres slots antes de liberar os handlers reais. Tres GETs devem concluir com tres checkouts no total e devolver todas as conexoes.
- O canario instalado de stage usa identidade sintetica, JSON temporario e schemas descartaveis exclusivos, sem fallback para `public`. Ele valida o handler e PostgreSQL reais sem acessar ou alterar registros operacionais; nao substitui uma prova de sessao real no navegador.
- Producao exige autorizacao separada depois da apresentacao do resultado de stage.
