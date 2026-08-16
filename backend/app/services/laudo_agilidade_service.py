from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.agenda_config import carregar_agenda_feriados, obter_feriado
from app.models.configuracao import Configuracao

PRAZO_LAUDO_HORAS_UTEIS = 48


def carregar_feriados(db: Session) -> list[dict[str, str]]:
    config = db.query(Configuracao).first()
    raw = getattr(config, "agenda_feriados", None) if config else None
    return carregar_agenda_feriados(raw)


def _e_dia_util(dia: date, feriados: list[dict[str, str]]) -> bool:
    if dia.weekday() >= 5:  # 5 = sabado, 6 = domingo
        return False
    if obter_feriado(dia, feriados):
        return False
    return True


def horas_uteis_entre(inicio: datetime, fim: datetime, feriados: list[dict[str, str]]) -> float:
    """Horas corridas contidas em dias uteis entre dois timestamps.

    Sabado, domingo e datas em `feriados` contam 0h - sem recorte de
    horario comercial dentro do dia util (conta as 24h corridas do dia).
    """
    inicio_naive = inicio.replace(tzinfo=None) if inicio.tzinfo else inicio
    fim_naive = fim.replace(tzinfo=None) if fim.tzinfo else fim

    if fim_naive <= inicio_naive:
        return 0.0

    total_horas = 0.0
    cursor = inicio_naive
    while cursor.date() < fim_naive.date():
        proximo_dia = datetime.combine(cursor.date() + timedelta(days=1), datetime.min.time())
        if _e_dia_util(cursor.date(), feriados):
            total_horas += (proximo_dia - cursor).total_seconds() / 3600
        cursor = proximo_dia

    if _e_dia_util(cursor.date(), feriados):
        total_horas += (fim_naive - cursor).total_seconds() / 3600

    return total_horas
