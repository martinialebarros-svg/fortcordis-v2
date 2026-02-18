"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  Settings,
  Building2,
  UserCircle,
  Image as ImageIcon,
  Signature,
  Save,
  Upload,
  X,
  Eye,
  Trash2,
  Users,
  Shield
} from "lucide-react";

interface ConfiguracoesSistema {
  nome_empresa: string;
  endereco: string;
  telefone: string;
  email: string;
  cidade: string;
  estado: string;
  website: string;
  tem_logomarca: boolean;
  tem_assinatura: boolean;
  texto_rodape_laudo: string;
  mostrar_logomarca: boolean;
  mostrar_assinatura: boolean;
}

interface ConfiguracoesUsuario {
  tema: string;
  idioma: string;
  notificacoes_email: boolean;
  notificacoes_push: boolean;
  tem_assinatura: boolean;
  crmv: string;
  especialidade: string;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [aba, setAba] = useState<"empresa" | "usuario" | "usuarios">("empresa");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Configurações da empresa
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema>({
    nome_empresa: "Fort Cordis Cardiologia Veterinária",
    endereco: "",
    telefone: "",
    email: "",
    cidade: "Fortaleza",
    estado: "CE",
    website: "",
    tem_logomarca: false,
    tem_assinatura: false,
    texto_rodape_laudo: "Fort Cordis Cardiologia Veterinária | Fortaleza-CE",
    mostrar_logomarca: true,
    mostrar_assinatura: true,
  });

  // Configurações do usuário
  const [configUsuario, setConfigUsuario] = useState<ConfiguracoesUsuario>({
    tema: "light",
    idioma: "pt-BR",
    notificacoes_email: true,
    notificacoes_push: true,
    tem_assinatura: false,
    crmv: "",
    especialidade: "",
  });

  // Preview de imagens
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [previewAssinaturaSistema, setPreviewAssinaturaSistema] = useState<string | null>(null);
  const [previewAssinaturaUsuario, setPreviewAssinaturaUsuario] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarConfiguracoes();
  }, [router]);

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);
      
      // Carregar configurações da empresa
      const respEmpresa = await api.get("/configuracoes");
      if (respEmpresa.data) {
        setConfigEmpresa((prev) => ({ ...prev, ...respEmpresa.data }));
        
        // Carregar preview da logomarca se existir
        if (respEmpresa.data.tem_logomarca) {
          setPreviewLogo("/api/v1/configuracoes/logomarca");
        }
        
        // Carregar preview da assinatura do sistema se existir
        if (respEmpresa.data.tem_assinatura) {
          setPreviewAssinaturaSistema("/api/v1/configuracoes/assinatura");
        }
      }
      
      // Carregar configurações do usuário
      const respUsuario = await api.get("/configuracoes/usuario");
      if (respUsuario.data) {
        setConfigUsuario((prev) => ({ ...prev, ...respUsuario.data }));
        
        // Carregar preview da assinatura do usuário se existir
        if (respUsuario.data.tem_assinatura) {
          setPreviewAssinaturaUsuario("/api/v1/configuracoes/usuario/assinatura");
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  const salvarConfigEmpresa = async () => {
    try {
      setSalvando(true);
      await api.put("/configuracoes", configEmpresa);
      alert("Configurações da empresa salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações da empresa.");
    } finally {
      setSalvando(false);
    }
  };

  const salvarConfigUsuario = async () => {
    try {
      setSalvando(true);
      await api.put("/configuracoes/usuario", configUsuario);
      alert("Configurações pessoais salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações pessoais.");
    } finally {
      setSalvando(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo: 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      await api.post("/configuracoes/logomarca", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      // Criar preview local
      const reader = new FileReader();
      reader.onloadend = () => setPreviewLogo(reader.result as string);
      reader.readAsDataURL(file);
      
      setConfigEmpresa((prev) => ({ ...prev, tem_logomarca: true }));
      alert("Logomarca atualizada com sucesso!");
    } catch (error) {
      alert("Erro ao fazer upload da logomarca.");
    }
  };

  const handleUploadAssinaturaSistema = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo: 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      await api.post("/configuracoes/assinatura", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const reader = new FileReader();
      reader.onloadend = () => setPreviewAssinaturaSistema(reader.result as string);
      reader.readAsDataURL(file);
      
      setConfigEmpresa((prev) => ({ ...prev, tem_assinatura: true }));
      alert("Assinatura do sistema atualizada com sucesso!");
    } catch (error) {
      alert("Erro ao fazer upload da assinatura.");
    }
  };

  const handleUploadAssinaturaUsuario = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. Máximo: 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      await api.post("/configuracoes/usuario/assinatura", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      const reader = new FileReader();
      reader.onloadend = () => setPreviewAssinaturaUsuario(reader.result as string);
      reader.readAsDataURL(file);
      
      setConfigUsuario((prev) => ({ ...prev, tem_assinatura: true }));
      alert("Assinatura pessoal atualizada com sucesso!");
    } catch (error) {
      alert("Erro ao fazer upload da assinatura pessoal.");
    }
  };

  const removerLogo = async () => {
    if (!confirm("Tem certeza que deseja remover a logomarca?")) return;
    
    try {
      await api.delete("/configuracoes/logomarca");
      setPreviewLogo(null);
      setConfigEmpresa((prev) => ({ ...prev, tem_logomarca: false }));
      alert("Logomarca removida com sucesso!");
    } catch (error) {
      alert("Erro ao remover logomarca.");
    }
  };

  const removerAssinaturaSistema = async () => {
    if (!confirm("Tem certeza que deseja remover a assinatura do sistema?")) return;
    
    try {
      await api.delete("/configuracoes/assinatura");
      setPreviewAssinaturaSistema(null);
      setConfigEmpresa((prev) => ({ ...prev, tem_assinatura: false }));
      alert("Assinatura removida com sucesso!");
    } catch (error) {
      alert("Erro ao remover assinatura.");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">Carregando configurações...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Configurações
          </h1>
          <p className="text-gray-500">Gerencie as configurações do sistema e sua conta</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setAba("empresa")}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              aba === "empresa"
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            <Building2 className="w-4 h-4" />
            Empresa
          </button>
          <button
            onClick={() => setAba("usuario")}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              aba === "usuario"
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            <UserCircle className="w-4 h-4" />
            Minha Conta
          </button>
          <button
            onClick={() => setAba("usuarios")}
            className={`px-4 py-2 font-medium flex items-center gap-2 border-b-2 transition-colors ${
              aba === "usuarios"
                ? "border-teal-600 text-teal-600"
                : "border-transparent text-gray-600 hover:text-gray-800"
            }`}
          >
            <Users className="w-4 h-4" />
            Usuários
          </button>
        </div>

        {/* Conteúdo */}
        {aba === "empresa" && (
          <div className="space-y-6">
            {/* Dados da Empresa */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Dados da Empresa
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Empresa
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.nome_empresa}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, nome_empresa: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={configEmpresa.email}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.telefone}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, telefone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.website}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Endereço
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.endereco}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, endereco: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.cidade}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, cidade: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estado
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    value={configEmpresa.estado}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, estado: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={salvarConfigEmpresa}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar Dados da Empresa"}
                </button>
              </div>
            </div>

            {/* Logomarca */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-teal-600" />
                Logomarca
              </h2>
              
              <div className="flex items-center gap-6">
                <div className="w-40 h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
                  {previewLogo ? (
                    <img src={previewLogo} alt="Logomarca" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-400 text-sm">Sem logomarca</span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload Logomarca
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadLogo}
                      className="hidden"
                    />
                  </label>
                  
                  {previewLogo && (
                    <button
                      onClick={removerLogo}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mostrar_logomarca"
                  checked={configEmpresa.mostrar_logomarca}
                  onChange={(e) => setConfigEmpresa({ ...configEmpresa, mostrar_logomarca: e.target.checked })}
                  className="w-4 h-4 text-teal-600"
                />
                <label htmlFor="mostrar_logomarca" className="text-sm text-gray-700">
                  Mostrar logomarca nos laudos
                </label>
              </div>
            </div>

            {/* Assinatura do Sistema */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Signature className="w-5 h-5 text-teal-600" />
                Assinatura Padrão do Sistema
              </h2>
              
              <div className="flex items-center gap-6">
                <div className="w-40 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
                  {previewAssinaturaSistema ? (
                    <img src={previewAssinaturaSistema} alt="Assinatura" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-400 text-sm">Sem assinatura</span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload Assinatura
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadAssinaturaSistema}
                      className="hidden"
                    />
                  </label>
                  
                  {previewAssinaturaSistema && (
                    <button
                      onClick={removerAssinaturaSistema}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  )}
                </div>
              </div>
              
              <p className="mt-3 text-sm text-gray-500">
                Esta assinatura será usada como padrão quando o usuário não tiver assinatura própria.
              </p>
              
              <div className="mt-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mostrar_assinatura"
                  checked={configEmpresa.mostrar_assinatura}
                  onChange={(e) => setConfigEmpresa({ ...configEmpresa, mostrar_assinatura: e.target.checked })}
                  className="w-4 h-4 text-teal-600"
                />
                <label htmlFor="mostrar_assinatura" className="text-sm text-gray-700">
                  Mostrar assinatura nos laudos
                </label>
              </div>
            </div>

            {/* Texto do Rodapé */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Texto do Rodapé do Laudo</h2>
              <textarea
                value={configEmpresa.texto_rodape_laudo}
                onChange={(e) => setConfigEmpresa({ ...configEmpresa, texto_rodape_laudo: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>
        )}

        {aba === "usuario" && (
          <div className="space-y-6">
            {/* Dados Profissionais */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-teal-600" />
                Dados Profissionais
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CRMV
                  </label>
                  <input
                    type="text"
                    value={configUsuario.crmv}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, crmv: e.target.value })}
                    placeholder="Ex: CE-1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Será exibido nos laudos emitidos por você
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Especialidade
                  </label>
                  <input
                    type="text"
                    value={configUsuario.especialidade}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, especialidade: e.target.value })}
                    placeholder="Ex: Cardiologia Veterinária"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* Assinatura Pessoal */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Signature className="w-5 h-5 text-teal-600" />
                Minha Assinatura
              </h2>
              
              <div className="flex items-center gap-6">
                <div className="w-40 h-24 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
                  {previewAssinaturaUsuario ? (
                    <img src={previewAssinaturaUsuario} alt="Assinatura" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-gray-400 text-sm">Sem assinatura</span>
                  )}
                </div>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    Upload Assinatura
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadAssinaturaUsuario}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              
              <p className="mt-3 text-sm text-gray-500">
                Esta assinatura será usada nos laudos emitidos por você. Se não houver assinatura pessoal, será usada a assinatura padrão do sistema.
              </p>
            </div>

            {/* Preferências */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Preferências</h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notif_email"
                    checked={configUsuario.notificacoes_email}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, notificacoes_email: e.target.checked })}
                    className="w-4 h-4 text-teal-600"
                  />
                  <label htmlFor="notif_email" className="text-sm text-gray-700">
                    Receber notificações por e-mail
                  </label>
                </div>
                
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notif_push"
                    checked={configUsuario.notificacoes_push}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, notificacoes_push: e.target.checked })}
                    className="w-4 h-4 text-teal-600"
                  />
                  <label htmlFor="notif_push" className="text-sm text-gray-700">
                    Receber notificações push
                  </label>
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={salvarConfigUsuario}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar Configurações"}
                </button>
              </div>
            </div>
          </div>
        )}

        {aba === "usuarios" && (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Gerenciamento de Usuários</h3>
            <p className="text-gray-500 mt-2">
              Esta funcionalidade será implementada em breve. Aqui você poderá criar usuários, atribuir permissões e gerenciar o acesso ao sistema.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
