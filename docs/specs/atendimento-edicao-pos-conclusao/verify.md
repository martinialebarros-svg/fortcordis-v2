# Verify — Edição após conclusão

Data: 2026-10-10. Status: validado localmente e em homologação; publicação isolada documentada no PR de release.

## Escopo de evidência

Checkout isolado a partir de `origin/stage` (`e33543b4`). A captura enviada pelo usuário mostra divergência visual de status; não comprova sozinha qual erro HTTP ocorreu naquela sessão. A reprodução com o código anterior mostrou que backup `Triagem/consulta_concluida=0` sobrescrevia `Concluido/1`; o PUT resultante era recusado com 409.

Todos os dados de testes são sintéticos. A validação local não alterou atendimento real, documento real, banco remoto ou envio externo. O ensaio de homologação usa cadastros exclusivos de teste e limpeza por seus IDs.

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

Os quality gates de stage e produção passam a executar explicitamente os dois arquivos pytest novos junto à persistência de documentos. As provas PostgreSQL usam apenas serviço descartável local do runner. O PR #336 integrou a alteração em stage como `154356d4`; a publicação de produção usa uma branch isolada da base `main` para respeitar a autorização de publicar somente esta alteração.

## Limites

A revisão local cobre HTTP real via TestClient, componentes React e concorrência de banco descartável. O ensaio de homologação abaixo usa Chrome real e dados sintéticos. A sessão Safari fornecida e o prontuário real não foram editados. O smoke de produção será registrado no PR de release após o deploy terminal. Histórico antigo permanece limitado aos eventos realmente gravados no passado. A edição do prontuário conserva a última escrita e registra suas diferenças; conflitos de versão continuam explicitamente protegidos para documentos, sem acrescentar versionamento otimista global de todo o atendimento.

## Validação da versão isolada de produção

Base `origin/main`: `655bb82ec5395f797ad8a6e343e26b9a3fc623cb`. Cherry-pick da implementação: `c0a1dc7d`; sem alterações de código em Agenda, Financeiro ou ordens de serviço e sem as entregas #333/#334. A promoção conjunta #335 permanece fora do escopo autorizado.

- Backend completo: **1.586 executados, OK, 7 ignorados** pelas condições preexistentes, em 73,750 s.
- Módulo Atendimento: **216 testes passaram, zero ignorados**, incluindo HTTP e concorrência de consulta, receita e documento em PostgreSQL 16 descartável; cluster local encerrado após o teste.
- Frontend: **558 testes Vitest em 80 arquivos + 9 testes Node passaram**. Lint, TypeScript e build Next.js aprovados.
- Revisões independentes de backend e frontend sobre a base de produção aprovadas. Não foi necessário alterar o código depois do cherry-pick; apenas registrar a evidência de homologação.

| ID | Evidência | Status |
| --- | --- | --- |
| CA-01 | Recuperação de backup conserva conclusão e texto; testes de merge, draft-recovery e persistência HTTP | ok |
| CA-02 | Testes HTTP e PostgreSQL conservam Agenda/OS, identidade, conclusão e data do encontro | ok |
| CA-03 | Falhas de auditoria revertem consulta, receita e documento na mesma transação | ok |
| CA-04 | Receita/documento emitidos conservam emissão; histórico tem antes/depois e escopo autenticado | ok |
| CA-05 | Nova sessão lê histórico durável; no-op não duplica evento; paginação coberta no HTTP e React | ok |
| CA-06 | Falhas preservam texto; histórico permite tentar novamente e descarta resposta obsoleta | ok |
| CA-07 | Backup limpo não reverte correção nova; conflito/legado exige comparação, undo preserva outra aba | ok |

## Ensaio em homologação — 2026-10-10

Snapshot instalado: `154356d488891b07f0f6617d34ddec2833057e3e` (PR #336). [Deploy to Stage 38086194169](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38086194169) terminou com sucesso, incluindo quality-gate, SDD, migrações, health, worker, canary autenticado, preservação/restauração dos seis arquivos de runtime e restore drill SQLite. Frontend CI e Migration CI também concluíram com sucesso. O drill SQLite não representa um restore de PostgreSQL.

Ensaio Chrome real com fixture exclusiva `CODEX-CA004-20261010-a37c`, sem contatos e com zero destinatários de push no preflight. O banco de homologação foi confirmado distinto do de produção.

- Finalizar o atendimento #18 vinculado à Agenda #166 mostrou Concluido/Sincronizado imediatamente; receita em PDF válido de uma página, sem recarregar (`performance.timeOrigin` inalterado, uma navegação principal). Fecha também CA-004 de atendimento-status-apos-finalizar.
- Editar a queixa depois da conclusão persistiu conteúdo e auditoria antes/depois (evento #756).
- Criar documento #9 já no atendimento concluído, emitir PDF A, editar o documento emitido e salvar produziu auditoria #759; antes/depois foi conferido na interface.
- Gerar PDF B refletiu o corpo corrigido. Extração confirmou CORPO A somente no PDF A e CORPO B CORRIGIDO APOS EMISSAO no PDF B; ambos válidos, com uma página e marcador sintético.
- Recarregar preservou o texto clínico e o documento corrigido. Estado final: atendimento Concluido/consulta_concluida=1, Agenda Realizado e uma única OS #48, Pendente/R$1,00; emissão da receita preservada.
- As primeiras tentativas encontraram timeouts TCP antes de carregar a página. A continuação usou o mesmo domínio HTTPS e TLS por SOCKS sobre SSH, sem mock da aplicação. O harness também foi ajustado para cookies HttpOnly/CSRF e foco após troca de aba; nenhum ajuste de código da aplicação foi necessário.

A publicação usa somente o diff desta correção sobre `main`; as entregas de Agenda e recebimento em lote presentes em stage não integram a versão de produção. O resultado final e a limpeza da fixture são registrados junto à evidência do release.
