import { describe, expect, it } from "vitest";
import { escolherMimeGravacao, podeIncorporarCampo, validarArquivosAssistente, type AssistenteIAResultado } from "./atendimento-assistente-ia";

describe("assistência IA do atendimento", () => {
  it("escolhe MP4 para navegadores que não suportam WebM", () => {
    expect(escolherMimeGravacao((mime) => mime === "audio/mp4")).toBe("audio/mp4");
    expect(escolherMimeGravacao(() => false)).toBeUndefined();
  });
  it("bloqueia arquivos incompatíveis, vazios ou em quantidade excessiva", () => {
    expect(validarArquivosAssistente([new File(["ok"], "exame.pdf")])).toBeNull();
    expect(validarArquivosAssistente([new File(["ok"], "exame.html")])).toContain("PDF");
    expect(validarArquivosAssistente([new File([], "exame.pdf")])).toContain("conteúdo");
    expect(validarArquivosAssistente(Array.from({ length: 6 }, () => new File(["ok"], "exame.pdf")))).toContain("cinco");
  });
  it("rejeita lote acima do limite somado mesmo que cada arquivo seja permitido", () => {
    const files = [new File(["123456"], "a.pdf"), new File(["123456"], "b.pdf")];
    expect(validarArquivosAssistente(files, { arquivos: 5, arquivo_bytes: 10, total_arquivos_bytes: 10, audio_bytes: 100, transcricao_chars: 100 })).toContain("conjunto");
  });
  it("exige fonte, evidência, revisão e campo permitido, mesmo para resposta inesperada", () => {
    const resultado = { bloqueado_integracao: false, revisao_obrigatoria: true } as AssistenteIAResultado;
    const campo = { campo: "anamnese" as const, texto: "Relato", fonte: "transcricao", evidencia: "relato original" };
    expect(podeIncorporarCampo(resultado, campo)).toBe(true);
    expect(podeIncorporarCampo({ ...resultado, bloqueado_integracao: true }, campo)).toBe(false);
    expect(podeIncorporarCampo(resultado, { ...campo, evidencia: "" })).toBe(false);
    expect(podeIncorporarCampo(resultado, { ...campo, campo: "plano_terapeutico" })).toBe(false);
  });
});
