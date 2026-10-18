import { findEchoNarrativeDiscrepancies } from "@/lib/echo-narrative-consistency";

type Props = {
  measurements: Record<string, string>;
  qualitative: object;
  conclusion: string;
};

export default function EchoNarrativeConsistencyNotice({ measurements, qualitative, conclusion }: Props) {
  const discrepancies = findEchoNarrativeDiscrepancies(measurements, qualitative, conclusion);
  if (!discrepancies.length) return null;
  return (
    <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Confira números citados no texto antes de emitir o PDF</strong>
      <ul className="mt-1 list-disc space-y-1 pl-5">
        {discrepancies.map((item) => <li key={item.key}>{item.message}</li>)}
      </ul>
      <p className="mt-2 text-xs">Aviso de conferência. A interpretação e o salvamento permanecem sob sua decisão.</p>
    </div>
  );
}
