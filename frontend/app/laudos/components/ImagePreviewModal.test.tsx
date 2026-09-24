import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import ImagePreviewModal from "./ImagePreviewModal";

const images = [
  { id: 1, nome: "eco-1.jpg", src: "data:image/jpeg;base64,one" },
  { id: 2, nome: "eco-2.jpg", src: "data:image/jpeg;base64,two" },
];

function Harness() {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  return (
    <ImagePreviewModal
      images={images}
      selectedIndex={selectedIndex}
      onSelectedIndexChange={setSelectedIndex}
    />
  );
}

describe("ImagePreviewModal", () => {
  it("exibe a imagem ampliada e navega entre imagens", () => {
    render(<Harness />);

    expect(screen.getByRole("dialog", { name: "Visualização ampliada de eco-1.jpg" })).toBeInTheDocument();
    expect(screen.getByText("Imagem 1 de 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Próxima imagem" }));

    expect(screen.getByRole("dialog", { name: "Visualização ampliada de eco-2.jpg" })).toBeInTheDocument();
    expect(screen.getByText("Imagem 2 de 2")).toBeInTheDocument();
  });

  it("fecha com Escape", () => {
    render(<Harness />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
  });
});
