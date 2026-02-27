"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, AlertCircle, X } from "lucide-react";

interface DadosPaciente {
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

interface DadosExame {
  paciente: DadosPaciente;
  medidas: Record<string, number>;
  clinica: string;
  veterinario_solicitante: string;
  fc: string;
}

interface XmlUploaderProps {
  onDadosImportados: (dados: DadosExame) => void;
  className?: string;
}

export default function XmlUploader({ onDadosImportados, className = "" }: XmlUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [arquivoNome, setArquivoNome] = useState<string | null>(null);

  const processarArquivo = async (file: File) => {
    if (!file.name.endsWith(".xml")) {
      setError("O arquivo deve ter extensão .xml");
      return;
    }

    // Verificar se há token
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Você precisa estar logado para importar XML. Faça login novamente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);
    setArquivoNome(file.name);

    try {
      const formData = new FormData();
      formData.append("arquivo", file);

      const response = await fetch("/api/v1/xml/importar-eco", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        setError("Sessão expirada. Faça login novamente.");
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erro ${response.status}`);
      }

      const data = await response.json();
      console.log("[XML_UPLOADER] Resposta da API:", data);
      console.log("[XML_UPLOADER] Dados recebidos:", data.dados);
      console.log("[XML_UPLOADER] Medidas recebidas:", data.dados?.medidas);

      if (data.success) {
        setSuccess(true);
        onDadosImportados(data.dados);
      } else {
        setError("Erro ao processar o arquivo");
      }
    } catch (err: any) {
      setError(err.message || "Erro ao importar XML");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processarArquivo(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processarArquivo(files[0]);
    }
  }, []);

  const limpar = () => {
    setArquivoNome(null);
    setError(null);
    setSuccess(false);
  };

  return (
    <div className={className}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragging 
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }
          ${error ? "border-red-300 bg-red-50 dark:bg-red-900/20" : ""}
          ${success ? "border-green-300 bg-green-50 dark:bg-green-900/20" : ""}
        `}
      >
        <input
          type="file"
          accept=".xml"
          onChange={handleFileInput}
          className="hidden"
          id="xml-upload"
        />
        <label htmlFor="xml-upload" className="cursor-pointer block">
          {isLoading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mb-3"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processando XML...
              </p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                XML importado com sucesso!
              </p>
              {arquivoNome && (
                <p className="text-xs text-gray-500 mt-1">{arquivoNome}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {error ? (
                <>
                  <AlertCircle className="h-10 w-10 text-red-500 mb-3" />
                  <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                    {error}
                  </p>
                  <p className="text-xs text-gray-500">
                    Clique para tentar novamente
                  </p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Arraste o arquivo XML ou clique para selecionar
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Aparelhos compatíveis: Vivid IQ e similares
                  </p>
                </>
              )}
            </div>
          )}
        </label>
      </div>

      {arquivoNome && (
        <div className="mt-3 flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
              {arquivoNome}
            </span>
          </div>
          <button
            onClick={limpar}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      )}
    </div>
  );
}
