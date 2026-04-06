"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { removePushSubscriptionForCurrentDevice, usePushNotifications } from "@/lib/usePushNotifications";
import { FortinhoProvider } from "@/components/fortinho/FortinhoProvider";
import {
  Calendar,
  CalendarDays,
  Users,
  Building2,
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  User,
  FileText,
  ClipboardPlus,
  DollarSign,
  BarChart3,
  Settings,
  BookOpen,
  MapPin,
  Car,
  Pencil,
  Check,
  Loader2
} from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/agenda/fullcalendar", label: "Agenda FullCalendar", icon: CalendarDays },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/servicos", label: "Serviços", icon: Stethoscope },
  { href: "/laudos", label: "Laudos", icon: FileText },
  { href: "/ultrassonografia-abdominal", label: "US Abdominal", icon: FileText },
  { href: "/atendimento", label: "Atendimento", icon: ClipboardPlus },
  { href: "/referencias-eco", label: "Referências Eco", icon: BookOpen },
  { href: "/logistica", label: "Logistica", icon: MapPin },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/financeiro/frota", label: "Custos Frota", icon: Car },
  { href: "/relatorios", label: "Relatorios", icon: BarChart3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [nomeClinica, setNomeClinica] = useState("FortCordis");
  const [nomeClinicaDraft, setNomeClinicaDraft] = useState("FortCordis");
  const [editandoNomeClinica, setEditandoNomeClinica] = useState(false);
  const [salvandoNomeClinica, setSalvandoNomeClinica] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [fortinhoHabilitado, setFortinhoHabilitado] = useState(false);
  const faviconOriginalRef = useRef<string>("/favicon.ico");
  const overlayCleanupRafRef = useRef<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const handledSnoozeRef = useRef<string>("");
  usePushNotifications(authChecked && Boolean(user));

  const limparBackdropsOrfaos = () => {
    if (typeof document === "undefined") return;

    const elementoVisivelNoViewport = (el: Element | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const style = window.getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || "1") === 0) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      if (rect.bottom <= 0 || rect.right <= 0) return false;
      if (rect.top >= window.innerHeight || rect.left >= window.innerWidth) return false;
      return true;
    };

    const viewportArea = window.innerWidth * window.innerHeight;
    const candidatos = Array.from(
      document.body.querySelectorAll(
        "div.fixed, button.fixed, [data-fortcordis-orphan-overlay-hidden='1']"
      )
    ) as HTMLElement[];

    candidatos.forEach((elemento) => {
      if (!elemento.isConnected) return;
      if (elemento.dataset.fortcordisOverlaySafe === "1") return;
      if (elemento.closest("[data-fortcordis-overlay-safe='1']")) return;
      if (elemento === document.body || elemento === document.documentElement) return;

      const className = typeof elemento.className === "string" ? elemento.className : "";
      const style = window.getComputedStyle(elemento);
      const rect = elemento.getBoundingClientRect();
      const coversViewport =
        rect.width * rect.height >= viewportArea * 0.9 &&
        rect.top <= 0 &&
        rect.left <= 0;
      const candidatosDialogo = Array.from(
        elemento.querySelectorAll(
          "[role='dialog'], iframe, img, form, section, article, textarea, input, select, button, [data-modal-content]"
        )
      );
      const hasDialogContentVisivel = candidatosDialogo.some((item) => elementoVisivelNoViewport(item));
      const hasMeaningfulTextVisivel = Array.from(
        elemento.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, strong, small, label, button")
      ).some((item) => {
        if (!elementoVisivelNoViewport(item)) return false;
        return Boolean((item.textContent || "").trim());
      });
      const backgroundColor = style.backgroundColor || "";
      const isDarkBackdrop =
        className.includes("bg-black/50") ||
        className.includes("bg-black bg-opacity-50") ||
        className.includes("bg-slate-950/70") ||
        /^rgba?\((\s*\d+\s*,){2}\s*\d+,\s*0\.[1-9]/.test(backgroundColor);
      const looksLikeOverlay =
        style.position === "fixed" &&
        Number(style.zIndex || "0") >= 40 &&
        coversViewport &&
        (
          className.includes("inset-0") ||
          isDarkBackdrop
        );

      if (looksLikeOverlay && !hasDialogContentVisivel && !hasMeaningfulTextVisivel) {
        elemento.style.display = "none";
        elemento.style.pointerEvents = "none";
        elemento.setAttribute("data-fortcordis-orphan-overlay-hidden", "1");
      }
    });
  };

  const blobParaDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultado = typeof reader.result === "string" ? reader.result : "";
        if (!resultado) {
          reject(new Error("Falha ao converter imagem para data URL"));
          return;
        }
        resolve(resultado);
      };
      reader.onerror = () => reject(reader.error || new Error("Erro ao ler imagem"));
      reader.readAsDataURL(blob);
    });

  const aplicarFavicon = (href: string, type = "image/png") => {
    if (typeof document === "undefined") return;

    const linksExistentes = Array.from(
      document.head.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    ) as HTMLLinkElement[];

    if (linksExistentes.length === 0) {
      const link = document.createElement("link");
      link.setAttribute("data-fortcordis-favicon", "true");
      link.setAttribute("rel", "icon");
      link.type = type;
      link.href = href;
      document.head.appendChild(link);
      return;
    }

    linksExistentes.forEach((link) => {
      link.setAttribute("data-fortcordis-favicon", "true");
      link.type = type;
      link.href = href;
    });
  };

  const capturarFaviconOriginal = () => {
    if (typeof document === "undefined") return;
    const primeiroIcone = document.head.querySelector(
      'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
    ) as HTMLLinkElement | null;
    if (primeiroIcone?.href) {
      faviconOriginalRef.current = primeiroIcone.href;
    }
  };

  const redirecionarParaLogin = () => {
    if (typeof window !== "undefined") {
      window.location.replace("/");
      return;
    }
    router.replace("/");
  };

  const atualizarLogoUrl = (novaUrl: string | null) => {
    setLogoUrl((anterior) => {
      if (anterior && anterior.startsWith("blob:")) {
        URL.revokeObjectURL(anterior);
      }
      return novaUrl;
    });
  };

  const carregarBranding = async () => {
    try {
      const respConfig = await api.get("/configuracoes");
      const nomeConfigurado = (respConfig.data?.nome_empresa || "").trim();
      const nomeFinal = nomeConfigurado || "FortCordis";
      setNomeClinica(nomeFinal);
      setNomeClinicaDraft(nomeFinal);
      setFortinhoHabilitado(respConfig.data?.fortinho_habilitado === true);

      const deveMostrarLogo = respConfig.data?.mostrar_logomarca !== false;
      const temLogo = Boolean(respConfig.data?.tem_logomarca);

      if (deveMostrarLogo && temLogo) {
        const respLogo = await api.get("/configuracoes/logomarca", {
          responseType: "blob",
        });
        const dataUrl = await blobParaDataUrl(respLogo.data);
        atualizarLogoUrl(dataUrl);
        return;
      }

      atualizarLogoUrl(null);
    } catch (error) {
      console.error("Erro ao carregar branding da clinica:", error);
      setFortinhoHabilitado(false);
      atualizarLogoUrl(null);
    }
  };

  const salvarNomeClinica = async () => {
    const nomeLimpo = nomeClinicaDraft.trim();
    if (!nomeLimpo) {
      alert("Informe o nome da clinica.");
      return;
    }

    try {
      setSalvandoNomeClinica(true);
      await api.put("/configuracoes", { nome_empresa: nomeLimpo });
      setNomeClinica(nomeLimpo);
      setEditandoNomeClinica(false);
    } catch (error) {
      console.error("Erro ao salvar nome da clinica:", error);
      alert("Nao foi possivel salvar o nome da clinica.");
    } finally {
      setSalvandoNomeClinica(false);
    }
  };

  useEffect(() => {
    try {
      const userData = localStorage.getItem("user");
      const token = localStorage.getItem("token");

      if (!userData || !token) {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        redirecionarParaLogin();
        return;
      }

      let parsedUser: any = null;
      try {
        parsedUser = JSON.parse(userData);
      } catch (parseError) {
        console.error("Valor invalido em localStorage.user:", parseError);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        redirecionarParaLogin();
        return;
      }

      if (!parsedUser || typeof parsedUser !== "object") {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        redirecionarParaLogin();
        return;
      }

      setUser(parsedUser);
      carregarBranding();
    } finally {
      setAuthChecked(true);
    }
  }, [router]);

  useEffect(() => {
    capturarFaviconOriginal();
  }, []);

  useEffect(() => {
    // Fallback para evitar tela presa em "Carregando..." caso algum efeito falhe em dev/HMR.
    const timeout = window.setTimeout(() => setAuthChecked(true), 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () => {
      const isMobile = window.innerWidth < 1024;
      setIsMobileViewport(isMobile);
      if (!isMobile) {
        setSidebarOpen(false);
      }
    };

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sidebarOpen]);

  useEffect(() => {
    aplicarFavicon(logoUrl || "/favicon.ico");

    return () => {
      aplicarFavicon(faviconOriginalRef.current || "/favicon.ico");
    };
  }, [logoUrl]);

  useEffect(() => {
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [logoUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!authChecked || !user) return;
    const searchParams = new URLSearchParams(window.location.search);
    const shouldSnooze = searchParams.get("push_snooze");
    if (shouldSnooze !== "1") return;

    const minutes = Number(searchParams.get("push_snooze_minutes") || "15");
    const safeMinutes = minutes === 30 || minutes === 60 ? minutes : 15;
    const notificationId = String(searchParams.get("push_snooze_notification_id") || "");
    const dedupeKey = `${notificationId}:${safeMinutes}:${pathname}`;
    if (handledSnoozeRef.current === dedupeKey) return;
    handledSnoozeRef.current = dedupeKey;

    const payload: Record<string, any> = {
      minutes: safeMinutes,
      title: String(searchParams.get("push_snooze_title") || ""),
      body: String(searchParams.get("push_snooze_body") || ""),
      url: String(searchParams.get("push_snooze_url") || "/financeiro"),
      module: String(searchParams.get("push_snooze_module") || "financeiro"),
      action: String(searchParams.get("push_snooze_action") || "payment_pending"),
      priority: String(searchParams.get("push_snooze_priority") || "normal"),
      notification_id: notificationId,
      resource_type: String(searchParams.get("push_snooze_resource_type") || ""),
    };
    const resourceIdRaw = searchParams.get("push_snooze_resource_id");
    if (resourceIdRaw && String(resourceIdRaw).trim() !== "") {
      const parsed = Number(resourceIdRaw);
      if (Number.isFinite(parsed) && parsed > 0) {
        payload.resource_id = parsed;
      }
    }

    const limparQuerySoneca = () => {
      const params = new URLSearchParams(window.location.search);
      [
        "push_snooze",
        "push_snooze_minutes",
        "push_snooze_title",
        "push_snooze_body",
        "push_snooze_url",
        "push_snooze_module",
        "push_snooze_action",
        "push_snooze_priority",
        "push_snooze_notification_id",
        "push_snooze_resource_type",
        "push_snooze_resource_id",
      ].forEach((key) => params.delete(key));
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    };

    (async () => {
      try {
        await api.post("/configuracoes/usuario/push/snooze", payload);
        alert(`Notificacao adiada por ${safeMinutes} minuto(s).`);
      } catch (error) {
        console.error("Erro ao agendar soneca da notificacao push:", error);
        alert("Nao foi possivel adiar a notificacao.");
      } finally {
        limparQuerySoneca();
      }
    })();
  }, [authChecked, pathname, router, user]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handle = window.setTimeout(() => {
      limparBackdropsOrfaos();
    }, 120);

    const observer = new MutationObserver(() => {
      if (overlayCleanupRafRef.current !== null) return;
      overlayCleanupRafRef.current = window.requestAnimationFrame(() => {
        overlayCleanupRafRef.current = null;
        limparBackdropsOrfaos();
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      window.clearTimeout(handle);
      if (overlayCleanupRafRef.current !== null) {
        window.cancelAnimationFrame(overlayCleanupRafRef.current);
        overlayCleanupRafRef.current = null;
      }
      observer.disconnect();
    };
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await removePushSubscriptionForCurrentDevice();
    } catch {
      // best effort
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Redirecionando para login...</div>
      </div>
    );
  }

  const dashboardContent = (
    <div className="min-h-screen bg-gray-50">
        {/* Header mobile */}
        <div className="lg:hidden bg-white border-b px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logomarca da clinica"
                className="w-8 h-8 rounded-lg object-contain border bg-white"
              />
            ) : (
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">FC</span>
              </div>
            )}
            <h1 className="text-lg font-bold text-gray-900 truncate">{nomeClinica}</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-gray-600 hover:text-gray-900"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-[60] w-64 bg-white border-r transition-transform duration-200 ease-in-out`}
          >
            <div className="h-full flex flex-col">
              {/* Logo */}
              <div className="hidden lg:flex flex-col gap-3 px-4 py-4 border-b">
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logomarca da clinica"
                      className="w-9 h-9 rounded-lg object-contain border bg-white"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">FC</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {editandoNomeClinica ? (
                      <input
                        value={nomeClinicaDraft}
                        onChange={(e) => setNomeClinicaDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            salvarNomeClinica();
                          }
                          if (e.key === "Escape") {
                            setNomeClinicaDraft(nomeClinica);
                            setEditandoNomeClinica(false);
                          }
                        }}
                        className="w-full px-2 py-1 text-sm font-semibold text-gray-900 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span className="block text-base font-bold text-gray-900 truncate">
                        {nomeClinica}
                      </span>
                    )}
                  </div>

                  {editandoNomeClinica ? (
                    <button
                      onClick={salvarNomeClinica}
                      disabled={salvandoNomeClinica}
                      className="p-1.5 rounded-md text-green-700 hover:bg-green-50 disabled:opacity-60"
                      title="Salvar nome da clinica"
                    >
                      {salvandoNomeClinica ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => setEditandoNomeClinica(true)}
                      className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
                      title="Editar nome da clinica"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {editandoNomeClinica && (
                  <p className="text-[11px] leading-4 text-gray-500 px-1">
                    Pressione Enter para salvar ou Esc para cancelar.
                  </p>
                )}
              </div>

              {/* Menu */}
              <nav className="flex-1 px-4 py-4 space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              {/* User & Logout */}
              <div className="border-t p-4">
                <div className="flex items-center gap-3 mb-3 px-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.nome}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
                <p className="mt-3 px-3 text-[11px] leading-4 text-gray-400">
                  Sistema proprietario da FortCordis. Desenvolvido por Martiniano Le Barros.
                </p>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main
            className="flex-1 min-w-0"
            onClick={() => {
              if (sidebarOpen && isMobileViewport) {
                setSidebarOpen(false);
              }
            }}
          >
            {children}
          </main>
        </div>
    </div>
  );

  return fortinhoHabilitado ? (
    <FortinhoProvider>{dashboardContent}</FortinhoProvider>
  ) : (
    dashboardContent
  );
}
