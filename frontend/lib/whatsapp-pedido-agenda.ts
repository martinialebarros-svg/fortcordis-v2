export interface PedidoAgenda {
  pedido_id: number;
  versao: number;
  clinica_id: number;
  resumo: string;
  paciente: { id: number; nome: string; tutor_id: number; tutor: string } | null;
  tutor: { id: number; nome: string } | null;
  servico_id: number | null;
  avisos: string[];
}

export function camposPedidoAgenda(pedido: PedidoAgenda) {
  return {
    clinica_id: String(pedido.clinica_id),
    paciente_id: pedido.paciente ? String(pedido.paciente.id) : "",
    tutor_id: pedido.tutor ? String(pedido.tutor.id) : "",
    servico_id: pedido.servico_id ? String(pedido.servico_id) : "",
    hora: "", // preferencia em texto nao define disponibilidade
    observacoes: `Pedido WhatsApp #${pedido.pedido_id}\n${pedido.resumo}`,
  };
}
