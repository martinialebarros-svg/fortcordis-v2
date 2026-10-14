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
| 6 — publicação stage | Workflow e canário de fixtures sintéticas previstos abaixo | A validar após deploy |

## Verificação de stage planejada

O run de diagnóstico `38648573578` consultou somente metadata, sob transação READ ONLY: o schema legado exige `pacientes.especie` além de nome_key, e `servicos.nome` é único. O roteiro passou a fornecer espécie vazia, equivalente ao default legado, e um nome de serviço com nonce. O run `38648738057` executou o canário real instalado em stage no SHA `9ba195b82fc91012ef25254aeb9b44d5fa2ea185`, acrescentando somente esse default da fixture em memória, sem modificar o código/serviço no servidor. Os 11 checks passaram, incluindo API/ZIP, R$250, dados clínicos omitidos, retry/segunda via byte a byte, seleção integral, duplicidade/legado, checksum e ausência de NotaFiscal; fixtures_cleaned=true. Falta concluir a publicação padrão com o roteiro corrigido persistido e o smoke HTTP final.

O run padrão `38646763972` passou quality-gate e deploy; sua etapa fiscal falhou antes do commit por especie=None. O PostgreSQL local anterior reproduzia apenas as restrições conhecidas no ORM. O novo diagnóstico de stage confirma as restrições legadas para o teste isolado; nenhuma tabela real teve restrições alteradas.

O run `38643448200`, SHA `b83ad68e3ccb6010b7434f517d2f80cfcd08e3eb`, concluiu quality-gate, migração/deploy, health, canário autenticado e backup/restore drill. A identidade correta permitiu iniciar o canário fiscal; a criação da fixture falhou em `Paciente.nome_key` NOT NULL, antes do commit. O roteiro preenche agora nome_key de tutor/paciente e usa nonce menor, mantendo numero_os abaixo de VARCHAR(50), sem alterar o schema ou código fiscal da aplicação. A transação de fixture foi revertida e o bloco de limpeza executou. A nova execução validará o pacote completo.

O PR #356 corrigiu somente as fixtures. O run `38641214265`, SHA `ea35ede66724847f3410a1f475ff5c6c7a5b3dbd`, passou quality-gate (incluindo PostgreSQL fiscal em UTC), SDD, Migration CI e Frontend CI. O deploy padrão concluiu migração 97, health, canário autenticado, preservação/restauração dos seis arquivos de runtime e backup/restore drill. O passo adicional fiscal falhou antes de abrir sessão/fixtures porque usava `www-data`; o serviço real executa como `martiniano` e seu arquivo de configuração é modo 600. O workflow foi ajustado para obter `User` do systemd e executar o canário sob essa identidade, sem alterar permissões ou configurações.

O PR #355 foi integrado em stage no SHA `45b4d5f585a3ed00d268c2000429cd4f169d9d38`. Migration CI, Frontend CI e SDD passaram. O run de deploy `38639909167` interrompeu o quality-gate no teste PostgreSQL fiscal: duas fixtures com datetime sem fuso eram interpretadas segundo o fuso da sessão do banco (UTC no runner, Fortaleza no PostgreSQL local). A aplicação normaliza corretamente os timestamps com offset; o ajuste declara explicitamente o fuso das fixtures e força UTC no teste PostgreSQL. Os 57 testes fiscais passaram novamente, incluindo as corridas e grants, com `SHOW TIME ZONE = UTC`. A reprodução da fixture antiga confirmou que 01/09 00:00 UTC corresponde a 31/08 21:00 em Fortaleza. O deploy não chegou a executar nesse run. Uma nova publicação e o canário completo validarão o snapshot corrigido.

PR de feature com base stage. O merge com marcador `[fiscal-fechamento-canary]` executa o canário pelo workflow de stage, sob identidade de backend autorizada, restrito ao caminho `/var/www/fortcordis-stage` e APP_ENV=stage. Fixture própria inclui clínica inativa, OS apta de agosto, cancelada e OS de setembro. Testa API/ZIP, seleção integral, retry, segunda via, prevenção de novo pacote e bypass legado, checksum e ausência de NotaFiscal. Limpa somente registros sintéticos identificados por IDs e UUIDs, confirmando a ausência em nova conexão.

Depois do deploy: verificar todos os jobs finais, SHA instalado, rota /fiscal, chunks com marcador "Fechamento por competência" e API protegida sem autenticação. Registrar resultado de aliases separadamente.

## Limitações de escopo

- Datas históricas não foram corrigidas: usuário confere a data registrada na OS antes de preparar. OS sem data ou cadastro válido ficam como pendência.
- O pacote preserva o snapshot preparado; edição de pacote/substituição/retificação e confirmação de encaminhamento serão etapas posteriores. Segunda via não atualiza valores.
- Histórico legado representa geração de arquivo, sem inferir nota emitida. A aba avulsa permanece identificada como formato anterior, com defesas para canceladas, IDs repetidos e OS já vinculada ao novo pacote.
- Nenhuma integração de emissão ou envio foi adicionada. Produção permanece fora do escopo autorizado.
