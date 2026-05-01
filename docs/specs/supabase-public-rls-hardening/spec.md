# Spec - supabase-public-rls-hardening

Data: 2026-04-29  
Responsavel: Equipe FortCordis  
Status: done

## 1) Escopo funcional

Adicionar migracao PostgreSQL para habilitar RLS em todas as tabelas existentes do schema `public` e revogar grants amplos das roles `anon` e `authenticated` em tabelas, sequencias e funcoes publicas.

## 2) Requisitos funcionais (RF)

- RF-001: habilitar RLS em tabelas existentes de `public` quando o dialect for PostgreSQL.
- RF-002: nao executar alteracoes de RLS em SQLite/local.
- RF-003: revogar grants da Data API para `anon` e `authenticated`.
- RF-004: recarregar cache do PostgREST apos a mudanca.

## 3) Requisitos nao funcionais (NFR)

- NFR-001 (seguranca): nao criar policies abertas com `USING (true)`.
- NFR-002 (compatibilidade): manter acesso direto do backend via `DATABASE_URL`.
- NFR-003 (rollback): permitir reversao por migration/redeploy controlado se algum consumidor da Data API for descoberto.

## 4) Contratos tecnicos

### Banco/migracoes

- Nova migracao: `20260430_32_supabase_public_rls_hardening.py`.
- Tabelas afetadas: todas as tabelas existentes em `public` no PostgreSQL.
- Roles afetadas: `anon`, `authenticated`.
- Roles nao alteradas: `service_role`.

### API

- Sem alteracao de endpoints FastAPI.

### Frontend

- Sem alteracao de telas ou chamadas.

## 5) Compatibilidade e rollout

- Rollout: aplicar primeiro em stage quando possivel; depois producao.
- Compatibilidade: backend deve continuar operando via conexao direta.
- Rollback: restaurar grants/policies caso exista consumidor legitimo da Data API.

## 6) Criterios de aceitacao (CA)

- CA-001: migracao compila.
- CA-002: em SQLite/local, a migracao nao executa alteracoes.
- CA-003: em PostgreSQL, RLS e habilitado nas tabelas `public`.
- CA-004: `anon` e `authenticated` deixam de ter grants amplos via Data API.
- CA-005: fluxo principal do app continua passando pelo backend.

## 7) Casos de borda

- CB-001: tabela criada com nome que exige aspas no PostgreSQL.
- CB-002: projeto com Data API sendo usada por integracao externa desconhecida.
- CB-003: usuario de banco sem permissao para revogar grants.

## 8) Fora de escopo

- Politicas RLS granulares para acesso direto pelo navegador.
- Desligar Data API pelo painel Supabase.
- Rotacao de credenciais Supabase.
