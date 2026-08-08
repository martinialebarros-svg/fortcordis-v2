"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
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
  MessageSquare,
  Pencil,
  Check,
  Loader2,
  Receipt,
  ShieldCheck,
  BrainCircuit,
  Activity,
  type LucideIcon,
} from "lucide-react";

const PushNotificationsBootstrap = dynamic(
  () => import("@/components/layout/PushNotificationsBootstrap"),
  { ssr: false }
);
const DashboardOverlayCleanup = dynamic(
  () => import("@/components/layout/DashboardOverlayCleanup"),
  { ssr: false }
);
const DashboardPushSnoozeHandler = dynamic(
  () => import("@/components/layout/DashboardPushSnoozeHandler"),
  { ssr: false }
);
const AlertasInternosBell = dynamic(
  () => import("@/components/layout/AlertasInternosBell"),
  { ssr: false }
);

type MenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
};

const menuGroups: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: "Comando",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/assistente-ia", label: "Mente FortCordis", icon: BrainCircuit, adminOnly: true },
      { href: "/agenda", label: "Agenda", icon: Calendar },
      { href: "/agenda/fullcalendar", label: "Calendário", icon: CalendarDays },
      { href: "/atendimento", label: "Atendimento", icon: ClipboardPlus },
    ],
  },
  {
    label: "Clínica",
    items: [
      { href: "/pacientes", label: "Pacientes", icon: Users },
      { href: "/clinicas", label: "Clínicas", icon: Building2 },
      { href: "/clinicas/portal", label: "Portal Clinicas", icon: ShieldCheck },
      { href: "/servicos", label: "Serviços", icon: Stethoscope },
      { href: "/laudos", label: "Laudos", icon: FileText },
      { href: "/visualizador-vivid-iq", label: "Visualizador Vivid IQ", icon: Activity },
      { href: "/referencias-eco", label: "Referências Eco", icon: BookOpen },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/logistica", label: "Logística", icon: MapPin },
      { href: "/financeiro", label: "Financeiro", icon: DollarSign },
      { href: "/financeiro/frota", label: "Custos Frota", icon: Car },
      { href: "/fiscal", label: "Exportação Fiscal", icon: Receipt },
      { href: "/relatorios", label: "Relatórios", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/whatsapp-stage", label: "WhatsApp Stage", icon: MessageSquare },
      { href: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const menuItems = menuGroups.flatMap((group) => group.items);

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
  const router = useRouter();
  const pathname = usePathname();

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
    let cancelado = false;

    const validarSessao = async () => {
      try {
        const meResponse = await api.get("/auth/me");
        if (cancelado) {
          return;
        }

        const currentUser = meResponse.data;
        setUser(currentUser);
        localStorage.setItem("user", JSON.stringify(currentUser));
        await carregarBranding();
      } catch (error) {
        if (cancelado) {
          return;
        }
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        redirecionarParaLogin();
      } finally {
        if (!cancelado) {
          setAuthChecked(true);
        }
      }
    };

    void validarSessao();
    return () => {
      cancelado = true;
    };
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

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // best effort
    }
    try {
      const { removePushSubscriptionForCurrentDevice } = await import("@/lib/usePushNotifications");
      await removePushSubscriptionForCurrentDevice();
    } catch {
      // best effort
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const userIsAdmin = Array.isArray(user?.papeis)
    && user.papeis.some((role: unknown) => {
      const name = typeof role === "string"
        ? role
        : typeof role === "object" && role !== null && "nome" in role
          ? String((role as { nome?: unknown }).nome || "")
          : "";
      return name.toLowerCase() === "admin";
    });

  const activeHref = menuItems
    .filter((item) => pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shell">
        <div className="text-ink-500">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shell">
        <div className="text-ink-500">Redirecionando para login...</div>
      </div>
    );
  }

  const dashboardContent = (
    <div className="fc-app-shell">
        <PushNotificationsBootstrap enabled={authChecked && Boolean(user)} />
        <DashboardPushSnoozeHandler enabled={authChecked && Boolean(user)} />
        <DashboardOverlayCleanup />
        <AlertasInternosBell />
        {/* Header mobile */}
        <div className="fc-mobile-header flex items-center justify-between lg:hidden">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logomarca da clinica"
                className="h-8 w-8 fc-brand-logo"
              />
            ) : (
              <div className="h-8 w-8 fc-brand-mark">
                <span className="text-white font-bold text-sm">FC</span>
              </div>
            )}
            <h1 className="truncate text-lg font-bold text-ink-900">{nomeClinica}</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Fechar menu" : "Abrir menu"}
            className="p-2 text-ink-500 hover:text-ink-900"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } fixed inset-y-0 left-0 z-[60] w-64 fc-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0`}
          >
            <div className="h-full flex flex-col">
              {/* Logo */}
              <div className="fc-sidebar-head">
                <div className="flex items-start gap-3">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logomarca da clinica"
                      className="h-9 w-9 shrink-0 fc-brand-logo"
                    />
                  ) : (
                    <div className="h-9 w-9 shrink-0 fc-brand-mark">
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
                        className="w-full rounded-md border border-ink-100 px-2 py-1 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-2 focus:ring-cordis-500"
                        autoFocus
                      />
                    ) : (
                      <span className="block whitespace-normal break-words text-base font-bold leading-snug text-white">
                        {nomeClinica}
                      </span>
                    )}
                  </div>

                  {editandoNomeClinica ? (
                    <button
                      onClick={salvarNomeClinica}
                      disabled={salvandoNomeClinica}
                      className="shrink-0 rounded-md p-1.5 text-vital-100 hover:bg-white/10 disabled:opacity-60"
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
                      className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                      title="Editar nome da clinica"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {editandoNomeClinica && (
                  <p className="px-1 text-[11px] leading-4 text-white/50">
                    Pressione Enter para salvar ou Esc para cancelar.
                  </p>
                )}
              </div>

              {/* Menu */}
              <nav className="fc-sidebar-nav" aria-label="Navegação principal">
                {menuGroups.map((group) => (
                  <div key={group.label} className="fc-nav-group">
                    <p className="fc-nav-group-label">{group.label}</p>
                    <div className="space-y-1">
                      {group.items.filter((item) => !item.adminOnly || userIsAdmin).map((item) => {
                        const Icon = item.icon;
                        const isActive = activeHref === item.href;

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setSidebarOpen(false)}
                            aria-current={isActive ? "page" : undefined}
                            className={`fc-nav-link ${
                              isActive
                                ? "fc-nav-link-active"
                                : "fc-nav-link-idle"
                            }`}
                          >
                            <span className="fc-nav-icon">
                              <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-white/50"}`} />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* User & Logout */}
              <div className="fc-sidebar-footer">
                <div className="fc-user-chip">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
                    <User className="w-4 h-4 text-vital-100" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{user.nome}</p>
                    <p className="truncate text-xs text-white/50">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="fc-logout-button"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
                <p className="mt-3 px-3 text-[11px] leading-4 text-white/40">
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
