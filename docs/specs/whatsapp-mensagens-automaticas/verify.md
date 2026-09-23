# Verificação

- Testes focados: 18 aprovados (worker e reconhecimento). Teste adicional de limites e preservação dos fragmentos: suíte específica com 3 testes aprovada.
- Casos incluem os sete avisos revisados; textos com sintomas/pedido adicionados não são reconhecidos como aviso; urgência real antes/depois de aviso continua prioritária; pausa existente é preservada; nenhum envio ou nova pausa é produzido pelo aviso sozinho.
- Agrupamento mantém limites de dois minutos, direção e tipo. Dados originais permanecem intactos.
- Validação utiliza SQLite temporário e serviços externos simulados. Sem mensagens reais, alterações de produção ou desbloqueio de conversas.
- Backend completo: 1406 testes e 297 subtestes aprovados, 7 ignorados pelas condições do ambiente; 25 avisos de depreciação. Log: `/private/tmp/whatsapp-ausencia-full.log`.
- Teste adicional de limites incluído após iniciar a suíte completa: suíte específica final aprovada (3 testes), log `/private/tmp/whatsapp-ausencia-focused-final.log`.
- Guardrail SDD incluindo arquivos novos e `git diff --check` aprovados. Nenhuma mudança frontend; build frontend não se aplica.
- Implementação local em `codex/whatsapp-ausencia`, base `7646e39a`; ainda não publicada.
