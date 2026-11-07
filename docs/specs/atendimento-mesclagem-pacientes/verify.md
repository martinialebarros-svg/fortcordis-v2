# Verify — mesclagem assistida de pacientes

Data: 2026-11-06
Status: implementado e validado localmente

| Critério | Evidência | Estado |
| --- | --- | --- |
| CA-001 | Link em nova aba; fila reabre após recarga; adiar não muda vínculos | passou |
| CA-002 | Listas de exames, laudos e atendimentos com origem, status e data operacional; visual desktop e celular | passou |
| CA-003 | API recusa perfil sem permissão, ausência de aceite, prévia antiga, divergências, consulta aberta, portal recente e vínculo cruzado | passou |
| CA-004 | IDs, textos e metadados de arquivo preservados; arquivamento e proteção contra novo vínculo; replay e rollback; histórico administrativo | passou |
| CA-005 | Migração aplicada duas vezes, ciclo SQLite, RLS/ACL e concorrência sem espera em PostgreSQL descartável | passou |

## Evidências locais

- API e ciclo de migrações: 14 testes passaram; uma variante específica de PostgreSQL foi omitida em SQLite. PostgreSQL local temporário com schemas isolados e roles de teste; sem acesso a base de stage ou produção.
- Backend geral no formato do workflow: 2652 testes executados, OK, 146 skips opcionais. Uma tentativa inicial com pytest global não coletou dois imports legados de Maps; a suíte no executor oficial passou. Os testes focados SQLite/PostgreSQL também foram incluídos no passo de integração clínica dos workflows existentes.
- Frontend geral antes do avanço independente da referência AE/Ao em stage: 2857 testes em 158 arquivos. Suíte focada final cobre a entrada do Atendimento, seleção, fila, prévia, recusa de acesso, confirmação, histórico e datas em Fortaleza. Build com lint e TypeScript e guardrail SDD aprovados na base local atualizada.
- Chrome local, aplicação compilada e API real contra SQLite sintético: abrir com paciente preenchido, guardar revisão, recarregar, retomar, comparar e confirmar, conferir histórico. Desktop 1440 px e celular 390 px; sem rolagem horizontal ou erro JavaScript. A autenticação do navegador foi simulada; o contrato de perfil foi testado na API.
- Logs em `/tmp/fortcordis-paciente-merge-*.log`. Controle de acesso da tabela segue o [guia de RLS do Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), sem exposição da trilha ao Data API.

## Limite de verificação

Não houve publicação, migração operacional ou alteração do caso relatado. Homologação em stage deve verificar o inventário e os guardas de vínculos do schema instalado, com uma dupla sintética, antes de publicar.

## Preparação da publicação em stage — 2026-11-07

- Base `9bf9efa31310fa8fd1dcac52a5e979c51b625866`. A migração mais recente no repositório e no schema operacional de stage é a 107. A 108 está reservada a esta entrega. O banco de stage foi identificado como separado de produção por metadados de configuração, sem ler registros de pacientes.
- O inventário de stage confirma as onze relações conhecidas e seis tabelas legadas com referência de paciente. O serviço mantém o bloqueio documentado se houver vínculos não mapeados na dupla selecionada. A homologação cobre esse caso em uma base descartável.
- O aceite de stage exige deploy terminal, SHA instalado, migração e proteção do histórico, interface servida e teste de revisão, confirmação e histórico com dados fictícios. O teste de transferência roda em base isolada.

## Candidata de promoção — 2026-11-07

- Reaplicada sobre `main` `ebec9de6` com a correção do cartão AE/Ao. O pacote mantém a migração 108, os guardas e os testes SQLite/PostgreSQL. No teste local foram usados apenas dados fictícios e um servidor PostgreSQL descartável.
- A suíte focada de backend (mesclagem e Laudos) passou com 81 testes e 159 subtestes. O único caso omitido depende de lock PostgreSQL e é exercitado na variante PostgreSQL. A primeira execução local com URL só de socket parou na guarda de configuração do teste. A execução com hostname explícito de loopback e o mesmo socket privado passou.
- As evidências do Stage original (#574) são anteriores a este empacotamento. A aprovação deste pacote usa o conteúdo exato da candidata e evidências de implantação e homologação registradas separadamente.
