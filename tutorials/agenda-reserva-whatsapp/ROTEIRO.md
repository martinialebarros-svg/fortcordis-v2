# Tutorial: criar uma reserva e enviar pelo WhatsApp

Formato: MP4 horizontal, 1280 x 720, aproximadamente 61 segundos, com narração por IA e textos completos na tela.

## Cenas

1. Abra a Agenda e clique em **Novo Agendamento**.
2. Preencha data, hora, clínica e tipo de atendimento.
3. Marque **Reserva de horário** e confira o prazo padrão de 3 horas.
4. Escolha se a mensagem será enviada para a clínica ou para o tutor e selecione o WhatsApp correto.
5. Salve, confira a mensagem e abra o WhatsApp. O envio continua manual.

## Orientações operacionais

- Se tutor ou paciente ainda não estiverem definidos, a mensagem mostrará **Pendente**.
- Nunca envie sem conferir o número selecionado.
- Sem confirmação dentro do prazo, a reserva expira e o horário volta a ficar disponível.
- As capturas devem usar dados de demonstração e ocultar telefones ou informações pessoais.

## Narração

Voz utilizada: `marin`, com o modelo `gpt-4o-mini-tts-2025-12-15` da OpenAI e orientação explícita para português brasileiro.

1. **Abertura:** Reserva de horário pelo WhatsApp.
2. **Agenda:** Na agenda, clique em Novo Agendamento para iniciar o cadastro da reserva.
3. **Dados:** Preencha a data, o horário, a clínica e o tipo de atendimento. Inclua tutor e paciente quando já estiverem definidos.
4. **Reserva:** Marque a opção Reserva de horário. O prazo vem preenchido com três horas. Sem confirmação, o horário volta a ficar disponível.
5. **Destino:** Escolha se a mensagem será enviada para a clínica ou para o tutor. Se houver mais de um WhatsApp, selecione o número correto.
6. **Mensagem:** Salve a reserva, revise o texto e confirme o destinatário. Depois, abra o WhatsApp e faça o envio manual da mensagem.
7. **Encerramento:** Pronto. Reserva criada e mensagem preparada. Antes de enviar, confira o número e o prazo.

## Atualização futura

As capturas ficam em `public/captures/`. Para atualizar o tutorial após alguma mudança visual, substitua os cinco arquivos PNG e renderize novamente.

```bash
npm ci
npm run preview
npm run typecheck
npm run render:voice
npm run render:voice:compact
```

Os vídeos prontos são gerados na pasta `output/`. A versão compacta é a mais indicada para compartilhamento pelo WhatsApp.
