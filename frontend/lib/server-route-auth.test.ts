// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { protectAppRoute } from "./server-route-auth";
import { safeLoginDestination } from "./protected-routes";
import { middleware } from "../middleware";

const request = (cookie = "", path = "/laudos/42?editar=1") =>
  new NextRequest(`https://app.stage.fortcordis.com.br${path}`, { headers: { cookie, host: "app.stage.fortcordis.com.br" } });

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("protecao de rotas no servidor", () => {
  it("redireciona visitante antes de renderizar e preserva o destino", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const response = await protectAppRoute(request());
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).searchParams.get("next")).toBe("/laudos/42?editar=1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("nao confia na presenca de um cookie forjado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect((await protectAppRoute(request("fortcordis_session=forged"))).status).toBe(307);
  });

  it("valida a sessao no backend configurado e impede cache compartilhado", async () => {
    vi.stubEnv("API_BACKEND_URL", "http://backend.internal:8001");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}")); vi.stubGlobal("fetch", fetchMock);
    const response = await protectAppRoute(request("fortcordis_session=valid"));
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock.mock.calls[0][0]).toBe("http://backend.internal:8001/api/v1/auth/me");
  });

  it("renova sessao e encaminha os novos cookies ao navegador e ao servidor", async () => {
    const renewed = new Response("{}", { headers: { "set-cookie": "fortcordis_session=new; HttpOnly; Path=/, fortcordis_supabase_refresh=rotated; HttpOnly; Path=/" } });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })).mockResolvedValueOnce(renewed);
    vi.stubGlobal("fetch", fetchMock);
    const response = await protectAppRoute(request("fortcordis_supabase_refresh=old; fortcordis_csrf=pair"));
    expect(fetchMock.mock.calls[1][1].headers["x-csrf-token"]).toBe("pair");
    expect(response.headers.get("set-cookie")).toContain("fortcordis_session=new");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("fortcordis_session=new");
  });

  it("falha fechada sem renderizar a pagina quando o backend esta indisponivel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await protectAppRoute(request("fortcordis_session=valid"))).status).toBe(503);
  });

  it("preserva portais publicos e protege todos os modulos internos", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    for (const path of ["/portal/clinica", "/area-pacientes", "/clinica-parceira", "/agenda/formalizar/invite-token", "/laudo/report-token", "/"]) {
      expect((await middleware(request("", path))).headers.get("x-middleware-next")).toBe("1");
    }
    for (const path of ["/fiscal", "/relatorios", "/assistente-ia", "/visualizador-vivid-iq"]) {
      expect((await middleware(request("", path))).status).toBe(307);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantem redirecionamento institucional para o host do aplicativo", async () => {
    const response = await middleware(new NextRequest("https://stage.fortcordis.com.br/relatorios", { headers: { host: "stage.fortcordis.com.br" } }));
    expect(response.headers.get("location")).toBe("https://app.stage.fortcordis.com.br/relatorios");
  });

  it("recusa destinos de login externos, publicos ou ambiguos", () => {
    for (const path of ["https://evil.com", "//evil.com", "/\\evil.com", "/portal/clinica", "/"]) {
      expect(safeLoginDestination(path)).toBe("/dashboard");
    }
    expect(safeLoginDestination("/laudos/42?editar=1")).toBe("/laudos/42?editar=1");
  });
});
