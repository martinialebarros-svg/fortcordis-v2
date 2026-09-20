import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortalRequestError, type PortalSessionResponse } from "@/lib/portal-api";

const loadPortalSession = vi.fn();
const savePortalSession = vi.fn();
const clearPortalSession = vi.fn();
const resumePortalDeviceSession = vi.fn();
const refreshClinicPortalSession = vi.fn();

vi.mock("@/lib/portal-api", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/portal-api")>();
  return {
    ...real,
    loadPortalSession: (...args: unknown[]) => loadPortalSession(...args),
    savePortalSession: (...args: unknown[]) => savePortalSession(...args),
    clearPortalSession: (...args: unknown[]) => clearPortalSession(...args),
    resumePortalDeviceSession: () => resumePortalDeviceSession(),
    refreshClinicPortalSession: () => refreshClinicPortalSession(),
  };
});

// O workspace faz as proprias chamadas e nao e o assunto aqui: o que importa e
// com qual sessao o shell decide monta-lo. Sem sessao ele aparece embutido na
// pagina publica, como o cartao de login da unidade.
vi.mock("@/components/portal/PortalClinicaWorkspace", () => ({
  default: ({
    initialSession,
    onPedirLoginPorSenha,
  }: {
    initialSession?: PortalSessionResponse;
    onPedirLoginPorSenha?: () => void;
  }) =>
    initialSession ? (
      <div data-testid="workspace">
        {initialSession.access_token}
        {onPedirLoginPorSenha ? (
          <button type="button" onClick={onPedirLoginPorSenha}>
            Entrar com senha
          </button>
        ) : null}
      </div>
    ) : (
      <div data-testid="cartao-de-login" />
    ),
}));

import PortalClinicaPageShell from "./PortalClinicaPageShell";

const sessaoDeDispositivo: PortalSessionResponse = {
  access_token: "token-guardado",
  token_type: "bearer",
  expires_at: "2026-12-31T23:59:00",
  actor_type: "clinica",
  actor_id: 8,
  clinica_id: 8,
  paciente_id: null,
  account_id: null,
  auth_method: "device_trust",
  trusted_session_expires_at: "2026-10-20T01:57:00",
  scope: ["exam:read", "exam:download"],
  message: null,
};

const sessaoComSenha: PortalSessionResponse = {
  ...sessaoDeDispositivo,
  access_token: "token-de-senha",
  auth_method: "password",
  account_id: 3,
  scope: ["clinic:read", "exam:read", "exam:download"],
};

beforeEach(() => {
  loadPortalSession.mockReset();
  savePortalSession.mockReset();
  clearPortalSession.mockReset();
  resumePortalDeviceSession.mockReset();
  refreshClinicPortalSession.mockReset();
  refreshClinicPortalSession.mockRejectedValue(new PortalRequestError(401, "Sem sessao."));
});

afterEach(() => {
  cleanup();
});

describe("bootstrap do portal da clinica", () => {
  it("reconfere a sessao do computador confiavel com o servidor antes de abrir os laudos", async () => {
    loadPortalSession.mockReturnValue(sessaoDeDispositivo);
    resumePortalDeviceSession.mockResolvedValue({ ...sessaoDeDispositivo, access_token: "token-novo" });

    render(<PortalClinicaPageShell />);

    // Nao basta ter token guardado: a tela so aparece depois que o servidor
    // confirma que aquele computador continua conectado.
    expect(await screen.findByTestId("workspace")).toHaveTextContent("token-novo");
    expect(resumePortalDeviceSession).toHaveBeenCalledTimes(1);
    expect(savePortalSession).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "token-novo" }),
    );
  });

  it("derruba o computador revogado mesmo com token guardado ainda no prazo", async () => {
    loadPortalSession.mockReturnValue(sessaoDeDispositivo);
    resumePortalDeviceSession.mockRejectedValue(
      new PortalRequestError(401, "Dispositivo nao esta mais conectado."),
    );

    render(<PortalClinicaPageShell />);

    await waitFor(() => expect(clearPortalSession).toHaveBeenCalledWith("clinica"));
    expect(await screen.findByTestId("cartao-de-login")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace")).not.toBeInTheDocument();
    // Uma recusa ja e resposta: nao insiste no mesmo endpoint depois de o
    // refresh por senha falhar.
    expect(resumePortalDeviceSession).toHaveBeenCalledTimes(1);
  });

  it("mantem a recepcao conectada quando o servidor nao responde", async () => {
    loadPortalSession.mockReturnValue(sessaoDeDispositivo);
    resumePortalDeviceSession.mockRejectedValue(new TypeError("Failed to fetch"));

    render(<PortalClinicaPageShell />);

    // Oscilacao de rede nao e revogacao. Derrubar a recepcao por causa dela
    // custaria mais do que o risco que a revalidacao fecha.
    expect(await screen.findByTestId("workspace")).toHaveTextContent("token-guardado");
    expect(clearPortalSession).not.toHaveBeenCalled();
  });

  it("nao reconfere sessao com senha, que tem o refresh proprio", async () => {
    loadPortalSession.mockReturnValue(sessaoComSenha);

    render(<PortalClinicaPageShell />);

    expect(await screen.findByTestId("workspace")).toHaveTextContent("token-de-senha");
    expect(resumePortalDeviceSession).not.toHaveBeenCalled();
    expect(refreshClinicPortalSession).not.toHaveBeenCalled();
  });

  it("leva ao formulario de senha sem encerrar a confianca do computador (RF-019)", async () => {
    loadPortalSession.mockReturnValue(sessaoDeDispositivo);
    resumePortalDeviceSession.mockResolvedValue(sessaoDeDispositivo);

    render(<PortalClinicaPageShell />);
    fireEvent.click(await screen.findByRole("button", { name: "Entrar com senha" }));

    expect(await screen.findByTestId("cartao-de-login")).toBeInTheDocument();
    // Limpa so o que estava guardado. O cookie do dispositivo nao e tocado - por
    // isso existe volta, e por isso o gestor nao derruba a recepcao para ver o
    // financeiro.
    expect(clearPortalSession).toHaveBeenCalledWith("clinica");

    const voltar = screen.getByRole("button", { name: /voltar para os laudos da unidade/i });
    await act(async () => {
      fireEvent.click(voltar);
    });

    expect(await screen.findByTestId("workspace")).toHaveTextContent("token-guardado");
  });

  it("nao oferece a volta para os laudos em quem chegou deslogado", async () => {
    loadPortalSession.mockReturnValue(null);
    resumePortalDeviceSession.mockRejectedValue(new PortalRequestError(401, "Sem dispositivo."));

    render(<PortalClinicaPageShell />);

    expect(await screen.findByTestId("cartao-de-login")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /voltar para os laudos da unidade/i }),
    ).not.toBeInTheDocument();
  });

  it("ainda tenta o computador confiavel quando nao ha nada guardado (CA-014)", async () => {
    loadPortalSession.mockReturnValue(null);
    resumePortalDeviceSession.mockResolvedValue(sessaoDeDispositivo);

    render(<PortalClinicaPageShell />);

    expect(await screen.findByTestId("workspace")).toHaveTextContent("token-guardado");
    expect(refreshClinicPortalSession).toHaveBeenCalledTimes(1);
    expect(resumePortalDeviceSession).toHaveBeenCalledTimes(1);
  });
});
