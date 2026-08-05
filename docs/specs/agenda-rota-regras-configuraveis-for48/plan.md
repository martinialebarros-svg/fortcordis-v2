# Plan - agenda-rota-regras-configuraveis-for48

Data: 2026-05-17  
Responsavel: Martiniano + Codex  
Status: done

## Tarefas

- [x] Criar estrutura de regras de rota com defaults e normalizacao no backend.
- [x] Persistir `agenda_rota_regras` em `configuracoes` (modelo + migracao + endpoint).
- [x] Aplicar regras na validacao de deslocamento e na sugestao de horarios/proximidade.
- [x] Expor configuracao visual no frontend para thresholds, politicas e overrides por clinica.
- [x] Validar qualidade tecnica local (py_compile, eslint, tsc).

## Ajuste de seguranca operacional — 2026-08-04

- [x] Trocar a abertura rapida de excecao por acesso ao formulario para `admin`, sem escrita em configuracoes.
- [x] Exibir confirmacao explicita no submit quando a validacao identificar agenda fechada ou horario fora da janela.
- [x] Reforcar a confirmacao no backend, exclusiva de `admin`, sem dispensar validacoes de sobreposicao e deslocamento.
- [x] Registrar auditoria com a causa do fechamento e cobrir bloqueio, confirmacao e auditoria em teste backend.
