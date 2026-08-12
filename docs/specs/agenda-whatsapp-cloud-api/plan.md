# Plan - agenda-whatsapp-cloud-api

Data: 2026-08-11

- [x] P1. Criar contrato autenticado core -> servico WhatsApp.
- [x] P2. Enviar o modelo aprovado com cinco variaveis e dois payloads aleatorios.
- [x] P3. Persistir envio, mensagem, eventos de botao e chaves de idempotencia.
- [x] P4. Validar assinatura, `phone_number_id`, payload e remetente do webhook.
- [x] P5. Processar confirmar/solicitar alteracao com alertas e protecao de prazo.
- [x] P6. Adicionar botao de envio automatico e preservar alternativa manual.
- [x] P7. Integrar configuracao ao deploy e ao preflight de stage.
- [x] P8. Adicionar testes focados e documentacao operacional.
- [ ] P9. Configurar os segredos reais diretamente no servidor de stage.
- [ ] P10. Publicar stage, assinar o WABA no webhook e executar smoke real ponta a ponta.
- [ ] P11. Promover o snapshot validado e executar smoke em producao.
