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

PR de feature com base stage. O merge com marcador `[fiscal-fechamento-canary]` executa o canário pelo workflow de stage, sob identidade de backend autorizada, restrito ao caminho `/var/www/fortcordis-stage` e APP_ENV=stage. Fixture própria inclui clínica inativa, OS apta de agosto, cancelada e OS de setembro. Testa API/ZIP, seleção integral, retry, segunda via, prevenção de novo pacote e bypass legado, checksum e ausência de NotaFiscal. Limpa somente registros sintéticos identificados por IDs e UUIDs, confirmando a ausência em nova conexão.

Depois do deploy: verificar todos os jobs finais, SHA instalado, rota /fiscal, chunks com marcador "Fechamento por competência" e API protegida sem autenticação. Registrar resultado de aliases separadamente.

## Limitações de escopo

- Datas históricas não foram corrigidas: usuário confere a data registrada na OS antes de preparar. OS sem data ou cadastro válido ficam como pendência.
- O pacote preserva o snapshot preparado; edição de pacote/substituição/retificação e confirmação de encaminhamento serão etapas posteriores. Segunda via não atualiza valores.
- Histórico legado representa geração de arquivo, sem inferir nota emitida. A aba avulsa permanece identificada como formato anterior, com defesas para canceladas, IDs repetidos e OS já vinculada ao novo pacote.
- Nenhuma integração de emissão ou envio foi adicionada. Produção permanece fora do escopo autorizado.
