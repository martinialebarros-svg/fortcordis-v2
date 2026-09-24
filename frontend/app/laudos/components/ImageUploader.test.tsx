import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImageUploader from "./ImageUploader";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("@/lib/axios", () => ({ default: mocks }));

const initialImages = [
  {
    id: "local-a",
    nome: "a.jpg",
    descricao: "",
    ordem: 0,
    dataUrl: "data:image/jpeg;base64,a",
    tamanho: 100,
    tempId: 10,
    uploaded: true,
    incluirNoPdf: true,
  },
  {
    id: "local-b",
    nome: "b.jpg",
    descricao: "",
    ordem: 1,
    dataUrl: "data:image/jpeg;base64,b",
    tamanho: 200,
    tempId: 11,
    uploaded: true,
    incluirNoPdf: true,
  },
];

describe("ImageUploader", () => {
  beforeEach(() => {
    mocks.put.mockReset();
    mocks.put.mockResolvedValue({ data: {} });
  });

  it("persiste seleção para o PDF e reordenação por arrastar", async () => {
    render(
      <ImageUploader
        sessionId="sessao-1"
        imagensIniciais={initialImages}
      />
    );

    const checkboxes = screen.getAllByRole("checkbox", { name: "Incluir no PDF" });
    fireEvent.click(checkboxes[0]);

    await waitFor(() => expect(mocks.put).toHaveBeenCalledWith(
      "/imagens/temp/session/sessao-1/configuracao",
      {
        imagens: [
          { id: 10, ordem: 0, incluir_no_pdf: false },
          { id: 11, ordem: 1, incluir_no_pdf: true },
        ],
      },
    ));

    const firstCard = screen.getByLabelText("Ampliar a.jpg").closest('[draggable="true"]');
    const secondCard = screen.getByLabelText("Ampliar b.jpg").closest('[draggable="true"]');
    expect(firstCard).not.toBeNull();
    expect(secondCard).not.toBeNull();
    const dataTransfer = { effectAllowed: "move", dropEffect: "move" };
    fireEvent.dragStart(firstCard!, { dataTransfer });
    fireEvent.dragOver(secondCard!, { dataTransfer });
    fireEvent.drop(secondCard!, { dataTransfer });

    await waitFor(() => expect(mocks.put).toHaveBeenLastCalledWith(
      "/imagens/temp/session/sessao-1/configuracao",
      {
        imagens: [
          { id: 11, ordem: 0, incluir_no_pdf: true },
          { id: 10, ordem: 1, incluir_no_pdf: false },
        ],
      },
    ));
  });
});
