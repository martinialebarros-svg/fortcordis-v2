import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_DIR)
sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///./fortcordis.db")
os.environ.setdefault("SECRET_KEY", "assistente-ia-admin-test-secret-key-1234567890")

from app.core.security import require_papel
from app.api.v1.endpoints import assistente_ia as assistente_ia_endpoint
from app.models.agendamento import Agendamento
from app.models.assistente_ia import (
    AssistenteIAAcaoPendente,
    AssistenteIAConversa,
    AssistenteIAMensagem,
)
from app.models.clinica import Clinica
from app.models.financeiro import ContaReceber, Transacao
from app.models.ordem_servico import OrdemServico
from app.models.paciente import Paciente
from app.models.servico import Servico
from app.models.tutor import Tutor
from app.services import assistente_ia_service, assistente_ia_tools


class AssistenteIAAdminTest(unittest.TestCase):
    def setUp(self) -> None:
        self._tmpdir = tempfile.TemporaryDirectory()
        db_path = Path(self._tmpdir.name) / "assistente-ia-admin.db"
        self._engine = create_engine(f"sqlite:///{db_path}")
        self._session_factory = sessionmaker(bind=self._engine, autocommit=False, autoflush=False)
        for table in (
            Tutor.__table__,
            Paciente.__table__,
            Clinica.__table__,
            Servico.__table__,
            Agendamento.__table__,
            Transacao.__table__,
            OrdemServico.__table__,
            ContaReceber.__table__,
            AssistenteIAConversa.__table__,
            AssistenteIAMensagem.__table__,
            AssistenteIAAcaoPendente.__table__,
        ):
            table.create(self._engine, checkfirst=True)

        self.user = SimpleNamespace(
            id=7,
            nome="Administrador",
            email="admin@fortcordis.com",
            tem_papel=lambda role: str(role).lower() == "admin",
        )

    def tearDown(self) -> None:
        self._engine.dispose()
        self._tmpdir.cleanup()

    def _seed_base(self, db):
        clinic = Clinica(
            nome="Animal Care",
            ativo=True,
            telefone="(85) 98894-6484",
            whatsapps=["85988946484", "85999998888"],
            endereco="Rua Teste",
            numero="100",
            cidade="Fortaleza",
            estado="CE",
            latitude=-3.7319,
            longitude=-38.5267,
        )
        service = Servico(nome="Ecocardiograma", duracao_minutos=30, ativo=True)
        tutor = Tutor(nome="Ana Oliveira", telefone="(85) 98765-4321", whatsapp="85987654321", ativo=1)
        db.add(tutor)
        db.flush()
        patient = Paciente(nome="Luna Oliveira", tutor_id=tutor.id, ativo=1)
        conversation = AssistenteIAConversa(
            id="conversation-test",
            usuario_id=self.user.id,
            titulo="Nova conversa",
            ativa=True,
        )
        db.add_all([clinic, service, patient, conversation])
        db.commit()
        for item in (clinic, service, patient, conversation):
            db.refresh(item)
        return clinic, service, patient, conversation

    def _appointment(self, db, clinic, service, patient, *, hour=10):
        reference = datetime.now(assistente_ia_tools.LOCAL_TZ).replace(
            hour=hour,
            minute=0,
            second=0,
            microsecond=0,
        )
        appointment = Agendamento(
            paciente_id=patient.id,
            clinica_id=clinic.id,
            servico_id=service.id,
            inicio=reference,
            fim=reference + timedelta(minutes=30),
            data=reference.date().isoformat(),
            hora=reference.strftime("%H:%M"),
            status="Agendado",
        )
        db.add(appointment)
        db.commit()
        db.refresh(appointment)
        return appointment

    def _context(self, db, conversation):
        return assistente_ia_tools.AssistenteIAToolContext(
            db=db,
            current_user=self.user,
            conversa=conversation,
            request=SimpleNamespace(headers={}),
        )

    def test_rotas_exigem_papel_admin(self) -> None:
        protected_routes = 0
        for route in assistente_ia_endpoint.router.routes:
            dependencies = getattr(getattr(route, "dependant", None), "dependencies", [])
            guards = [dependency.call for dependency in dependencies]
            has_admin_guard = any(
                any(cell.cell_contents == "admin" for cell in (guard.__closure__ or ()))
                for guard in guards
            )
            self.assertTrue(has_admin_guard, f"Rota sem guard admin: {getattr(route, 'path', '')}")
            protected_routes += 1
        self.assertEqual(protected_routes, 6)

        guard = require_papel("admin")
        non_admin = SimpleNamespace(tem_papel=lambda _role: False)

        with self.assertRaises(HTTPException) as error:
            guard(non_admin)

        self.assertEqual(error.exception.status_code, 403)

    def test_localiza_agendamento_sem_expor_dados_do_tutor(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            appointment = self._appointment(db, clinic, service, patient)
            result = assistente_ia_tools.localizar_agendamentos(
                self._context(db, conversation),
                data=appointment.data,
                horario="10:00",
                clinica="animal care",
                servico=None,
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["total"], 1)
        self.assertEqual(result["matches"][0]["agendamento_id"], appointment.id)
        self.assertEqual(result["matches"][0]["paciente_primeiro_nome"], "Luna")
        self.assertNotIn("telefone", str(result).lower())
        self.assertNotIn("tutor", str(result).lower())

    def test_reserva_preparada_nao_cria_horario_antes_da_confirmacao(self) -> None:
        with self._session_factory() as db:
            clinic, service, _patient, conversation = self._seed_base(db)
            future = datetime.now(assistente_ia_tools.LOCAL_TZ) + timedelta(days=7)
            with (
                patch.object(assistente_ia_tools, "_validate_appointment_candidate"),
                patch.object(assistente_ia_tools, "registrar_auditoria"),
            ):
                prepared = assistente_ia_tools.solicitar_criacao_agendamento(
                    self._context(db, conversation),
                    tipo="reserva",
                    origem_atendimento="clinica_parceira",
                    clinica=clinic.nome,
                    tutor=None,
                    paciente=None,
                    servico=service.nome,
                    data=future.date().isoformat(),
                    horario="10:00",
                    destinatario_mensagem="clinica",
                    prazo_confirmacao_horas=3,
                    observacoes="Aguardando confirmacao da clinica",
                )

            self.assertTrue(prepared["ok"])
            self.assertTrue(prepared["requires_approval"])
            self.assertEqual(prepared["pending_action"]["type"], "create_appointment")
            self.assertEqual(prepared["pending_action"]["target"]["status"], "Reservado")
            self.assertEqual(
                prepared["pending_action"]["target"]["destinatario_mensagem"]["telefones"],
                ["85988946484", "85999998888"],
            )
            provider_result = assistente_ia_tools.tool_result_for_model(
                "solicitar_criacao_agendamento",
                prepared,
            )
            self.assertNotIn("85988946484", str(provider_result))
            self.assertNotIn("telefones", str(provider_result))
            self.assertEqual(
                provider_result["pending_action"]["target"]["destinatario_mensagem"]["quantidade_contatos"],
                2,
            )
            self.assertEqual(db.query(Agendamento).count(), 0)

    def test_criacao_so_executa_endpoint_oficial_apos_aprovacao(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            future = datetime.now(assistente_ia_tools.LOCAL_TZ) + timedelta(days=8)
            with (
                patch.object(assistente_ia_tools, "_validate_appointment_candidate"),
                patch.object(assistente_ia_tools, "registrar_auditoria"),
            ):
                prepared = assistente_ia_tools.solicitar_criacao_agendamento(
                    self._context(db, conversation),
                    tipo="agendamento",
                    origem_atendimento="clinica_parceira",
                    clinica=clinic.nome,
                    tutor="Ana Oliveira",
                    paciente=patient.nome,
                    servico=service.nome,
                    data=future.date().isoformat(),
                    horario="11:00",
                    destinatario_mensagem="tutor",
                    prazo_confirmacao_horas=None,
                    observacoes="Primeiro atendimento",
                )["pending_action"]

                self.assertEqual(db.query(Agendamento).count(), 0)
                with patch.object(
                    assistente_ia_tools.agenda,
                    "criar_agendamento",
                    return_value={
                        "id": 321,
                        "status": "Agendado",
                        "inicio": prepared["target"]["inicio"],
                    },
                ) as create_appointment:
                    executed = assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=prepared["id"],
                        decision="approve",
                    )

            self.assertEqual(executed["status"], "executed")
            self.assertEqual(executed["result"]["agendamento"]["id"], 321)
            self.assertEqual(executed["result"]["comunicacao"]["destinatario_nome"], "Ana Oliveira")
            self.assertIn("Ecocardiograma", executed["result"]["comunicacao"]["mensagem"])
            self.assertTrue(executed["result"]["comunicacao"]["envio_manual"])
            payload = create_appointment.call_args.kwargs["agendamento"]
            self.assertIsInstance(payload, assistente_ia_tools.AgendamentoCreate)
            self.assertEqual(payload.status, "Agendado")
            self.assertEqual(payload.paciente_id, patient.id)

    def test_rejeitar_criacao_preserva_agenda(self) -> None:
        with self._session_factory() as db:
            clinic, service, _patient, conversation = self._seed_base(db)
            future = datetime.now(assistente_ia_tools.LOCAL_TZ) + timedelta(days=9)
            with (
                patch.object(assistente_ia_tools, "_validate_appointment_candidate"),
                patch.object(assistente_ia_tools, "registrar_auditoria"),
            ):
                prepared = assistente_ia_tools.solicitar_criacao_agendamento(
                    self._context(db, conversation),
                    tipo="reserva",
                    origem_atendimento="clinica_parceira",
                    clinica=clinic.nome,
                    tutor=None,
                    paciente=None,
                    servico=service.nome,
                    data=future.date().isoformat(),
                    horario="12:00",
                    destinatario_mensagem="clinica",
                    prazo_confirmacao_horas=None,
                    observacoes=None,
                )["pending_action"]
                with patch.object(assistente_ia_tools.agenda, "criar_agendamento") as create_appointment:
                    rejected = assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=prepared["id"],
                        decision="reject",
                    )

            self.assertEqual(rejected["status"], "rejected")
            self.assertEqual(db.query(Agendamento).count(), 0)
            create_appointment.assert_not_called()

    def test_criacao_e_invalidada_quando_referencia_muda(self) -> None:
        with self._session_factory() as db:
            clinic, service, _patient, conversation = self._seed_base(db)
            future = datetime.now(assistente_ia_tools.LOCAL_TZ) + timedelta(days=10)
            with (
                patch.object(assistente_ia_tools, "_validate_appointment_candidate"),
                patch.object(assistente_ia_tools, "registrar_auditoria"),
            ):
                prepared = assistente_ia_tools.solicitar_criacao_agendamento(
                    self._context(db, conversation),
                    tipo="reserva",
                    origem_atendimento="clinica_parceira",
                    clinica=clinic.nome,
                    tutor=None,
                    paciente=None,
                    servico=service.nome,
                    data=future.date().isoformat(),
                    horario="13:00",
                    destinatario_mensagem="clinica",
                    prazo_confirmacao_horas=3,
                    observacoes=None,
                )["pending_action"]

                service.updated_at = datetime.now() + timedelta(minutes=5)
                db.add(service)
                db.commit()
                with patch.object(assistente_ia_tools.agenda, "criar_agendamento") as create_appointment:
                    with self.assertRaises(HTTPException) as changed:
                        assistente_ia_tools.decide_pending_action(
                            db=db,
                            current_user=self.user,
                            request=SimpleNamespace(headers={}),
                            action_id=prepared["id"],
                            decision="approve",
                        )

            self.assertEqual(changed.exception.status_code, 409)
            stored = db.query(AssistenteIAAcaoPendente).filter_by(id=prepared["id"]).one()
            self.assertEqual(stored.status, "invalidated")
            self.assertEqual(db.query(Agendamento).count(), 0)
            create_appointment.assert_not_called()

    def test_localizacao_com_multiplos_candidatos_exige_desambiguacao(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            first = self._appointment(db, clinic, service, patient)
            self._appointment(db, clinic, service, patient)
            result = assistente_ia_tools.localizar_agendamentos(
                self._context(db, conversation),
                data=first.data,
                horario="10:00",
                clinica="Animal Care",
                servico="Ecocardiograma",
            )

        self.assertEqual(result["total"], 2)
        self.assertIn("desambiguacao", result["orientacao"])

    def test_faturamento_gera_serie_mensal_e_filtro_por_clinica(self) -> None:
        with self._session_factory() as db:
            clinic, _service, _patient, conversation = self._seed_base(db)
            first_month = assistente_ia_tools._first_day_shifted(
                datetime.now(assistente_ia_tools.LOCAL_TZ).date().replace(day=1),
                -4,
            )
            for offset, value in enumerate((100.0, 120.0, 90.0, 150.0, 180.0)):
                transaction_date = assistente_ia_tools._first_day_shifted(first_month, offset)
                db.add(
                    Transacao(
                        tipo="entrada",
                        categoria="exame",
                        valor=value,
                        valor_final=value,
                        valor_taxa=0,
                        status="Pago",
                        clinica_id=clinic.id,
                        data_transacao=datetime.combine(transaction_date, datetime.min.time()),
                    )
                )
            db.commit()

            result = assistente_ia_tools.analisar_faturamento(
                self._context(db, conversation),
                meses=5,
                clinica="Animal Care",
            )

        self.assertTrue(result["ok"])
        self.assertEqual(len(result["serie_mensal"]), 5)
        self.assertEqual(result["resumo"]["faturamento_total"], 640.0)
        self.assertEqual(result["serie_mensal"][-1]["faturamento_liquido"], 180.0)

    def test_relatorio_mantem_ordens_e_contas_em_subtotais_separados(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            appointment = self._appointment(db, clinic, service, patient)
            db.add_all(
                [
                    OrdemServico(
                        numero_os="OS-IA-1",
                        agendamento_id=appointment.id,
                        paciente_id=patient.id,
                        clinica_id=clinic.id,
                        servico_id=service.id,
                        data_atendimento=appointment.inicio,
                        valor_final=250,
                        status="Pendente",
                    ),
                    ContaReceber(
                        descricao="Fatura mensal",
                        cliente=clinic.nome,
                        valor=300,
                        data_vencimento=datetime.now() - timedelta(days=3),
                        status="Atrasado",
                        clinica_id=clinic.id,
                    ),
                ]
            )
            db.commit()
            result = assistente_ia_tools.relatorio_debitos_pendentes(
                self._context(db, conversation),
                clinica="Animal Care",
                somente_vencidos=False,
            )

        self.assertEqual(result["ordens_servico_pendentes"]["total"], 250.0)
        self.assertEqual(result["contas_receber_pendentes"]["total"], 300.0)
        self.assertEqual(result["total_estimado_sem_deduplicacao"], 550.0)
        self.assertIn("fontes separadas", result["aviso"])

    def test_disponibilidade_reutiliza_motor_real_da_agenda(self) -> None:
        with self._session_factory() as db:
            _clinic, _service, _patient, conversation = self._seed_base(db)
            suggestion = {
                "items": [
                    {
                        "inicio": "2099-01-10T09:00:00-03:00",
                        "fim": "2099-01-10T09:30:00-03:00",
                        "risco": "baixo",
                        "score": 92,
                        "tempo_deslocamento_total_min": 20,
                        "destino_operacional": "Animal Care",
                        "telefone": "nao-deve-sair",
                    }
                ]
            }
            with patch.object(assistente_ia_tools.agenda, "sugerir_horarios_agenda", return_value=suggestion):
                result = assistente_ia_tools.verificar_disponibilidade(
                    self._context(db, conversation),
                    clinica="Animal Care",
                    servico="Ecocardiograma",
                    data_inicio="2099-01-10",
                    dias=1,
                )

        self.assertTrue(result["ok"])
        self.assertEqual(len(result["slots"]), 1)
        self.assertNotIn("telefone", str(result).lower())

    def test_exclusao_fica_pendente_e_pode_ser_rejeitada_sem_apagar(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            appointment = self._appointment(db, clinic, service, patient)
            with patch.object(assistente_ia_tools, "registrar_auditoria") as audit:
                prepared = assistente_ia_tools.solicitar_exclusao_agendamento(
                    self._context(db, conversation),
                    agendamento_id=appointment.id,
                    motivo="Solicitado pelo administrador",
                )
                self.assertIsNotNone(db.query(Agendamento).filter_by(id=appointment.id).first())
                rejected = assistente_ia_tools.decide_pending_action(
                    db=db,
                    current_user=self.user,
                    request=SimpleNamespace(headers={}),
                    action_id=prepared["pending_action"]["id"],
                    decision="reject",
                    observation="Cancelar operacao",
                )

            self.assertEqual(rejected["status"], "rejected")
            self.assertIsNotNone(db.query(Agendamento).filter_by(id=appointment.id).first())

    def test_exclusao_so_executa_apos_aprovacao_e_revalida_snapshot(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            first = self._appointment(db, clinic, service, patient, hour=10)
            second = self._appointment(db, clinic, service, patient, hour=11)
            with patch.object(assistente_ia_tools, "registrar_auditoria") as audit:
                first_action = assistente_ia_tools.solicitar_exclusao_agendamento(
                    self._context(db, conversation),
                    agendamento_id=first.id,
                    motivo="Excluir agenda duplicada",
                )["pending_action"]
                second_action = assistente_ia_tools.solicitar_exclusao_agendamento(
                    self._context(db, conversation),
                    agendamento_id=second.id,
                    motivo="Excluir agenda incorreta",
                )["pending_action"]

                second.status = "Confirmado"
                db.add(second)
                db.commit()
                with self.assertRaises(HTTPException) as changed:
                    assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=second_action["id"],
                        decision="approve",
                    )
                self.assertEqual(changed.exception.status_code, 409)

                def delete_appointment(*, agendamento_id, db, **_kwargs):
                    db.query(Agendamento).filter(Agendamento.id == agendamento_id).delete()
                    db.commit()
                    return {"message": "ok"}

                with patch.object(
                    assistente_ia_tools.agenda,
                    "deletar_agendamento",
                    side_effect=delete_appointment,
                ):
                    executed = assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=first_action["id"],
                        decision="approve",
                    )

            self.assertEqual(executed["status"], "executed")
            self.assertIsNone(db.query(Agendamento).filter_by(id=first.id).first())
            self.assertIsNotNone(db.query(Agendamento).filter_by(id=second.id).first())
            self.assertTrue(
                any(
                    call.kwargs.get("acao") == "ASSISTENTE_IA_ACAO_EXECUTADA"
                    for call in audit.call_args_list
                )
            )

    def test_acao_expirada_ou_ja_decidida_nao_pode_ser_executada(self) -> None:
        with self._session_factory() as db:
            clinic, service, patient, conversation = self._seed_base(db)
            first = self._appointment(db, clinic, service, patient, hour=12)
            second = self._appointment(db, clinic, service, patient, hour=13)
            with patch.object(assistente_ia_tools, "registrar_auditoria"):
                expired_action = assistente_ia_tools.solicitar_exclusao_agendamento(
                    self._context(db, conversation),
                    agendamento_id=first.id,
                    motivo="Teste de validade da aprovacao",
                )["pending_action"]
                action_record = db.query(AssistenteIAAcaoPendente).filter_by(id=expired_action["id"]).one()
                action_record.expires_at = datetime.now() - timedelta(minutes=1)
                db.commit()

                with self.assertRaises(HTTPException) as expired:
                    assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=expired_action["id"],
                        decision="approve",
                    )
                self.assertEqual(expired.exception.status_code, 409)
                self.assertEqual(action_record.status, "expired")
                self.assertIsNotNone(db.query(Agendamento).filter_by(id=first.id).first())

                rejected_action = assistente_ia_tools.solicitar_exclusao_agendamento(
                    self._context(db, conversation),
                    agendamento_id=second.id,
                    motivo="Teste de protecao contra repeticao",
                )["pending_action"]
                assistente_ia_tools.decide_pending_action(
                    db=db,
                    current_user=self.user,
                    request=SimpleNamespace(headers={}),
                    action_id=rejected_action["id"],
                    decision="reject",
                )
                with self.assertRaises(HTTPException) as replay:
                    assistente_ia_tools.decide_pending_action(
                        db=db,
                        current_user=self.user,
                        request=SimpleNamespace(headers={}),
                        action_id=rejected_action["id"],
                        decision="approve",
                    )

            self.assertEqual(replay.exception.status_code, 409)
            self.assertIsNotNone(db.query(Agendamento).filter_by(id=second.id).first())

    def test_turno_da_ia_executa_tool_loop_e_persiste_historico(self) -> None:
        with self._session_factory() as db:
            _clinic, _service, _patient, conversation = self._seed_base(db)
            tool_call = SimpleNamespace(
                type="function_call",
                name="analisar_faturamento",
                arguments='{"meses": 5, "clinica": null}',
                call_id="call-1",
            )
            first_response = SimpleNamespace(id="resp-1", output=[tool_call], output_text="")
            final_response = SimpleNamespace(
                id="resp-2",
                output=[],
                output_text="O faturamento cresceu no periodo analisado.",
            )
            tool_result = {"ok": True, "periodo": {"meses": 5}, "serie_mensal": []}

            with (
                patch.object(assistente_ia_service, "ensure_assistant_available"),
                patch.object(assistente_ia_service, "OpenAI", return_value=SimpleNamespace()),
                patch.object(
                    assistente_ia_service,
                    "_provider_request",
                    side_effect=[first_response, final_response],
                ) as provider,
                patch.object(assistente_ia_service, "execute_tool", return_value=tool_result) as executor,
                patch.object(assistente_ia_service, "registrar_auditoria"),
            ):
                result = assistente_ia_service.run_assistant_turn(
                    db=db,
                    current_user=self.user,
                    request=SimpleNamespace(headers={}),
                    message="Analise os ultimos cinco meses",
                    conversation=conversation,
                )

            self.assertEqual(provider.call_count, 2)
            executor.assert_called_once()
            self.assertEqual(result["assistant_message"]["content"], final_response.output_text)
            self.assertEqual(conversation.previous_response_id, "resp-2")
            self.assertEqual(db.query(AssistenteIAMensagem).count(), 2)


if __name__ == "__main__":
    unittest.main()
