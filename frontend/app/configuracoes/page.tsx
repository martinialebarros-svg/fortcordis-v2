"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "../layout-dashboard";
import api from "@/lib/axios";
import { requestPushSync, syncPushNotificationsNow } from "@/lib/usePushNotifications";
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
  fortinho_habilitado: boolean;
  agenda_semanal: AgendaSemanalConfig;
  agenda_feriados: AgendaFeriadoConfig[];
  agenda_excecoes: AgendaExcecaoConfig[];
  inscricao_municipal: string;
  inscricao_estadual: string;
  cnae: string;
  regime_tributario: number | null;
  codigo_municipio_servico: string;
}

interface ConfiguracoesUsuario {
  tema: string;
  idioma: string;
  notificacoes_email: boolean;
  notificacoes_push: boolean;
  notificacoes_push_tipos: string[];
  notificacoes_push_prioridade_alta_tipos: string[];
  notificacoes_push_agrupar: boolean;
  notificacoes_push_lembrete_pendencias: boolean;
  notificacoes_push_lembrete_horas: number;
  notificacoes_push_perfil: string;
  tem_assinatura: boolean;
  crmv: string;
  especialidade: string;
}

const TIPOS_PUSH_AGENDA_OPCOES: Array<{ valor: string; label: string; descricao: string }> = [
  { valor: "created", label: "Novo agendamento", descricao: "Quando um agendamento for criado." },
  { valor: "updated", label: "Agendamento atualizado", descricao: "Quando data, horario ou dados forem alterados." },
  { valor: "status_changed", label: "Mudanca de status", descricao: "Quando o status mudar (confirmado, realizado etc.)." },
  { valor: "cancelled", label: "Agendamento cancelado", descricao: "Quando o agendamento for marcado como cancelado." },
  { valor: "deleted", label: "Agendamento excluido", descricao: "Quando um agendamento for removido." },
];

const TIPOS_PUSH_FINANCEIRO_OPCOES: Array<{ valor: string; label: string; descricao: string }> = [
  { valor: "os_generated", label: "OS gerada", descricao: "Quando uma ordem de servico for gerada." },
  { valor: "payment_received", label: "Pagamento recebido", descricao: "Quando uma OS for marcada como paga." },
  { valor: "os_deleted", label: "OS excluida", descricao: "Quando uma ordem de servico for removida." },
  { valor: "payment_pending", label: "Lembrete de pendencia", descricao: "Quando a OS segue pendente apos X horas." },
];

const TIPOS_PUSH_OPCOES = [...TIPOS_PUSH_AGENDA_OPCOES, ...TIPOS_PUSH_FINANCEIRO_OPCOES];
const TIPOS_PUSH_VALIDOS = new Set(TIPOS_PUSH_OPCOES.map((item) => item.valor));
const TIPOS_PUSH_PRIORIDADE_ALTA_PADRAO = ["os_deleted", "payment_pending"];

interface PerfilPushPreset {
  perfil: string;
  titulo: string;
  descricao: string;
  tipos: string[];
  alta_prioridade: string[];
  agrupar: boolean;
  lembrete_pendencias: boolean;
  lembrete_horas: number;
}

const PERFIS_PUSH_PRESETS: PerfilPushPreset[] = [
  {
    perfil: "recepcao",
    titulo: "Recepcao",
    descricao: "Foco em agenda e fluxo geral de atendimento.",
    tipos: ["created", "updated", "status_changed", "cancelled", "deleted", "os_generated"],
    alta_prioridade: ["status_changed", "cancelled", "deleted"],
    agrupar: true,
    lembrete_pendencias: false,
    lembrete_horas: 6,
  },
  {
    perfil: "financeiro",
    titulo: "Financeiro",
    descricao: "Foco em OS, recebimentos e pendencias de pagamento.",
    tipos: ["os_generated", "payment_received", "os_deleted", "payment_pending"],
    alta_prioridade: ["os_deleted", "payment_pending"],
    agrupar: true,
    lembrete_pendencias: true,
    lembrete_horas: 6,
  },
  {
    perfil: "medico",
    titulo: "Medico",
    descricao: "Foco em mudancas de agenda e eventos clinicos.",
    tipos: ["created", "updated", "status_changed", "cancelled", "deleted", "os_generated"],
    alta_prioridade: ["status_changed", "cancelled"],
    agrupar: false,
    lembrete_pendencias: false,
    lembrete_horas: 8,
  },
];

const normalizarTiposPushAgenda = (valor: unknown): string[] => {
  if (valor == null) {
    return TIPOS_PUSH_OPCOES.map((item) => item.valor);
  }

  const bruto = Array.isArray(valor)
    ? valor
    : String(valor)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const vistos = new Set<string>();
  const normalizado: string[] = [];
  for (const item of bruto) {
    const chave = String(item || "").trim().toLowerCase();
    if (!TIPOS_PUSH_VALIDOS.has(chave) || vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);
    normalizado.push(chave);
  }
  return normalizado;
};

const normalizarTiposPrioridadeAltaPush = (valor: unknown): string[] => {
  if (valor == null) {
    return [...TIPOS_PUSH_PRIORIDADE_ALTA_PADRAO];
  }
  return normalizarTiposPushAgenda(valor);
};

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

interface AuditoriaEventoItem {
  id: number;
  created_at?: string | null;
  usuario_id?: number | null;
  usuario_nome?: string | null;
  usuario_email?: string | null;
  modulo: string;
  entidade: string;
  entidade_id?: string | null;
  acao: string;
  descricao?: string | null;
  detalhes?: Record<string, any>;
  ip_origem?: string | null;
  rota?: string | null;
  metodo?: string | null;
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [aba, setAba] = useState<"empresa" | "usuario" | "usuarios">("empresa");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // ConfiguraÃ§Ãµes da empresa
  const [configEmpresa, setConfigEmpresa] = useState<ConfiguracoesSistema>({
    nome_empresa: "Fort Cordis Cardiologia VeterinÃ¡ria",
    endereco: "",
    telefone: "",
    email: "",
    cidade: "Fortaleza",
    estado: "CE",
    website: "",
    tem_logomarca: false,
    tem_assinatura: false,
    texto_rodape_laudo: "Fort Cordis Cardiologia VeterinÃ¡ria | Fortaleza-CE",
    mostrar_logomarca: true,
    mostrar_assinatura: true,
    fortinho_habilitado: false,
    agenda_semanal: normalizarAgendaSemanal(DEFAULT_AGENDA_SEMANAL),
    agenda_feriados: [],
    agenda_excecoes: [],
    inscricao_municipal: "",
    inscricao_estadual: "",
    cnae: "",
    regime_tributario: null,
    codigo_municipio_servico: "",
  });

  // ConfiguraÃ§Ãµes do usuÃ¡rio
  const [configUsuario, setConfigUsuario] = useState<ConfiguracoesUsuario>({
    tema: "light",
    idioma: "pt-BR",
    notificacoes_email: true,
    notificacoes_push: true,
    notificacoes_push_tipos: TIPOS_PUSH_OPCOES.map((item) => item.valor),
    notificacoes_push_prioridade_alta_tipos: [...TIPOS_PUSH_PRIORIDADE_ALTA_PADRAO],
    notificacoes_push_agrupar: true,
    notificacoes_push_lembrete_pendencias: true,
    notificacoes_push_lembrete_horas: 6,
    notificacoes_push_perfil: "custom",
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
  const [somenteLeituraAgenda, setSomenteLeituraAgenda] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [modulosPermissoes, setModulosPermissoes] = useState<ModuloPermissao[]>([]);
  const [matrizPermissoes, setMatrizPermissoes] = useState<MatrizPermissaoPapel[]>([]);
  const [auditoriaItens, setAuditoriaItens] = useState<AuditoriaEventoItem[]>([]);
  const [auditoriaTotal, setAuditoriaTotal] = useState(0);
  const [auditoriaModulos, setAuditoriaModulos] = useState<string[]>([]);
  const [auditoriaAcoes, setAuditoriaAcoes] = useState<string[]>([]);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [erroAuditoria, setErroAuditoria] = useState("");
  const [filtroAuditoriaModulo, setFiltroAuditoriaModulo] = useState("todos");
  const [filtroAuditoriaAcao, setFiltroAuditoriaAcao] = useState("todos");
  const [filtroAuditoriaBusca, setFiltroAuditoriaBusca] = useState("");
  const [filtroAuditoriaDataInicio, setFiltroAuditoriaDataInicio] = useState("");
  const [filtroAuditoriaDataFim, setFiltroAuditoriaDataFim] = useState("");
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

  const usuarioEhAdmin = () => {
    if (typeof window === "undefined") return false;

    const userData = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    try {
      if (userData) {
        const user = JSON.parse(userData);
        const papeisUser: unknown[] = Array.isArray(user?.papeis) ? user.papeis : [];
        if (papeisUser.some((papel: unknown) => String(papel || "").trim().toLowerCase() === "admin")) {
          return true;
        }
      }

      if (token) {
        const partes = token.split(".");
        if (partes.length >= 2) {
          const base64Url = partes[1];
          const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
          const normalizado = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
          const payloadStr = atob(normalizado);
          const payload = JSON.parse(payloadStr);
          const papeisToken: unknown[] = Array.isArray(payload?.papeis) ? payload.papeis : [];
          if (papeisToken.some((papel: unknown) => String(papel || "").trim().toLowerCase() === "admin")) {
            return true;
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setIsAdmin(usuarioEhAdmin());
    carregarConfiguracoes();
  }, [router]);

  useEffect(() => {
    if (aba === "usuarios") {
      carregarUsuariosPermissoes();
      carregarAuditoria();
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
      await Promise.all([carregarUsuariosPermissoes(), carregarAuditoria()]);
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
      await Promise.all([carregarUsuariosPermissoes(), carregarAuditoria()]);
      alert("Usuario desativado.");
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      alert(typeof detalhe === "string" ? detalhe : "Erro ao desativar usuario.");
    }
  };

  const carregarConfiguracoes = async () => {
    try {
      setLoading(true);

      try {
        // Carrega configuracoes completas da empresa (quando permitido).
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
        setSomenteLeituraAgenda(false);
      } catch (errorEmpresa: any) {
        if (errorEmpresa?.response?.status === 403) {
          // Sem permissao de Configuracoes: exibe agenda em modo leitura.
          setSomenteLeituraAgenda(true);
        } else {
          console.error("Erro ao carregar configuracoes da empresa:", errorEmpresa);
        }
      }

      try {
        // Fonte unica do funcionamento da agenda (mesma regra da tela Agenda).
        const respAgenda = await api.get("/agenda/configuracao");
        setConfigEmpresa((prev) => ({
          ...prev,
          agenda_semanal: normalizarAgendaSemanal(respAgenda.data?.agenda_semanal),
          agenda_feriados: normalizarAgendaFeriados(respAgenda.data?.agenda_feriados),
          agenda_excecoes: normalizarAgendaExcecoes(respAgenda.data?.agenda_excecoes),
        }));
      } catch (errorAgenda) {
        console.error("Erro ao carregar funcionamento da agenda:", errorAgenda);
      }

      // Carregar configuracoes do usuario
      const respUsuario = await api.get("/configuracoes/usuario");
      if (respUsuario.data) {
        const lembreteHoras = Number(respUsuario.data?.notificacoes_push_lembrete_horas ?? 6);
        setConfigUsuario((prev) => ({
          ...prev,
          ...respUsuario.data,
          notificacoes_push_tipos: normalizarTiposPushAgenda(respUsuario.data?.notificacoes_push_tipos),
          notificacoes_push_prioridade_alta_tipos: normalizarTiposPrioridadeAltaPush(
            respUsuario.data?.notificacoes_push_prioridade_alta_tipos
          ),
          notificacoes_push_agrupar: respUsuario.data?.notificacoes_push_agrupar !== false,
          notificacoes_push_lembrete_pendencias:
            respUsuario.data?.notificacoes_push_lembrete_pendencias !== false,
          notificacoes_push_lembrete_horas: Number.isFinite(lembreteHoras)
            ? Math.min(168, Math.max(1, Math.round(lembreteHoras)))
            : 6,
          notificacoes_push_perfil: String(respUsuario.data?.notificacoes_push_perfil || "custom"),
        }));

        // Carregar preview da assinatura do usuario se existir
        if (respUsuario.data.tem_assinatura) {
          const assUrl = await carregarImagem("/configuracoes/usuario/assinatura");
          if (assUrl) setPreviewAssinaturaUsuario(assUrl);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configuracoes:", error);
    } finally {
      setLoading(false);
    }
  };

  const carregarAuditoria = async () => {
    try {
      setCarregandoAuditoria(true);
      setErroAuditoria("");
      const params: Record<string, any> = { limit: 200 };
      if (filtroAuditoriaModulo !== "todos") params.modulo = filtroAuditoriaModulo;
      if (filtroAuditoriaAcao !== "todos") params.acao = filtroAuditoriaAcao;
      if (filtroAuditoriaBusca.trim()) params.busca = filtroAuditoriaBusca.trim();
      if (filtroAuditoriaDataInicio) params.data_inicio = filtroAuditoriaDataInicio;
      if (filtroAuditoriaDataFim) params.data_fim = filtroAuditoriaDataFim;

      const resp = await api.get("/admin/auditoria", { params });
      const payload = resp?.data || {};
      setAuditoriaItens(Array.isArray(payload.items) ? payload.items : []);
      setAuditoriaTotal(Number(payload.total || 0));
      setAuditoriaModulos(Array.isArray(payload.modulos) ? payload.modulos : []);
      setAuditoriaAcoes(Array.isArray(payload.acoes) ? payload.acoes : []);
    } catch (error: any) {
      const detalhe = error?.response?.data?.detail;
      setErroAuditoria(typeof detalhe === "string" ? detalhe : "Erro ao carregar auditoria.");
    } finally {
      setCarregandoAuditoria(false);
    }
  };

  const salvarConfigEmpresa = async () => {
    try {
      setSalvando(true);
      const payload: Record<string, any> = {
        ...configEmpresa,
        agenda_semanal: normalizarAgendaSemanal(configEmpresa.agenda_semanal),
        agenda_feriados: normalizarAgendaFeriados(configEmpresa.agenda_feriados),
        agenda_excecoes: normalizarAgendaExcecoes(configEmpresa.agenda_excecoes),
      };
      if (!isAdmin) {
        delete payload.fortinho_habilitado;
      }
      await api.put("/configuracoes", payload);
      setConfigEmpresa((prev) => ({
        ...prev,
        agenda_semanal: payload.agenda_semanal,
        agenda_feriados: payload.agenda_feriados,
        agenda_excecoes: payload.agenda_excecoes,
      }));
      alert("ConfiguraÃ§Ãµes da empresa salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configuraÃ§Ãµes da empresa.");
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

  const alternarTipoPushAgenda = (tipo: string) => {
    setConfigUsuario((prev) => {
      const atuais = normalizarTiposPushAgenda(prev.notificacoes_push_tipos);
      const existe = atuais.includes(tipo);
      const atualizados = existe
        ? atuais.filter((item) => item !== tipo)
        : [...atuais, tipo];

      const ordenados = TIPOS_PUSH_AGENDA_OPCOES
        .map((item) => item.valor)
        .filter((item) => atualizados.includes(item));

      const ordenadosFinanceiro = TIPOS_PUSH_FINANCEIRO_OPCOES
        .map((item) => item.valor)
        .filter((item) => atualizados.includes(item));

      return {
        ...prev,
        notificacoes_push_tipos: [...ordenados, ...ordenadosFinanceiro],
        notificacoes_push_perfil: "custom",
      };
    });
  };

  const alternarTipoPrioridadeAltaPush = (tipo: string) => {
    setConfigUsuario((prev) => {
      const atuais = normalizarTiposPrioridadeAltaPush(prev.notificacoes_push_prioridade_alta_tipos);
      const existe = atuais.includes(tipo);
      const atualizados = existe
        ? atuais.filter((item) => item !== tipo)
        : [...atuais, tipo];
      const ordenados = TIPOS_PUSH_OPCOES.map((item) => item.valor).filter((item) => atualizados.includes(item));
      return {
        ...prev,
        notificacoes_push_prioridade_alta_tipos: ordenados,
        notificacoes_push_perfil: "custom",
      };
    });
  };

  const aplicarPerfilPush = (preset: PerfilPushPreset) => {
    setConfigUsuario((prev) => ({
      ...prev,
      notificacoes_push_tipos: normalizarTiposPushAgenda(preset.tipos),
      notificacoes_push_prioridade_alta_tipos: normalizarTiposPrioridadeAltaPush(preset.alta_prioridade),
      notificacoes_push_agrupar: preset.agrupar,
      notificacoes_push_lembrete_pendencias: preset.lembrete_pendencias,
      notificacoes_push_lembrete_horas: preset.lembrete_horas,
      notificacoes_push_perfil: preset.perfil,
    }));
  };

  const salvarConfigUsuario = async () => {
    try {
      setSalvando(true);
      const lembreteHoras = Number(configUsuario.notificacoes_push_lembrete_horas || 6);
      let proximaConfig = {
        ...configUsuario,
        notificacoes_push_tipos: normalizarTiposPushAgenda(configUsuario.notificacoes_push_tipos),
        notificacoes_push_prioridade_alta_tipos: normalizarTiposPrioridadeAltaPush(
          configUsuario.notificacoes_push_prioridade_alta_tipos
        ),
        notificacoes_push_lembrete_horas: Number.isFinite(lembreteHoras)
          ? Math.min(168, Math.max(1, Math.round(lembreteHoras)))
          : 6,
        notificacoes_push_perfil: String(configUsuario.notificacoes_push_perfil || "custom").toLowerCase(),
      };

      if (proximaConfig.notificacoes_push && proximaConfig.notificacoes_push_tipos.length === 0) {
        alert("Selecione pelo menos um tipo de evento para notificacao push.");
        return;
      }
      if (
        proximaConfig.notificacoes_push &&
        proximaConfig.notificacoes_push_lembrete_pendencias &&
        (proximaConfig.notificacoes_push_lembrete_horas < 1 ||
          proximaConfig.notificacoes_push_lembrete_horas > 168)
      ) {
        alert("Defina o lembrete de pendencia entre 1 e 168 horas.");
        return;
      }

      if (proximaConfig.notificacoes_push && typeof window !== "undefined") {
        const suportaPushWeb =
          window.isSecureContext &&
          "Notification" in window &&
          "serviceWorker" in navigator &&
          "PushManager" in window;

        if (!suportaPushWeb) {
          proximaConfig = { ...proximaConfig, notificacoes_push: false };
          setConfigUsuario(proximaConfig);
          alert("Este navegador/URL nao suporta push web. Use localhost ou HTTPS.");
        } else if (Notification.permission === "default") {
          const permissao = await Notification.requestPermission();
          if (permissao !== "granted") {
            proximaConfig = { ...proximaConfig, notificacoes_push: false };
            setConfigUsuario(proximaConfig);
            alert("Permissao de notificacoes nao concedida. Push foi desativado.");
          }
        } else if (Notification.permission === "denied") {
          proximaConfig = { ...proximaConfig, notificacoes_push: false };
          setConfigUsuario(proximaConfig);
          alert("Notificacoes bloqueadas no navegador para este site.");
        }
      }

      await api.put("/configuracoes/usuario", proximaConfig);
      await syncPushNotificationsNow(false);
      requestPushSync(proximaConfig.notificacoes_push);
      alert("ConfiguraÃ§Ãµes pessoais salvas com sucesso!");
    } catch (error) {
      alert("Erro ao salvar configuraÃ§Ãµes pessoais.");
    } finally {
      setSalvando(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Arquivo muito grande. MÃ¡ximo: 5MB");
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
      alert("Arquivo muito grande. MÃ¡ximo: 5MB");
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
      alert("Arquivo muito grande. MÃ¡ximo: 5MB");
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
        <div className="p-6 text-center">Carregando configuraÃ§Ãµes...</div>
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
            ConfiguraÃ§Ãµes
          </h1>
          <p className="text-gray-500">Gerencie as configuraÃ§Ãµes do sistema e sua conta</p>
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
            UsuÃ¡rios
          </button>
        </div>

        {/* ConteÃºdo */}
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
                    value={configEmpresa.nome_empresa ?? ""}
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
                    value={configEmpresa.email ?? ""}
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
                    value={configEmpresa.telefone ?? ""}
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
                    value={configEmpresa.website ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    EndereÃ§o
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.endereco ?? ""}
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
                    value={configEmpresa.cidade ?? ""}
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
                    value={configEmpresa.estado ?? ""}
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

            {/* Dados Fiscais (ISS / NFS-e) */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Dados Fiscais (Prestador de Servicos)
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Dados do prestador de servicos para emissao de NFS-e e calculo de ISS.
                Necessarios para exportar relatorios contabeis para o contador.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inscricao Municipal (IM)
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.inscricao_municipal ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, inscricao_municipal: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="000000000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inscricao Estadual (IE) / CNPJ
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.inscricao_estadual ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, inscricao_estadual: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="00.000.000/0001-00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CNAE (Codigo Nacional de Atividade)
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.cnae ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, cnae: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="8622-1/01 (Clinica veterinaria)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Regime Tributario
                  </label>
                  <select
                    value={configEmpresa.regime_tributario ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, regime_tributario: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="1">1 - MEI (Microempreendedor Individual)</option>
                    <option value="2">2 - Simples Nacional</option>
                    <option value="3">3 - Lucro Presumido</option>
                    <option value="4">4 - Lucro Real</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Codigo do Municipio (IBGE)
                  </label>
                  <input
                    type="text"
                    value={configEmpresa.codigo_municipio_servico ?? ""}
                    onChange={(e) => setConfigEmpresa({ ...configEmpresa, codigo_municipio_servico: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                    placeholder="230440 (Fortaleza)"
                  />
                  <p className="text-xs text-gray-400 mt-1">Codigo IBGE do municipio onde o servico e prestado.</p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  onClick={salvarConfigEmpresa}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar Dados Fiscais"}
                </button>
              </div>
            </div>

            {/* Jornada da Agenda */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-2">Funcionamento da Agenda</h2>
              {somenteLeituraAgenda && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                  Visualizacao em modo leitura para este perfil. Edicao disponivel apenas com permissao em Configuracoes.
                </p>
              )}
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
                              disabled={somenteLeituraAgenda}
                              onChange={(e) => atualizarJornadaDia(dia.id, "ativo", e.target.checked)}
                              className="w-4 h-4 text-teal-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={cfg.inicio}
                              disabled={somenteLeituraAgenda || !cfg.ativo}
                              onChange={(e) => atualizarJornadaDia(dia.id, "inicio", e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="time"
                              value={cfg.fim}
                              disabled={somenteLeituraAgenda || !cfg.ativo}
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
                    disabled={somenteLeituraAgenda}
                    onChange={(e) => setNovoFeriadoData(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <select
                    value={novoFeriadoTipo}
                    disabled={somenteLeituraAgenda}
                    onChange={(e) => setNovoFeriadoTipo((e.target.value === "nacional" ? "nacional" : "local"))}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="local">Local</option>
                    <option value="nacional">Nacional</option>
                  </select>
                  <input
                    type="text"
                    value={novoFeriadoDescricao}
                    disabled={somenteLeituraAgenda}
                    onChange={(e) => setNovoFeriadoDescricao(e.target.value)}
                    placeholder="Descricao (opcional)"
                    className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2"
                  />
                </div>

                <button
                  type="button"
                  onClick={adicionarFeriado}
                  disabled={somenteLeituraAgenda}
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
                          disabled={somenteLeituraAgenda}
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
                    disabled={somenteLeituraAgenda}
                    onChange={(e) => setNovaExcecaoData(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={novaExcecaoAtiva}
                      disabled={somenteLeituraAgenda}
                      onChange={(e) => setNovaExcecaoAtiva(e.target.checked)}
                      className="w-4 h-4 text-teal-600"
                    />
                    Agenda aberta
                  </label>
                  <input
                    type="time"
                    value={novaExcecaoInicio}
                    disabled={somenteLeituraAgenda || !novaExcecaoAtiva}
                    onChange={(e) => setNovaExcecaoInicio(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <input
                    type="time"
                    value={novaExcecaoFim}
                    disabled={somenteLeituraAgenda || !novaExcecaoAtiva}
                    onChange={(e) => setNovaExcecaoFim(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                  />
                  <button
                    type="button"
                    onClick={adicionarExcecao}
                    disabled={somenteLeituraAgenda}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Adicionar excecao
                  </button>
                </div>

                <input
                  type="text"
                  value={novaExcecaoMotivo}
                  disabled={somenteLeituraAgenda}
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
                          disabled={somenteLeituraAgenda}
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
                  disabled={salvando || somenteLeituraAgenda}
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
                Assinatura PadrÃ£o do Sistema
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
                Esta assinatura serÃ¡ usada como padrÃ£o quando o usuÃ¡rio nÃ£o tiver assinatura prÃ³pria.
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

            {/* Fortinho */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-2">Fortinho</h2>
              <p className="text-sm text-gray-500 mb-4">
                Controle global do assistente Fortinho para todo o sistema.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="fortinho_habilitado"
                  checked={configEmpresa.fortinho_habilitado}
                  disabled={!isAdmin}
                  onChange={(e) => setConfigEmpresa({ ...configEmpresa, fortinho_habilitado: e.target.checked })}
                  className="w-4 h-4 text-teal-600 disabled:opacity-50"
                />
                <label htmlFor="fortinho_habilitado" className="text-sm text-gray-700">
                  Ativar Fortinho no sistema
                </label>
              </div>
              {!isAdmin && (
                <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  Somente administradores podem ativar ou desativar o Fortinho.
                </p>
              )}
            </div>

            {/* Texto do RodapÃ© */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">Texto do RodapÃ© do Laudo</h2>
              <textarea
                value={configEmpresa.texto_rodape_laudo ?? ""}
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
                    value={configUsuario.crmv ?? ""}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, crmv: e.target.value })}
                    placeholder="Ex: CE-1234"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    SerÃ¡ exibido nos laudos emitidos por vocÃª
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Especialidade
                  </label>
                  <input
                    type="text"
                    value={configUsuario.especialidade ?? ""}
                    onChange={(e) => setConfigUsuario({ ...configUsuario, especialidade: e.target.value })}
                    placeholder="Ex: Cardiologia VeterinÃ¡ria"
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
                Esta assinatura serÃ¡ usada nos laudos emitidos por vocÃª. Se nÃ£o houver assinatura pessoal, serÃ¡ usada a assinatura padrÃ£o do sistema.
              </p>
            </div>

            {/* PreferÃªncias */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold mb-4">PreferÃªncias</h2>
              
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
                    Receber notificaÃ§Ãµes por e-mail
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
                    Receber notificaÃ§Ãµes push
                  </label>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Perfil rapido de notificacao
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                    {PERFIS_PUSH_PRESETS.map((preset) => {
                      const selecionado =
                        String(configUsuario.notificacoes_push_perfil || "custom").toLowerCase() === preset.perfil;
                      return (
                        <button
                          key={preset.perfil}
                          type="button"
                          onClick={() => aplicarPerfilPush(preset)}
                          disabled={!configUsuario.notificacoes_push}
                          className={`rounded-lg border px-3 py-2 text-left transition ${
                            !configUsuario.notificacoes_push
                              ? "cursor-not-allowed opacity-60"
                              : selecionado
                                ? "border-teal-600 bg-teal-50"
                                : "border-gray-200 bg-white hover:border-teal-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">{preset.titulo}</p>
                          <p className="text-xs text-gray-500">{preset.descricao}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Eventos da agenda para push
                  </p>
                  <div className="mt-2 space-y-2">
                    {TIPOS_PUSH_AGENDA_OPCOES.map((opcao) => (
                      <label
                        key={opcao.valor}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                          configUsuario.notificacoes_push ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={normalizarTiposPushAgenda(configUsuario.notificacoes_push_tipos).includes(opcao.valor)}
                          disabled={!configUsuario.notificacoes_push}
                          onChange={() => alternarTipoPushAgenda(opcao.valor)}
                          className="mt-0.5 h-4 w-4 text-teal-600"
                        />
                        <span>
                          <span className="block text-sm text-gray-800">{opcao.label}</span>
                          <span className="block text-xs text-gray-500">{opcao.descricao}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Eventos do financeiro para push
                  </p>
                  <div className="mt-2 space-y-2">
                    {TIPOS_PUSH_FINANCEIRO_OPCOES.map((opcao) => (
                      <label
                        key={opcao.valor}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                          configUsuario.notificacoes_push ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={normalizarTiposPushAgenda(configUsuario.notificacoes_push_tipos).includes(opcao.valor)}
                          disabled={!configUsuario.notificacoes_push}
                          onChange={() => alternarTipoPushAgenda(opcao.valor)}
                          className="mt-0.5 h-4 w-4 text-teal-600"
                        />
                        <span>
                          <span className="block text-sm text-gray-800">{opcao.label}</span>
                          <span className="block text-xs text-gray-500">{opcao.descricao}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Prioridade alta (item 1)
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Eventos marcados como alta prioridade usam destaque visual e alerta reforcado.
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {TIPOS_PUSH_OPCOES.map((opcao) => (
                      <label
                        key={`prioridade-${opcao.valor}`}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 ${
                          configUsuario.notificacoes_push ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={normalizarTiposPrioridadeAltaPush(
                            configUsuario.notificacoes_push_prioridade_alta_tipos
                          ).includes(opcao.valor)}
                          disabled={!configUsuario.notificacoes_push}
                          onChange={() => alternarTipoPrioridadeAltaPush(opcao.valor)}
                          className="mt-0.5 h-4 w-4 text-amber-600"
                        />
                        <span className="text-sm text-gray-800">{opcao.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
                    Automacoes (itens 3, 4 e 6)
                  </p>
                  <div className="mt-3 space-y-3">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={configUsuario.notificacoes_push_agrupar}
                        disabled={!configUsuario.notificacoes_push}
                        onChange={(e) =>
                          setConfigUsuario((prev) => ({
                            ...prev,
                            notificacoes_push_agrupar: e.target.checked,
                            notificacoes_push_perfil: "custom",
                          }))
                        }
                        className="h-4 w-4 text-teal-600"
                      />
                      Agrupar notificacoes semelhantes em sequencia (reduz spam)
                    </label>

                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={configUsuario.notificacoes_push_lembrete_pendencias}
                        disabled={!configUsuario.notificacoes_push}
                        onChange={(e) =>
                          setConfigUsuario((prev) => ({
                            ...prev,
                            notificacoes_push_lembrete_pendencias: e.target.checked,
                            notificacoes_push_perfil: "custom",
                          }))
                        }
                        className="h-4 w-4 text-teal-600"
                      />
                      Enviar lembrete automatico de OS pendente de pagamento
                    </label>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-700">Lembrar apos</label>
                      <input
                        type="number"
                        min={1}
                        max={168}
                        disabled={!configUsuario.notificacoes_push || !configUsuario.notificacoes_push_lembrete_pendencias}
                        value={configUsuario.notificacoes_push_lembrete_horas}
                        onChange={(e) =>
                          setConfigUsuario((prev) => ({
                            ...prev,
                            notificacoes_push_lembrete_horas: Number(e.target.value || 6),
                            notificacoes_push_perfil: "custom",
                          }))
                        }
                        className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-600">hora(s)</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <button
                  onClick={salvarConfigUsuario}
                  disabled={salvando}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {salvando ? "Salvando..." : "Salvar ConfiguraÃ§Ãµes"}
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

            <div className="xl:col-span-3 bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Auditoria de acoes</h3>
                  <p className="text-sm text-gray-500">
                    Registros de quem cadastrou, alterou status, recebeu, cancelou ou excluiu.
                  </p>
                </div>
                <button
                  onClick={carregarAuditoria}
                  type="button"
                  disabled={carregandoAuditoria}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                >
                  {carregandoAuditoria ? "Atualizando..." : "Atualizar log"}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                <select
                  value={filtroAuditoriaModulo}
                  onChange={(e) => setFiltroAuditoriaModulo(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="todos">Todos modulos</option>
                  {auditoriaModulos.map((modulo) => (
                    <option key={modulo} value={modulo}>
                      {modulo}
                    </option>
                  ))}
                </select>

                <select
                  value={filtroAuditoriaAcao}
                  onChange={(e) => setFiltroAuditoriaAcao(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="todos">Todas acoes</option>
                  {auditoriaAcoes.map((acao) => (
                    <option key={acao} value={acao}>
                      {acao}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={filtroAuditoriaDataInicio}
                  onChange={(e) => setFiltroAuditoriaDataInicio(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  type="date"
                  value={filtroAuditoriaDataFim}
                  onChange={(e) => setFiltroAuditoriaDataFim(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />

                <input
                  type="text"
                  value={filtroAuditoriaBusca}
                  onChange={(e) => setFiltroAuditoriaBusca(e.target.value)}
                  placeholder="Buscar usuario, email ou descricao"
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="mb-4 flex gap-2">
                <button
                  onClick={carregarAuditoria}
                  type="button"
                  disabled={carregandoAuditoria}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Filtrar
                </button>
                <button
                  onClick={() => {
                    setFiltroAuditoriaModulo("todos");
                    setFiltroAuditoriaAcao("todos");
                    setFiltroAuditoriaDataInicio("");
                    setFiltroAuditoriaDataFim("");
                    setFiltroAuditoriaBusca("");
                  }}
                  type="button"
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Limpar filtros
                </button>
                <div className="ml-auto text-sm text-gray-500 self-center">
                  {auditoriaTotal} registro(s)
                </div>
              </div>

              {erroAuditoria ? (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {erroAuditoria}
                </div>
              ) : null}

              {carregandoAuditoria ? (
                <div className="py-8 text-center text-gray-500">Carregando auditoria...</div>
              ) : auditoriaItens.length === 0 ? (
                <div className="py-8 text-center text-gray-500">Nenhum registro encontrado.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Data/Hora</th>
                        <th className="text-left px-3 py-2 font-medium">Usuario</th>
                        <th className="text-left px-3 py-2 font-medium">Acao</th>
                        <th className="text-left px-3 py-2 font-medium">Modulo</th>
                        <th className="text-left px-3 py-2 font-medium">Descricao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditoriaItens.map((item) => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-700">{formatarDataHora(item.created_at)}</td>
                          <td className="px-3 py-2 text-gray-700">
                            <div className="font-medium text-gray-900">{item.usuario_nome || "-"}</div>
                            <div className="text-xs text-gray-500">{item.usuario_email || "-"}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                              {item.acao}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <div>{item.modulo}</div>
                            <div className="text-xs text-gray-500">
                              {item.entidade}
                              {item.entidade_id ? ` #${item.entidade_id}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-700">
                            <div>{item.descricao || "-"}</div>
                            {item.rota ? (
                              <div className="text-xs text-gray-500">
                                {item.metodo || "-"} {item.rota}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
