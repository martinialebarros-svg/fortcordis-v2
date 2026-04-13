"use client";

import { ChevronDown, ChevronRight, Thermometer } from "lucide-react";
import type { LooseAtendimentoComponentProps } from "./component-props";

type AtendimentoTriagemSectionProps = LooseAtendimentoComponentProps;

export default function AtendimentoTriagemSection(props: AtendimentoTriagemSectionProps) {
  const { ESCALA_ECC, form, HIDRATACAO, MUCOSAS, setField, setTriagemExpandida, triagemExpandida } = props;

  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Thermometer className="h-4 w-4 text-blue-600" />
          Triagem - Sinais Vitais
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTriagemExpandida((prev: boolean) => !prev)}
            className="rounded-xl bg-slate-100 px-3 py-2 text-slate-700 hover:bg-slate-200"
          >
            {triagemExpandida ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.triagem_concluida === 1}
              onChange={(e) => setField("triagem_concluida", e.target.checked ? 1 : 0)}
              className="h-4 w-4"
            />
            Triagem Concluida
          </label>
        </div>
      </div>
      {triagemExpandida ? (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-gray-600">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.triagem.peso ?? ""}
                onChange={(e) => setField("triagem", { ...form.triagem, peso: e.target.value ? Number(e.target.value) : null })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Temperatura (°C)</label>
              <input
                type="number"
                step="0.1"
                value={form.triagem.temperatura ?? ""}
                onChange={(e) =>
                  setField("triagem", { ...form.triagem, temperatura: e.target.value ? Number(e.target.value) : null })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">FC (bpm)</label>
              <input
                type="number"
                value={form.triagem.frequencia_cardiaca ?? ""}
                onChange={(e) =>
                  setField("triagem", {
                    ...form.triagem,
                    frequencia_cardiaca: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Batimentos"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">FR (mpm)</label>
              <input
                type="number"
                value={form.triagem.frequencia_respiratoria ?? ""}
                onChange={(e) =>
                  setField("triagem", {
                    ...form.triagem,
                    frequencia_respiratoria: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Movimentos"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Pressao Arterial</label>
              <input
                value={form.triagem.pressao_arterial}
                onChange={(e) => setField("triagem", { ...form.triagem, pressao_arterial: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="mmHg"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">SpO2 (%)</label>
              <input
                type="number"
                value={form.triagem.saturacao_oxigenio ?? ""}
                onChange={(e) =>
                  setField("triagem", {
                    ...form.triagem,
                    saturacao_oxigenio: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="%"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Escore Condicao Corporal</label>
              <select
                value={form.triagem.escore_condicion_corpo ?? ""}
                onChange={(e) =>
                  setField("triagem", {
                    ...form.triagem,
                    escore_condicion_corpo: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {ESCALA_ECC.map((value: number) => (
                  <option key={value} value={value}>
                    {value} - {value <= 3 ? "Magro" : value <= 5 ? "Ideal" : "Obeso"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Mucosas</label>
              <select
                value={form.triagem.mucosas}
                onChange={(e) => setField("triagem", { ...form.triagem, mucosas: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {MUCOSAS.map((item: string) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Hidratacao</label>
              <select
                value={form.triagem.hidratacao}
                onChange={(e) => setField("triagem", { ...form.triagem, hidratacao: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {HIDRATACAO.map((item: string) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-600">Observacoes da Triagem</label>
            <textarea
              value={form.triagem.triagem_observacoes}
              onChange={(e) => setField("triagem", { ...form.triagem, triagem_observacoes: e.target.value })}
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Observacoes adicionais da triagem..."
            />
          </div>
        </>
      ) : (
        <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Peso {form.triagem.peso ?? "-"} kg · FC {form.triagem.frequencia_cardiaca ?? "-"} bpm · FR{" "}
          {form.triagem.frequencia_respiratoria ?? "-"} mpm · PA {form.triagem.pressao_arterial || "-"}
        </div>
      )}
    </section>
  );
}
