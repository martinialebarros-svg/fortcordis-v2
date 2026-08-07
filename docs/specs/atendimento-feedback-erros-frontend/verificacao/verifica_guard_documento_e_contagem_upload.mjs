// Prova deterministica de 2 dos mecanismos do pacote de itens de media
// severidade, reproduzindo a logica exata fora do DOM/React.

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Achado #19: guard sincrono de reentrancia em salvarDocumentoClinico /
// criarDocumentoClinicoDeTemplate. Cenario: duplo clique antes do primeiro
// await resolver (obterAtendimentoIdParaDocumento pode disparar um
// saveAtendimento("manual") inteiro).
// ---------------------------------------------------------------------------
async function testeGuardDocumento() {
  const emVooRef = { current: false };
  let chamadasQueExecutaram = 0;
  let chamadasBloqueadas = 0;

  async function obterAtendimentoIdParaDocumento() {
    await delay(50); // simula o saveAtendimento("manual") completo
    return 42;
  }

  // Copia exata da estrutura introduzida no commit desta correcao.
  async function salvarDocumentoClinico() {
    if (emVooRef.current) {
      chamadasBloqueadas += 1;
      return null;
    }
    emVooRef.current = true;
    try {
      const atendimentoId = await obterAtendimentoIdParaDocumento();
      chamadasQueExecutaram += 1;
      return atendimentoId;
    } finally {
      emVooRef.current = false;
    }
  }

  // Duplo clique: duas chamadas disparadas na mesma sincronia, antes de
  // qualquer await resolver.
  const [r1, r2] = await Promise.all([salvarDocumentoClinico(), salvarDocumentoClinico()]);

  console.log("=== Achado #19: guard de reentrancia de documento ===");
  console.log(`Chamadas que executaram de fato: ${chamadasQueExecutaram}`);
  console.log(`Chamadas bloqueadas pelo guard: ${chamadasBloqueadas}`);

  const passou = chamadasQueExecutaram === 1 && chamadasBloqueadas === 1;
  console.log(`Resultado: ${passou ? "PASSOU" : "FALHOU"} (duplo clique deve criar UM documento, nao dois)`);
  return passou;
}

// ---------------------------------------------------------------------------
// Achado #29: aritmetica de "quantos arquivos do lote nao foram tentados"
// apos uma falha no meio do upload sequencial.
// ---------------------------------------------------------------------------
function calcularNaoTentados(totalArquivos, enviados) {
  return totalArquivos - enviados - 1;
}

function testeContagemUpload() {
  console.log("\n=== Achado #29: aritmetica de arquivos nao tentados ===");
  const casos = [
    { nome: "5 arquivos, 2o falha (1 enviado antes)", total: 5, enviados: 1, esperado: 3 },
    { nome: "1 arquivo, falha imediata (nada enviado)", total: 1, enviados: 0, esperado: 0 },
    { nome: "3 arquivos, todos enviados (sem falha)", total: 3, enviados: 3, esperado: -1 }, // negativo -> if (>0) nao dispara
    { nome: "2 arquivos, 1o falha (nada enviado)", total: 2, enviados: 0, esperado: 1 },
  ];

  let todosPassaram = true;
  for (const caso of casos) {
    const resultado = calcularNaoTentados(caso.total, caso.enviados);
    const dispararia = resultado > 0;
    const ok = resultado === caso.esperado;
    todosPassaram = todosPassaram && ok;
    console.log(
      `  ${caso.nome}: calculado=${resultado} esperado=${caso.esperado} ` +
        `(${dispararia ? "mostraria aviso" : "sem aviso extra"}) -> ${ok ? "PASSOU" : "FALHOU"}`
    );
  }
  return todosPassaram;
}

async function main() {
  const r1 = await testeGuardDocumento();
  const r2 = testeContagemUpload();
  console.log(`\n=== VEREDITO FINAL: ${r1 && r2 ? "TODOS PASSARAM" : "HOUVE FALHA"} ===`);
  if (!r1 || !r2) process.exit(1);
}

main();
