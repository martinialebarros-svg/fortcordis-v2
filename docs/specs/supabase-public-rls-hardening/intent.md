# Intent - supabase-public-rls-hardening

Data: 2026-04-29  
Responsavel: Equipe FortCordis  
Status: done

## 1) Problema atual

O Supabase Security Advisor reporta tabelas no schema `public` sem Row Level Security (RLS), incluindo tabelas sensiveis de pacientes, tutores, agenda e financeiro.

## 2) Objetivo

Reduzir a superficie de exposicao da Data API/PostgREST do Supabase sem alterar o fluxo principal do app, que acessa o banco pelo backend FastAPI.

## 3) Nao objetivos

- Nao criar acesso direto do frontend ao Supabase.
- Nao desenhar politicas RLS por usuario para uso via navegador.
- Nao aplicar `FORCE ROW LEVEL SECURITY` nesta etapa.

## 4) Contexto e restricoes

- O frontend usa `/api/v1` e nao usa `supabase-js`.
- O backend usa conexao direta via `DATABASE_URL`.
- A mudanca deve ser reversivel e nao deve bloquear o usuario direto usado pelo backend.

## 5) Impacto esperado

- Alertas de RLS desabilitado deixam de aparecer para tabelas existentes.
- Roles `anon` e `authenticated` perdem grants amplos na Data API.
- Backend permanece responsavel por autenticacao e autorizacao de negocio.

## 6) Riscos iniciais

- Risco 1: algum uso nao mapeado da Data API deixar de funcionar.
- Risco 2: futura tabela criada fora das migrações voltar a nascer sem RLS.

## 7) Perguntas abertas

- A Data API deve ser desligada tambem no painel Supabase? Recomendado se nao houver consumidor REST/GraphQL.

## 8) Definition of Ready

- [x] Alertas do Supabase identificados.
- [x] Uso atual do frontend/backend verificado no repo.
- [x] Estrategia sem policies publicas definida.
