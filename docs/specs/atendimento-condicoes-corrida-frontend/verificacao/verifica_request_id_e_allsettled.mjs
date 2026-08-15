// Prova deterministica dos outros 2 padroes do commit 2772e9f3, reproduzindo a
// estrutura exata do codigo (page.tsx) fora do DOM/React.

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// CA-001/CA-002: guard de requestId (carregarHistoricoPaciente, carregarCadastroComplementar,
// abrirAtendimento). Cenario: usuario troca de paciente A -> B rapidamente; a
// resposta de A, mais lenta, chega DEPOIS da resposta de B, mais rapida.
// ---------------------------------------------------------------------------
async function testeRequestId() {
  const requestIdRef = { current: 0 };
  let estadoAplicado = null;
  const aplicacoes = [];

  async function carregar(pacienteId, latenciaMs) {
    const requestId = ++requestIdRef.current;
    await delay(latenciaMs); // simula o fetch
    if (requestId !== requestIdRef.current) {
      aplicacoes.push({ pacienteId, aplicado: false });
      return; // resposta obsoleta descartada - exatamente o guard do commit
    }
    estadoAplicado = pacienteId;
    aplicacoes.push({ pacienteId, aplicado: true });
  }

  // Paciente A selecionado primeiro, mas sua resposta demora mais (300ms).
  const chamadaA = carregar("paciente-A", 300);
  // 10ms depois, usuario troca para paciente B (resposta rapida, 20ms).
  await delay(10);
  const chamadaB = carregar("paciente-B", 20);

  await Promise.all([chamadaA, chamadaB]);

  console.log("=== CA-001/CA-002: guard de requestId ===");
  aplicacoes.forEach((a) => console.log(`  ${a.pacienteId}: ${a.aplicado ? "APLICADO" : "descartado (fora de ordem)"}`));
  console.log(`Estado final aplicado: ${estadoAplicado}`);

  const passou = estadoAplicado === "paciente-B" && aplicacoes.find((a) => a.pacienteId === "paciente-A").aplicado === false;
  console.log(`Resultado: ${passou ? "PASSOU" : "FALHOU"} (o paciente mais recente selecionado, B, deve prevalecer; a resposta antiga de A, que chegou depois, deve ser descartada)`);
  return passou;
}

// ---------------------------------------------------------------------------
// CA-004: Promise.allSettled em vez de Promise.all em carregarBase. Cenario:
// 1 dos 5 recursos falha; os outros 4 devem ser aplicados normalmente.
// ---------------------------------------------------------------------------
async function testeAllSettled() {
  const recursos = [
    { nome: "pacientes", ok: true },
    { nome: "clinicas", ok: true },
    { nome: "medicamentos", ok: true },
    { nome: "catalogo_exames", ok: true },
    { nome: "frases_clinicas", ok: false }, // este falha
  ];

  async function fetchRecurso(r) {
    await delay(5);
    if (!r.ok) throw new Error(`${r.nome} indisponivel`);
    return r.nome;
  }

  const resultados = await Promise.allSettled(recursos.map(fetchRecurso));

  const aplicados = [];
  const comFalha = [];
  resultados.forEach((resultado, i) => {
    if (resultado.status === "fulfilled") {
      aplicados.push(recursos[i].nome); // equivalente a setPacientes/setClinicas/...
    } else {
      comFalha.push(recursos[i].nome); // equivalente a listar no erro parcial
    }
  });

  console.log("\n=== CA-004: Promise.allSettled no boot ===");
  console.log(`Recursos aplicados com sucesso: ${aplicados.join(", ")}`);
  console.log(`Recursos com falha (nao travam os demais): ${comFalha.join(", ")}`);

  const passou = aplicados.length === 4 && comFalha.length === 1 && comFalha[0] === "frases_clinicas";
  console.log(`Resultado: ${passou ? "PASSOU" : "FALHOU"} (4 recursos essenciais aplicados apesar de 1 falha secundaria)`);
  return passou;
}

async function main() {
  const r1 = await testeRequestId();
  const r2 = await testeAllSettled();
  console.log(`\n=== VEREDITO FINAL: ${r1 && r2 ? "TODOS PASSARAM" : "HOUVE FALHA"} ===`);
  if (!r1 || !r2) process.exit(1);
}

main();
