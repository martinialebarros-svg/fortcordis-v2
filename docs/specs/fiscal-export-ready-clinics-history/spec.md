# Spec - fiscal-export-ready-clinics-history

Data: 2026-08-04
Responsavel: Codex
Status: done

## 1) Escopo funcional

A exportação fiscal deve identificar clínicas que possuem todos os campos necessários para o tomador PJ: razão/nome, CNPJ, logradouro, bairro, cidade, UF, CEP e telefone. No modo multiclínica, a tela começa exibindo somente essas clínicas e não permite incluir uma clínica incompleta no lote. O usuário vê o total dos serviços enquanto seleciona clínicas ou OS e consulta o histórico das exportações concluídas, inclusive se foram fechamento por período ou emissão por serviço.

## 2) Requisitos funcionais (RF)

- RF-001: `GET /fiscal/clinicas-com-os` deve informar `dados_fiscais_completos` e `campos_fiscais_pendentes`, com opção de retornar apenas clínicas completas.
- RF-002: o filtro multiclínica deve iniciar em “somente cadastros completos”; itens incompletos só podem ser visualizados, nunca selecionados para exportação multiclínica.
- RF-003: a interface deve mostrar valor total das clínicas marcadas antes da consolidação e valor das OS marcadas depois dela.
- RF-004: cada exportação de OS bem-sucedida deve registrar formato, tipo de emissão, período, OS, clínicas, total, usuário e data/hora local.
- RF-005: a tela deve listar os registros mais recentes com escopo e valor suficientes para revisão operacional.

## 3) Requisitos não funcionais (NFR)

- NFR-001 (consistência): a regra de completude da lista e da exportação deve ser única no backend.
- NFR-002 (segurança): histórico e exportação permanecem sob autenticação e autorização do módulo fiscal; não persistir nomes de pacientes ou tutores.
- NFR-003 (auditabilidade): o arquivo só é entregue se seu histórico correspondente puder ser salvo.

## 4) Contratos técnicos

### API

- `GET /api/v1/fiscal/clinicas-com-os?data_inicio&data_fim&somente_completas=false`: retorna clínicas com `dados_fiscais_completos` e `campos_fiscais_pendentes`.
- `POST /api/v1/fiscal/os/exportar-lote`: aceita opcionalmente `tipo_emissao` (`fechamento_periodo` ou `por_servico`) e registra a emissão após gerar o conteúdo.
- `GET /api/v1/fiscal/relatorios-emissoes?limit=20&clinica_id=`: retorna registros recentes de exportação.

### Banco/migrações

- Tabela nova: `relatorios_fiscais_emissoes`.
- Campos: formato, modo, tipo, período, quantidade, valor, clínicas/OS em JSON textual, usuário, nome do arquivo e data local.
- Índices: emissão, usuário e tipo de emissão.
- Migração necessária: sim.

### Frontend

- Tela afetada: `/fiscal/exportar`.
- Estados: filtro de completude, total das clínicas, tipo de emissão, carregamento/atualização do histórico.
- Erros: clínica incompleta recebe os campos pendentes; falha da API continua impedindo o arquivo.

## 5) Compatibilidade e rollout

- Backward compatibility: `tipo_emissao` é opcional e exportações de clientes antigos recebem `fechamento_periodo`.
- Feature flag: não.
- Estratégia de rollback: reverter a aplicação; a nova tabela permanece inerte e não altera relatórios já emitidos.

## 6) Critérios de aceitação (CA)

- CA-001: clínicas incompletas não entram na seleção padrão e não bloqueiam uma exportação formada somente por clínicas aptas.
- CA-002: o valor exibido muda ao marcar/desmarcar clínicas e OS.
- CA-003: uma exportação bem-sucedida cria exatamente um registro com total, escopo, tipo, formato, usuário e data local.
- CA-004: o histórico exibe emissões por período e por serviço sem dados de paciente/tutor.
- CA-005: requisição direta à API com clínica incompleta continua retornando 422.

## 7) Casos de borda

- CB-001: nenhuma clínica completa no período deve orientar a ajustar o cadastro, sem permitir exportação vazia.
- CB-002: ao trocar período ou filtro, clínicas e OS fora do escopo são removidas da seleção.
- CB-003: reexportar o mesmo conjunto cria outro registro, pois são emissões distintas que exigem rastreabilidade.

## 8) Fora de escopo

- Cancelar ou apagar uma emissão histórica.
- Integração de transmissão de NFS-e.
