# Verify - agenda-whatsapp-ultimo-usado

Data: 2026-08-08
Status: in-progress

## 1) Testes automatizados executados

```bash
cd frontend
npx tsc --noEmit -p tsconfig.json
npx eslint app/agenda/NovoAgendamentoModal.tsx
```

Resultado: ambos sem erros/avisos.

## 2) Testes manuais (pendentes — sem ambiente de UI interativo neste sandbox)

1. Criar uma reserva para uma clinica com 2+ WhatsApp cadastrados; na tela de mensagem, trocar
   para o segundo numero e clicar "Abrir WhatsApp".
2. Criar uma nova reserva/agendamento para a mesma clinica (ou editar outra ja existente dela) e
   gerar a mensagem de novo — o segundo numero deve vir pre-selecionado.
3. Repetir com um tutor com WhatsApp e telefone cadastrados (fallback de 1 candidato) — confirmar
   que nada quebra quando so ha 1 opcao (nenhum dropdown, texto simples).
4. Testar em aba anonima / com `localStorage` bloqueado (config do navegador) — confirmar que o
   fluxo de gerar/copiar/abrir mensagem continua funcionando normalmente, so sem lembrar o numero.

## 3) Riscos residuais

- Sem cobertura automatizada de UI (mesma limitacao ja registrada em
  `docs/specs/agenda-reserva-mensagem-edicao/verify.md`).
- Preferencia fica presa ao navegador/dispositivo da secretaria que usou — se a equipe reveza de
  computador, o "ultimo usado" pode nao bater. Impacto baixo (o dropdown continua disponivel).

## 4) Decisao de release

- [ ] Aprovado para stage.
- [ ] Aprovado para producao.
- [x] Nao aprovado ainda — pendente de QA manual (mesmo fluxo que o usuario ja vai fazer em stage
      para as outras entregas desta sessao).
