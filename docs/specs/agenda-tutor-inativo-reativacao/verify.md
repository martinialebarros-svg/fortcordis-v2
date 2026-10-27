# Verify — agenda-tutor-inativo-reativacao

Atualizacao: 2026-10-27
Status: verified-local

A verificacao historica de reutilizacao por nome foi substituida pelo contrato
explicito de identidade. Nenhum resultado anterior e evidencia do comportamento
novo em producao.

| ID | Evidencia local | Status |
| --- | --- | --- |
| CA-001 | test_tutor_inativo_exige_confirmacao_e_volta_para_a_busca_apos_reativacao: criar outro ID preserva telefone e inatividade do original | ok |
| CA-002 | mesmo teste: POST de reativacao pelo ID e confirmacao devolve o ID original, ambos aparecem na busca | ok |
| CA-003 | mesmo teste: confirmar=false retorna erro antes de reativar | ok |
| CA-004 | test_tutor_ativo_com_mesmo_nome_permite_outra_pessoa | ok |

Testes de reativacao e formalizacao: 14 passaram na rodada dedicada (incluidos
nos 24 da rodada com o contrato inicial de mesclagem). Evidencias complementares
em [verify de identidade](../tutores-identidade-mesclagem/verify.md). Entrega local.
