"""Consent quotes are read-only with respect to Google; config/history are admin-only."""
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field, StrictInt

from app.core.security import get_current_user, require_papel
from app.models.user import User
from app.services.google_maps_cost_control import (
    CostConfiguration, confirm_preview, create_preview, get_status, update_configuration,
)

router = APIRouter()


class PreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: str = Field(min_length=3, max_length=10)
    path: str = Field(min_length=1, max_length=500, pattern=r"^/api/v1/")
    query: str | dict[str, Any] | None = None
    body: Any = None


class ConfirmRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    quote_id: str = Field(min_length=20, max_length=64)


class ConfigRequest(CostConfiguration):
    expected_revision: StrictInt = Field(ge=0)


@router.post("/preview")
def preview(payload: PreviewRequest, current_user: User = Depends(get_current_user)):
    return create_preview(current_user.id, **payload.model_dump())


@router.post("/confirm")
def confirm(payload: ConfirmRequest, current_user: User = Depends(get_current_user)):
    return confirm_preview(current_user.id, payload.quote_id)


@router.get("/status")
def status(current_user: User = Depends(require_papel("admin"))):
    return get_status()


@router.put("/config")
def configure(payload: ConfigRequest, current_user: User = Depends(require_papel("admin"))):
    config = CostConfiguration.model_validate(payload.model_dump(exclude={"expected_revision"}))
    return update_configuration(current_user.id, config, payload.expected_revision)
