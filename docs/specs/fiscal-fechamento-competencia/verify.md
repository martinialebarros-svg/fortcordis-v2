# Verificação

## Evidências locais

- Testes fiscais focados: 57 aprovados, incluindo seleção integral, canceladas, CPF/CNPJ alfanumérico, competência UTC/local, retry/segunda via, checksum, snapshot, documentos e autorização de API.
- PostgreSQL 16 local descartável: corridas com a mesma chave, chaves distintas, seleção sobreposta e mesma chave com payload diferente. Comprovado um único pacote/claim, conflito sem persistência parcial, RLS ativa, owner autorizado e roles anon/authenticated sem acesso após REVOKE (SQLSTATE 42501).
- Backend completo: 1.763 testes aprovados (10 ignorados por ambientes opcionais ausentes), com DATABASE_URL SQLite isolado e testes fiscais PostgreSQL habilitados.
- Frontend completo após atualizar a base stage: 695 testes Vitest e 23 testes Node aprovados; lint completo sem avisos; typecheck e build Next.js aprovados. Dez testes específicos cobrem mudanças de mês/resposta antiga, exclusões, conferência, retry, conflito e recuperação de histórico.
- PDF sintético regular (2 páginas) e textos longos (3 páginas) renderizados e inspecionados; sem sobreposição ou texto cortado. XLSX reconcilia resumo e detalhe e trata cadastros como texto, inclusive valores iniciados por '='.
- Revisão independente das camadas backend/API e canário. Canário rastreia todas as chaves, aguarda locks antes da limpeza em caso de timeout HTTP e confirma limpeza usando nova conexão.
- Canário completo executado localmente a partir da fonte real (somente guarda de caminho substituída em memória) com API TestClient e schema PostgreSQL isolado em UTC: nome_key NOT NULL, VARCHAR(50) e FKs. Dez chamadas reais da API e onze checks aprovados, incluindo ZIP, valores, privacidade, checksum, retry, segunda via, duplicidade e ausência de NF. Fixtures e schema removidos; fonte preservada. Essa evidência local não substitui o canário de stage.

## Matriz de aceite

| Critério | Evidência | Estado |
| --- | --- | --- |
| 1 — competência de prestação/fuso | Tests fiscais locais e PostgreSQL | Aprovado local |
| 2 — canceladas/IDs/seleção integral | API e serviço, sem pacote parcial | Aprovado local |
| 3 — concorrência/retry/exclusividade | Quatro corridas PostgreSQL e constraint de OS | Aprovado local |
| 4 — totais/privacidade/pacote | ZIP, manifesto, XLSX, texto e PDF | Aprovado local |
| 5 — legado/segunda via | Reconhecimento explícito e bytes imutáveis | Aprovado local |
| 6 — publicação stage | Workflow final, canário fiscal e smoke HTTP/bundles abaixo | Aprovado em stage |

## Publicação e verificação de stage

- Snapshot instalado: `f72bed798bff2b0593f588985010de80567a302d`. HEAD conferido por SSH e hash do roteiro instalado `2dd23d5bed7cbc82d138b497a94cc4dd1f1a44a79ea890b53d8260ea7911f089`, idêntico ao teste isolado com metadata real.
- [Deploy final 38649203651](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38649203651): todos os quatro jobs concluídos com success em 14/10/2026, 22:54 UTC. Migration CI `38649203337` e Frontend CI `38649203228` também concluídos com success para esse SHA.
- Canário fiscal às 22:53:57 UTC: onze checks true e fixtures_cleaned=true. API real confirmou competência/canceladas/clínica inativa, recusa de outro mês/IDs repetidos/seleção parcial, ZIP com R$250, privacidade, retry/segunda via com os mesmos bytes, duplicidade/legado bloqueados, checksum e ausência de NotaFiscal. Limpeza confirmada em nova conexão.
- Health backend e WhatsApp stage, smoke autenticado, observabilidade, seis arquivos de runtime preservados/restaurados e backup/restore drill passaram. Migração 97 já aplicada; nenhuma migração pendente no deploy final.
- Smoke HTTP após o sucesso terminal, às 22:56 UTC: `/fiscal` respondeu 200 nos domínios app.stage.fortcordis.com.br, stage.fortcordis.com.br e www.stage.fortcordis.com.br; TLS válido e zero redirects nos três. Todos os 15 chunks same-origin retornaram 200. Marcadores `Fechamento por competência`, `/fiscal/fechamentos/previa` e `/fiscal/fechamentos` presentes. Prévia sem autenticação respondeu 401.
- Interface autenticada conferida em stage: troca para agosto carregou três OS com pendência documental e seleção bloqueada. Nenhum cadastro existente foi corrigido ou usado para preparar pacote.
- Código fiscal da aplicação, frontend e migração 97 permanecem byte a byte idênticos ao snapshot local validado `9cd26ffb15d262a88c6640f61e3ce1e479d2b2c5`. As correções posteriores foram de fixtures, execução do canário e documentação.
- `main` permaneceu `73039abd94774a8e951c77fe6997bf049f54b4a2`; este trabalho não promoveu produção. Alterações anteriores no checkout principal foram preservadas.

## Compatibilidade do roteiro de teste

A metadata real de stage foi consultada em transação READ ONLY nos runs `38648573578` e `38648832136`, sem ler registros. O banco legado exige nome_key/espécie do paciente e nome único de serviço; o canário informa espécie vazia, usa nonce no nome e respeita VARCHAR(50). O processo executa sob o usuário efetivo do backend, com a configuração modo 600 preservada. Nenhuma restrição do banco foi relaxada.

O harness local final reproduziu as sete tabelas com tipos/fusos, defaults, NOT NULL, PKs, índices, unicidade, checks e FKs obtidos da metadata. A fonte real do roteiro passou nos onze checks da API com zero sobras em dez tabelas verificadas; schema descartável removido. A guarda de caminho foi substituída somente em memória no harness, e a fonte do repositório permaneceu intacta. O run independente `38648738057` também aprovou o fluxo real de stage com o default da fixture em memória antes da publicação padrão final.

Evidências sanitizadas locais: `/tmp/fc-fiscal-stage-success-run.log`, `/tmp/fc-fiscal-stage-success-canary.json`, `/tmp/fc-fiscal-stage-smoke.json`, `/tmp/fc-fiscal-stage-schema.json` e `/tmp/fc-fiscal-canary-local-check.py`. Os diagnósticos usaram uma branch temporária que não foi integrada; a branch remota foi removida após a coleta.

## Limitações de escopo

- Datas históricas não foram corrigidas: usuário confere a data registrada na OS antes de preparar. OS sem data ou cadastro válido ficam como pendência.
- O pacote preserva o snapshot preparado; edição de pacote/substituição/retificação e confirmação de encaminhamento serão etapas posteriores. Segunda via não atualiza valores.
- Histórico legado representa geração de arquivo, sem inferir nota emitida. A aba avulsa permanece identificada como formato anterior, com defesas para canceladas, IDs repetidos e OS já vinculada ao novo pacote.
- Nenhuma integração de emissão ou envio foi adicionada. A autorização posterior de produção está delimitada abaixo.

## Candidato isolado para produção — 14/10/2026

- Autorização do usuário: publicar este módulo em produção, sem levar dados fictícios de stage, sem emitir notas e sem enviar nada automaticamente ao contador.
- Base de produção: `73039abd94774a8e951c77fe6997bf049f54b4a2`. Stage conferido: `65d392785a6f9a8a1acb346088095872ca94cfd0`. O stage contém também as PRs clínicas #354, #357 e #362, cuja publicação não faz parte desta autorização.
- Candidato preparado sobre main somente com os sete commits fiscais e sua evidência de stage: 25 arquivos, código fiscal, frontend, migração 97, testes e canário idênticos aos de stage. As dependências necessárias já existem em main. Nenhum arquivo clínico, dump, seed do cenário de agosto ou artefato de pacote é incluído.
- Exceção de fluxo `hotfix`: PR isolado para main preserva o escopo solicitado e o stage compartilhado, sem promoção integral de alterações clínicas. Não usa `promocao-com-pendencia`, push direto em main ou dispensa de SDD/testes. Após a publicação, reintegrar a documentação de release em stage.
- Frontend do candidato: 673 testes Vitest e 23 Node aprovados, lint completo sem avisos, typecheck e build de 43 páginas aprovados. Guardrails SDD e critérios de promoção aprovados localmente.
- Backend do candidato isolado: 1.763 testes aprovados em 131,5 segundos e dez skips de ambientes opcionais. Testes fiscais com PostgreSQL local habilitados, incluindo concorrência, exclusividade, retry e RLS; banco descartável encerrado após a suíte.
- Baseline de produção, somente leitura: SHA instalado `73039abd94774a8e951c77fe6997bf049f54b4a2`; 1.219 OS, zero OS com prefixo `TESTE-AGO26-20261014-`, zero notas fiscais e tabelas novas de fechamento ainda ausentes. As duas bases de stage/produção são projetos distintos; o deploy não copia banco.
- Revisão do deploy: preserva/restaura os seis arquivos de runtime do próprio diretório de produção; migração 97 apenas cria tabelas/índices/proteções. O canário fiscal cria fixtures exclusivamente em stage e não é chamado no workflow de produção. O canário autenticado existente usa GETs. Dry-run da sincronização clínica já existente no workflow: `Nenhuma alteração necessária.`
- Baseline HTTP: cinco domínios de produção respondem 200 em `/fiscal`, TLS válido e sem redirects; todos os 15 chunks respondem 200. A API nova ainda retorna 404 e a API fiscal existente retorna 401. O smoke posterior exige os marcadores novos e 401 na API nova.
- Esta seção registra a preparação; não comprova implantação. A evidência terminal de produção será acrescentada depois do deploy. Nenhuma escrita de negócio, emissão de nota ou envio ao contador integra a verificação.

## Conferência de dados de produção durante a instalação

- PR #363 integrada em main como `67dc92012900e0785c2f6ddca3c2ae7988f9a23d`, com todos os seis checks de PR aprovados. O primeiro evento de Branch Flow Guard não recebeu a label já solicitada na criação; o evento posterior com a label e a nova avaliação após edição do corpo passaram. Nenhuma regra foi alterada ou check dispensado.
- Consulta em transação READ ONLY no projeto de produção: migração `20261014_97` aplicada uma vez; 1.219 OS preservadas; zero OS com o prefixo do cenário fictício de agosto; zero pacotes, zero vínculos de fechamento e zero notas fiscais.
- As duas tabelas novas têm RLS habilitada e `SELECT/INSERT/UPDATE/DELETE` sem concessão para `anon` e `authenticated`. O acesso da aplicação segue pelo proprietário/serviço autorizado.
- A consulta comprova a separação dos dados e a aplicação da migração, mas não substitui o sucesso terminal do deploy nem o smoke da interface.

## Produção publicada e conferida

- [PR #363](https://github.com/martinialebarros-svg/fortcordis-v2/pull/363) integrada como `67dc92012900e0785c2f6ddca3c2ae7988f9a23d`. SHA final confirmado no remote main e por SSH no checkout de produção. Publicação somente do fiscal; as três PRs clínicas permaneceram fora de main.
- [Deploy to VPS 38657491870](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38657491870): SUCCESS terminal em 15/10/2026 às 00:12:43 UTC (14/10, 21:12:43 em Fortaleza), com quality-gate, sdd-guardrail e deploy aprovados. [Migration CI 38657491838](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38657491838) e [Frontend CI 38657491879](https://github.com/martinialebarros-svg/fortcordis-v2/actions/runs/38657491879) também em SUCCESS para o mesmo SHA.
- Seis arquivos de runtime preservados às 00:06:24 e restaurados às 00:06:25; somente migração 97 aplicada com OK às 00:06:28. Health backend e WhatsApp, observabilidade, canário autenticado e backup/restore drill aprovados. Sincronização clínica final: `Nenhuma alteração necessária.` Nenhum seed ou canário fiscal executado em produção.
- Smoke final às 00:13:30 UTC: `/fiscal` retornou 200 nos cinco hosts app.fortcordis.com.br, fortcordis.com.br, www.fortcordis.com.br, fortcordis.com e www.fortcordis.com, todos com TLS válido e sem redirects. Todos os 15 chunks referenciados retornaram 200; três marcadores do novo fechamento presentes. GET da prévia de agosto sem autenticação retornou 401.
- Sessão autorizada existente de produção: aba mensal, competência de outubro e troca para agosto carregaram a prévia real e as pendências. Ambas as confirmações de datas/exportações anteriores permaneceram desmarcadas, preparação desabilitada e histórico sem pacotes. Nenhum botão de preparação, emissão ou envio acionado.
- Consulta READ ONLY após o deploy e a conferência visual confirmou novamente os mesmos totais de OS, zero fixtures de agosto, zero pacotes/vínculos/notas, uma aplicação da migração 97 e as proteções RLS/REVOKE das duas tabelas.
- Provas locais sanitizadas: `/tmp/fc-fiscal-production-deploy.log`, `/tmp/fc-fiscal-prod-final-smoke.json` e screenshot de produção na pasta local `fiscal-producao`. Nenhum artefato do cenário fictício foi incorporado ao release.
- Esta evidência confirma publicação, leitura autenticada e separação dos dados. A preparação de pacote real em produção não foi exercitada, para respeitar o escopo solicitado; geração, retry, duplicidade e conteúdo foram validados localmente e em stage.
