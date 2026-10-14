# Verificação

## Evidências locais

- Testes fiscais focados: 57 aprovados, incluindo seleção integral, canceladas, CPF/CNPJ alfanumérico, competência UTC/local, retry/segunda via, checksum, snapshot, documentos e autorização de API.
- PostgreSQL 16 local descartável: corridas com a mesma chave, chaves distintas, seleção sobreposta e mesma chave com payload diferente. Comprovado um único pacote/claim, conflito sem persistência parcial, RLS ativa, owner autorizado e roles anon/authenticated sem acesso após REVOKE (SQLSTATE 42501).
- Backend completo: 1.763 testes aprovados (10 ignorados por ambientes opcionais ausentes), com DATABASE_URL SQLite isolado e testes fiscais PostgreSQL habilitados.
- Frontend completo após atualizar a base stage: 695 testes Vitest e 23 testes Node aprovados; lint completo sem avisos; typecheck e build Next.js aprovados. Dez testes específicos cobrem mudanças de mês/resposta antiga, exclusões, conferência, retry, conflito e recuperação de histórico.
- PDF sintético regular (2 páginas) e textos longos (3 páginas) renderizados e inspecionados; sem sobreposição ou texto cortado. XLSX reconcilia resumo e detalhe e trata cadastros como texto, inclusive valores iniciados por '='.
- Revisão independente das camadas backend/API e canário. Canário rastreia todas as chaves, aguarda locks antes da limpeza em caso de timeout HTTP e confirma limpeza usando nova conexão.

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

O PR #356 corrigiu somente as fixtures. O run `38641214265`, SHA `ea35ede66724847f3410a1f475ff5c6c7a5b3dbd`, passou quality-gate (incluindo PostgreSQL fiscal em UTC), SDD, Migration CI e Frontend CI. O deploy padrão concluiu migração 97, health, canário autenticado, preservação/restauração dos seis arquivos de runtime e backup/restore drill. O passo adicional fiscal falhou antes de abrir sessão/fixtures porque usava `www-data`; o serviço real executa como `martiniano` e seu arquivo de configuração é modo 600. O workflow foi ajustado para obter `User` do systemd e executar o canário sob essa identidade, sem alterar permissões ou configurações.

O PR #355 foi integrado em stage no SHA `45b4d5f585a3ed00d268c2000429cd4f169d9d38`. Migration CI, Frontend CI e SDD passaram. O run de deploy `38639909167` interrompeu o quality-gate no teste PostgreSQL fiscal: duas fixtures com datetime sem fuso eram interpretadas segundo o fuso da sessão do banco (UTC no runner, Fortaleza no PostgreSQL local). A aplicação normaliza corretamente os timestamps com offset; o ajuste declara explicitamente o fuso das fixtures e força UTC no teste PostgreSQL. Os 57 testes fiscais passaram novamente, incluindo as corridas e grants, com `SHOW TIME ZONE = UTC`. A reprodução da fixture antiga confirmou que 01/09 00:00 UTC corresponde a 31/08 21:00 em Fortaleza. O deploy não chegou a executar nesse run. Uma nova publicação e o canário completo validarão o snapshot corrigido.

PR de feature com base stage. O merge com marcador `[fiscal-fechamento-canary]` executa o canário pelo workflow de stage, sob identidade de backend autorizada, restrito ao caminho `/var/www/fortcordis-stage` e APP_ENV=stage. Fixture própria inclui clínica inativa, OS apta de agosto, cancelada e OS de setembro. Testa API/ZIP, seleção integral, retry, segunda via, prevenção de novo pacote e bypass legado, checksum e ausência de NotaFiscal. Limpa somente registros sintéticos identificados por IDs e UUIDs, confirmando a ausência em nova conexão.

Depois do deploy: verificar todos os jobs finais, SHA instalado, rota /fiscal, chunks com marcador "Fechamento por competência" e API protegida sem autenticação. Registrar resultado de aliases separadamente.

## Limitações de escopo

- Datas históricas não foram corrigidas: usuário confere a data registrada na OS antes de preparar. OS sem data ou cadastro válido ficam como pendência.
- O pacote preserva o snapshot preparado; edição de pacote/substituição/retificação e confirmação de encaminhamento serão etapas posteriores. Segunda via não atualiza valores.
- Histórico legado representa geração de arquivo, sem inferir nota emitida. A aba avulsa permanece identificada como formato anterior, com defesas para canceladas, IDs repetidos e OS já vinculada ao novo pacote.
- Nenhuma integração de emissão ou envio foi adicionada. Produção permanece fora do escopo autorizado.

## Compatibilidade da fixture do canário (2026-10-14)

O run `38643448200` instalou corretamente `b83ad68e`, preservou/restaurou runtime, passou sincronização de presets, recibos e todos os gates anteriores. O canário fiscal falhou em `db.flush()` do paciente sintético, antes das chamadas HTTP, porque `pacientes.nome_key` é obrigatório no schema legado PostgreSQL. A fixture passa a preencher as chaves de paciente e tutor pelo normalizador existente da aplicação. Não há mudança no ORM, migrations, regras fiscais, permissões, assertions ou limpeza. Compilar e conferir SDD/diff; a próxima execução do canário em stage é a prova da compatibilidade com o schema instalado.

Validação local do ajuste: execução do prefixo real de construção das fixtures do script em SQLite descartável com `nome_key NOT NULL` para ambos os modelos; flush e vínculo passaram, chaves não vazias coincidem com o normalizador existente. O construtor antigo sem chave foi recusado pelo mesmo banco. Sem HTTP ou runtime. `py_compile`, diff check e guardrail SDD sobre o commit passaram.
