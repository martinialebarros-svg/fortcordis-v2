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
- Nenhuma integração de emissão ou envio foi adicionada. Produção permanece fora do escopo autorizado.
