// Contraprova: o MESMO cenario, mas chamando executarSaveAtendimento diretamente
// (comportamento ANTES do commit 2772e9f3), sem o wrapper saveAtendimento/
// salvamentoAtendimentoEmVooRef. Deve reproduzir o bug: 2 requisicoes simultaneas
// em voo, e a mais antiga (autosave) pode vencer a mais nova (manual) se demorar
// mais no servidor - perda silenciosa do dado mais recente.

let formRef = { current: "" };
const chamadasConcluidas = [];
let requisicoesEmVooSimultaneas = 0;
let maxRequisicoesSimultaneas = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executarSaveAtendimento(mode) {
  const payloadNoMomentoDoEnvio = formRef.current;
  requisicoesEmVooSimultaneas += 1;
  maxRequisicoesSimultaneas = Math.max(maxRequisicoesSimultaneas, requisicoesEmVooSimultaneas);
  await delay(mode === "autosave" ? 300 : 30);
  requisicoesEmVooSimultaneas -= 1;
  const resultado = { mode, payloadPersistido: payloadNoMomentoDoEnvio, t: Date.now() };
  chamadasConcluidas.push(resultado);
  return resultado;
}

async function main() {
  formRef.current = "F1 (autosave, mais antigo)";
  const chamadaAutosave = executarSaveAtendimento("autosave"); // SEM wrapper/guard

  await delay(10);
  formRef.current = "F2 (manual, mais novo)";
  const chamadaManual = executarSaveAtendimento("manual"); // SEM wrapper/guard

  await Promise.all([chamadaAutosave, chamadaManual]);

  console.log("--- ordem de resolucao (quem grava por ultimo no banco) ---");
  chamadasConcluidas.forEach((c) => console.log(`  ${c.mode.padEnd(10)} payload="${c.payloadPersistido}"`));
  console.log(`\nmax de requisicoes simultaneas em voo: ${maxRequisicoesSimultaneas}`);

  const ultimoAResolver = chamadasConcluidas[chamadasConcluidas.length - 1];
  console.log(`Ultimo a resolver (o que fica gravado no banco): ${ultimoAResolver.mode} -> "${ultimoAResolver.payloadPersistido}"`);

  if (maxRequisicoesSimultaneas > 1 && ultimoAResolver.payloadPersistido !== "F2 (manual, mais novo)") {
    console.log("\nBUG REPRODUZIDO: o autosave (dado antigo, F1) resolveu DEPOIS do manual (F2) e sobrescreveu o dado mais novo.");
    console.log("Isto e exatamente o que o wrapper saveAtendimento (commit 2772e9f3) impede.");
  } else {
    console.log("\n(neste run em particular o bug nao se manifestou - depende de timing; rode de novo ou ajuste os delays)");
  }
}

main();
