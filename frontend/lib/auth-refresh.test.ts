import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "./axios";

const originalAdapter = api.defaults.adapter;
const ok = (config: InternalAxiosRequestConfig): AxiosResponse => ({
  data: { ok: true }, status: 200, statusText: "OK", headers: {}, config,
});
const unauthorized = (config: InternalAxiosRequestConfig) => new AxiosError(
  "expired", "ERR_BAD_REQUEST", config, undefined,
  { ...ok(config), status: 401, data: { detail: "expired" } },
);

beforeEach(() => { localStorage.clear(); document.cookie = "fortcordis_csrf=pair; path=/"; });
afterEach(() => { api.defaults.adapter = originalAdapter; vi.restoreAllMocks(); });

describe("renovacao da sessao no cliente", () => {
  it("renova uma vez e atualiza Bearer legado antes de repetir", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { access_token: "renewed" } });
    const seen: string[] = [];
    api.defaults.adapter = async (config) => {
      seen.push(String(config.headers.Authorization));
      if (seen.length === 1) throw unauthorized(config);
      return ok(config);
    };
    expect((await api.get("/agenda", { headers: { Authorization: "Bearer old" } })).status).toBe(200);
    expect(seen).toEqual(["Bearer old", "Bearer renewed"]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][2]?.headers).toEqual({ "x-csrf-token": "pair" });
  });

  it("compartilha renovacao entre requisicoes concorrentes", async () => {
    let complete!: (value: unknown) => void;
    const pending = new Promise((resolve) => { complete = resolve; });
    const post = vi.spyOn(axios, "post").mockReturnValue(pending as ReturnType<typeof axios.post>);
    const attempts = new Map<string, number>();
    api.defaults.adapter = async (config) => {
      const count = attempts.get(config.url!) || 0;
      attempts.set(config.url!, count + 1);
      if (count === 0) throw unauthorized(config);
      return ok(config);
    };
    const requests = Promise.all([api.get("/agenda"), api.get("/pacientes")]);
    await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    complete({ data: { access_token: "renewed" } });
    expect((await requests).map((r) => r.status)).toEqual([200, 200]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("mantem sessao local quando o provedor esta indisponivel", async () => {
    localStorage.setItem("token", "keep-me");
    const config = {} as InternalAxiosRequestConfig;
    const transient = new AxiosError("unavailable", "ERR_BAD_RESPONSE", config, undefined,
      { ...ok(config), status: 503 });
    vi.spyOn(axios, "post").mockRejectedValue(transient);
    api.defaults.adapter = async (config) => { throw unauthorized(config); };
    await expect(api.get("/agenda")).rejects.toBe(transient);
    expect(localStorage.getItem("token")).toBe("keep-me");
  });
});
