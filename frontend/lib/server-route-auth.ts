import { NextRequest, NextResponse } from "next/server";

function loginRedirect(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  url.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function unavailable(): NextResponse {
  return new NextResponse("Nao foi possivel validar sua sessao. Tente novamente.", {
    status: 503, headers: { "Cache-Control": "private, no-store", "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function protectAppRoute(request: NextRequest): Promise<NextResponse> {
  const sessionName = process.env.AUTH_COOKIE_NAME || "fortcordis_session";
  const refreshName = process.env.SUPABASE_REFRESH_COOKIE_NAME || "fortcordis_supabase_refresh";
  const csrfName = process.env.CSRF_COOKIE_NAME || "fortcordis_csrf";
  if (!request.cookies.has(sessionName) && !request.cookies.has(refreshName)) {
    return loginRedirect(request);
  }

  // Destino fixo de configuracao; nunca construir a URL a partir de Host/forwarded headers.
  const backend = (process.env.API_BACKEND_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
  const cookie = request.headers.get("cookie") || "";
  const options = { headers: { cookie }, cache: "no-store" as const, redirect: "manual" as const };
  try {
    const me = await fetch(`${backend}/api/v1/auth/me`, { ...options, signal: AbortSignal.timeout(12000) });
    const forwardedHeaders = new Headers(request.headers);
    const setCookies: string[] = [];
    if (me.status === 401 && request.cookies.has(refreshName)) {
      const csrf = request.cookies.get(csrfName)?.value || "";
      const refreshed = await fetch(`${backend}/api/v1/auth/refresh`, {
        ...options, method: "POST", signal: AbortSignal.timeout(12000),
        headers: { cookie, [process.env.CSRF_HEADER_NAME || "x-csrf-token"]: csrf },
      });
      if ([401, 403, 404].includes(refreshed.status)) return loginRedirect(request);
      if (!refreshed.ok) return unavailable();
      const raw = refreshed.headers.get("set-cookie") || "";
      setCookies.push(...raw.split(/,(?=\s*[^;,=\s]+=)/).filter(Boolean));
      if (!setCookies.length) return unavailable();
      for (const cookieHeader of setCookies) {
        const [pair] = cookieHeader.trim().split(";");
        const index = pair.indexOf("=");
        request.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      // Server Components e rewrites recebem a mesma sessao enviada ao browser.
      forwardedHeaders.set("cookie", request.cookies.toString());
    } else if ([401, 403].includes(me.status)) {
      return loginRedirect(request);
    } else if (!me.ok) {
      return unavailable();
    }
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    for (const cookieHeader of setCookies) response.headers.append("set-cookie", cookieHeader.trim());
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.append("Vary", "Cookie");
    return response;
  } catch {
    return unavailable();
  }
}
