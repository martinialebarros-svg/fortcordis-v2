// Reproduz EXATAMENTE o wrapper de frontend/app/atendimento/page.tsx (saveAtendimento
// em torno de executarSaveAtendimento, via salvamentoAtendimentoEmVooRef) fora do
// React/DOM, para provar deterministicamente a propriedade de seguranca contra
// corrida entre autosave e save manual (achado #6), sem depender do navegador.
//
// Cenario adversarial reproduzido: uma chamada A (simulando o autosave) comeca a
// executar sua chamada de rede (assincrona, demorada); ANTES dela terminar, uma
// chamada B (simulando o clique manual) e disparada com dados mais novos. Sem o
// guard, B dispararia sua propria requisicao em paralelo com A, e se A resolvesse
// DEPOIS de B no servidor, os dados mais antigos de A venceriam - perda silenciosa.

let emVooRef = { current: null };
let formRef = { current: "" }; // equivalente a formRef.current no componente real
const chamadasIniciadas = [];
const chamadasConcluidas = [];
let requisicoesEmVooSimultaneas = 0;
let maxRequisicoesSimultaneas = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Equivalente a executarSaveAtendimento: le formRef.current no momento em que
// EXECUTA de fato (nao no momento em que foi originalmente chamada).
async function executarSaveAtendimento(mode) {
  const payloadNoMomentoDoEnvio = formRef.current;
  requisicoesEmVooSimultaneas += 1;
  maxRequisicoesSimultaneas = Math.max(maxRequisicoesSimultaneas, requisicoesEmVooSimultaneas);
  chamadasIniciadas.push({ mode, payload: payloadNoMomentoDoEnvio, t: Date.now() });

  // Simula latencia de rede/servidor - a chamada "autosave" e deliberadamente
  // mais lenta, para reproduzir o pior caso: requisicao mais antiga demorando
  // mais que a mais nova.
  await delay(mode === "autosave" ? 300 : 30);

  requisicoesEmVooSimultaneas -= 1;
  const resultado = { mode, payloadPersistido: payloadNoMomentoDoEnvio };
  chamadasConcluidas.push({ ...resultado, t: Date.now() });
  return resultado;
}

// Copia exata do wrapper introduzido no commit 2772e9f3 (page.tsx).
async function saveAtendimento(mode) {
  const emVoo = emVooRef.current;
  if (emVoo) {
    await emVoo.catch(() => null);
    return saveAtendimento(mode);
  }
  const promise = executarSaveAtendimento(mode);
  emVooRef.current = promise;
  try {
    return await promise;
  } finally {
    if (emVooRef.current === promise) {
      emVooRef.current = null;
    }
  }
}

async function main() {
  // t=0: edicao "F1", autosave dispara (assincrono, mais lento).
  formRef.current = "F1 (autosave, mais antigo)";
  const chamadaAutosave = saveAtendimento("autosave");

  // t=10ms: ENQUANTO o autosave ainda esta em voo, o usuario edita de novo e
  // clica em salvar manualmente com dados MAIS NOVOS.
  await delay(10);
  formRef.current = "F2 (manual, mais novo)";
  const chamadaManual = saveAtendimento("manual");

  const [resultadoAutosave, resultadoManual] = await Promise.all([chamadaAutosave, chamadaManual]);

  console.log("--- chamadas iniciadas (ordem de disparo real da 'rede') ---");
  chamadasIniciadas.forEach((c) => console.log(`  ${c.mode.padEnd(10)} payload="${c.payload}"`));
  console.log("--- chamadas concluidas (ordem de resolucao) ---");
  chamadasConcluidas.forEach((c) => console.log(`  ${c.mode.padEnd(10)} payload persistido="${c.payloadPersistido}"`));
  console.log(`\nmax de requisicoes de rede simultaneamente em voo: ${maxRequisicoesSimultaneas}`);
  console.log(`ultimo payload efetivamente persistido: "${chamadasConcluidas[chamadasConcluidas.length - 1].payloadPersistido}"`);

  const nuncaSobrepoe = maxRequisicoesSimultaneas <= 1;
  const ultimoPersistidoEhOMaisNovo = chamadasConcluidas[chamadasConcluidas.length - 1].payloadPersistido === "F2 (manual, mais novo)";
  const apenasDuasChamadasDeRedeReais = chamadasIniciadas.length === 2;

  console.log("\n=== VEREDITO ===");
  console.log(`Nunca houve 2 requisicoes de rede simultaneas em voo: ${nuncaSobrepoe ? "PASSOU" : "FALHOU"}`);
  console.log(`O ultimo dado persistido e o mais recente (F2), nao o mais antigo (F1): ${ultimoPersistidoEhOMaisNovo ? "PASSOU" : "FALHOU"}`);
  console.log(`Exatamente 2 chamadas de rede reais disparadas (nenhuma duplicada silenciosa): ${apenasDuasChamadasDeRedeReais ? "PASSOU" : "FALHOU"}`);

  if (!nuncaSobrepoe || !ultimoPersistidoEhOMaisNovo || !apenasDuasChamadasDeRedeReais) {
    process.exit(1);
  }
  console.log("\nTODOS OS CRITERIOS PASSARAM.");
}

main();
