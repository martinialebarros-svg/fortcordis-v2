# Intenção — idade e nascimento do paciente

Pedido de Martiniano em 04/11/2026 neste chat: oferecer nascimento e idade independentes em todos os módulos que usam idade. A entrada explicitamente editada define a fonte. Tutores podem informar só idade ou só ano de nascimento. Confirmado: idade informada deve avançar como estimativa desde a data do registro.

Não inventar aniversário. Preservar cadastros legados, identificação, dados clínicos e documentos emitidos. Implementação local autorizada; publicação e alterações em cadastros reais fora do escopo desta entrega.

## Publicação autorizada — 05/11/2026
Usuário solicitou “publique”. Ciclo Stage isolado → produção por PR direta stage/main → restauração de Stage com os trabalhos paralelos. Migração 106 após máximo remoto 105, sem backfill. Sem edição de cadastro real, assinatura, envio ou reemissão de documento real neste release.
