import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "atendimento-documentos-test-secret-key-1234567890")

from app.api.v1.endpoints import atendimento
from app.models.atendimento_clinico import (
    AtendimentoClinico,
    DocumentoAtendimento,
    DocumentoAtendimentoTemplate,
)
from app.models.clinica import Clinica
from app.models.paciente import Paciente
from app.models.tutor import Tutor
from app.schemas.atendimento import DocumentoAtendimentoCreatePayload, DocumentoTemplatePayload


class AtendimentoDocumentosTest(unittest.TestCase):
    def setUp(self) -> None:
        self.user = SimpleNamespace(id=7, nome="Dra. Teste")

    def _build_session(self):
        tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(tmpdir.name) / "atendimento-documentos.db"
        engine = create_engine(f"sqlite:///{db_path}")
        for table in (
            Paciente.__table__,
            Tutor.__table__,
            Clinica.__table__,
            AtendimentoClinico.__table__,
            DocumentoAtendimentoTemplate.__table__,
            DocumentoAtendimento.__table__,
        ):
            table.create(engine, checkfirst=True)
        session = sessionmaker(bind=engine, autocommit=False, autoflush=False)()
        return tmpdir, session, engine

    def _seed_atendimento(self, db):
        tutor = Tutor(nome="Maria Tutora", ativo=1)
        paciente = Paciente(
            nome="Fofa",
            especie="Canina",
            raca="SRD",
            sexo="Femea",
            peso_kg=12.4,
            tutor_id=1,
            ativo=1,
        )
        clinica = Clinica(nome="Clinica Teste")
        db.add_all([tutor, paciente, clinica])
        db.flush()
        paciente.tutor_id = tutor.id
        atendimento_item = AtendimentoClinico(
            paciente_id=paciente.id,
            tutor_id=tutor.id,
            clinica_id=clinica.id,
            veterinario_id=self.user.id,
            especie="Canina",
            data_atendimento=datetime(2026, 5, 1, 10, 30),
            status="Em atendimento",
            queixa_principal="Avaliacao pre-operatoria.",
            diagnostico_principal="Sem alteracoes relevantes.",
            plano_terapeutico="Liberada para procedimento conforme avaliacao.",
            retorno_recomendado="Conforme evolucao clinica.",
            criado_por_id=self.user.id,
            criado_por_nome=self.user.nome,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(atendimento_item)
        db.commit()
        db.refresh(atendimento_item)
        return atendimento_item, paciente, tutor, clinica

    def test_cria_documento_a_partir_de_template_renderizando_contexto(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            atendimento_item, *_ = self._seed_atendimento(db)
            template = atendimento.criar_template_documento_atendimento(
                DocumentoTemplatePayload(
                    nome="Parecer teste",
                    tipo="parecer",
                    titulo_padrao="Parecer de {{paciente_nome}}",
                    corpo_template="Paciente {{paciente_nome}}, tutor {{tutor_nome}}, vet {{veterinario_nome}}.",
                ),
                db=db,
                current_user=self.user,
            )

            documento = atendimento.criar_documento_atendimento(
                atendimento_item.id,
                DocumentoAtendimentoCreatePayload(template_id=template["id"]),
                db=db,
                current_user=self.user,
            )

            self.assertEqual(documento["titulo"], "Parecer de Fofa")
            self.assertIn("Paciente Fofa", documento["corpo"])
            self.assertIn("tutor Maria Tutora", documento["corpo"])
            self.assertIn("vet Dra. Teste", documento["corpo"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_documento_usa_tutor_atual_do_paciente_quando_atendimento_tem_tutor_antigo(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            atendimento_item, paciente, tutor_antigo, _ = self._seed_atendimento(db)
            tutor_atual = Tutor(nome="Joana Atualizada", ativo=1)
            db.add(tutor_atual)
            db.flush()
            paciente.tutor_id = tutor_atual.id
            atendimento_item.tutor_id = tutor_antigo.id
            db.commit()
            db.refresh(atendimento_item)

            template = atendimento.criar_template_documento_atendimento(
                DocumentoTemplatePayload(
                    nome="Declaracao tutor atual",
                    tipo="declaracao",
                    titulo_padrao="Declaracao de {{paciente_nome}}",
                    corpo_template="Tutor atual: {{tutor_nome}}.",
                ),
                db=db,
                current_user=self.user,
            )

            documento = atendimento.criar_documento_atendimento(
                atendimento_item.id,
                DocumentoAtendimentoCreatePayload(template_id=template["id"]),
                db=db,
                current_user=self.user,
            )

            self.assertIn("Tutor atual: Joana Atualizada.", documento["corpo"])
            self.assertNotIn("Maria Tutora", documento["corpo"])
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_pdf_atualiza_rascunho_de_template_sem_edicao_para_tutor_atual(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            atendimento_item, paciente, tutor_antigo, _ = self._seed_atendimento(db)
            template_payload = atendimento.criar_template_documento_atendimento(
                DocumentoTemplatePayload(
                    nome="Autorizacao tutor atual",
                    tipo="autorizacao",
                    titulo_padrao="Autorizacao {{tutor_nome}}",
                    corpo_template="Responsavel: {{tutor_nome}}.",
                ),
                db=db,
                current_user=self.user,
            )

            documento = DocumentoAtendimento(
                atendimento_id=atendimento_item.id,
                template_id=template_payload["id"],
                titulo="Autorizacao Maria Tutora",
                corpo="Responsavel: Maria Tutora.",
                status="rascunho",
                criado_por_id=self.user.id,
                criado_por_nome=self.user.nome,
            )
            db.add(documento)
            db.commit()
            db.refresh(documento)

            tutor_atual = Tutor(nome="Joana Atualizada", ativo=1)
            db.add(tutor_atual)
            db.flush()
            paciente.tutor_id = tutor_atual.id
            atendimento_item.tutor_id = tutor_antigo.id
            db.commit()
            db.refresh(documento)

            atendimento._atualizar_documento_template_se_contexto_mudou(
                db,
                atendimento_item,
                documento,
                {
                    "nome_veterinario": self.user.nome,
                    "crmv": "",
                    "logomarca_bytes": None,
                    "assinatura_bytes": None,
                    "texto_rodape": None,
                },
            )

            self.assertEqual(documento.titulo, "Autorizacao Joana Atualizada")
            self.assertEqual(documento.corpo, "Responsavel: Joana Atualizada.")
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()

    def test_pdf_documento_clinico_usa_layout_pdf(self) -> None:
        tmpdir, db, engine = self._build_session()
        try:
            atendimento_item, paciente, tutor, clinica = self._seed_atendimento(db)
            documento = DocumentoAtendimento(
                atendimento_id=atendimento_item.id,
                titulo="Parecer Medico Veterinario",
                corpo="Atesto que {{paciente_nome}} foi avaliada.\n\nAtenciosamente,",
                status="rascunho",
                criado_por_id=self.user.id,
                criado_por_nome=self.user.nome,
            )
            db.add(documento)
            db.commit()
            db.refresh(documento)

            pdf = atendimento._gerar_pdf_documento_atendimento_bytes(
                atendimento_item,
                paciente,
                tutor,
                clinica,
                documento,
                nome_veterinario=self.user.nome,
                crmv="3236/CE",
            )

            self.assertTrue(pdf.startswith(b"%PDF"))
            self.assertGreater(len(pdf), 1000)
        finally:
            db.close()
            engine.dispose()
            tmpdir.cleanup()


if __name__ == "__main__":
    unittest.main()
