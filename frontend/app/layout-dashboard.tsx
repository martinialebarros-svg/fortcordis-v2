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
  Receipt
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
  { href: "/fiscal", label: "Exportacao Fiscal", icon: Receipt },
  { href: "/whatsapp-stage", label: "WhatsApp Stage", icon: MessageSquare },
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
        <PushNotificationsBootstrap enabled={authChecked && Boolean(user)} />
        <DashboardPushSnoozeHandler enabled={authChecked && Boolean(user)} />
        <DashboardOverlayCleanup />
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
