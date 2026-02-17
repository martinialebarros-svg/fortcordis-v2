"use client";

import React, { useState, useCallback } from "react";
import { Upload, X, Loader2, MoveUp, MoveDown } from "lucide-react";

interface Imagem {
  id: string;  // ID único local
  nome: string;
  descricao: string;
  ordem: number;
  dataUrl: string;  // URL de dados para preview
  tamanho: number;
  file: File;  // Arquivo original para upload posterior
}

interface ImageUploaderProps {
  onImagensChange?: (imagens: Imagem[]) => void;
}

export default function ImageUploader({ onImagensChange }: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [imagens, setImagens] = useState<Imagem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gerarId = () => Math.random().toString(36).substring(2, 15);

  const processarArquivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const novasImagens: Imagem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validar tipo
      if (!file.type.startsWith("image/")) {
        setError(`Arquivo ${file.name} não é uma imagem válida`);
        continue;
      }

      // Validar tamanho (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`Arquivo ${file.name} excede 10MB`);
        continue;
      }

      try {
        // Criar URL de dados para preview imediato
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        novasImagens.push({
          id: gerarId(),
          nome: file.name,
          descricao: "",
          ordem: imagens.length + novasImagens.length,
          dataUrl,
          tamanho: file.size,
          file,
        });
      } catch (err) {
        console.error(`Erro ao processar ${file.name}:`, err);
      }
    }

    const todasImagens = [...imagens, ...novasImagens];
    setImagens(todasImagens);
    onImagensChange?.(todasImagens);
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

  const removerImagem = (id: string) => {
    const novasImagens = imagens.filter(img => img.id !== id);
    // Reordenar
    novasImagens.forEach((img, idx) => img.ordem = idx);
    setImagens(novasImagens);
    onImagensChange?.(novasImagens);
  };

  const moverImagem = (index: number, direcao: "up" | "down") => {
    if (direcao === "up" && index === 0) return;
    if (direcao === "down" && index === imagens.length - 1) return;

    const novasImagens = [...imagens];
    const newIndex = direcao === "up" ? index - 1 : index + 1;
    
    [novasImagens[index], novasImagens[newIndex]] = [novasImagens[newIndex], novasImagens[index]];
    
    // Atualizar ordem
    novasImagens.forEach((img, i) => img.ordem = i);
    
    setImagens(novasImagens);
    onImagensChange?.(novasImagens);
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
              <p className="text-sm text-gray-600">Processando imagens...</p>
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
