"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import {
  AgendaExcecaoConfig,
  AgendaFeriadoConfig,
  AgendaSemanalConfig,
  DEFAULT_AGENDA_SEMANAL,
  DIAS_SEMANA_LABELS,
  normalizarAgendaExcecoes,
  normalizarAgendaFeriados,
  normalizarAgendaSemanal,
} from "@/lib/agenda-config";
import {
  Settings,
  Building2,
  UserCircle,
  Image as ImageIcon,
  Signature,
  Save,
  Upload,
  X,
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
  agenda_semanal: AgendaSemanalConfig;
  agenda_feriados: AgendaFeriadoConfig[];
  agenda_excecoes: AgendaExcecaoConfig[];
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

interface PapelSistema {
  id: number;
  nome: string;
  descricao?: string | null;
}

interface UsuarioSistema {
  id: number;
  nome: string;
  email: string;
  ativo: number;
  papeis: string[];
  criado_em?: string | null;
  ultimo_acesso?: string | null;
}

interface UsuarioForm {
  id: number | null;
  nome: string;
  email: string;
  senha: string;
  ativo: boolean;
  papeis: string[];
}

interface ModuloPermissao {
  codigo: string;
  nome: string;
}

interface PermissaoPapel {
  modulo: string;
  visualizar: boolean;
  editar: boolean;
  excluir: boolean;
}

interface MatrizPermissaoPapel {
  id: number;
  nome: string;
  descricao?: string | null;
  permissoes: PermissaoPapel[];
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
    agenda_semanal: normalizarAgendaSemanal(DEFAULT_AGENDA_SEMANAL),
    agenda_feriados: [],
    agenda_excecoes: [],
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
  const [usuariosSistema, setUsuariosSistema] = useState<UsuarioSistema[]>([]);
  const [papeisSistema, setPapeisSistema] = useState<PapelSistema[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [salvandoUsuarioSistema, setSalvandoUsuarioSistema] = useState(false);
  const [erroUsuarios, setErroUsuarios] = useState("");
  const [erroPermissoes, setErroPermissoes] = useState("");
  const [carregandoPermissoes, setCarregandoPermissoes] = useState(false);
  const [salvandoPermissoes, setSalvandoPermissoes] = useState(false);
  const [modulosPermissoes, setModulosPermissoes] = useState<ModuloPermissao[]>([]);
  const [matrizPermissoes, setMatrizPermissoes] = useState<MatrizPermissaoPapel[]>([]);
  const [modoEdicaoUsuario, setModoEdicaoUsuario] = useState(false);
  const [novoFeriadoData, setNovoFeriadoData] = useState("");
  const [novoFeriadoTipo, setNovoFeriadoTipo] = useState<"local" | "nacional">("local");
  const [novoFeriadoDescricao, setNovoFeriadoDescricao] = useState("");
  const [novaExcecaoData, setNovaExcecaoData] = useState("");
  const [novaExcecaoAtiva, setNovaExcecaoAtiva] = useState(true);
  const [novaExcecaoInicio, setNovaExcecaoInicio] = useState("08:00");
  const [novaExcecaoFim, setNovaExcecaoFim] = useState("18:00");
  const [novaExcecaoMotivo, setNovaExcecaoMotivo] = useState("");
  const [usuarioForm, setUsuarioForm] = useState<UsuarioForm>({
    id: null,
    nome: "",
    email: "",
    senha: "",
    ativo: true,
    papeis: [],
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    carregarConfiguracoes();
  }, [router]);

  useEffect(() => {
    if (aba === "usuarios") {
      carregarUsuariosPermissoes();
    }
  }, [aba]);

  const carregarImagem = async (url: string): Promise<string | null> => {
    try {
      const response = await api.get(url, { responseType: 'blob' });
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.error(`Erro ao carregar imagem ${url}:`, error);
      return null;
    }
  };

  const formatarDataHora = (valor?: string | null) => {
    if (!valor) return "-";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return "-";
    return data.toLocaleString("pt-BR");
  };

  const limparFormularioUsuario = () => {
    setUsuarioForm({
      id: null,
      nome: "",
      email: "",
      senha: "",
      ativo: true,
      papeis: [],
    });
    setModoEdicaoUsuario(false);
  };

  const carregarUsuariosPermissoes = async () => {
    try {
      setCarregandoUsuarios(true);
      setCarregandoPermissoes(true);
      setErroUsuarios("");
      setErroPermissoes("");
      const [respPapeis, respUsuarios, respPermissoes] = await Promise.all([
        api.get("/admin/papeis"),
        api.get("/admin/usuarios"),
        api.get("/admin/permissoes"),
      ]);
      setPapeisSistema(Array.isArray(respPapeis.data) ? respPapeis.data : []);
      setUsuariosSistema(Array.isArray(respUsuarios.data) ? respUsuarios.data : []);
      const payloadPermissoes = respPermissoes?.data || {};
      setModulosPermissoes(Array.isArray(payloadPermissoes.modulos) ? payloadPermissoes.modulos : []);
      setMatrizPermissoes(Array.isArray(payloadPermissoes.papeis) ? payloadPermissoes.papeis : []);
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      const mensagem = typeof detalhe === "string" ? detalhe : "Erro ao carregar usuarios e permissoes.";
      setErroUsuarios(mensagem);
      setErroPermissoes(mensagem);
    } finally {
      setCarregandoUsuarios(false);
      setCarregandoPermissoes(false);
    }
  };

  const alternarPermissao = (
    papelId: number,
    modulo: string,
    campo: "visualizar" | "editar" | "excluir"
  ) => {
    setMatrizPermissoes((anterior) =>
      anterior.map((papel) => {
        if (papel.id !== papelId) return papel;
        const existe = papel.permissoes.some((perm) => perm.modulo === modulo);
        const permissoesAtualizadas = existe
          ? papel.permissoes.map((perm) =>
              perm.modulo === modulo ? { ...perm, [campo]: !perm[campo] } : perm
            )
          : [...papel.permissoes, { modulo, visualizar: false, editar: false, excluir: false, [campo]: true }];

        return {
          ...papel,
          permissoes: permissoesAtualizadas,
        };
      })
    );
  };

  const salvarPermissoes = async () => {
    const itens = matrizPermissoes.flatMap((papel) =>
      papel.permissoes.map((perm) => ({
        papel_id: papel.id,
        modulo: perm.modulo,
        visualizar: !!perm.visualizar,
        editar: !!perm.editar,
        excluir: !!perm.excluir,
      }))
    );

    if (itens.length === 0) {
      alert("Nao ha permissoes para salvar.");
      return;
    }

    try {
      setSalvandoPermissoes(true);
      await api.put("/admin/permissoes", { itens });
      alert("Permissoes salvas com sucesso.");
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      alert(typeof detalhe === "string" ? detalhe : "Erro ao salvar permissoes.");
    } finally {
      setSalvandoPermissoes(false);
    }
  };

  const alternarPapelFormulario = (nomePapel: string) => {
    setUsuarioForm((anterior) => {
      const jaSelecionado = anterior.papeis.includes(nomePapel);
      if (jaSelecionado) {
        return {
          ...anterior,
          papeis: anterior.papeis.filter((papel) => papel !== nomePapel),
        };
      }
      return { ...anterior, papeis: [...anterior.papeis, nomePapel] };
    });
  };

  const editarUsuario = (usuario: UsuarioSistema) => {
    setModoEdicaoUsuario(true);
    setUsuarioForm({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      senha: "",
      ativo: usuario.ativo === 1,
      papeis: usuario.papeis || [],
    });
  };

  const salvarUsuarioSistema = async () => {
    const nome = usuarioForm.nome.trim();
    const email = usuarioForm.email.trim().toLowerCase();
    const senha = usuarioForm.senha.trim();

    if (!nome || !email) {
      alert("Informe nome e email.");
      return;
    }

    if (!modoEdicaoUsuario && !senha) {
      alert("Informe a senha para criar o usuario.");
      return;
    }

    const payload: Record<string, any> = {
      nome,
      email,
      ativo: usuarioForm.ativo ? 1 : 0,
      papeis: usuarioForm.papeis,
    };

    if (senha) {
      payload.senha = senha;
    }

    try {
      setSalvandoUsuarioSistema(true);
      if (modoEdicaoUsuario && usuarioForm.id) {
        await api.put(`/admin/usuarios/${usuarioForm.id}`, payload);
        alert("Usuario atualizado com sucesso.");
      } else {
        await api.post("/admin/usuarios", payload);
        alert("Usuario criado com sucesso.");
      }
      limparFormularioUsuario();
      await carregarUsuariosPermissoes();
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      alert(typeof detalhe === "string" ? detalhe : "Erro ao salvar usuario.");
    } finally {
      setSalvandoUsuarioSistema(false);
    }
  };

  const desativarUsuario = async (usuario: UsuarioSistema) => {
    if (!confirm(`Deseja desativar o usuario ${usuario.nome}?`)) {
      return;
    }

    try {
      await api.delete(`/admin/usuarios/${usuario.id}`);
      if (usuarioForm.id === usuario.id) {
        limparFormularioUsuario();
      }
      await carregarUsuariosPermissoes();
      alert("Usuario desativado.");
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      alert(typeof detalhe === "string" ? detalhe : "Erro ao desativar usuario.");
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);
      
      // Carregar configurações da empresa
      const respEmpresa = await api.get("/configuracoes");
      if (respEmpresa.data) {
        setConfigEmpresa((prev) => ({
          ...prev,
          ...respEmpresa.data,
          agenda_semanal: normalizarAgendaSemanal(respEmpresa.data?.agenda_semanal),
          agenda_feriados: normalizarAgendaFeriados(respEmpresa.data?.agenda_feriados),
          agenda_excecoes: normalizarAgendaExcecoes(respEmpresa.data?.agenda_excecoes),
        }));
        
        // Carregar preview da logomarca se existir
        if (respEmpresa.data.tem_logomarca) {
          const logoUrl = await carregarImagem("/configuracoes/logomarca");
          if (logoUrl) setPreviewLogo(logoUrl);
        }
        
        // Carregar preview da assinatura do sistema se existir
        if (respEmpresa.data.tem_assinatura) {
          const assUrl = await carregarImagem("/configuracoes/assinatura");
          if (assUrl) setPreviewAssinaturaSistema(assUrl);
        }
      }
      
      // Carregar configurações do usuário
      const respUsuario = await api.get("/configuracoes/usuario");
      if (respUsuario.data) {
        setConfigUsuario((prev) => ({ ...prev, ...respUsuario.data }));
        
        // Carregar preview da assinatura do usuário se existir
        if (respUsuario.data.tem_assinatura) {
          const assUrl = await carregarImagem("/configuracoes/usuario/assinatura");
          if (assUrl) setPreviewAssinaturaUsuario(assUrl);
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
      const payload = {
        ...configEmpresa,
        agenda_semanal: normalizarAgendaSemanal(configEmpresa.agenda_semanal),
        agenda_feriados: normalizarAgendaFeriados(configEmpresa.agenda_feriados),
        agenda_excecoes: normalizarAgendaExcecoes(configEmpresa.agenda_excecoes),
      };
      await api.put("/configuracoes", payload);
      setConfigEmpresa((prev) => ({
        ...prev,
        agenda_semanal: payload.agenda_semanal,
        agenda_feriados: payload.agenda_feriados,
        agenda_excecoes: payload.agenda_excecoes,
      }));
      alert("Configurações da empresa salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configurações da empresa.");
    } finally {
      setSalvando(false);
    }
  };

  const atualizarJornadaDia = (
    dia: keyof AgendaSemanalConfig,
    campo: "ativo" | "inicio" | "fim",
    valor: boolean | string
  ) => {
    setConfigEmpresa((prev) => {
      const agendaAtual = normalizarAgendaSemanal(prev.agenda_semanal);
      const diaAtual = agendaAtual[dia];
      return {
        ...prev,
        agenda_semanal: {
          ...agendaAtual,
          [dia]: {
            ...diaAtual,
            [campo]: valor,
          },
        },
      };
    });
  };

  const adicionarFeriado = () => {
    if (!novoFeriadoData) {
      alert("Selecione a data do feriado.");
      return;
    }

    const novoItem: AgendaFeriadoConfig = {
      data: novoFeriadoData,
      tipo: novoFeriadoTipo,
      descricao: novoFeriadoDescricao.trim(),
    };

    setConfigEmpresa((prev) => ({
      ...prev,
      agenda_feriados: normalizarAgendaFeriados([...prev.agenda_feriados, novoItem]),
    }));
    setNovoFeriadoData("");
    setNovoFeriadoDescricao("");
    setNovoFeriadoTipo("local");
  };

  const removerFeriado = (data: string) => {
    setConfigEmpresa((prev) => ({
      ...prev,
      agenda_feriados: prev.agenda_feriados.filter((item) => item.data !== data),
    }));
  };

  const adicionarExcecao = () => {
    if (!novaExcecaoData) {
      alert("Selecione a data da excecao.");
      return;
    }

    const novaExcecao: AgendaExcecaoConfig = {
      data: novaExcecaoData,
      ativo: novaExcecaoAtiva,
      inicio: novaExcecaoInicio,
      fim: novaExcecaoFim,
      motivo: novaExcecaoMotivo.trim(),
    };

    setConfigEmpresa((prev) => ({
      ...prev,
      agenda_excecoes: normalizarAgendaExcecoes([...prev.agenda_excecoes, novaExcecao]),
    }));
    setNovaExcecaoData("");
    setNovaExcecaoAtiva(true);
    setNovaExcecaoInicio("08:00");
    setNovaExcecaoFim("18:00");
    setNovaExcecaoMotivo("");
  };

  const removerExcecao = (data: string) => {
    setConfigEmpresa((prev) => ({
      ...prev,
      agenda_excecoes: prev.agenda_excecoes.filter((item) => item.data !== data),
    }));
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
      await api.post("/configuracoes/logomarca", formData);
      
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
      await api.post("/configuracoes/assinatura", formData);
      
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
      await api.post("/configuracoes/usuario/assinatura", formData);
      
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

  const agendaSemanalAtual = normalizarAgendaSemanal(configEmpresa.agenda_semanal);

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

            {/* Jornada da Agenda */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-2">Funcionamento da Agenda</h2>
              <p className="text-sm text-gray-500 mb-4">
                Defina abertura/fechamento por dia da semana e os feriados (local ou nacional) em que a agenda fica fechada.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Dia</th>
                      <th className="text-left px-3 py-2 font-medium">Aberta</th>
                      <th className="text-left px-3 py-2 font-medium">Abre</th>
                      <th className="text-left px-3 py-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIAS_SEMANA_LABELS.map((dia) => {
                      const cfg = agendaSemanalAtual[dia.id];
                      return (
                        <tr key={dia.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800">{dia.nome}</td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={cfg.ativo}
                              onChange={(e) => atualizarJornadaDia(dia.id, "ativo", e.target.checked)}
                              className="w-4 h-4 text-teal-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={cfg.inicio}
                              disabled={!cfg.ativo}
                              onChange={(e) => atualizarJornadaDia(dia.id, "inicio", e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={cfg.fim}
                              disabled={!cfg.ativo}
                              onChange={(e) => atualizarJornadaDia(dia.id, "fim", e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Feriados com agenda fechada</h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <input
                    type="date"
                    value={novoFeriadoData}
                    onChange={(e) => setNovoFeriadoData(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={novoFeriadoTipo}
                    onChange={(e) => setNovoFeriadoTipo((e.target.value === "nacional" ? "nacional" : "local"))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="local">Local</option>
                    <option value="nacional">Nacional</option>
                  </select>
                  <input
                    type="text"
                    value={novoFeriadoDescricao}
                    onChange={(e) => setNovoFeriadoDescricao(e.target.value)}
                    placeholder="Descricao (opcional)"
                    className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2"
                  />
                </div>

                <button
                  type="button"
                  onClick={adicionarFeriado}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Adicionar feriado
                </button>

                <div className="mt-4 space-y-2">
                  {configEmpresa.agenda_feriados.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhum feriado cadastrado.</p>
                  ) : (
                    configEmpresa.agenda_feriados.map((feriado) => (
                      <div
                        key={feriado.data}
                        className="flex items-center justify-between gap-3 px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">{new Date(`${feriado.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                          <span className="mx-2 text-gray-400">|</span>
                          <span className="uppercase text-xs font-semibold text-orange-700">
                            {feriado.tipo || "local"}
                          </span>
                          {(feriado.descricao || "").trim() ? (
                            <span className="ml-2 text-gray-600">- {feriado.descricao}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removerFeriado(feriado.data)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg p-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3">Excecoes por data (horario especial)</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Use para ampliar ou reduzir horario em um dia especifico. Exemplo: amanha das 08:00 as 18:00.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
                  <input
                    type="date"
                    value={novaExcecaoData}
                    onChange={(e) => setNovaExcecaoData(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={novaExcecaoAtiva}
                      onChange={(e) => setNovaExcecaoAtiva(e.target.checked)}
                      className="w-4 h-4 text-teal-600"
                    />
                    Agenda aberta
                  </label>
                  <input
                    type="time"
                    value={novaExcecaoInicio}
                    disabled={!novaExcecaoAtiva}
                    onChange={(e) => setNovaExcecaoInicio(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <input
                    type="time"
                    value={novaExcecaoFim}
                    disabled={!novaExcecaoAtiva}
                    onChange={(e) => setNovaExcecaoFim(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={adicionarExcecao}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Adicionar excecao
                  </button>
                </div>

                <input
                  type="text"
                  value={novaExcecaoMotivo}
                  onChange={(e) => setNovaExcecaoMotivo(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4"
                />

                <div className="space-y-2">
                  {configEmpresa.agenda_excecoes.length === 0 ? (
                    <p className="text-sm text-gray-500">Nenhuma excecao cadastrada.</p>
                  ) : (
                    configEmpresa.agenda_excecoes.map((excecao) => (
                      <div
                        key={excecao.data}
                        className="flex items-center justify-between gap-3 px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <div className="text-sm text-gray-700">
                          <span className="font-medium">{new Date(`${excecao.data}T00:00:00`).toLocaleDateString("pt-BR")}</span>
                          <span className="mx-2 text-gray-400">|</span>
                          {excecao.ativo ? (
                            <span className="text-emerald-700 font-medium">
                              Aberta {excecao.inicio} as {excecao.fim}
                            </span>
                          ) : (
                            <span className="text-red-700 font-medium">Fechada</span>
                          )}
                          {(excecao.motivo || "").trim() ? (
                            <span className="ml-2 text-gray-600">- {excecao.motivo}</span>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removerExcecao(excecao.data)}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={salvarConfigEmpresa}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar funcionamento da agenda"}
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
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-1 bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {modoEdicaoUsuario ? "Editar usuario" : "Novo usuario"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Defina os dados de acesso e os papeis do usuario no sistema.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={usuarioForm.nome}
                    onChange={(e) => setUsuarioForm((prev) => ({ ...prev, nome: e.target.value }))}
                    placeholder="Nome completo"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={usuarioForm.email}
                    onChange={(e) => setUsuarioForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="usuario@email.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Senha {modoEdicaoUsuario && <span className="text-gray-400">(opcional)</span>}
                  </label>
                  <input
                    type="password"
                    value={usuarioForm.senha}
                    onChange={(e) => setUsuarioForm((prev) => ({ ...prev, senha: e.target.value }))}
                    placeholder={modoEdicaoUsuario ? "Preencha para trocar a senha" : "Senha inicial"}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="usuario_ativo"
                    type="checkbox"
                    checked={usuarioForm.ativo}
                    onChange={(e) => setUsuarioForm((prev) => ({ ...prev, ativo: e.target.checked }))}
                    className="w-4 h-4 text-teal-600"
                  />
                  <label htmlFor="usuario_ativo" className="text-sm text-gray-700">
                    Usuario ativo
                  </label>
                </div>

                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-2">Papeis</p>
                  <div className="space-y-2 max-h-36 overflow-auto pr-1">
                    {papeisSistema.length === 0 && (
                      <p className="text-sm text-gray-400">Nenhum papel disponivel.</p>
                    )}
                    {papeisSistema.map((papel) => (
                      <label key={papel.id} className="flex items-start gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={usuarioForm.papeis.includes(papel.nome)}
                          onChange={() => alternarPapelFormulario(papel.nome)}
                          className="mt-0.5 w-4 h-4 text-teal-600"
                        />
                        <span>
                          <span className="font-medium">{papel.nome}</span>
                          {papel.descricao ? (
                            <span className="block text-xs text-gray-500">{papel.descricao}</span>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={salvarUsuarioSistema}
                  disabled={salvandoUsuarioSistema}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvandoUsuarioSistema
                    ? "Salvando..."
                    : modoEdicaoUsuario
                      ? "Atualizar usuario"
                      : "Criar usuario"}
                </button>

                <button
                  onClick={limparFormularioUsuario}
                  type="button"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <X className="w-4 h-4" />
                  Limpar
                </button>
              </div>
            </div>

            <div className="xl:col-span-2 bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Usuarios cadastrados</h3>
                <button
                  onClick={carregarUsuariosPermissoes}
                  type="button"
                  disabled={carregandoUsuarios}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {carregandoUsuarios ? "Atualizando..." : "Atualizar"}
                </button>
              </div>

              {erroUsuarios ? (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {erroUsuarios}
                </div>
              ) : null}

              {carregandoUsuarios ? (
                <div className="py-8 text-center text-gray-500">Carregando usuarios...</div>
              ) : usuariosSistema.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  Nenhum usuario encontrado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Nome</th>
                        <th className="text-left px-3 py-2 font-medium">E-mail</th>
                        <th className="text-left px-3 py-2 font-medium">Papeis</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-left px-3 py-2 font-medium">Ultimo acesso</th>
                        <th className="text-right px-3 py-2 font-medium">Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usuariosSistema.map((usuario) => (
                        <tr key={usuario.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-900">{usuario.nome}</td>
                          <td className="px-3 py-2 text-gray-700">{usuario.email}</td>
                          <td className="px-3 py-2 text-gray-700">
                            {usuario.papeis?.length ? usuario.papeis.join(", ") : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                usuario.ativo === 1
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {usuario.ativo === 1 ? "Ativo" : "Inativo"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            {formatarDataHora(usuario.ultimo_acesso)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => editarUsuario(usuario)}
                                className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                              >
                                Editar
                              </button>
                              {usuario.ativo === 1 ? (
                                <button
                                  onClick={() => desativarUsuario(usuario)}
                                  className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  Desativar
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="xl:col-span-3 bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Permissoes por papel</h3>
                  <p className="text-sm text-gray-500">
                    Marque o que cada papel pode visualizar, editar ou excluir.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={carregarUsuariosPermissoes}
                    type="button"
                    disabled={carregandoPermissoes}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                  >
                    {carregandoPermissoes ? "Atualizando..." : "Atualizar"}
                  </button>
                  <button
                    onClick={salvarPermissoes}
                    type="button"
                    disabled={salvandoPermissoes || carregandoPermissoes}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {salvandoPermissoes ? "Salvando..." : "Salvar permissoes"}
                  </button>
                </div>
              </div>

              {erroPermissoes ? (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {erroPermissoes}
                </div>
              ) : null}

              {carregandoPermissoes ? (
                <div className="py-8 text-center text-gray-500">Carregando matriz de permissoes...</div>
              ) : matrizPermissoes.length === 0 ? (
                <div className="py-8 text-center text-gray-500">Nenhum papel encontrado para configurar.</div>
              ) : (
                <div className="space-y-4">
                  {matrizPermissoes.map((papel) => (
                    <div key={papel.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="mb-3">
                        <p className="text-sm font-semibold text-gray-900">{papel.nome}</p>
                        {papel.descricao ? (
                          <p className="text-xs text-gray-500">{papel.descricao}</p>
                        ) : null}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Modulo</th>
                              <th className="text-center px-3 py-2 font-medium">Visualizar</th>
                              <th className="text-center px-3 py-2 font-medium">Editar</th>
                              <th className="text-center px-3 py-2 font-medium">Excluir</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modulosPermissoes.map((modulo) => {
                              const permissao = papel.permissoes.find((perm) => perm.modulo === modulo.codigo);
                              return (
                                <tr key={`${papel.id}-${modulo.codigo}`} className="border-t border-gray-100">
                                  <td className="px-3 py-2 text-gray-800">{modulo.nome}</td>
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!permissao?.visualizar}
                                      onChange={() => alternarPermissao(papel.id, modulo.codigo, "visualizar")}
                                      className="w-4 h-4 text-teal-600"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!permissao?.editar}
                                      onChange={() => alternarPermissao(papel.id, modulo.codigo, "editar")}
                                      className="w-4 h-4 text-teal-600"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={!!permissao?.excluir}
                                      onChange={() => alternarPermissao(papel.id, modulo.codigo, "excluir")}
                                      className="w-4 h-4 text-teal-600"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
