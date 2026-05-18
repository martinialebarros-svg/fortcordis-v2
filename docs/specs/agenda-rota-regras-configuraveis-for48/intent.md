# Intent - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: done

## 1) Problema atual

As regras de oferta de agenda e eficiencia de rota estavam rigidamente no codigo, sem painel unico para ajuste operacional e sem controle fino por perfil de clinica.

## 2) Objetivo

Permitir configuracao visual e persistente das regras de roteirizacao (base, limiares, politica de oferta e bloqueio de ineficiencia), reduzindo deslocamentos improdutivos e melhorando previsibilidade de sugestao de horarios.

## 3) Nao objetivos

- Implementar otimizador global de rotas com solver externo.
- Alterar o modelo de negocio de agendamento para multi-profissional.

## 4) Contexto e restricoes

- Restricoes tecnicas: manter compatibilidade com fluxo atual de agenda e endpoints existentes.
- Restricoes de prazo: entrega incremental em stage sem interromper operacao.
- Restricoes regulatorio/operacional: respeitar politicas atuais de autenticacao e trilha de deploy.

## 5) Impacto esperado

- Usuarios impactados: recepcao, operacao de agenda e administracao.
- Modulos impactados: backend agenda/configuracoes, frontend configuracoes.
- Risco de regressao: medio (logica de sugestao e validacao de conflitos).

## 6) Riscos iniciais

- Regras muito restritivas reduzirem opcoes de horarios.
- Configuracao inconsistente sem normalizacao de payload.

## 7) Perguntas abertas

- Qual calibracao final de limiares por regiao de atendimento?
- Quais clinicas precisam de override permanente vs sazonal?

## 8) Definition of Ready (gate para spec)

- [x] Problema e objetivo estao claros.
- [x] Escopo e nao escopo estao explicitos.
- [x] Restricoes estao registradas.
- [x] Riscos iniciais estao mapeados.
