"use client";

import { useState } from "react";
import { requestMapsConfirmation, type MapsQuote } from "@/lib/google-maps-control";

const example: MapsQuote = {
  operation_mode: "paid_budget", budget_policy: "agenda_monitor", financial_limit_enforced: false, required: true, blocked: false,
  action: "SIMULAÇÃO — agendar com uma nova consulta de rota", service: "Google Maps Platform",
  services: ["routes_essentials"], max_calls: 4, estimated_cost_min_brl: 0, estimated_cost_max_brl: 0.24,
  limits: { action: { calls: 4, estimated_brl: 1 }, day: { calls: 20, estimated_brl: 5 }, month: { calls: 100, estimated_brl: 20 } },
  consumption: { day: { calls: 2, estimated_brl: 0.12 }, month: { calls: 8, estimated_brl: 0.48 } },
  remaining: { day: { calls: 18, estimated_brl: 4.88 }, month: { calls: 92, estimated_brl: 19.52 } },
  uncertainty: ["SIMULAÇÃO: todos os números são exemplos para demonstração, sem vínculo com faturamento ou limites de produção. Confirmar aqui não envia consultas nem cria agendamento."],
};

export default function GoogleMapsControlDemo() {
  const [result, setResult] = useState("");
  const [waiting, setWaiting] = useState(false);
  const simulate = async (overReference = false) => {
    setWaiting(true);
    try {
      const confirmed = await requestMapsConfirmation(overReference ? { ...example, consumption: { day: { calls: 22, estimated_brl: 5.2 }, month: { calls: 110, estimated_brl: 21 } }, remaining: { day: { calls: 0, estimated_brl: 0 }, month: { calls: 0, estimated_brl: 0 } }, alerts: ["Referência atingida: a Agenda continua liberada; lotes e extras ficam bloqueados."] } : example);
      setResult(confirmed
        ? "Simulação confirmada: uma única execução poderia consultar até 4 unidades, inclusive acima da referência diária/mensal. Lotes e extras ficam sujeitos ao teto rígido. Nesta demonstração: 0 consultas e 0 agendamentos."
        : "Simulação cancelada: 0 consultas pagas; os dados do formulário continuam preenchidos.");
    } finally { setWaiting(false); }
  };
  return <section aria-labelledby="maps-demo-title" className="space-y-3 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-950">
    <h3 id="maps-demo-title" className="font-semibold">Experimentar o controle sem gerar custo</h3>
    <p>Demonstração com valores fictícios. Os botões abaixo não consultam Google, não salvam orçamento e não criam agendamentos.</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={waiting} onClick={() => setResult("Rota válida no cache: o agendamento passa pela validação normal, sem popup, token ou nova consulta paga.")} className="rounded-lg border border-teal-300 bg-white px-3 py-2">Rota já armazenada</button>
      <button type="button" disabled={waiting} onClick={() => void simulate()} className="rounded-lg border border-teal-300 bg-white px-3 py-2">Nova consulta de rota</button>
      <button type="button" disabled={waiting} onClick={() => void simulate(true)} className="rounded-lg border border-teal-300 bg-white px-3 py-2">Referência atingida — Agenda liberada</button>
    </div>
    {result && <p role="status" className="rounded-lg bg-white p-3">{result}</p>}
    <p>Política escolhida: Agenda liberada com alertas de custo; teto rígido somente para lotes e extras. Valores reais e reativação em produção ainda dependem de revisão e autorização.</p>
  </section>;
}
