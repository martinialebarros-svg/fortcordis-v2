export function normalizarSexoPaciente(sexo?: string | null): string {
  const texto = String(sexo || "").trim();
  if (!texto) return "";

  const normalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (normalizado.startsWith("f")) return "Fêmea";
  if (normalizado.startsWith("m")) return "Macho";
  return texto;
}

function calcularIdadePorNascimento(dataNascimento?: string | null): string {
  const texto = String(dataNascimento || "").trim();
  if (!texto) return "";

  const nascimento = new Date(texto);
  if (Number.isNaN(nascimento.getTime())) {
    return texto;
  }

  const hoje = new Date();
  let meses = (hoje.getFullYear() - nascimento.getFullYear()) * 12;
  meses += hoje.getMonth() - nascimento.getMonth();

  if (meses < 12) {
    return `${meses}m`;
  }

  const anos = Math.floor(meses / 12);
  const mesesRestantes = meses % 12;
  return mesesRestantes > 0 ? `${anos}a ${mesesRestantes}m` : `${anos}a`;
}

export function extrairIdadePaciente(source: {
  idade?: string | null;
  data_nascimento?: string | null;
  observacoes?: string | null;
}): string {
  const idadeDireta = String(source.idade || "").trim();
  if (idadeDireta) {
    return idadeDireta;
  }

  const idadePorNascimento = calcularIdadePorNascimento(source.data_nascimento);
  if (idadePorNascimento) {
    return idadePorNascimento;
  }

  const match = /(?:^|\n)Idade:\s*(.+?)(?:\n|$)/i.exec(String(source.observacoes || ""));
  return match ? match[1].trim() : "";
}
