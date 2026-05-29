# Spec - agenda-renderizacao-slots-configuravel

Data: 2026-05-28
Responsavel: Martiniano + Codex
Status: done

## 1) Escopo funcional

Adicionar configuracao operacional da grade da agenda dentro de `agenda_rota_regras.rendering_policy`, consumida por:

- `Agenda` (visoes panoramica dia/semana);
- `Agenda FullCalendar`;
- `NovoAgendamentoModal` (intervalo enviado ao assistente de ofertas).

## 2) Requisitos funcionais (RF)

- RF-001: sistema deve permitir configurar `slot_interval_min` (5-120 min).
- RF-002: sistema deve oferecer flag `use_custom_window` para habilitar janela fixa de renderizacao.
- RF-003: com `use_custom_window=true`, grade deve usar `window_start` e `window_end`.
- RF-004: com `use_custom_window=false`, janela visual deve continuar derivada do funcionamento semanal (`agenda_semanal`).
- RF-005: `slot_interval_min` deve ser aplicado de forma consistente entre Agenda panoramica, FullCalendar e payload de sugestao do assistente.
- RF-006: configuracao deve ser editavel na tela `Configuracoes > Funcionamento da Agenda`.

## 3) Requisitos nao funcionais (NFR)

- NFR-001: sem migracao de banco.
- NFR-002: compatibilidade retroativa para empresas sem configuracao previa (fallback para defaults).
- NFR-003: normalizacao defensiva no backend e frontend para evitar janelas invalidas.

## 4) Contratos tecnicos

### Backend

- Arquivo: `backend/app/core/agenda_route_rules.py`
- Mudanca: adicionar `rendering_policy` ao `DEFAULT_AGENDA_ROTA_REGRAS` e normalizacao:
  - `use_custom_window: bool`;
  - `window_start/window_end: HH:MM`;
  - `slot_interval_min: int (5..120)`;
  - fallback para janela padrao quando `window_start >= window_end`.

### Frontend

- Arquivo: `frontend/lib/agenda-route-rules.ts`
  - tipos e normalizacao para `rendering_policy`.
- Arquivo: `frontend/app/configuracoes/page.tsx`
  - controles de UI para intervalo e janela de renderizacao.
- Arquivo: `frontend/app/agenda/page.tsx`
  - substituicao de hardcodes de 30 min pela configuracao.
- Arquivo: `frontend/app/agenda/fullcalendar/page.tsx`
  - remover grade baseada no MDC das duracoes de servico;
  - usar `slot_interval_min` da configuracao;
  - aplicar janela fixa opcional.
- Arquivo: `frontend/app/agenda/NovoAgendamentoModal.tsx`
  - receber `intervaloSlotMinutos` e usar no payload (`intervalo_minutos`) do assistente.

## 5) Criterios de aceitacao (CA)

- CA-001: ao definir `slot_interval_min=20`, as grades da Agenda e FullCalendar passam a renderizar em 20 min.
- CA-002: ao ativar `use_custom_window` e definir `08:00-20:00`, a grade exibe esse periodo.
- CA-003: ao desativar `use_custom_window`, grade volta a seguir janela operacional derivada do `agenda_semanal`.
- CA-004: assistente guiado envia `intervalo_minutos` igual ao `slot_interval_min` configurado.
- CA-005: configuracoes invalidas sao normalizadas sem quebrar carregamento da agenda.
