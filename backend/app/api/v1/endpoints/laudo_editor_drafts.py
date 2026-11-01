"""Private recovery workspaces. These routes never save or emit a clinical report."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.laudo_editor_draft import (
    LaudoEditorDraftClose, LaudoEditorDraftClosedResponse,
    LaudoEditorDraftResponse, LaudoEditorDraftSave,
)
from app.services.laudo_editor_draft_service import close_editor_draft, get_editor_draft, save_editor_draft


router = APIRouter(prefix="/laudos/editor-drafts")


def _require_editor_owner(user: User, expected_owner_id: int) -> None:
    # The cookie remains the authentication authority. This header only stops
    # an old open editor from autosaving under a different browser session.
    if expected_owner_id != user.id:
        raise HTTPException(403, "A sessão mudou. Reabra o editor com o usuário atual antes de continuar.")


@router.get("/{draft_id}", response_model=LaudoEditorDraftResponse)
def get_draft(draft_id: UUID, response: Response,
              expected_owner_id: int = Header(..., alias="X-Editor-Owner-Id", gt=0),
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_editor_owner(user, expected_owner_id)
    response.headers["Cache-Control"] = "no-store"
    return get_editor_draft(db, user.id, str(draft_id))


@router.put("/{draft_id}", response_model=LaudoEditorDraftResponse)
def save_draft(draft_id: UUID, payload: LaudoEditorDraftSave, response: Response,
               expected_owner_id: int = Header(..., alias="X-Editor-Owner-Id", gt=0),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_editor_owner(user, expected_owner_id)
    response.headers["Cache-Control"] = "no-store"
    return save_editor_draft(db, user.id, str(draft_id), payload)


@router.post("/{draft_id}/close", response_model=LaudoEditorDraftClosedResponse)
def close_draft(draft_id: UUID, payload: LaudoEditorDraftClose, response: Response,
                expected_owner_id: int = Header(..., alias="X-Editor-Owner-Id", gt=0),
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _require_editor_owner(user, expected_owner_id)
    response.headers["Cache-Control"] = "no-store"
    return close_editor_draft(db, user.id, str(draft_id), payload)
