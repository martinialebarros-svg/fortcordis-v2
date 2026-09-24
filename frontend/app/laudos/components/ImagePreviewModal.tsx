"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PreviewImage {
  id: string | number;
  nome: string;
  src: string;
}

interface ImagePreviewModalProps {
  images: PreviewImage[];
  selectedIndex: number | null;
  onSelectedIndexChange: (index: number | null) => void;
}

export default function ImagePreviewModal({ images, selectedIndex, onSelectedIndexChange }: ImagePreviewModalProps) {
  const isOpen = selectedIndex !== null && Boolean(images[selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onSelectedIndexChange(null);
      if (event.key === "ArrowLeft" && images.length > 1) {
        onSelectedIndexChange((selectedIndex! - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onSelectedIndexChange((selectedIndex! + 1) % images.length);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [images.length, isOpen, onSelectedIndexChange, selectedIndex]);

  if (!isOpen) return null;
  const image = images[selectedIndex!];
  const previous = () => onSelectedIndexChange((selectedIndex! - 1 + images.length) % images.length);
  const next = () => onSelectedIndexChange((selectedIndex! + 1) % images.length);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Visualização ampliada de ${image.nome}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onSelectedIndexChange(null);
      }}
    >
      <div className="relative flex h-full w-full max-w-7xl flex-col items-center justify-center">
        <button type="button" onClick={() => onSelectedIndexChange(null)} className="absolute right-0 top-0 z-10 rounded-full bg-white/95 p-2 text-gray-800 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" aria-label="Fechar visualização">
          <X className="h-6 w-6" />
        </button>
        {images.length > 1 && (
          <button type="button" onClick={previous} className="absolute left-0 z-10 rounded-full bg-white/95 p-2 text-gray-800 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" aria-label="Imagem anterior">
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}
        <img src={image.src} alt={image.nome} className="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] object-contain" />
        {images.length > 1 && (
          <button type="button" onClick={next} className="absolute right-0 z-10 rounded-full bg-white/95 p-2 text-gray-800 shadow hover:bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" aria-label="Próxima imagem">
            <ChevronRight className="h-7 w-7" />
          </button>
        )}
        <div className="mt-3 max-w-full rounded-lg bg-black/70 px-4 py-2 text-center text-sm text-white">
          <p className="truncate font-medium">{image.nome}</p>
          <p className="text-xs text-gray-300">Imagem {selectedIndex! + 1} de {images.length}</p>
        </div>
      </div>
    </div>
  );
}
