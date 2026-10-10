# Verify — Edição após conclusão

Data: 2026-10-10. Status: validação local; sem publicação.

## Escopo de evidência

Checkout isolado a partir de `origin/stage` (`e33543b4`). A captura enviada pelo usuário mostra divergência visual de status; não comprova sozinha qual erro HTTP ocorreu naquela sessão. A reprodução com o código anterior mostrou que backup `Triagem/consulta_concluida=0` sobrescrevia `Concluido/1`; o PUT resultante era recusado com 409.

Todos os dados de testes são sintéticos. Nenhum atendimento real, documento real, banco remoto ou envio externo foi alterado.

## Evidências automatizadas

- Backend, módulo Atendimento: **218 testes passaram**, incluindo 13 casos HTTP novos e 3 cenários concorrentes em PostgreSQL 16 descartável local. Nenhum caso dessa execução foi ignorado.
- Backend, suíte `unittest discover -s backend/tests -p 'test_*.py'`: **1621 executados, OK, 7 ignorados** pelas condições preexistentes da suíte; execução final em 63,150 s. Uma primeira execução durante a atualização das fixtures falhou em cinco testes do módulo; as fixtures foram ajustadas para incluir a auditoria transacional e a suíte final passou.
- `test_atendimento_edicao_historico.py`: save de concluído conserva Agenda/OS e identidade; nova sessão lê antes/depois; receita emitida salva sem confirmação; documento emitido conserva emissão, rejeita versão obsoleta e produz PDF cujo texto extraído contém a correção; falha de auditoria reverte consulta/documento/receita; no-op não duplica evento; paginação, escopo, 401 e matriz 403/200.
- `test_atendimento_edicoes_concorrencia_postgres.py`: dois escritores com estado antigo no identity map produzem uma cadeia coerente de antes/depois em consulta, receita pelo PUT do atendimento e receita pelo endpoint próprio. Estado Concluido, Agenda Realizado e OS única/Pago/150 permanecem. Controle negativo sem `populate_existing` falhou na continuidade da cadeia, provando sensibilidade da regressão.
- Concorrência preexistente de documentos em PostgreSQL: update/update e update/archive continuam com um vencedor e um conflito, sem sobrescrita silenciosa. Cluster descartável encerrado após a validação.
- Frontend final: **578 testes Vitest em 80 arquivos + 9 testes Node passaram**. Lint completo, TypeScript e build Next.js aprovados. Após a limpeza imediata do backup ao desfazer digitação, lint do arquivo, TypeScript e build foram repetidos.
- Recuperação de backup: base salva por conteúdo, cópia limpa A não reverte correção B, pendência com base intacta recupera texto conservando conclusão, legado/conflito exige comparação explícita, undo remove apenas a cópia gravada por esta sessão e não apaga pendência de outra aba. Componente de comparação apresenta rótulos e valores legíveis, sem JSON. Criação contextual de template continua sincronizando o atendimento antes de renderizar variáveis; atualização de documento persistido permanece independente.
- Revisão independente final aprovada, sem achados bloqueantes.
- Gate SDD e `git diff --check` aprovados no fechamento.

## Integração contínua

Os quality gates de stage e produção passam a executar explicitamente os dois arquivos pytest novos junto à persistência de documentos. As provas PostgreSQL usam apenas serviço descartável local do runner. Não foi executado workflow remoto nem deploy.

## Limites

A revisão e os testes são locais, com HTTP real via TestClient, componentes React e concorrência de banco descartável. A sessão Safari fornecida e o prontuário real não foram editados. Não há prova de publicação ou smoke de produção nesta entrega. Histórico antigo permanece limitado aos eventos realmente gravados no passado. A edição do prontuário conserva a última escrita e registra suas diferenças; conflitos de versão continuam explicitamente protegidos para documentos, sem acrescentar versionamento otimista global de todo o atendimento.
