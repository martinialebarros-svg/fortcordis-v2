import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NovoLaudoPage from "./novo/page";
import EditarLaudoPage from "./[id]/editar/page";
import {
  criarEcocardiogramaEstruturadoInicial,
  extrairQualitativaEcoDaDescricao,
  montarDescricaoEcocardiograma,
  type EcocardiogramaEstruturadoPersistido,
} from "@/lib/ecocardiograma-estruturado";
import { parseStoredEchoMeasurements } from "@/lib/echo-derived-measurements";

const mocks = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(),
  router: { push: vi.fn(), replace: vi.fn() },
  imported: {} as Record<string, string>,
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "905" }), useRouter: () => mocks.router }));
vi.mock("@/app/layout-dashboard", () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/axios", () => ({ default: { get: mocks.get, post: mocks.post, put: mocks.put } }));
vi.mock("@/lib/clinicas", () => ({ listarTodasClinicas: vi.fn(async () => []) }));
vi.mock("@/app/laudos/components/EchoVoiceAssistant", () => ({ default: ({ currentMeasurements }: { currentMeasurements: Record<string, string> }) =>
  <output data-testid="narrative-page-measurements">{JSON.stringify(currentMeasurements)}</output> }));
vi.mock("@/app/laudos/components/EcoStudyImportUploader", () => ({ default: ({ onDadosImportados }: { onDadosImportados: (data: unknown) => void }) =>
  <button onClick={() => onDadosImportados({ paciente: {}, medidas: mocks.imported })}>Importar estudo sintético</button> }));
vi.mock("@/app/laudos/components/XmlUploader", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/ImageHeaderUploader", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/ImageUploader", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/ImagePreviewModal", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/EcocardiogramaEstruturadoBiblioteca", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/EchoUnitReview", () => ({ default: () => null }));
vi.mock("@/app/laudos/components/ReferenciaComparison", () => ({ ReferenciaComparison: () => null }));
// Preserve the real page selection/save logic and the real consistency engine/notice.
// The editor substitute only provides a deterministic user edit of its public value.
vi.mock("@/app/laudos/components/EcocardiogramaEstruturadoEditor", () => ({ default: ({ value, onChange }: {
  value: EcocardiogramaEstruturadoPersistido;
  onChange: (next: EcocardiogramaEstruturadoPersistido) => void;
}) => <><textarea aria-label="Texto diastólico sintético" value={value.textos.funcao_diastolica || ""}
  onChange={(event) => onChange({ ...value, usar_no_laudo: true,
    textos: { ...value.textos, funcao_diastolica: event.target.value } })} />
  <button onClick={() => onChange({ ...value, usar_no_laudo: false, textos: { ...value.textos,
    funcao_diastolica: "Função diastólica preservada, com padrão de enchimento adequado ao Doppler transmitral." } })}>
    Preparar rascunho conflitante sem aplicar
  </button>
  <button onClick={() => onChange({ ...value, usar_no_laudo: false, textos: { ...value.textos,
    funcao_diastolica: "Ondas E/A fundidas; a avaliação diastólica considera os demais parâmetros disponíveis." } })}>
    Preparar rascunho compatível sem aplicar
  </button></> }));

type Mode = "novo" | "editar";
const MODES: Mode[] = ["novo", "editar"];
const CONFLICT = "Função diastólica preservada, com padrão de enchimento adequado ao Doppler transmitral.";
const REVIEWED = "Ondas E/A fundidas; a avaliação diastólica considera os demais parâmetros disponíveis.";
const CONCLUSION = "Interpretação clínica integrada preservada para revisão do médico veterinário.";
const PANEL = "Conferência de coerência do laudo";
const MEASURES = { Onda_E: "1.08", Onda_A: "0.95", E_A: "1.14", TD: "51", TRIV: "40",
  e_doppler: "0.16", a_doppler: "0.06", E_E_linha: "6.95", doppler_tecidual_relacao: "2.60" };
let patient: Record<string, unknown>;
let stored: Record<string, string>;
let description: string;
let savedStructured: EcocardiogramaEstruturadoPersistido | undefined;

const qualitative = (text: string) => ({ valvas: "", camaras: "", funcao: text, pericardio: "", vasos: "", ad_vd: "" });
const live = (): Record<string, string> => JSON.parse(screen.getByTestId("narrative-page-measurements").textContent || "{}");
const panel = () => screen.queryByRole("status", { name: PANEL });

async function editNarrative(text: string) {
  fireEvent.click(screen.getByRole("button", { name: "Qualitativa" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Texto diastólico sintético" }), { target: { value: text } });
}

async function openPage(mode: Mode, options: { species?: string; flow?: string; tissue?: string; official?: string; draft?: string } = {}) {
  const { species = "Gato", flow = "separadas", tissue = "separadas", official = CONFLICT, draft } = options;
  patient = { id: 901, nome: "QA COERÊNCIA FELINA", especie: species, tutor: "QA TUTOR", tutor_id: 902,
    peso_kg: 5.6, sexo: "Macho", raca: "SRD", idade: "4 anos" };
  stored = { ...MEASURES, Diastolica_ondas: flow, TDI_ondas: tissue };
  description = montarDescricaoEcocardiograma(stored, qualitative(official));
  savedStructured = draft === undefined ? undefined : { ...criarEcocardiogramaEstruturadoInicial(),
    usar_no_laudo: true, textos: { funcao_diastolica: draft, conclusao: "Conclusão do rascunho ainda não aplicada." } };
  mocks.get.mockImplementation(async (url: string) => {
    if (url === "/pacientes/901") return { data: patient };
    if (url === "/laudos/905") return { data: { id: 905, tipo: "ecocardiograma", paciente_id: 901, paciente: patient,
      titulo: "QA COERÊNCIA", diagnostico: CONCLUSION, observacoes: "Observação preservada.",
      data_exame: "2026-10-15", status: "Rascunho", medidas: stored, descricao: description,
      ecocardiograma_estruturado: savedStructured, imagens: [] } };
    if (url === "/portal/parceiros/veterinarios/opcoes") return { data: { items: [] } };
    throw new Error(`Unexpected mocked GET: ${url}`);
  });
  window.history.replaceState(null, "", mode === "novo" ? "/laudos/novo?paciente_id=901" : "/laudos/905/editar");
  render(mode === "novo" ? <NovoLaudoPage /> : <EditarLaudoPage />);
  await screen.findByDisplayValue(String(patient.nome));
  if (mode === "novo") {
    fireEvent.click(screen.getByRole("button", { name: "Importar estudo sintético" }));
    await waitFor(() => expect(live().Onda_E).toBe("1.08"));
    await editNarrative(official);
  }
  fireEvent.click(screen.getByRole("button", { name: "Medidas" }));
  if (mode === "novo" && species !== "Canina") {
    fireEvent.change(screen.getByLabelText("Ondas transmitrais E/A"), { target: { value: flow } });
    fireEvent.change(screen.getByLabelText("Ondas teciduais e'/a'"), { target: { value: tissue } });
  }
  if (species !== "Canina") await waitFor(() => expect(live().Diastolica_ondas).toBe(flow));
}

async function save(mode: Mode) {
  fireEvent.click(screen.getByRole("button", { name: "Salvar Laudo" }));
  const transport = mode === "novo" ? mocks.post : mocks.put;
  const url = mode === "novo" ? "/laudos" : "/laudos/905";
  await waitFor(() => expect(transport.mock.calls.some(([target]) => target === url)).toBe(true));
  return transport.mock.calls.find(([target]) => target === url)![1];
}

describe("páginas reais: conferência da narrativa diastólica felina", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem("token", "synthetic-local-token");
    mocks.imported = { ...MEASURES };
    mocks.post.mockResolvedValue({ data: { id: 905 } });
    mocks.put.mockResolvedValue({ data: { id: 905 } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); window.history.replaceState(null, "", "/"); });

  it.each(MODES)("%s recalcula o aviso real ao mudar fusão ou corrigir a redação nas duas abas", async (mode) => {
    await openPage(mode);
    expect(panel()).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Ondas transmitrais E/A"), { target: { value: "fundidas" } });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    const notice = panel()!;
    expect(notice).toHaveAttribute("data-echo-consistency-review");
    expect(within(notice).getByText(/Ver trecho.*Função.*e sugestão/i, { selector: "summary" })).toBeInTheDocument();
    expect(notice.querySelector("blockquote")).toHaveTextContent(CONFLICT);
    expect(within(notice).getByText("Sugestão para sua revisão:")).toBeInTheDocument();
    expect(notice).toHaveTextContent(/fundidas/i);
    expect(live()).toMatchObject({ Onda_E: "1.08", Onda_A: "0.95", TD: "51", TRIV: "40", e_doppler: "0.16" });
    fireEvent.change(screen.getByLabelText("Ondas transmitrais E/A"), { target: { value: "separadas" } });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("Ondas transmitrais E/A"), { target: { value: "fundidas" } });
    fireEvent.click(screen.getByRole("button", { name: "Qualitativa" }));
    expect(panel()).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Texto diastólico sintético" }), { target: { value: REVIEWED } });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Medidas" }));
    expect(panel()).not.toBeInTheDocument();
    expect(live().Diastolica_ondas).toBe("fundidas");
  });

  it.each(MODES)("%s deixa salvar o conflito sem aplicar sugestão nem apagar dados", async (mode) => {
    await openPage(mode, { flow: "fundidas" });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    const before = Object.fromEntries(Object.entries(live()).filter(([, value]) => value !== ""));
    const payload = await save(mode);
    const savedQualitative = mode === "novo" ? payload.qualitativa : extrairQualitativaEcoDaDescricao(payload.descricao);
    const savedMeasures = mode === "novo" ? payload.medidas : parseStoredEchoMeasurements(null, payload.descricao);
    expect(savedQualitative.funcao).toBe(CONFLICT);
    expect(Object.fromEntries(Object.entries(savedMeasures).filter(([, value]) => value !== ""))).toEqual(before);
    if (mode === "editar") {
      expect(payload.diagnostico).toBe(CONCLUSION);
      expect(payload.aplicar_qualitativa_estruturada).toBe(false);
    }
    expect(payload.ecocardiograma_estruturado?.textos.funcao_diastolica || CONFLICT).toBe(CONFLICT);
  });

  it("compara o texto oficial salvo mesmo quando o rascunho estruturado contém uma redação compatível", async () => {
    await openPage("editar", { flow: "fundidas", official: CONFLICT, draft: REVIEWED });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    expect(panel()!.querySelector("blockquote")).toHaveTextContent(CONFLICT);
    const payload = await save("editar");
    expect(extrairQualitativaEcoDaDescricao(payload.descricao).funcao).toBe(CONFLICT);
    expect(payload.ecocardiograma_estruturado.textos.funcao_diastolica).toBe(REVIEWED);
    expect(payload.diagnostico).toBe(CONCLUSION);
    expect(payload.aplicar_qualitativa_estruturada).toBe(false);
  });

  it("ignora um conflito apenas no rascunho e passa a avisar quando o médico aplica a redação", async () => {
    await openPage("editar", { flow: "fundidas", official: REVIEWED, draft: CONFLICT });
    expect(panel()).not.toBeInTheDocument();
    await editNarrative(`${CONFLICT} Revisado manualmente.`);
    await waitFor(() => expect(panel()).toBeInTheDocument());
    expect(panel()!.querySelector("blockquote")).toHaveTextContent(CONFLICT);
    const payload = await save("editar");
    expect(extrairQualitativaEcoDaDescricao(payload.descricao).funcao).toBe(`${CONFLICT} Revisado manualmente.`);
    expect(payload.aplicar_qualitativa_estruturada).toBe(true);
    expect(payload.diagnostico).toBe(CONCLUSION);
  });

  it.each([
    { official: REVIEWED, draft: "conflitante", expected: false },
    { official: CONFLICT, draft: "compatível", expected: true },
  ])("novo considera o legado selecionado quando o rascunho $draft está desabilitado", async ({ official, draft, expected }) => {
    await openPage("novo", { flow: "fundidas", official });
    fireEvent.click(screen.getByRole("button", { name: "Qualitativa" }));
    fireEvent.click(screen.getByRole("button", { name: `Preparar rascunho ${draft} sem aplicar` }));
    const expectedDraft = expected ? REVIEWED : CONFLICT;
    expect(screen.getByRole("textbox", { name: "Texto diastólico sintético" })).toHaveValue(expectedDraft);
    if (expected) {
      await waitFor(() => expect(panel()).toBeInTheDocument());
      expect(panel()!.querySelector("blockquote")).toHaveTextContent(official);
    } else {
      await waitFor(() => expect(panel()).not.toBeInTheDocument());
    }
    fireEvent.click(screen.getByRole("button", { name: "Medidas" }));
    if (expected) expect(panel()).toBeInTheDocument();
    else expect(panel()).not.toBeInTheDocument();
    expect(live().Diastolica_ondas).toBe("fundidas");
    const payload = await save("novo");
    expect(payload.qualitativa.funcao).toBe(official);
    expect(payload.ecocardiograma_estruturado.usar_no_laudo).toBe(false);
    expect(payload.ecocardiograma_estruturado.textos.funcao_diastolica).toBe(expectedDraft);
  });

  it.each(MODES)("%s limita o aviso novo à espécie felina", async (mode) => {
    await openPage(mode, { species: "Canina", flow: "fundidas" });
    expect(panel()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Qualitativa" }));
    expect(panel()).not.toBeInTheDocument();
  });

  it.each(MODES)("%s recalcula a conferência após alterar a espécie do formulário", async (mode) => {
    await openPage(mode, { flow: "fundidas" });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    for (const [species, expected] of [["Canina", false], ["Felina", true]] as const) {
      fireEvent.click(screen.getByRole("button", { name: "Paciente" }));
      const selector = screen.getByText("Espécie", { selector: "label" }).parentElement?.querySelector("select");
      expect(selector).not.toBeNull();
      fireEvent.change(selector!, { target: { value: species } });
      fireEvent.click(screen.getByRole("button", { name: "Medidas" }));
      await waitFor(() => expected ? expect(panel()).toBeInTheDocument() : expect(panel()).not.toBeInTheDocument());
    }
    expect(live().Diastolica_ondas).toBe("fundidas");
  });

  it.each(MODES)("%s identifica TDI fundido sem depender de fusão transmitral", async (mode) => {
    await openPage(mode, { flow: "separadas", tissue: "fundidas", official: "Relação e′/a′ de 1,33." });
    await waitFor(() => expect(panel()).toBeInTheDocument());
    expect(panel()!.querySelector("blockquote")).toHaveTextContent("Relação e′/a′ de 1,33.");
    fireEvent.change(screen.getByLabelText("Ondas teciduais e'/a'"), { target: { value: "separadas" } });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(live().Diastolica_ondas).toBe("separadas");
  });
});
