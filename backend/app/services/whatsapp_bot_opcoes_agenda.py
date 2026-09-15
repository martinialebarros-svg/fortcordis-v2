"""Opções administrativas da agenda: nunca reserva, cadastra ou altera agendamentos."""
import json
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from app.models.servico import Servico
from app.models.whatsapp_bot import WhatsAppBotResposta
from app.services.whatsapp_bot_agendamento import normalizar
from app.services.whatsapp_bot_servico_match import procedimentos_do_pedido, procedimentos_do_servico

KEY = 'opcoes_agenda'
TZ = ZoneInfo('America/Fortaleza')
CONSULTAS = {'ver horarios', 'consultar horarios', 'quais horarios', 'quais horarios disponiveis', 'outras opcoes', 'ver opcoes'}
FALLBACK = 'A equipe vai conferir os horários para sua preferência. Nenhum horário foi reservado.'


def local(value):
    parsed = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    return parsed.replace(tzinfo=TZ) if parsed.tzinfo is None else parsed.astimezone(TZ)


def periodo(preferencia, recebida_em, now):
    """Só interpreta formas explícitas; texto desconhecido fica para a equipe."""
    text = normalizar(preferencia).strip(' .!')
    anchor = local(recebida_em).date() if recebida_em else now.date()
    turno = 'manha' if re.search(r'\bmanha\b', text) else 'tarde' if re.search(r'\btarde\b', text) else None
    clean = re.sub(r'\b(pela|de|a|no periodo da|da)\s+(manha|tarde)\b', '', text).strip()
    if clean in ('manha', 'tarde'): clean = ''
    if clean in ('', 'qualquer dia', 'sem preferencia', 'qualquer dia e horario'):
        dates = [now.date() + timedelta(days=i) for i in range(7)]
    elif clean in ('hoje', 'amanha'):
        dates = [anchor + timedelta(days=int(clean == 'amanha'))]
    else:
        weekdays = {'segunda':0,'terca':1,'quarta':2,'quinta':3,'sexta':4,'sabado':5,'domingo':6}
        weekday = clean.removesuffix('-feira')
        if weekday in weekdays:
            dates = [anchor + timedelta(days=(weekdays[weekday]-anchor.weekday()) % 7)]
        elif re.fullmatch(r'\d{2}/\d{2}/\d{4}', clean):
            dates = [datetime.strptime(clean, '%d/%m/%Y').date()]
        else:
            raise ValueError('Preferência precisa de revisão humana')
    if any(d < now.date() or d > now.date()+timedelta(days=13) for d in dates):
        raise ValueError('Preferência fora da janela de consulta')
    return dates, turno


def servico_exato(db, exame):
    pedido = procedimentos_do_pedido(exame)
    ativos = db.query(Servico).filter(Servico.ativo.is_(True)).all()
    encontrados = [s for s in ativos if normalizar(s.nome) == normalizar(exame)]
    if not encontrados and pedido:
        encontrados = [s for s in ativos if procedimentos_do_servico(s.nome) == pedido]
    if len(encontrados) != 1 or not encontrados[0].duracao_minutos:
        raise ValueError('Serviço ambíguo ou sem duração')
    return encontrados[0]


def consultar_dia(db, clinic_id, service, day):
    from app.api.v1.endpoints.agenda import SugestaoHorarioPayload, sugerir_horarios_agenda
    result = sugerir_horarios_agenda(payload=SugestaoHorarioPayload(
        data=day.isoformat(), clinica_id=clinic_id, servico_id=service.id,
        duracao_minutos=service.duracao_minutos, origem_atendimento='clinica_parceira',
        intervalo_minutos=15, limite=50, perfil_deslocamento='comercial'), db=db, current_user=None)
    if not result.get('ok'):
        raise ValueError('Consulta indisponível')
    # Retorno interno tem contexto de outros pacientes. Somente horários saem daqui.
    return result.get('items') or []


def slots_seguros(items, service, day, now, turno=None):
    slots = []
    for item in items:
        try:
            inicio, fim = local(item['inicio']), local(item['fim'])
            if item.get('risco') != 0 or inicio <= now or inicio.date() != day:
                continue
            if fim-inicio != timedelta(minutes=service.duracao_minutos):
                continue
            if turno == 'manha' and (inicio.hour >= 12 or fim.hour > 12 or (fim.hour == 12 and fim.minute)):
                continue
            if turno == 'tarde' and not (12 <= inicio.hour < 18 and (fim.hour < 18 or (fim.hour == 18 and fim.minute == 0))):
                continue
            slots.append({'inicio':inicio.isoformat(), 'fim':fim.isoformat()})
        except (KeyError, TypeError, ValueError):
            continue
    return slots


def oferecer(db, clinic_id, coleta, pedido_id=None, now=None):
    now = now or datetime.now(TZ)
    audit = {'estado':'indisponivel', 'pedido_id':pedido_id, 'clinica_id':clinic_id}
    try:
        service = servico_exato(db, coleta['dados']['exame'])
        dates, turno = periodo(coleta['dados']['preferencia'], coleta.get('preferencia_recebida_em'), now)
        slots = []
        for day in dates:
            for slot in slots_seguros(consultar_dia(db, clinic_id, service, day), service, day, now, turno):
                if slot not in slots: slots.append(slot)
                if len(slots) == 3: break
            if len(slots) == 3: break
        if not slots: return FALLBACK, audit
        audit.update(estado='oferta', pedido_versao=1, servico_id=service.id, duracao=service.duracao_minutos,
                     expira_em=(now+timedelta(minutes=15)).isoformat(), slots=slots)
        lines = [f'{i}. {local(s["inicio"]).strftime("%d/%m/%Y às %H:%M")}' for i,s in enumerate(slots,1)]
        return ('Opções encontradas na agenda (horário de Fortaleza):\n'+'\n'.join(lines)+
                '\nResponda com o número da opção em até 15 minutos. Vou conferir novamente e encaminhar sua escolha à equipe. Ainda não há reserva; a equipe confirma o agendamento.'), audit
    except (HTTPException, ValueError, KeyError, TimeoutError):
        return FALLBACK, audit


def apos_confirmacao(db, clinic_id, coleta, texto):
    if coleta.get('status') != 'encaminhada': return texto, {}
    body, audit = oferecer(db, clinic_id, coleta)
    return 'Dados confirmados. '+body, {KEY:audit}


def ultima_oferta(db, pedido, identity, conversation_id):
    rows = db.query(WhatsAppBotResposta).filter(
        WhatsAppBotResposta.wa_identity == identity, WhatsAppBotResposta.clinica_id == pedido.clinica_id,
        WhatsAppBotResposta.conversation_id == str(conversation_id),
        WhatsAppBotResposta.id >= pedido.resposta_id,
        WhatsAppBotResposta.decisao == 'sent',
    ).order_by(WhatsAppBotResposta.id.desc()).limit(50).all()
    for row in rows:
        audit = json.loads(row.tools_usadas or '{}')
        data = audit.get(KEY)
        if data and row.texto_enviado != row.texto_gerado:
            return None
        if data and (data.get('pedido_id') == pedido.id or row.id == pedido.resposta_id):
            return data
        if audit.get('continuidade_pedido', {}).get('complemento') or audit.get('solicitacao_agendamento'):
            return None
    return None


def responder(db, pedido, coleta, message, identity, conversation_id, now=None):
    if not pedido or str(pedido.conversation_id) != str(conversation_id): return None
    if coleta and coleta.get('status') in ('coletando', 'aguardando_confirmacao'): return None
    text = normalizar(message).strip(' .!?')
    choice = re.fullmatch(r'(?:opcao\s+|quero a opcao\s+|prefiro a opcao\s+)?([1-9])', text)
    if text not in CONSULTAS and not choice: return None
    now = now or datetime.now(TZ)
    if pedido.status != 'aguardando_equipe' or pedido.responsavel_id is not None or pedido.agendamento_id:
        return 'A equipe está acompanhando este pedido. Confirme os horários com ela.', {KEY:{'estado':'equipe', 'pedido_id':pedido.id}}
    if text in CONSULTAS:
        events = json.loads(pedido.historico)
        if any(e.get('acao') == 'complemento_cliente' for e in events):
            return 'Sua atualização está com a equipe. Ela vai conferir os horários considerando a mudança solicitada.', {KEY:{'estado':'equipe','pedido_id':pedido.id}}
        source = db.get(WhatsAppBotResposta, pedido.resposta_id)
        if source and (source.wa_identity != identity or source.clinica_id != pedido.clinica_id or str(source.conversation_id) != str(conversation_id)):
            source = None
        original = json.loads(source.tools_usadas or '{}').get('solicitacao_agendamento', {}) if source else {}
        body, data = oferecer(db, pedido.clinica_id, original, pedido.id, now)
        data['pedido_versao'] = pedido.versao
        return body, {KEY:data}
    oferta = ultima_oferta(db, pedido, identity, conversation_id)
    if not oferta or oferta.get('estado') != 'oferta' or '?' in message:
        return 'Para consultar uma nova lista de opções, escreva “ver horários”. Nenhum horário foi reservado.', {KEY:{'estado':'sem_oferta','pedido_id':pedido.id}}
    index = int(choice[1])-1
    if pedido.versao != oferta.get('pedido_versao') or now >= local(oferta['expira_em']) or index >= len(oferta['slots']):
        return 'Essa opção não está disponível nesta lista ou a lista expirou. Escreva “ver horários” para consultar novamente.', {KEY:{'estado':'expirada','pedido_id':pedido.id}}
    slot = oferta['slots'][index]
    try:
        service = db.get(Servico, oferta['servico_id'])
        if not service or not service.ativo or service.duracao_minutos != oferta['duracao']:
            raise ValueError('Serviço alterado')
        day = local(slot['inicio']).date()
        available = slots_seguros(consultar_dia(db, pedido.clinica_id, service, day), service, day, now)
        if slot not in available: raise ValueError('Horário alterado')
    except (HTTPException, ValueError, TimeoutError):
        return 'Não consegui revalidar esse horário. Nenhuma reserva foi feita. Escreva “ver horários” para consultar novas opções ou fale com a equipe.', {KEY:{'estado':'indisponivel','pedido_id':pedido.id}}
    label = local(slot['inicio']).strftime('%d/%m/%Y às %H:%M')
    observacao = f'Horário escolhido pelo cliente: {label} (Fortaleza). Revalidado na consulta; sem reserva. A equipe deve conferir novamente antes de agendar.'
    return (f'Recebi sua escolha: {label} (Fortaleza). O horário apareceu novamente na consulta e vou encaminhá-lo à equipe. Ainda não há reserva; aguarde a confirmação da equipe.',
            {KEY:{'estado':'escolha','pedido_id':pedido.id,'slot':slot,'servico_id':service.id},
             'continuidade_pedido':{'pedido_id':pedido.id,'complemento':observacao,'horario_preferido':slot['inicio'],'pedido_versao':pedido.versao}})


def validar_renderizado(text, audit):
    from app.services.whatsapp_bot_guardrails import avaliar_resposta, TurnoDeGeracao, _horarios_no_texto
    data = audit.get(KEY, {})
    slots = data.get('slots', []) + ([data['slot']] if data.get('slot') else [])
    turno = TurnoDeGeracao(persona='clinica', tools_ok=['consulta_agenda_operacional'])
    for slot in slots:
        turno.horarios_permitidos.update(_horarios_no_texto(local(slot['inicio']).strftime('%H:%M')))
    return avaliar_resposta(texto=text, intent='solicitar_agendamento', modo='suggest', turno=turno).aprovado


def envio_vigente(resposta, now=None):
    """Não enviar uma oferta que expirou enquanto aguardava processamento."""
    data = json.loads(resposta.tools_usadas or '{}').get(KEY, {})
    if data.get('estado') != 'oferta': return True
    try:
        now = now or datetime.now(TZ)
        return (data.get('clinica_id') == resposta.clinica_id and now < local(data['expira_em'])
                and all(local(slot['inicio']) > now for slot in data['slots']))
    except (ValueError, KeyError, TypeError):
        return False
