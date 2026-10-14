"use client";

import type { ReactNode } from "react";
import { canonicalFelineDiastolicKey } from "@/lib/echo-feline-diastolic-reference";

type Props = {
  especie?: string;
  medidas: Record<string, string>;
  onMedidaChange: (key: string, value: string) => void;
};
const FLOW_KEYS = new Set(["Onda_E", "Onda_A", "E_A", "TD", "TRIV", "E_TRIV", "E_E_linha"]);
const TISSUE_KEYS = new Set(["e_doppler", "a_doppler", "doppler_tecidual_relacao", "E_E_linha"]);

export function FelineDiastolicProtocol({ especie, medidas, onMedidaChange }: Props) {
  if (!/^felin/i.test(especie ?? "")) return null;
  const present = Object.entries(medidas).filter(([, value]) => {
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) && number > 0;
  }).map(([key]) => canonicalFelineDiastolicKey(key));
  const hasFlow = present.some((key) => FLOW_KEYS.has(key));
  const hasTissue = present.some((key) => TISSUE_KEYS.has(key));
  if (!hasFlow && !hasTissue) return null;
  const select = (key: string, label: string, children: ReactNode) => (
    <div className="min-w-0">
      <label htmlFor={`feline-${key}`} className="mb-1 block text-sm font-medium text-blue-900">{label}</label>
      <select id={`feline-${key}`} value={medidas[key] || ""}
        onChange={(event) => onMedidaChange(key, event.target.value)}
        className="w-full rounded border border-blue-200 bg-white p-2 text-sm text-gray-900">
        {children}
      </select>
    </div>
  );
  return <section className="rounded-lg bg-blue-50 p-3 space-y-3 text-left" aria-label="Protocolo diastólico felino">
    <p className="text-sm font-medium text-blue-900">Protocolo diastólico felino</p>
    {hasFlow && <div className="grid gap-3 sm:grid-cols-2">
      {select("Diastolica_metodo", "Aquisição transmitral e TRIV", <>
        <option value="">Protocolo não confirmado</option>
        <option value="felino_adulto_nao_sedado_pw_clique_aortico">Adulto, não sedado; TRIV pelo clique aórtico</option>
        <option value="felino_adulto_nao_sedado_pw_fim_fluxo">Adulto, não sedado; TRIV pelo fim do fluxo aórtico</option>
        <option value="outro">Outro protocolo</option>
      </>)}
      {select("Diastolica_ondas", "Ondas transmitrais E/A", <>
        <option value="">Separação não confirmada</option>
        <option value="separadas">Separadas e mensuráveis</option>
        <option value="fundidas">Fundidas</option>
      </>)}
    </div>}
    {hasTissue && <div className="grid gap-3 sm:grid-cols-2">
      {select("TDI_metodo", "Técnica e sítio do Doppler tecidual", <>
        <option value="">Técnica e sítio não confirmados</option>
        <option value="felino_pw_anel_lateral">Doppler pulsado; anel mitral lateral</option>
        <option value="felino_pw_anel_septal">Doppler pulsado; anel mitral septal</option>
        <option value="outro">Outra técnica ou sítio</option>
      </>)}
      {select("TDI_ondas", "Ondas teciduais e'/a'", <>
        <option value="">Separação não confirmada</option>
        <option value="separadas">Separadas e mensuráveis</option>
        <option value="fundidas">Fundidas</option>
      </>)}
    </div>}
    <p className="text-xs text-blue-800">Transmitral: Doppler pulsado nas pontas dos folhetos mitrais. TRIV: registro simultâneo de entrada e saída do VE; confirme clique de fechamento ou fim do fluxo aórtico. A fusão E/A e a fusão e&apos;/a&apos; são confirmações independentes.</p>
    <p className="text-xs text-blue-800">a&apos; representa a velocidade anular tardia associada à contração atrial; confirme o mesmo sítio e técnica de e&apos;. Um valor isolado não define disfunção diastólica; limiares de e&apos; não se aplicam automaticamente a a&apos;.</p>
    <p className="text-xs text-blue-800">Os estudos são apresentados como média ± DP, sem classificação automática. Para o anel lateral, Kiatsilapanan e Surachetpong (2020) descrevem 20 gatos saudáveis, não sedados, com ondas separadas. Para o septal, Ward (2012) descreve apenas 7 gatos saudáveis de 1–3 anos, antes da sedação; confirme a pertinência ao paciente.</p>
  </section>;
}
