"use client";

export interface DadosPacienteImportados {
  nome: string;
  tutor: string;
  raca: string;
  especie: string;
  peso: string;
  idade: string;
  sexo: string;
  telefone: string;
  data_exame: string;
}

export interface DadosExameImportados {
  paciente: DadosPacienteImportados;
  medidas: Record<string, number>;
  clinica: string;
  veterinario_solicitante: string;
  fc: string;
}

type XmlImportJobStatus = {
  job_id: number;
  status: string;
  filename?: string | null;
  erro?: string | null;
  dados?: DadosExameImportados | null;
};

const JOB_POLL_INTERVAL_MS = 1000;
const JOB_POLL_TIMEOUT_MS = 30000;

function getAuthHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function waitForXmlImportJob(jobId: number): Promise<XmlImportJobStatus> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < JOB_POLL_TIMEOUT_MS) {
    const response = await fetch(`/api/v1/xml/importar-eco/jobs/${jobId}`, {
      headers: getAuthHeaders(),
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Nao foi possivel consultar o XML em processamento.");
    }

    const job = (await response.json()) as XmlImportJobStatus;
    if (job.status === "completed" || job.status === "failed") {
      return job;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, JOB_POLL_INTERVAL_MS);
    });
  }

  throw new Error("Tempo limite excedido ao processar XML.");
}

async function importSynchronously(file: File): Promise<DadosExameImportados> {
  const formData = new FormData();
  formData.append("arquivo", file);

  const response = await fetch("/api/v1/xml/importar-eco", {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
    credentials: "include",
  });

  if (response.status === 401) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Erro ${response.status}`);
  }

  if (!payload.success || !payload.dados) {
    throw new Error("Erro ao processar o arquivo.");
  }

  return payload.dados as DadosExameImportados;
}

export async function importarXmlEco(file: File): Promise<DadosExameImportados> {
  const formData = new FormData();
  formData.append("arquivo", file);

  try {
    const response = await fetch("/api/v1/xml/importar-eco/jobs", {
      method: "POST",
      headers: getAuthHeaders(),
      body: formData,
      credentials: "include",
    });

    if (response.status === 401) {
      throw new Error("Sessao expirada. Faca login novamente.");
    }

    const initialJob = (await response.json().catch(() => ({}))) as XmlImportJobStatus & {
      detail?: string;
    };
    if (!response.ok) {
      throw new Error(initialJob.detail || `Erro ${response.status}`);
    }

    if (initialJob.status === "completed" && initialJob.dados) {
      return initialJob.dados;
    }

    const finalJob = await waitForXmlImportJob(initialJob.job_id);
    if (!finalJob.dados) {
      throw new Error(finalJob.erro || "Falha ao processar XML.");
    }
    return finalJob.dados;
  } catch {
    return importSynchronously(file);
  }
}
