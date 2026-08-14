# Plan - agenda-whatsapp-cloud-api

Data: 2026-08-14

- [x] P1. Criar contrato autenticado core -> servico WhatsApp.
- [x] P2. Enviar o modelo aprovado com cinco variaveis e dois payloads aleatorios.
- [x] P3. Persistir envio, mensagem, eventos de botao e chaves de idempotencia.
- [x] P4. Validar assinatura, `phone_number_id`, payload e remetente do webhook.
- [x] P5. Processar confirmar/solicitar alteracao com alertas e protecao de prazo.
- [x] P6. Adicionar botao de envio automatico e preservar alternativa manual.
- [x] P7. Integrar configuracao ao deploy e ao preflight de stage.
- [x] P8. Adicionar testes focados e documentacao operacional.
- [x] P9. Configurar os segredos reais diretamente no servidor de stage.
- [ ] P10. Publicar stage, assinar o WABA no webhook e executar smoke real ponta a ponta.
- [ ] P11. Promover o snapshot validado e executar smoke em producao.
- [x] P12. Diagnosticar o primeiro callback real rejeitado pela divergencia do nono digito brasileiro.
- [x] P13. Implementar identidade canonica restrita, teste de equivalencia e unificacao das novas conversas.
- [ ] P14. Publicar a correcao em stage e repetir uma confirmacao real antes de concluir P10.
