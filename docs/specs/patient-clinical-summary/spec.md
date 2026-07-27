# Spec - patient-clinical-summary

Data: 2026-07-27
Responsável: Equipe FortCordis
Status: done

## 1) Escopo funcional

Ampliar a edição de paciente para funcionar como carteira clínica: a equipe pode iniciar um atendimento para o pet atual e consultar um resumo dos principais registros longitudinais sem sair do cadastro.

## 2) Requisitos funcionais

- RF-001: o cabeçalho de `/pacientes/{id}` deve exibir a ação destacada `Iniciar atendimento`.
- RF-002: a ação deve abrir `/atendimento?paciente_id={id}`, preservando o paciente como contexto do novo atendimento.
- RF-003: a edição deve mostrar os totais de atendimentos, laudos concluídos e alertas clínicos ativos.
- RF-004: o resumo deve listar até quatro atendimentos anteriores, do mais recente para o mais antigo.
- RF-005: cada atendimento recente deve abrir seu registro por `atendimento_id`.
- RF-006: o resumo deve listar até quatro laudos concluídos, arquivados ou liberados no portal, sem tratar rascunhos como exames laudados.
- RF-007: cada laudo recente deve abrir a rota de visualização compatível com seu tipo.
- RF-008: alertas clínicos ativos devem aparecer em destaque quando existirem.
- RF-009: carregamento, falha de consulta, ausência de atendimentos e ausência de laudos devem possuir mensagens próprias.
- RF-010: a atualização manual do histórico deve estar disponível sem recarregar todo o cadastro.

## 3) Requisitos não funcionais

- NFR-001: o endpoint deve exigir a autenticação interna já usada pelos demais cadastros.
- NFR-002: o resumo deve usar contagens e consultas limitadas, sem carregar a linha do tempo clínica completa.
- NFR-003: o limite solicitado deve ficar entre 1 e 10 registros por categoria.
- NFR-004: a mudança não deve exigir nova migração de banco.
- NFR-005: cabeçalho, métricas e listas devem continuar legíveis em desktop e mobile.
- NFR-006: a abertura do atendimento não deve criar registro no banco antes do salvamento explícito no módulo clínico.

## 4) Contratos técnicos

### API

- `GET /api/v1/pacientes/{paciente_id}/resumo-clinico?limite=4`
- Resposta:
  - `totais.atendimentos`
  - `totais.laudos_concluidos`
  - `totais.alertas_ativos`
  - `atendimentos_recentes[]`
  - `laudos_recentes[]`
  - `alertas_ativos[]`
- Status de laudo considerados concluídos:
  - `Finalizado`
  - `Liberado no portal`
  - `Arquivado`
  - variantes legadas de `Concluido`

### Frontend

- Tela afetada: `frontend/app/pacientes/[id]/page.tsx`.
- Estilos afetados: `frontend/app/globals.css`.
- Início de atendimento: `/atendimento?paciente_id={id}`.
- Abertura de histórico: `/atendimento?atendimento_id={id}`.
- Abertura de laudo: `getLaudoViewPath(id, tipo)`.

## 5) Critérios de aceitação

- CA-001: a carteira clínica exibe `Iniciar atendimento` junto às ações do paciente.
- CA-002: a ação abre o atendimento com o mesmo paciente já selecionado.
- CA-003: totais e listas recentes refletem apenas registros do paciente acessado.
- CA-004: rascunhos de laudo não entram na contagem de exames laudados.
- CA-005: atendimentos e laudos recentes abrem seus detalhes.
- CA-006: paciente sem histórico recebe estados vazios claros, sem erro de tela.
- CA-007: falha isolada do resumo mantém os dados cadastrais acessíveis e oferece nova tentativa.
- CA-008: testes backend, lint e build frontend passam.
- CA-009: a composição permanece utilizável em viewport mobile.

## 6) Fora de escopo

- Criar atendimento automaticamente ao clicar no botão.
- Exibir a linha do tempo clínica completa dentro do cadastro.
- Editar laudos ou atendimentos diretamente no resumo.
- Alterar permissões existentes dos módulos clínicos.
