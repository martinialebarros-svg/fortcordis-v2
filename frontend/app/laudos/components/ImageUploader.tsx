"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Upload, X, Loader2, MoveUp, MoveDown } from "lucide-react";
import api from "@/lib/axios";

interface Imagem {
  id: string;
  nome: string;
  descricao: string;
  ordem: number;
  dataUrl: string;
  tamanho: number;
  file?: File;
  serverId?: number;
  uploaded: boolean;
}

interface ImageUploaderProps {
  onImagensChange?: (imagens: Imagem[]) => void;
  sessionId: string;
  imagensIniciais?: Imagem[];
}

export default function ImageUploader({
  onImagensChange,
  sessionId,
  imagensIniciais = [],
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imagens, setImagens] = useState<Imagem[]>(imagensIniciais);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gerarId = () => Math.random().toString(36).substring(2, 15);

  const atualizarImagens = (novasImagens: Imagem[]) => {
    setImagens(novasImagens);
    onImagensChange?.(novasImagens);
  };

  useEffect(() => {
    setImagens(imagensIniciais);
  }, [imagensIniciais]);

  const fazerUploadImagem = async (imagem: Imagem): Promise<boolean> => {
    if (!imagem.file || imagem.uploaded) return true;
    
    try {
      const formData = new FormData();
      formData.append("arquivo", imagem.file);
      formData.append("ordem", imagem.ordem.toString());
      formData.append("descricao", imagem.descricao || "");
      formData.append("session_id", sessionId);
      
      const response = await api.post("/imagens/upload-temp", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      
      if (response.data && response.data.success) {
        return true;
      }
      return false;
    } catch (err) {
      console.error("Erro ao fazer upload:", err);
      return false;
    }
  };

  const processarArquivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const novasImagens: Imagem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (!file.type.startsWith("image/")) {
        setError(`Arquivo ${file.name} não é uma imagem válida`);
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError(`Arquivo ${file.name} excede 10MB`);
        continue;
      }

      try {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        const novaImagem: Imagem = {
          id: gerarId(),
          nome: file.name,
          descricao: "",
          ordem: imagens.length + novasImagens.length,
          dataUrl,
          tamanho: file.size,
          file,
          uploaded: false,
        };

        novasImagens.push(novaImagem);
      } catch (err) {
        console.error(`Erro ao processar ${file.name}:`, err);
      }
    }

    let todasImagens = [...imagens, ...novasImagens];
    atualizarImagens(todasImagens);

    // Fazer upload das novas imagens
    for (const imagem of novasImagens) {
      const sucesso = await fazerUploadImagem(imagem);
      if (sucesso) {
        todasImagens = todasImagens.map((img) =>
          img.id === imagem.id ? { ...img, uploaded: true } : img
        );
        atualizarImagens(todasImagens);
      }
    }

    setUploading(false);
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
    processarArquivos(e.dataTransfer.files);
  }, [imagens]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processarArquivos(e.target.files);
    e.target.value = "";
  }, [imagens]);

  const removerImagem = async (id: string) => {
    const imagem = imagens.find(img => img.id === id);
    if (imagem?.uploaded && sessionId) {
      try {
        await api.delete(`/imagens/temp/${id}?session_id=${sessionId}`);
      } catch (e) {
        console.error("Erro ao remover imagem do servidor:", e);
      }
    }
    
    const novasImagens = imagens
      .filter(img => img.id !== id)
      .map((img, idx) => ({ ...img, ordem: idx }));
    atualizarImagens(novasImagens);
  };

  const moverImagem = (index: number, direcao: "up" | "down") => {
    if (direcao === "up" && index === 0) return;
    if (direcao === "down" && index === imagens.length - 1) return;

    const novasImagens = [...imagens];
    const newIndex = direcao === "up" ? index - 1 : index + 1;
    
    [novasImagens[index], novasImagens[newIndex]] = [novasImagens[newIndex], novasImagens[index]];
    const imagensReordenadas = novasImagens.map((img, i) => ({ ...img, ordem: i }));
    
    atualizarImagens(imagensReordenadas);
  };

  const formatarTamanho = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="space-y-4">
      {/* Área de Drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
          ${isDragging 
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
            : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          }
        `}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
          id="image-upload"
        />
        <label htmlFor="image-upload" className="cursor-pointer block">
          {uploading ? (
            <div className="flex flex-col items-center">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
              <p className="text-sm text-gray-600">Enviando imagens...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <Upload className="h-10 w-10 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700 mb-1">
                Arraste imagens aqui ou clique para selecionar
              </p>
              <p className="text-xs text-gray-500">
                JPG, PNG, GIF até 10MB cada
              </p>
            </div>
          )}
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Lista de Imagens */}
      {imagens.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-700">
            Imagens ({imagens.length})
            {imagens.some(img => !img.uploaded) && (
              <span className="text-xs text-yellow-600 ml-2">
                (algumas ainda não foram enviadas)
              </span>
            )}
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {imagens.map((imagem, index) => (
              <div 
                key={imagem.id}
                className="relative group bg-white border rounded-lg overflow-hidden shadow-sm"
              >
                {/* Preview */}
                <div className="aspect-square bg-gray-100 relative">
                  <img
                    src={imagem.dataUrl}
                    alt={imagem.nome}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Número da ordem */}
                  <div className="absolute top-2 left-2 bg-teal-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {index + 1}
                  </div>

                  {/* Status de upload */}
                  {!imagem.uploaded && (
                    <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                      Enviando...
                    </div>
                  )}
                  
                  {/* Overlay com controles */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => moverImagem(index, "up")}
                      disabled={index === 0}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 disabled:opacity-50"
                      title="Mover para cima"
                    >
                      <MoveUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moverImagem(index, "down")}
                      disabled={index === imagens.length - 1}
                      className="p-2 bg-white rounded-full hover:bg-gray-100 disabled:opacity-50"
                      title="Mover para baixo"
                    >
                      <MoveDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removerImagem(imagem.id)}
                      className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      title="Remover"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Info */}
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate" title={imagem.nome}>
                    {imagem.nome}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatarTamanho(imagem.tamanho)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
