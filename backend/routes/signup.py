"""POST /api/signup/interpret — entende uma resposta do cadastro conversado."""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from models.signup import SignupInterpretRequest, SignupInterpretResponse
from services.llm_service import LLMConfigurationError, LLMExtractionError
from services.signup_service import interpret_signup_answer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signup", tags=["signup"])


@router.post(
    "/interpret",
    response_model=SignupInterpretResponse,
    summary="Entender uma resposta em linguagem natural do cadastro",
)
async def interpret(payload: SignupInterpretRequest) -> SignupInterpretResponse:
    try:
        answer = await interpret_signup_answer(payload.field, payload.text)
    except LLMConfigurationError as exc:
        # Servidor mal configurado, não pedido inválido.
        logger.error("LLM provider is misconfigured: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except LLMExtractionError as exc:
        # O texto da pessoa nunca entra no log: é dado pessoal (nome, email,
        # data de nascimento) e o motivo da falha está na exceção, não nele.
        logger.warning("Signup interpretation failed for field %s", payload.field)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    return SignupInterpretResponse(answer=answer)
