"use client";

export interface TutorIdentificacao {
  identificacao_pendente: boolean;
  origem_cadastro: string;
  identificacao_observacoes: string;
}

export default function TutorIdentificacaoFields({ value, onChange }: {
  value: TutorIdentificacao;
  onChange: (value: TutorIdentificacao) => void;
}) {
  return (
    <fieldset className="col-span-full space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <legend className="px-1 font-medium text-slate-800">Identificação do tutor</legend>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={value.identificacao_pendente}
          onChange={(event) => onChange({ ...value, identificacao_pendente: event.target.checked })} />
        Identificação pendente
      </label>
      <p className="text-sm text-slate-600">Pode agendar com os dados disponíveis. Desmarque somente após confirmar a identidade da pessoa. Nomes iguais podem pertencer a pessoas diferentes.</p>
      <label className="block text-sm">Origem do cadastro / clínica informante
        <input className="mt-1 w-full rounded-lg border bg-white p-2" value={value.origem_cadastro}
          onChange={(event) => onChange({ ...value, origem_cadastro: event.target.value })}
          placeholder="Ex.: Clínica Alfa" />
      </label>
      <label className="block text-sm">O que falta confirmar / observações da identificação
        <textarea className="mt-1 w-full rounded-lg border bg-white p-2" value={value.identificacao_observacoes}
          onChange={(event) => onChange({ ...value, identificacao_observacoes: event.target.value })}
          placeholder="Ex.: confirmar sobrenome e contato com a clínica" rows={2} />
      </label>
    </fieldset>
  );
}
