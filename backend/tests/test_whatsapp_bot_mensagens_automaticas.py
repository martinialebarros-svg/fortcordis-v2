import tempfile
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from tests import test_whatsapp_bot_process_job as cases
from app.services.whatsapp_bot_mensagens_automaticas import AVISOS, mensagem_automatica
from app.services import whatsapp_bot_worker_service as worker
from app.models.whatsapp_bot import WhatsAppBotResposta, WhatsAppBotConversaEstado
from app.models.alerta_interno import AlertaInterno


def test_reconhecimento_exato_sem_ocultar_complementos():
    for texto in AVISOS:
        item = {'type': 'text', 'from_me': False, 'body': '🚨 *' + texto + '*'}
        assert mensagem_automatica(item)
        assert not mensagem_automatica({**item, 'from_me': True})
        assert not mensagem_automatica({**item, 'type': 'image'})
        for extra in (' meu pet está com falta de ar', ' preciso de um laudo', ' quero falar com humano'):
            assert not mensagem_automatica({**item, 'body': texto + extra})
    assert not mensagem_automatica({'type': 'text', 'body': 'Fora do expediente, meu pet está em emergência'})


def test_worker_avisos_fragmentos_e_pausas():
    helper = cases.WhatsAppBotProcessJobTest()
    now = datetime.now(timezone.utc)
    def msg(body, offset=0):
        return {'type': 'text', 'from_me': False, 'body': body,
                'created_at': (now + timedelta(seconds=offset)).isoformat()}
    scenarios = [
        *[(texto, [], False, 'mensagem_automatica') for texto in AVISOS],
        (AVISOS[0], [msg('meu pet está com falta de ar', -10)], True, 'emergencia'),
        ('meu pet está com falta de ar', [msg(AVISOS[0], -10)], True, 'emergencia'),
        (AVISOS[0] + '\nmeu pet está com falta de ar', [], True, 'emergencia'),
        (AVISOS[0], [msg('quero falar com humano', -10)], False, 'pedido_humano'),
        ('qual o valor do exame?', [msg(AVISOS[0], -10)], True, 'pausado'),
        (AVISOS[0], [], True, 'mensagem_automatica'),
    ]
    for current, history, paused, expected in scenarios:
        with tempfile.TemporaryDirectory() as tmp:
            factory, engine = helper._build_session_factory(tmp)
            try:
                with factory() as db, ExitStack() as stack:
                    job = helper._make_job(db)
                    if paused:
                        db.add(WhatsAppBotConversaEstado(wa_identity=job.wa_identity, pausado_ate=now+timedelta(hours=1)))
                        db.commit()
                    stack.enter_context(patch.object(worker, 'is_whatsapp_bot_enabled', return_value=True))
                    stack.enter_context(patch.object(worker, 'resolve_conversation_mode', return_value='auto'))
                    stack.enter_context(patch.object(worker, '_bot_internal_client_config', return_value=('local', {}, 1)))
                    stack.enter_context(patch.object(worker, '_fetch_conversation_by_phone', return_value={'id':job.conversation_id}))
                    stack.enter_context(patch.object(worker, '_last_message_from_conversation', return_value=msg(current)))
                    stack.enter_context(patch.object(worker, '_fetch_historico', return_value=history+[msg(current)]))
                    handoff = stack.enter_context(patch.object(worker, 'trigger_active_handoff'))
                    generator = stack.enter_context(patch.object(worker, 'gerar_resposta'))
                    pause = stack.enter_context(patch.object(worker, 'pause_conversation'))
                    stack.enter_context(patch.object(worker, 'build_handoff_message', return_value='Equipe avisada'))
                    worker._process_job(db, job)
                    db.flush()
                    audit = db.query(WhatsAppBotResposta).one()
                    assert audit.motivo == expected, (current, expected, audit.motivo)
                    assert audit.texto_enviado is None
                    assert handoff.call_count == int(expected in ('emergencia', 'pedido_humano'))
                    pause.assert_not_called()
                    generator.assert_not_called()
                    assert db.query(AlertaInterno).count() == 0
                    if expected == 'mensagem_automatica':
                        assert db.query(WhatsAppBotConversaEstado).count() == int(paused)
            finally:
                engine.dispose()


def test_pedido_real_contiguo_preservado_sem_cruzar_limites():
    from app.services.whatsapp_bot_continuidade import agrupar_fragmentos
    from app.services.whatsapp_bot_mensagens_automaticas import sem_aviso_automatico
    now = datetime.now(timezone.utc)
    current = {'body': AVISOS[0], 'from_me': False, 'type': 'text', 'created_at': now.isoformat()}
    previous = {**current, 'body': 'Poderia enviar a chave Pix e o valor?', 'created_at': (now-timedelta(seconds=15)).isoformat()}
    original = dict(current)
    body, _ = agrupar_fragmentos([sem_aviso_automatico(previous)], sem_aviso_automatico(current))
    assert body.strip() == previous['body']
    assert current == original
    for change in ({'from_me': True}, {'type': 'image'}, {'created_at': (now-timedelta(minutes=3)).isoformat()}):
        body, _ = agrupar_fragmentos([sem_aviso_automatico({**previous, **change})], sem_aviso_automatico(current))
        assert not body.strip()
