# Verificação — rotina do contador

## Base e limites

- Worktree fiscal próprio e limpo antes da implementação. Base stage conferida: `6ecf53afe74d01fb00217946d550917055540431`; main `c3a1d322a39c32227f42faea7b4b399b7c094fcb`. O checkout principal contém trabalho clínico alheio e permanece preservado.
- O máximo remoto de migrações era 97, revalidado antes da entrega. A migração nova é `20261014_98`, exclusivamente aditiva.
- Escopo autorizado: somente stage, padrão semanal sexta no fim do dia e Vet Fauna por serviço, sem emitir notas nem enviar automaticamente. Horário de referência adotado: 18h de Fortaleza.
- Pacotes anteriores são imutáveis. Agosto/setembro foram informados como já encaminhados pelo usuário; não inferir emissão de NF nem criar eventos históricos sem confirmação.

## Matriz

| ID | Critério | Evidência | Status |
| --- | --- | --- | --- |
| 1 | Corte, fuso, backlog e competência | 25 testes SQLite/API e 17 PostgreSQL/guards: sexta antes/no/depois de 18h, offsets, futuro e fronteira mensal | Local aprovado |
| 2 | Preferências e uma OS por serviço | Default por CNPJ, override/CAS, seleção individual e recusa de múltiplas OS | Local aprovado |
| 3 | Validação autoritativa e retry | Revalidação do modo/escopo/prova, hash legado sem contexto, retry após mudança de semana | Local aprovado |
| 4 | Andamento manual, CAS e imutabilidade | Concorrência em PostgreSQL real; UUID/CAS, histórico por OS, referência obrigatória, ZIP inalterado e OS operacional excluída | Local aprovado |
| 5 | Migração, RLS e ausência de efeitos externos | Migração repetida SQLite/PostgreSQL, constraints e revogações; replay local do canário com schema real de stage | Local aprovado; canário remoto pendente |
| 6 | Fluxo e recuperação frontend | 26 testes fiscais, lint completo/fiscal, typecheck completo e build aprovados; paginação além de 20 pacotes com proteção contra respostas antigas | Local aprovado; QA remota pendente |
| 7 | Publicação somente stage | Workflows, SSH e smoke final | Pendente |

## Verificação local

- Suíte completa do backend: 1.822 testes, aprovação com dez skips de integrações opcionais fora deste escopo; os testes PostgreSQL fiscais foram executados com banco local real e não ficaram entre os skips.
- Suíte completa inicial do frontend: 95 arquivos, 851 testes Vitest e 23 testes Node aprovados. Após ajustes finais de paginação e tipos: 26 testes fiscais, lint fiscal, typecheck completo e build aprovados. O lint completo também passou nesta entrega.
- Revisão independente encontrou e reproduziu uma corrida entre duas requisições semanais com corte implícito atravessando sexta às 18h. O wrapper recupera o corte da UUID persistida e o núcleo confere todo o fingerprint; o teste concorrente agora retorna 200/200, mesmos bytes e um único pacote/claim. Os 25 testes SQLite e os 17 PostgreSQL/guards passaram após a correção. Corte explícito e payload divergente seguem protegidos.

## Canário antes da publicação

- Metadados de estrutura de dez tabelas de stage foram consultados em transação somente leitura, com allowlist do projeto stage e recusa explícita de produção. Nenhum registro de negócio foi lido nessa coleta. Diagnóstico temporário: workflow `38666684386`, concluído; branch remota temporária removida.
- O script novo foi executado intacto contra PostgreSQL local isolado e ASGI usando o schema refletido, inclusive `agendamentos.fim` obrigatório. Passou em oito verificações, com chamadas HTTP reais e zero fixtures restantes; isso ainda não comprova o deploy remoto.
- O teste verifica o ZIP, PDF, XLSX, texto e snapshot sem dados de outra clínica/paciente/tutor; confirma etapas manuais, retry, checksum e ausência de NotaFiscal ou alteração do pagamento. As fixtures são próprias e a limpeza usa outra conexão.

A evidência terminal da publicação será adicionada após os workflows e a QA autenticada. A existência dos arquivos ou de uma execução iniciada não comprova publicação.
