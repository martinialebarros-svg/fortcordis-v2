import { render, screen, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UploadEletrocardiogramaPage from "./page";

const mocks = vi.hoisted(() => {
  const push = vi.fn();
  return {
    get: vi.fn(),
    push,
    router: { push },
    listarTodasClinicas: vi.fn(),
  };
});

vi.mock("../../../layout-dashboard", () => ({
  default: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/lib/axios", () => ({
  default: { get: mocks.get },
}));

vi.mock("@/lib/clinicas", () => ({
  listarTodasClinicas: mocks.listarTodasClinicas,
}));

function campoDataRealizacao() {
  return screen.getByLabelText("Data de realizacao") as HTMLInputElement;
}

describe("UploadEletrocardiogramaPage", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.push.mockReset();
    mocks.listarTodasClinicas.mockReset();
    mocks.listarTodasClinicas.mockResolvedValue([]);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem("token", "test-token");
    window.history.replaceState({}, "", "/laudos/eletrocardiograma/upload");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("usa a data agendada como default quando o upload vem de um agendamento", async () => {
    window.history.replaceState({}, "", "/laudos/eletrocardiograma/upload?agendamento_id=42");
    mocks.get.mockImplementation((url: string) => {
      if (url === "/portal/parceiros/veterinarios/opcoes") {
        return Promise.resolve({ data: { items: [] } });
      }
      if (url === "/agenda/42") {
        return Promise.resolve({
          data: {
            id: 42,
            paciente_id: 7,
            clinica_id: 3,
            paciente: "Bidu",
            tutor: "Ana",
            data: "2026-09-04",
            inicio: "2026-09-04 09:30:00",
          },
        });
      }
      if (url === "/pacientes/7") {
        return Promise.resolve({ data: { id: 7, nome: "Bidu", tutor: "Ana" } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    render(<UploadEletrocardiogramaPage />);

    await waitFor(() => expect(campoDataRealizacao().value).toBe("2026-09-04"));
  });

  it("cai para a data do dia quando o upload nao tem agendamento", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:00:00Z"));
    mocks.get.mockImplementation((url: string) => {
      if (url === "/portal/parceiros/veterinarios/opcoes") {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    render(<UploadEletrocardiogramaPage />);

    await vi.waitFor(() => expect(campoDataRealizacao().value).toBe("2026-09-10"));
  });

  it("cai para a data do dia quando o agendamento nao carrega", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T15:00:00Z"));
    window.history.replaceState({}, "", "/laudos/eletrocardiograma/upload?agendamento_id=42");
    mocks.get.mockImplementation((url: string) => {
      if (url === "/portal/parceiros/veterinarios/opcoes") {
        return Promise.resolve({ data: { items: [] } });
      }
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });

    render(<UploadEletrocardiogramaPage />);

    await vi.waitFor(() => expect(campoDataRealizacao().value).toBe("2026-09-10"));
  });
});
