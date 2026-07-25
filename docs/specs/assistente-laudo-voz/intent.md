# Intent - assistente-laudo-voz

Data: 2026-07-25
Responsável: Martiniano + Codex
Status: stage_validated

## Objetivo

Adicionar ao editor existente de ecocardiograma um assistente de ditado em português
brasileiro que transcreve áudio, estrutura achados nos campos reais do FortCordis e
devolve sugestões individualmente revisáveis, sem substituir a decisão do
médico-veterinário ou o fluxo manual.

## Resultado esperado

- gravação, pausa, reprodução, regravação e upload de áudio no editor;
- transcrição editável antes da estruturação clínica;
- medidas, sugestões e alertas validados por esquema estrito;
- comparação do texto atual com a sugestão, com edição ou rejeição por campo;
- aplicação seletiva, por modo, somente após confirmação explícita;
- laudo mantido como rascunho e salvo apenas pelo fluxo normal;
- áudio temporário, exclusão manual e limpeza automática;
- isolamento das sessões pelo usuário proprietário e clínica do laudo;
- vocabulário e frases preferidas configuráveis pelo usuário;
- feature flag desativada por padrão e ativada somente em homologação neste ciclo.

## Não objetivos do MVP

- finalizar, assinar, liberar no portal ou publicar laudo;
- sugerir tratamento, medicamento ou dose;
- alterar classificação clínica do paciente;
- streaming de transcrição em tempo real;
- substituir o modelo atual de laudo ou o editor manual;
- criar Redis, Celery ou novo serviço de fila;
- promover a funcionalidade para produção.

## Riscos principais

- erro de transcrição em números, unidades ou negações;
- sugestão clínica ser confundida com fato ou diagnóstico definitivo;
- áudio ou transcrição conter dados pessoais desnecessários;
- sessão ser acessada por outro usuário;
- indisponibilidade do provedor interromper o trabalho clínico;
- migration chegar a produção sem validação prévia em homologação.

## Salvaguardas

- extração e verificação numérica determinísticas sem correção silenciosa;
- Pydantic com `extra=forbid` e Structured Outputs;
- confirmação `confirmed=true` obrigatória no contrato de aplicação;
- endpoint de aplicação devolve patch ao formulário e não persiste o laudo;
- sessão sempre filtrada por `session_id + user_id`;
- minimização e redação de dados pessoais antes do provedor de estruturação;
- logs sem áudio, transcrição ou laudo integral;
- feature flag e fluxo manual independentes.
