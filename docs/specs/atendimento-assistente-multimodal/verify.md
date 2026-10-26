# Verify — Assistência multimodal no atendimento

Data: 2026-10-26
Status: done (validação local; homologação clínica e publicação pendentes)

## Matriz de rastreabilidade

| Critério | Evidência | Resultado |
| --- | --- | --- |
| CA-001/002 | `backend/tests/test_atendimento_assistente.py`: autenticação/matriz, consentimento, validação binária e limites, provider mock, identidade, fontes/páginas, referências ausentes, unidades, recusa/erro | 30 testes passaram |
| CA-003/004 | Testes IA/hook/helpers: revisão individual, append entre trechos, mesmo áudio sem duplicação, falha conserva fontes, isolamento de recuperação por usuário/caso/paciente, fragmento final após unmount, sincronização antes de anexar | Passaram |
| CA-005 | Helper/UI WhatsApp: telefone e DDD, confirmação destinatário, PDF preparado, revisão de conteúdo estável no autosave, edição/troca invalida arquivo, cancelamento e fallback | 42 testes passaram |
| CA-006 | Suite frontend completa, regressão backend atendimento, lint, TypeScript/build, diff e SDD | Passaram; comandos abaixo |

## Testes executados

Runtime backend: `/Users/martiniano/fortcordis-v2/backend/venv/bin/python`.

```text
python -m unittest discover -s backend/tests -p 'test_atendimento*.py' -q
233 testes passaram.

python -m unittest discover -s backend/tests -p 'test_atendimento_assistente.py' -q
30 testes passaram na revisão final, incluindo extensão MPEG/MPGA.

cd frontend && npm test
119 arquivos / 1.294 testes Vitest + 23 testes Node passaram.
Após essa execução, 5 testes complementares em AtendimentoAssistenteIA.memory.test.tsx passaram, assim como novo TypeScript; total validado de 1.299 testes Vitest.

cd frontend && npm run lint
Passou sem warnings ESLint.

cd frontend && npx tsc --noEmit
Passou; também verificado no build final.

cd frontend && npm run build
Passou, 43 páginas geradas.

git diff --check
Passou.

scripts/ci/check_sdd_guardrail.py — evaluate_guardrail com diff + arquivos novos
Passou para atendimento-assistente-multimodal.
```

O primeiro comando de suite frontend recebeu indevidamente `--runInBand` no runner Node; Vitest passou, Node rejeitou o argumento. O comando correto `npm test` foi executado novamente e terminou com sucesso. Há aviso preexistente de Browserslist desatualizado e uma mensagem de navegação não implementada no jsdom; não houve falha de teste.

## Inspeção visual e funcional simulada

Prévia local em loopback com componentes reais/CSS do app e fixtures sintéticas; chamadas de API, microfone e PDF foram simulados. Conferidos em navegador:

- Layout estreito sem sobreposição; painéis recolhidos deixam a consulta acessível.
- Análise não incorpora nada automaticamente; fonte literal aparece, botão permanece bloqueado até revisão e fica desabilitado após inclusão.
- Plano/conduta aparece separado de fatos do prontuário.
- WhatsApp exige confirmação do destinatário e oferece ações apenas após PDF preparado.
- Nenhum clique de compartilhamento/envio final foi feito.

Capturas em `output/assistente-preview/revisao-preview.png` e `output/assistente-preview/whatsapp-preview.png` (artefatos locais ignorados). A prévia não demonstra funcionamento com paciente real, API real ou microfone físico.

## Revisão independente e correções

Corrigidos: telefone de cadastro anterior após falha de carregamento; invalidação por IDs/históricos do autosave; contexto desatualizado antes da análise/anexação; resposta e lote de upload após troca de paciente; sobrescrita da transcrição pelo segundo trecho; backup sem identificação do paciente; perda de revisão em navegação SPA; reset cancelável após DELETE; retenção do arquivo bruto pelo marcador de transcrição após descarte.

## Limites de validação e release

Fixtures/mocks provam contrato e tratamento de falhas, não acurácia de transcrição/OCR ou qualidade clínica. Ainda é necessário confirmar acesso da conta aos modelos, custo/latência reais, microfones/navegadores usados e amostras representativas (ruído, falas sobrepostas, nomes, medicamentos, negações, unidades, documento ilegível e paciente divergente).

IA permanece desativada por padrão (`ATENDIMENTO_IA_ENABLED=false`). Sem migração, chamada real à OpenAI, envio WhatsApp, alteração de paciente real, commit, push ou deploy. Compartilhamento final continua manual pelo usuário; não é envio Meta Cloud API. Nenhuma ativação/publicação foi realizada.

## Preparação da publicação autorizada

Usuário autorizou em 2026-10-26 aguardar publicações concorrentes e publicar em seguida. A verificação inicial encontrou os runs de stage `40381395318` (painel) em execução e `40383527861` (restauração) pendente. Produção estava em `1fb920c2711b5776f095bfb8e6d06d7f7ece76b5`, com deploy `40378878594` concluído com sucesso. Esses registros são o estado inicial da fila, não prova desta entrega.

A revisão de prontidão confirmou que desabilitar IA bloqueia transcrever/analisar, mantendo gravação local, anexação explícita e WhatsApp manual. Os workflows já injetam chaves OpenAI separadas por ambiente, sem ativar `ATENDIMENTO_IA_ENABLED`. Não há alteração de segredo, política Meta ou configuração de ativação nesta publicação.

## Ajuste após preferência de dispositivo

O usuário confirmou alternância entre computador e celular. Acrescentada orientação no painel sobre parada da gravação, revisão/incorporação e confirmação do salvamento antes de trocar de aparelho. Áudio e rascunhos seguem locais ao navegador; não foi implementada sincronização de gravação ou de revisão pendente entre dispositivos. A matriz de homologação física inclui celular e computador; esses testes físicos permanecem pendentes. ESLint do componente passou após o ajuste de texto; nenhuma lógica de captura/análise/envio foi alterada.
