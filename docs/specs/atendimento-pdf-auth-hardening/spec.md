# Spec - atendimento-pdf-auth-hardening

Data: 2026-10-22 (revisao de compatibilidade Supabase)
Responsavel: Equipe FortCordis  
Status: approved

## 1) Escopo funcional

Autenticar os PDFs do atendimento pelo mesmo resolvedor central usado nas demais rotas (`get_current_user`), respeitando `AUTH_PROVIDER` (`legacy` ou `supabase`). Aceitar a sessao por cookie HttpOnly ou bearer e manter a rejeicao de `access_token` na URL. A revisao corrige a recusa indevida de sessoes Supabase que antes eram decodificadas como JWT legado exclusivamente nos downloads.

## 2) Requisitos funcionais (RF)

- RF-001: receitas principal/complementar, solicitacao de exames e documentos devem usar `get_current_user(request=request, token=None, db=db)`, aceitando cookie de sessao ou `Authorization: Bearer <token>` conforme a politica central do provedor configurado.
- RF-002: requests contendo `access_token` na query string devem ser rejeitadas explicitamente.
- RF-003: requests sem sessao valida devem retornar `401` com `WWW-Authenticate: Bearer`; usuario inativo ou sem permissao local recebe `403`.
- RF-004: requests autenticadas corretamente devem continuar funcionando sem alteracao de payload de sucesso, identidade do paciente, medicamentos ou alvo da receita.
- RF-005: adicionar testes automatizados cobrindo cenarios de rejeicao e sucesso do helper de auth para PDF.
- RF-006: em modo Supabase, validar a sessao pelo servico existente e seu vinculo local por `app_metadata`; nao tentar JWT legado quando houver revogacao ou indisponibilidade. O cookie atual prevalece sobre bearer antigo conforme a politica central.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca/permissoes): impedir uso de credencial em URL para reduzir vazamento em logs/historico/proxies.
- NFR-002 (confiabilidade): manter comportamento deterministico de erro (`400` para query token, `401` para credencial ausente/invalida, `403` para usuario inativo).
- NFR-003 (observabilidade): manter mensagens de erro claras para diagnostico rapido em stage/producao.

## 4) Contratos tecnicos

### API

- Endpoints:
- `GET /api/v1/atendimentos/{atendimento_id}/prescricao/pdf`
- `GET /api/v1/atendimentos/{atendimento_id}/prescricoes/{prescricao_id}/pdf`
- `GET /api/v1/atendimentos/{atendimento_id}/exames/pdf`
- `GET /api/v1/atendimentos/{atendimento_id}/documentos/{documento_id}/pdf`
- Metodo: `GET`
- Auth obrigatoria:
- Aceito: cookie HttpOnly de sessao ou header `Authorization: Bearer <token>`, validado pelo provedor configurado.
- Nao aceito: query string `?access_token=...`
- Erros esperados:
- `400` quando `access_token` vier na URL.
- `401` quando faltar sessao valida ou houver revogacao.
- `403` quando usuario autenticado estiver inativo ou sem permissao de visualizar `atendimento_clinico`.
- `503` quando o provedor de autenticacao estiver indisponivel, sem fallback legado.

### Banco/migracoes

- Tabelas/colunas afetadas: nenhuma.
- Indices/constraints: sem alteracao.
- Migracao necessaria: nao.

### Frontend

- Tela afetada: `frontend/app/atendimento/page.tsx` (sem mudanca funcional prevista).
- Estado de UI esperado: downloads de PDF continuam via `api.get(...)` com as credenciais da sessao enviadas pelo cliente existente.
- Regra de erro: request com auth invalida continua propagando erro da API.

## 5) Compatibilidade e rollout

- Backward compatibility: clientes usando header bearer permanecem compativeis.
- Breaking change controlada: clientes que usarem query token passarao a receber `400`.
- Feature flag: nenhuma nova; usa `AUTH_PROVIDER` existente.
- Estrategia de rollback: reverter somente esta correcao. Nao altera contas, papeis, cookies, configuracao do provedor nem dados clinicos; o revert reintroduz a incompatibilidade com Supabase nos PDFs.

## 6) Criterios de aceitacao (CA)

- CA-001: request com `?access_token=...` recebe `400` com mensagem orientando uso de header.
- CA-002: request sem cookie e sem bearer recebe `401`; cookie valido funciona sem bearer.
- CA-003: request com bearer invalido recebe `401`.
- CA-004: request com bearer valido retorna objeto `User` no helper de auth, permitindo fluxo normal do endpoint.
- CA-005: testes automatizados novos passam localmente.
- CA-006: cookie Supabase valido com bearer antigo autentica as quatro rotas; receita principal e complementar retornam PDF real com paciente e medicamento corretos, sem misturar receitas nem reabrir atendimento concluido.
- CA-007: sessoes revogadas, vinculo apenas em `user_metadata`, usuario inativo e falta de permissao permanecem bloqueados; indisponibilidade retorna `503`.

## 7) Casos de borda

- CB-001: request com query token e header valido ao mesmo tempo (deve continuar bloqueando por query token).
- CB-002: header `Authorization` sem prefixo `Bearer`.
- CB-003: JWT valido para email de usuario inexistente.
- CB-004: JWT valido para usuario inativo.
- CB-005: cookie Supabase atual acompanhado de bearer antigo.
- CB-006: download da receita complementar preserva o alvo solicitado.

## 8) Fora de escopo

- Refatoracao completa do modulo de autenticacao global.
- Rotacao de JWT, refresh token e SSO.
- Mudancas de layout/UX na tela de atendimento.
