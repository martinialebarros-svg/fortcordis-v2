"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import {
  Calendar,
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
  Settings,
  BookOpen,
  Pencil,
  Check,
  Loader2
} from "lucide-react";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/pacientes", label: "Pacientes", icon: Users },
  { href: "/clinicas", label: "Clínicas", icon: Building2 },
  { href: "/servicos", label: "Serviços", icon: Stethoscope },
  { href: "/laudos", label: "Laudos", icon: FileText },
  { href: "/atendimento", label: "Atendimento", icon: ClipboardPlus },
  { href: "/referencias-eco", label: "Referências Eco", icon: BookOpen },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [nomeClinica, setNomeClinica] = useState("FortCordis");
  const [nomeClinicaDraft, setNomeClinicaDraft] = useState("FortCordis");
  const [editandoNomeClinica, setEditandoNomeClinica] = useState(false);
  const [salvandoNomeClinica, setSalvandoNomeClinica] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const atualizarLogoUrl = (novaUrl: string | null) => {
    setLogoUrl((anterior) => {
      if (anterior) {
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

      const deveMostrarLogo = respConfig.data?.mostrar_logomarca !== false;
      const temLogo = Boolean(respConfig.data?.tem_logomarca);

      if (deveMostrarLogo && temLogo) {
        const respLogo = await api.get("/configuracoes/logomarca", {
          responseType: "blob",
        });
        atualizarLogoUrl(URL.createObjectURL(respLogo.data));
        return;
      }

      atualizarLogoUrl(null);
    } catch (error) {
      console.error("Erro ao carregar branding da clinica:", error);
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
    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    
    if (!userData || !token) {
      router.push("/");
      return;
    }
    
    setUser(JSON.parse(userData));
    carregarBranding();
  }, [router]);

  useEffect(() => {
    return () => {
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [logoUrl]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Carregando...</div>
      </div>
    );
  }

  return (
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
          } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r transition-transform duration-200 ease-in-out`}
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

        {/* Overlay mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
