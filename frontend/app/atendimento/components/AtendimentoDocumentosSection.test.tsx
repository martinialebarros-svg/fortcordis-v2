import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AtendimentoDocumentosSection from "./AtendimentoDocumentosSection";

afterEach(() => {
  cleanup();
});

function noop() {}

function Harness({ uploadArquivosAnexoGeral }: { uploadArquivosAnexoGeral: (files: File[]) => Promise<void> }) {
  const [anexoArquivos, setAnexoArquivos] = useState<File[]>([]);
  const [anexoForm, setAnexoForm] = useState({ tipo: "documento", descricao: "", url: "" });

  return (
    <AtendimentoDocumentosSection
      ATENDIMENTO_ATTACHMENT_ACCEPT=".jpeg,.jpg,.pdf,.png,.webp"
      adicionarLinkAnexo={noop}
      anexosGerais={[]}
      anexoArquivos={anexoArquivos}
      anexoForm={anexoForm}
      abrirAnexo={noop}
      baixarPdfDocumentoClinico={noop}
      cancelarUploadAnexo={noop}
      criarDocumentoClinicoDeTemplate={noop}
      documentTemplates={[]}
      documentoClinicoForm={{ id: null, status: "rascunho", titulo: "", corpo: "" }}
      documentoTemplateForm={{ id: null, nome: "", tipo: "documento", titulo_padrao: "", corpo_template: "", ordem: "", ativo: 1 }}
      documentoTemplateSelecionado=""
      documentoVariaveisNaoResolvidas={[]}
      editarDocumentoTemplate={noop}
      evolucaoForm={{ descricao: "", sinais_vitais: "" }}
      excluirDocumentoClinico={noop}
      excluirAnexo={noop}
      formatBytes={(n: number) => `${n}B`}
      formatDate={(d: string) => d}
      gerandoDocumentoPdfId={null}
      novoDocumentoClinicoLivre={noop}
      openingAttachmentId={null}
      progressoUploadGeral={null}
      selecionado={123}
      setAnexoArquivos={setAnexoArquivos}
      setAnexoForm={setAnexoForm}
      setDocumentoClinicoForm={noop}
      setDocumentoTemplateForm={noop}
      setDocumentoTemplateSelecionado={noop}
      setErro={noop}
      setEvolucaoForm={noop}
      setShowDocumentoTemplateEditor={noop}
      setSucesso={noop}
      showDocumentoTemplateEditor={false}
      salvandoDocumentoClinico={false}
      salvandoDocumentoTemplate={false}
      salvarDocumentoClinico={noop}
      salvarDocumentoTemplate={noop}
      selecionarDocumentoClinico={noop}
      toggleDocumentoTemplate={noop}
      uploadArquivosAnexoGeral={uploadArquivosAnexoGeral}
      uploadGeralEmAndamento={false}
      abrirAtendimento={noop}
      api={{ post: vi.fn() }}
      form={{ documentos: [], evolucoes: [] }}
    />
  );
}

function getAnexoFileInput(): HTMLInputElement {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
  if (!fileInput) throw new Error("input de arquivo de anexo nao encontrado");
  return fileInput;
}

describe("AtendimentoDocumentosSection - selecao multipla de anexos", () => {
  it("aceita mais de um arquivo no input", () => {
    render(<Harness uploadArquivosAnexoGeral={async () => {}} />);
    const input = getAnexoFileInput();
    expect(input.multiple).toBe(true);
  });

  it("mostra um chip por arquivo selecionado e o rotulo do botao no plural", () => {
    render(<Harness uploadArquivosAnexoGeral={async () => {}} />);
    const input = getAnexoFileInput();
    const exame1 = new File(["a"], "exame-sangue.pdf", { type: "application/pdf" });
    const exame2 = new File(["b"], "raio-x-torax.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [exame1, exame2] } });

    expect(screen.getByText(/exame-sangue\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/raio-x-torax\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar 2 arquivos/ })).toBeInTheDocument();
  });

  it("envia todos os arquivos selecionados de uma vez ao clicar em enviar", async () => {
    const uploadArquivosAnexoGeral = vi.fn().mockResolvedValue(undefined);
    render(<Harness uploadArquivosAnexoGeral={uploadArquivosAnexoGeral} />);
    const input = getAnexoFileInput();
    const exame1 = new File(["a"], "exame-sangue.pdf", { type: "application/pdf" });
    const exame2 = new File(["b"], "raio-x-torax.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [exame1, exame2] } });
    fireEvent.click(screen.getByRole("button", { name: /Enviar 2 arquivos/ }));

    expect(uploadArquivosAnexoGeral).toHaveBeenCalledTimes(1);
    expect(uploadArquivosAnexoGeral).toHaveBeenCalledWith([exame1, exame2]);
  });

  it("permite remover um arquivo da selecao antes de enviar", () => {
    render(<Harness uploadArquivosAnexoGeral={async () => {}} />);
    const input = getAnexoFileInput();
    const exame1 = new File(["a"], "exame-sangue.pdf", { type: "application/pdf" });
    const exame2 = new File(["b"], "raio-x-torax.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [exame1, exame2] } });
    fireEvent.click(screen.getByRole("button", { name: /Remover exame-sangue.pdf da selecao/ }));

    expect(screen.queryByText(/exame-sangue\.pdf/)).not.toBeInTheDocument();
    expect(screen.getByText(/raio-x-torax\.pdf/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar arquivo" })).toBeInTheDocument();
  });
});
