# Spec - financeiro-pendencias-cobranca-pdf

Data: 2026-06-12
Responsavel: Martiniano + Codex
Status: done (hotfix de 2026-06-12); ajuste de tabela de 2026-10-06 validado localmente, sem publicacao

## 1) Escopo funcional

Corrigir a geracao do PDF de cobranca de pendencias no modulo Financeiro, acessado pelo botao `Baixar PDF` dos grupos de clinica com OS pendentes.

## 2) Requisitos funcionais (RF)

- RF-001: usuario deve conseguir baixar o PDF de pendencias de pagamento quando houver OS pendentes nos filtros selecionados.
- RF-002: usuario deve conseguir baixar o PDF de um grupo de clinica especifico usando a mensagem de cobranca preenchida para aquela clinica.
- RF-003: quando a API retornar erro, a tela deve exibir a mensagem operacional enviada em `detail` mesmo em respostas de download com `responseType: "blob"`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: a correcao deve manter o layout atual do PDF sem introduzir novas dependencias.
- NFR-002: o fluxo de recibos de OS recebidas deve manter o comportamento atual ao reaproveitar a leitura de erro de download.

## 4) Contratos tecnicos

### API

- `GET /ordens-servico/relatorios/pendencias/pdf`
  - filtros existentes: `status`, `clinica_id`, `clinica_nome`, `servico_id`, `tipo_horario`, `data_inicio`, `data_fim`, `busca`, `mensagem`
  - resposta de sucesso: `application/pdf`
  - resposta sem itens: `404` com `detail` explicativo

### Frontend

- Tela afetada:
  - `frontend/app/financeiro/page.tsx`
- Comportamento:
  - `Baixar PDF` geral e por clinica chama o endpoint de pendencias.
  - erros em `blob` sao lidos como texto/JSON antes de exibir o alerta.

## 5) Criterios de aceitacao (CA)

- CA-001: PDF de pendencias deixa de falhar por referencia a variavel inexistente no backend.
- CA-002: arquivo gerado continua iniciando com assinatura `%PDF`.
- CA-003: alerta de erro usa `detail` quando o backend retorna JSON encapsulado como `blob`.

## 6) Fora de escopo

- alterar layout visual do relatorio;
- alterar regras de filtro das OS pendentes;
- envio automatico do PDF por WhatsApp.

## 7) Ajuste da tabela de pendencias (2026-10-06)

O hotfix acima restaurou a geracao do arquivo, mas o texto das celulas da tabela pode ultrapassar os limites das colunas no PDF. Este ciclo corrige pontualmente a apresentacao da tabela. A restricao de nao alterar o layout visual na secao 6 se refere apenas ao hotfix de 2026-06-12.

### Requisitos

- RF-004: os textos de OS, paciente, tutor e servico devem permanecer legiveis dentro das respectivas celulas, com quebra de linha quando necessario, sem sobreposicao entre colunas ou corte de conteudo.
- RF-005: o valor monetario deve permanecer completo e associado a sua linha, com alinhamento a direita; cabecalho, subtotal por destinatario e total geral devem continuar legiveis.
- NFR-003: a tabela deve caber na area util da pagina A4, respeitando margens e rodape, inclusive quando ocupar mais de uma pagina.
- NFR-004: dados inseridos nas celulas devem ser tratados como texto, inclusive caracteres especiais, sem interpretar marcacao fornecida pelos registros.

### Criterios de aceitacao

- CA-004: uma amostra com nomes, servicos e numero de OS longos produz celulas com altura adequada e texto contido nos limites da tabela, sem colisao visual.
- CA-005: todas as bordas da tabela ficam dentro da area util da pagina; em relatorios com varias paginas, o cabecalho da tabela se repete e nenhuma linha invade o rodape.
- CA-006: a correcao preserva os dados, a ordem das OS, os subtotais e o total geral, sem alterar filtros, regras de cobranca ou o contrato de download `application/pdf`.
