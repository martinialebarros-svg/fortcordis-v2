# Spec — mesclagem assistida de pacientes

Data: 2026-11-06

1. O Histórico recente do Atendimento oferece **Revisar duplicidade do paciente**, em nova aba, com o código atual preenchido. Nenhuma consulta de duplicidade ocorre ao abrir a ficha clínica. **Pacientes → Revisões de duplicidade** reabre a fila global.
2. Um administrador pesquisa ou informa dois códigos distintos e escolhe o principal. A ação **Guardar para revisar depois** persiste a dupla sem mudar cadastros. É possível retomar e gerar uma prévia atual em outra sessão. Repetir a mesma dupla reutiliza a pendência.
3. A prévia apresenta identidade e tutor de cada ficha, lista de exames/laudos/atendimentos com código, data, status e origem, e contagem dos demais vínculos que mudam. A pesquisa por nome é apenas navegação. Motivo e confirmação explícita de que é o mesmo animal são obrigatórios.
4. Somente dois pacientes ativos do mesmo tutor ativo podem ser mesclados. Divergência conhecida de espécie, sexo, nascimento ou microchip, atendimento em aberto, vínculos de outro tutor/paciente, acesso recente do tutor ao portal, referência não mapeada ou sessão de IA do secundário bloqueiam a conclusão. Uma pendência pode ser guardada apesar desses bloqueios. O secundário não pode ser principal de uma mesclagem anterior.
5. Na confirmação, a versão da prévia é revalidada. Atualizar apenas os códigos de paciente nas relações explicitamente mapeadas, preservando identificadores, datas, textos, laudos, anexos, valores, clínicas e permissões; sem deduplicar exames ou alterar os dados demográficos do principal. Histórico de portal não é transferido e links antigos não são remapeados. Arquivar o secundário, preservar seu código e impedir nova escrita vinculada a ele.
6. A atualização de vínculos e o histórico de mesclagem ocorrem na mesma transação. Histórico privado registra autor, data, motivo, principal, secundário e códigos transferidos. Um erro devolve a operação inteira ao estado anterior. A repetição da confirmação após perda de resposta não transfere os registros de novo.
7. As rotas de revisão e histórico exigem perfil administrativo. Tabela nova com RLS e sem grants públicos no PostgreSQL. Não há fusão automática, em massa, entre tutores diferentes, reversão automática ou edição de documentos emitidos.

## Aceitação

- CA-001: entrada opcional e fila persistente sem transferência ao adiar.
- CA-002: prévia separa as três categorias e mostra o cadastro de origem de cada registro.
- CA-003: permissões, confirmação explícita, prévia obsoleta e bloqueios de identidade e atendimento.
- CA-004: transferência atômica, proteção de código arquivado, preservação de conteúdo e histórico.
- CA-005: migração idempotente, RLS, concorrência e validação em SQLite e PostgreSQL descartáveis.
