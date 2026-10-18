# Verificação — rotina do contador

## Base e limites

- Worktree fiscal próprio e limpo antes da implementação. Base stage conferida: `6ecf53afe74d01fb00217946d550917055540431`; main `c3a1d322a39c32227f42faea7b4b399b7c094fcb`. O checkout principal contém trabalho clínico alheio e permanece preservado.
- O máximo remoto de migrações era 97, revalidado antes da entrega. A migração nova é `20261014_98`, exclusivamente aditiva.
- Escopo inicial autorizado: stage, padrão semanal sexta no fim do dia e Vet Fauna por serviço, sem emitir notas nem enviar automaticamente. Horário de referência adotado: 18h de Fortaleza. Em 15/10/2026, o usuário autorizou a promoção desse fluxo para produção nos mesmos limites, sem transportar os dados fictícios.
- Pacotes anteriores são imutáveis. Agosto/setembro foram informados como já encaminhados pelo usuário; não inferir emissão de NF nem criar eventos históricos sem confirmação.

## Matriz

| ID | Critério | Evidência | Status |
| --- | --- | --- | --- |
| 1 | Corte, fuso, backlog e competência | 25 testes SQLite/API e 17 PostgreSQL/guards: sexta antes/no/depois de 18h, offsets, futuro e fronteira mensal | Local aprovado |
| 2 | Preferências e uma OS por serviço | Default por CNPJ, override/CAS, seleção individual e recusa de múltiplas OS | Local aprovado |
| 3 | Validação autoritativa e retry | Revalidação do modo/escopo/prova, hash legado sem contexto, retry após mudança de semana | Local aprovado |
| 4 | Andamento manual, CAS e imutabilidade | Concorrência em PostgreSQL real; UUID/CAS, histórico por OS, referência obrigatória, ZIP inalterado e OS operacional excluída | Local aprovado |
| 5 | Migração, RLS e ausência de efeitos externos | Migração repetida SQLite/PostgreSQL, constraints e revogações; migração 98 aplicada em stage e canário remoto com oito verificações | Local e canário de stage aprovados |
| 6 | Fluxo e recuperação frontend | 26 testes fiscais, lint, tipos e build; QA autenticada de stage nos limites descritos abaixo | Local e UI de stage aprovados |
| 7 | Publicação em stage | Workflows terminais, SHA instalado, smoke em três domínios e bundles, API protegida e canário transitório limpo | Stage publicado e verificado |

## Verificação local

- Suíte completa do backend: 1.822 testes, aprovação com dez skips de integrações opcionais fora deste escopo; os testes PostgreSQL fiscais foram executados com banco local real e não ficaram entre os skips.
- Suíte completa inicial do frontend: 95 arquivos, 851 testes Vitest e 23 testes Node aprovados. Após ajustes finais de paginação e tipos: 26 testes fiscais, lint fiscal, typecheck completo e build aprovados. O lint completo também passou nesta entrega.
- Revisão independente encontrou e reproduziu uma corrida entre duas requisições semanais com corte implícito atravessando sexta às 18h. O wrapper recupera o corte da UUID persistida e o núcleo confere todo o fingerprint; o teste concorrente agora retorna 200/200, mesmos bytes e um único pacote/claim. Os 25 testes SQLite e os 17 PostgreSQL/guards passaram após a correção. Corte explícito e payload divergente seguem protegidos.

## Canário antes da publicação

- Metadados de estrutura de dez tabelas de stage foram consultados em transação somente leitura, com allowlist do projeto stage e recusa explícita de produção. Nenhum registro de negócio foi lido nessa coleta. Diagnóstico temporário: workflow `38666684386`, concluído; branch remota temporária removida.
- O script novo foi executado intacto contra PostgreSQL local isolado e ASGI usando o schema refletido, inclusive `agendamentos.fim` obrigatório. Passou em oito verificações, com chamadas HTTP reais e zero fixtures restantes; isso ainda não comprova o deploy remoto.
- O teste verifica o ZIP, PDF, XLSX, texto e snapshot sem dados de outra clínica/paciente/tutor; confirma etapas manuais, retry, checksum e ausência de NotaFiscal ou alteração do pagamento. As fixtures são próprias e a limpeza usa outra conexão.

## Evidência terminal de stage

- [Deploy 38668059415](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38668059415), [Migration CI 38668059424](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38668059424) e [Frontend CI 38668059253](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38668059253) concluídos com sucesso no SHA `b1f95ca1c09664b8a03ce0d8ff9a9ff359faf7cc`. Migração 98 registrada, seis arquivos runtime preservados/restaurados, observabilidade, canário autenticado e backup/restore aprovados. O canário fiscal passou nas oito verificações e removeu suas próprias fixtures.
- Os três domínios de stage responderam `/fiscal` com HTTP 200 e TLS válido; os 15 chunks referenciados foram conferidos e contêm os cinco marcadores novos. A rota de prévia retornou 401 sem autenticação.
- QA autenticada confirmou outubro, semana padrão, corte de 16/10 às 18h de Fortaleza, seleção individual por serviço, indicador de pagamento dependente da NF, conferência mensal somente leitura e bloqueio de canceladas/serviços sem comprovação. A confirmação de datas habilita a preparação; desmarcá-la volta a bloquear. Recuperação, paginação e respostas atrasadas têm testes locais; transições manuais foram exercitadas pelo canário API, sem afirmar QA visual remota dessas ações.
- Entre `b1f95ca1` e `9d20e3e7c0287c628f6f45fd5af2d7393f117ec4` não houve alteração fiscal; o delta foi clínico e já foi reintegrado às duas branches.
- Em 15/10/2026, o [workflow 38736580167](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38736580167) preparou os pacotes fictícios 5 e 6 exclusivamente em stage: semanal com OS 66/67, R$ 400,00; por serviço com OS 68, R$ 300,00. Checksums HTTP válidos e segundas vias idênticas, etapa `preparado` sem eventos, duas páginas PDF e oito abas XLSX conferidas. OS 69/70 aparecem apenas nas informações de conferência, fora dos totais. Nenhuma rota de emissão, envio ou avanço de andamento foi chamada nessa demonstração.
- As demos OUT26 e os pacotes 5/6 permanecem deliberadamente no banco de stage para teste do usuário. Não confundir essa demonstração persistente com as fixtures transitórias removidas pelo canário. Os scripts temporários de criação/exportação não foram integrados à aplicação. A transferência dos arquivos foi cifrada e o artefato remoto temporário foi removido após a conferência local.
- O cadastro real da Vet Fauna estava ausente em stage; o fluxo foi testado por simulação e testes do CNPJ, sem alegar uma operação real dessa clínica. Campos fiscais do prestador vazios em stage foram fielmente exportados e informados ao usuário; não foram preenchidos automaticamente.

## Promoção autorizada para produção

O usuário autorizou a publicação em 15/10/2026 e a retomou em 16/10, mantendo sexta-feira às 18h e Vet Fauna por serviço, sem dados fictícios, emissão de notas ou envio automático. A migração 98 contém somente DDL, índices, constraints, RLS e revogações; não contém seed ou cópia de registros.

O PR documental #381 foi integrado a stage `43c81a7c` após quatro checks aprovados. A promoção padrão #383 foi convertida para draft quando stage avançou para `74784bce` com o incremento clínico #382, expressamente limitado a stage. Para preservar o escopo fiscal autorizado, a publicação foi recortada do snapshot `43c81a7c`, que contém main `43269428` como ancestral e difere dele em somente 22 arquivos fiscais. A PR isolada usa o escape explícito `hotfix` com todos os gates, sem `promocao-com-pendencia`. Não há reset de stage, cópia de banco ou publicação do incremento clínico; a ancestralidade e os documentos serão reintegrados preservando o stage atual.

A preferência efetiva da Vet Fauna será conferida no cadastro existente de produção. Se necessário, uma preferência explícita `por_servico` com pagamento dependente de NF poderá ser salva na clínica identificada de forma única, com CAS e auditoria. Essa configuração não preenche CNPJ/endereço, não prepara pacote real, não avança andamentos e não cria nota fiscal.

Os resultados da instalação, migração e verificações finais de produção serão registrados após o deploy. A autorização não substitui essa evidência.


## Revisão local — domingo às 17h (18/10/2026)

- Escopo: novo padrão semanal domingo às 17h de Fortaleza, sem emissão, cron ou envio; Vet Fauna por serviço preservada.
- Backend: padrão, sugestão, validação explícita, prazo por OS e metadados calculados em America/Fortaleza. Corte inclusivo e regras de competência/realização/exclusividade preservados.
- Interface: rótulos e preferências atualizados; “Corte deste pacote” usa a prévia; requisição envia seu corte confirmado e resposta de outro corte é bloqueada.
- Regressões: sábado, domingo às 17h, um segundo após o corte, offsets UTC, próximo domingo e fronteira mensal; snapshot/ZIP/Excel/PDF/texto com corte único; retry histórico de sexta preserva bytes, checksum e contexto, sem permitir novos pacotes nesse padrão.
- O pacote real #1 e os dados de produção permanecem intocados. Não há migração ou reparo do histórico nesta revisão.
- Validação local: 91 testes de backend aprovados (SQLite, PostgreSQL 16 descartável e guards), incluindo 50 subcasos. O PostgreSQL foi criado exclusivamente em 127.0.0.1:55439 com banco fiscal_test UTF-8 e schemas sintéticos, sem conexão com stage/produção. O ambiente foi encerrado após a execução.
- Frontend: 22 testes fiscais aprovados; TypeScript sem erros, ESLint dos arquivos alterados sem avisos e build Next.js concluído. Guardrail SDD dos arquivos alterados e git diff --check aprovados. Avisos existentes de depreciação Pydantic/SQLAlchemy e base Browserslist antiga não impediram os checks.
- Os testes de pacote real sintético conferem a mesma referência no snapshot, manifesto, XLSX, PDF e texto; o teste de retry histórico compara bytes/checksum/fingerprint originais. A divergência observada no pacote #1 motivou a exibição e verificação do corte efetivo, sem afirmar diagnóstico reproduzido da interação anterior do navegador.
- Publicação, canário remoto e QA autenticada desse novo padrão ainda não executados. Nenhum commit, push ou alteração do histórico real nesta etapa.

## Publicação autorizada — 18/10/2026

- Pedido explícito: publicar domingo às 17h e preparar a documentação para envio manual em 19/10. Limites: sem emissão, envio automático ou repetição das OS já preparadas.
- A evidência de PRs, checks terminais, SHA instalado, preservação/restauração, smoke HTTP/bundles e preparação real será acrescentada após a execução.
