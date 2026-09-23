# Contrato
- Lista explícita de sete avisos institucionais conhecidos. Normalização tolera acentos, caixa, emoji e pontuação; preserva palavras e números. Não usar correspondência parcial, nomes genéricos ou classificação por LLM.
- Somente mensagens textuais recebidas podem ser reconhecidas. Texto adicional no mesmo corpo impede a classificação integral; conteúdo desconhecido segue os portões normais.
- O worker conserva mensagens originais no serviço WhatsApp. Usa cópias com corpo vazio para avisos reconhecidos antes de agrupar fragmentos; mantém limites existentes de tipo, direção, tempo e quantidade.
- Aviso sozinho registra `suppressed/mensagem_automatica`, sem geração, envio, alerta ou criação/renovação de pausa.
- Relato real adjacente permanece no corpo agrupado, mesmo quando a última mensagem é um aviso; emergência continua prioritária sobre pausa.
- Não limpar pausas antigas nem liberar conversas assumidas automaticamente. Não ampliar piloto, modificar preços ou confirmar agenda nesta entrega.
- Lista conservadora não reconhece todos os autorespondedores possíveis. Inclusões futuras exigem revisão e regressões de mensagens mistas.
- Sem migrações, credenciais ou configuração nova. Reversão pelo código, sem alteração de dados históricos.
