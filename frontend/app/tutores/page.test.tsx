import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TutoresPage from "./page";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock("../layout-dashboard", () => ({ default: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("@/lib/axios", () => ({ default: mocks }));
const items = [
  { id: 1, nome: "Cristiane", identificacao_pendente: false, telefone: "85911111111", origem_cadastro: "Clínica Alfa", pets: [{ id: 10, nome: "Mel" }] },
  { id: 2, nome: "Cristiane", identificacao_pendente: true, telefone: "85922222222", origem_cadastro: "Clínica Beta", pets: [{ id: 20, nome: "Pingo" }] },
];
const previa = {
  principal: { id: 1, nome: "Cristiane", telefone: "85911111111", endereco: { endereco: "Rua A" } },
  secundario: { id: 2, nome: "Cristiane", telefone: "85922222222", endereco: { endereco: "Rua B" } },
  campos: ["nome", "telefone", "endereco"], conflitos: ["telefone", "endereco"], bloqueios: [], avisos: [],
  token_previa: "a".repeat(64), vinculos: { pacientes: { principal: 1, secundario: 1 } },
  pets: [{ id: 10, nome: "Mel", tutor_id: 1 }, { id: 20, nome: "Pingo", tutor_id: 2 }],
};

async function comparar() {
  await screen.findByRole("button", { name: "Manter #1 como principal" });
  fireEvent.click(screen.getByRole("button", { name: "Manter #1 como principal" }));
  fireEvent.click(screen.getByRole("button", { name: "Mesclar #2 no principal" }));
  fireEvent.click(screen.getByRole("button", { name: "Comparar cadastros" }));
  await screen.findByRole("region", { name: "Prévia da mesclagem" });
}
function confirmarRevisao() {
  fireEvent.click(screen.getByRole("radio", { name: "Telefone: usar secundario" }));
  fireEvent.click(screen.getByRole("radio", { name: "Endereço completo e localização: usar principal" }));
  fireEvent.change(screen.getByLabelText("Motivo e evidência de que é a mesma pessoa"), { target: { value: "Identidade confirmada com a clínica" } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Revisei os dados/ }));
}

describe("Tutores e mesclagem assistida", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.setItem("user", JSON.stringify({ id: 7, email: "admin@example.com", papeis: ["admin"] }));
    mocks.get.mockResolvedValue({ data: { items, total: 2 } });
    mocks.post.mockImplementation((path: string) => Promise.resolve({ data: path.endsWith("/previa") ? previa : { id: 3 } }));
  });
  afterEach(() => localStorage.clear());

  it("distingue homônimos pelo código, animais, origem e situação da identificação", async () => {
    render(<TutoresPage />);
    expect(await screen.findByText("Identificação pendente")).toBeInTheDocument();
    expect(screen.getByText("Identificação confirmada pela equipe")).toBeInTheDocument();
    expect(screen.getByText("Animais: Pingo #20")).toBeInTheDocument();
    expect(screen.getByText(/85911111111 · Clínica Alfa/)).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it("cria outro cadastro com identificação pendente e origem, sem reutilizar um homônimo", async () => {
    render(<TutoresPage />);
    fireEvent.click(screen.getByRole("button", { name: "Novo tutor" }));
    expect(screen.getByRole("checkbox", { name: "Identificação pendente" })).toBeChecked();
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Cristiane" } });
    fireEvent.change(screen.getByLabelText("Origem do cadastro / clínica informante"), { target: { value: "Clínica Gama" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar cadastro" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/tutores", expect.objectContaining({ nome: "Cristiane", identificacao_pendente: true, origem_cadastro: "Clínica Gama" })));
  });

  it("só mescla após resolver conflitos, informar motivo e confirmar a revisão", async () => {
    render(<TutoresPage />); await comparar();
    expect(screen.getByRole("button", { name: "Confirmar mesclagem" })).toBeDisabled();
    confirmarRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mesclagem" }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith("/tutores/mesclagens", {
      principal_id: 1, secundario_id: 2, token_previa: previa.token_previa,
      escolhas: { telefone: "secundario", endereco: "principal" },
      motivo: "Identidade confirmada com a clínica", confirmar: true,
    }));
    expect(await screen.findByText(/Mesclagem concluída/)).toBeInTheDocument();
  });

  it("bloqueia a confirmação quando há CPFs divergentes", async () => {
    mocks.post.mockResolvedValue({ data: { ...previa, bloqueios: ["Os CPFs informados são diferentes."] } });
    render(<TutoresPage />); await comparar(); confirmarRevisao();
    expect(screen.getByRole("alert")).toHaveTextContent("CPFs");
    expect(screen.getByRole("button", { name: "Confirmar mesclagem" })).toBeDisabled();
  });

  it("descarta prévia obsoleta e exige nova comparação após conflito do servidor", async () => {
    mocks.post.mockImplementation((path: string) => path.endsWith("/previa") ? Promise.resolve({ data: previa })
      : Promise.reject({ response: { data: { detail: "Os cadastros mudaram. Gere uma nova prévia." } } }));
    render(<TutoresPage />); await comparar(); confirmarRevisao();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar mesclagem" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nova prévia");
    expect(screen.queryByRole("region", { name: "Prévia da mesclagem" })).not.toBeInTheDocument();
  });

  it("não oferece mesclagem nem histórico para usuário sem papel administrador", async () => {
    localStorage.setItem("user", JSON.stringify({ email: "recepcao@example.com", papeis: ["secretaria"] }));
    render(<TutoresPage />);
    await screen.findByText("Animais: Pingo #20");
    expect(screen.queryByRole("button", { name: "Comparar cadastros" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Histórico #1" })).not.toBeInTheDocument();
  });
});
