# Plan — Primeira saída da Agenda

Data: 2026-10-07
Responsável: Codex
Status: em execução

## Fases

1. Verificar a configuração operacional da origem residencial, sua validação e
   a fonte de duração do trajeto sem gravar endereço pessoal em respostas.
2. Extrair cálculo compartilhado de primeira chegada e pisos municipais;
   aplicar antes do ranking das sugestões e na validação final de escrita.
3. Manter a interface consistente com lista vazia, erro de oferta vencida e
   recálculo antes do aceite/salvamento.
4. Testar dados sintéticos: hoje e futuro, quatro cidades com piso, município
   comum, trajeto longo, ausência de localização, segundos, oferta vencida e
   preservação dos encaixes intermediários.
5. Executar testes focados, regressão relevante, lint/tipos/build do frontend,
   inspeção do diff e guardrail SDD; registrar os resultados em `verify.md`.

## Rollback e limites

- A política de primeira saída é aditiva e não modifica horários existentes.
- Falha na obtenção da viagem deve impedir confirmação indevida do primeiro
  atendimento, preservando o pedido para correção/reconsulta.
- A publicação em stage/produção e qualquer teste com agendamento real ficam
  fora desta execução local.

## Dependências

- Endereço residencial informado pelo usuário e fonte de geolocalização/tempo
  de viagem operacionalmente confiável.
- Disponibilidade dos serviços de rota existentes; testes isolam esse cálculo
  com duração determinística e nunca usam dados de pacientes reais.
