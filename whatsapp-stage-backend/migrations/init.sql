-- conversations
CREATE TABLE IF NOT EXISTS conversations (
  id BIGSERIAL PRIMARY KEY,
  wa_phone_number VARCHAR(32) NOT NULL,
  wa_psid VARCHAR(128),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  subject TEXT,
  last_agent_id BIGINT,
  last_activity_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT conversations_wa_phone_number_key UNIQUE (wa_phone_number),
  CONSTRAINT conversations_wa_psid_key UNIQUE (wa_psid)
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(128),
  from_me BOOLEAN NOT NULL,
  body TEXT,
  type VARCHAR(32) NOT NULL DEFAULT 'text',
  metadata JSONB,
  status VARCHAR(32) DEFAULT 'received',
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT messages_wa_message_id_key UNIQUE (wa_message_id)
);

-- agents
CREATE TABLE IF NOT EXISTS agents (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(150),
  email VARCHAR(255) UNIQUE,
  role VARCHAR(20) DEFAULT 'agent',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- conversation_participants
CREATE TABLE IF NOT EXISTS conversation_participants (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id BIGINT REFERENCES agents(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ
);

-- audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT,
  agent_id BIGINT,
  action VARCHAR(100),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- message_status_events
CREATE TABLE IF NOT EXISTS message_status_events (
  id BIGSERIAL PRIMARY KEY,
  wa_message_id VARCHAR(128) NOT NULL,
  conversation_id BIGINT,
  status VARCHAR(32) NOT NULL,
  provider_timestamp BIGINT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT message_status_events_wa_message_id_status_provider_timestamp_key
    UNIQUE (wa_message_id, status, provider_timestamp)
);

-- webhook_events
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  payload JSONB NOT NULL,
  raw_body TEXT NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  signature_header TEXT,
  object_type VARCHAR(64),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT webhook_events_payload_hash_key UNIQUE (payload_hash)
);

-- webhook_event_cleanup_runs
CREATE TABLE IF NOT EXISTS webhook_event_cleanup_runs (
  id BIGSERIAL PRIMARY KEY,
  executor VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  retention_days INTEGER NOT NULL,
  deleted_rows INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Reservation templates sent by FortCordis. The random button payloads bind
-- Meta callbacks to one reservation without exposing its numeric id.
CREATE TABLE IF NOT EXISTS agenda_reservation_messages (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL,
  destination VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  confirm_payload VARCHAR(128) NOT NULL,
  change_payload VARCHAR(128) NOT NULL,
  wa_message_id VARCHAR(160),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT agenda_reservation_messages_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT agenda_reservation_messages_confirm_payload_key UNIQUE (confirm_payload),
  CONSTRAINT agenda_reservation_messages_change_payload_key UNIQUE (change_payload),
  CONSTRAINT agenda_reservation_messages_wa_message_id_key UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS ix_agenda_reservation_messages_reservation
  ON agenda_reservation_messages (reservation_id, created_at);

CREATE TABLE IF NOT EXISTS agenda_reservation_button_events (
  id BIGSERIAL PRIMARY KEY,
  provider_message_id VARCHAR(160) NOT NULL,
  reservation_message_id BIGINT NOT NULL REFERENCES agenda_reservation_messages(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL,
  from_phone VARCHAR(32) NOT NULL,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  response_payload JSONB,
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT agenda_reservation_button_events_provider_message_id_key UNIQUE (provider_message_id)
);

-- Approved utility templates sent explicitly by FortCordis. Button payloads
-- remain opaque and are retained for future domain-specific callback bindings.
CREATE TABLE IF NOT EXISTS approved_template_messages (
  id BIGSERIAL PRIMARY KEY,
  template_key VARCHAR(80) NOT NULL,
  template_name VARCHAR(128) NOT NULL,
  language_code VARCHAR(20) NOT NULL,
  subject_type VARCHAR(40) NOT NULL,
  subject_id BIGINT NOT NULL,
  destination VARCHAR(32) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  body_parameters JSONB NOT NULL,
  button_bindings JSONB NOT NULL DEFAULT '[]'::jsonb,
  rendered_body TEXT NOT NULL,
  wa_message_id VARCHAR(160),
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT approved_template_messages_idempotency_key UNIQUE (idempotency_key),
  CONSTRAINT approved_template_messages_wa_message_id_key UNIQUE (wa_message_id)
);

CREATE INDEX IF NOT EXISTS ix_approved_template_messages_subject
  ON approved_template_messages (subject_type, subject_id, created_at);

-- normalize duplicated conversations by phone (preserve oldest row)
WITH ranked_phone AS (
  SELECT
    id,
    wa_phone_number,
    MIN(id) OVER (PARTITION BY wa_phone_number) AS canonical_id
  FROM conversations
),
to_merge_phone AS (
  SELECT id, canonical_id
  FROM ranked_phone
  WHERE id <> canonical_id
)
UPDATE messages m
SET conversation_id = t.canonical_id
FROM to_merge_phone t
WHERE m.conversation_id = t.id;

WITH ranked_phone AS (
  SELECT
    id,
    wa_phone_number,
    MIN(id) OVER (PARTITION BY wa_phone_number) AS canonical_id
  FROM conversations
),
to_merge_phone AS (
  SELECT id, canonical_id
  FROM ranked_phone
  WHERE id <> canonical_id
)
UPDATE conversation_participants cp
SET conversation_id = t.canonical_id
FROM to_merge_phone t
WHERE cp.conversation_id = t.id;

WITH ranked_phone AS (
  SELECT
    id,
    wa_phone_number,
    MIN(id) OVER (PARTITION BY wa_phone_number) AS canonical_id
  FROM conversations
),
to_merge_phone AS (
  SELECT id, canonical_id
  FROM ranked_phone
  WHERE id <> canonical_id
)
UPDATE audit_logs a
SET conversation_id = t.canonical_id
FROM to_merge_phone t
WHERE a.conversation_id = t.id;

WITH ranked_phone AS (
  SELECT
    id,
    wa_phone_number,
    MIN(id) OVER (PARTITION BY wa_phone_number) AS canonical_id
  FROM conversations
),
to_merge_phone AS (
  SELECT id, canonical_id
  FROM ranked_phone
  WHERE id <> canonical_id
)
UPDATE message_status_events mse
SET conversation_id = t.canonical_id
FROM to_merge_phone t
WHERE mse.conversation_id = t.id;

WITH ranked_phone AS (
  SELECT
    id,
    wa_phone_number,
    MIN(id) OVER (PARTITION BY wa_phone_number) AS canonical_id
  FROM conversations
)
DELETE FROM conversations c
USING ranked_phone r
WHERE c.id = r.id
  AND r.id <> r.canonical_id;

-- normalize duplicated conversations by psid (preserve oldest row)
WITH ranked_psid AS (
  SELECT
    id,
    wa_psid,
    MIN(id) OVER (PARTITION BY wa_psid) AS canonical_id
  FROM conversations
  WHERE wa_psid IS NOT NULL
),
to_merge_psid AS (
  SELECT id, canonical_id
  FROM ranked_psid
  WHERE id <> canonical_id
)
UPDATE messages m
SET conversation_id = t.canonical_id
FROM to_merge_psid t
WHERE m.conversation_id = t.id;

WITH ranked_psid AS (
  SELECT
    id,
    wa_psid,
    MIN(id) OVER (PARTITION BY wa_psid) AS canonical_id
  FROM conversations
  WHERE wa_psid IS NOT NULL
),
to_merge_psid AS (
  SELECT id, canonical_id
  FROM ranked_psid
  WHERE id <> canonical_id
)
UPDATE conversation_participants cp
SET conversation_id = t.canonical_id
FROM to_merge_psid t
WHERE cp.conversation_id = t.id;

WITH ranked_psid AS (
  SELECT
    id,
    wa_psid,
    MIN(id) OVER (PARTITION BY wa_psid) AS canonical_id
  FROM conversations
  WHERE wa_psid IS NOT NULL
),
to_merge_psid AS (
  SELECT id, canonical_id
  FROM ranked_psid
  WHERE id <> canonical_id
)
UPDATE audit_logs a
SET conversation_id = t.canonical_id
FROM to_merge_psid t
WHERE a.conversation_id = t.id;

WITH ranked_psid AS (
  SELECT
    id,
    wa_psid,
    MIN(id) OVER (PARTITION BY wa_psid) AS canonical_id
  FROM conversations
  WHERE wa_psid IS NOT NULL
),
to_merge_psid AS (
  SELECT id, canonical_id
  FROM ranked_psid
  WHERE id <> canonical_id
)
UPDATE message_status_events mse
SET conversation_id = t.canonical_id
FROM to_merge_psid t
WHERE mse.conversation_id = t.id;

WITH ranked_psid AS (
  SELECT
    id,
    wa_psid,
    MIN(id) OVER (PARTITION BY wa_psid) AS canonical_id
  FROM conversations
  WHERE wa_psid IS NOT NULL
)
DELETE FROM conversations c
USING ranked_psid r
WHERE c.id = r.id
  AND r.id <> r.canonical_id;

-- normalize duplicated wa_message_id before adding UNIQUE (keep first, preserve duplicates as rows)
WITH ranked_messages AS (
  SELECT
    id,
    wa_message_id,
    ROW_NUMBER() OVER (PARTITION BY wa_message_id ORDER BY created_at ASC, id ASC) AS rn,
    MIN(id) OVER (PARTITION BY wa_message_id) AS canonical_id
  FROM messages
  WHERE wa_message_id IS NOT NULL
),
duplicate_messages AS (
  SELECT id, wa_message_id, canonical_id
  FROM ranked_messages
  WHERE rn > 1
)
UPDATE messages m
SET wa_message_id = NULL,
    metadata = COALESCE(m.metadata, '{}'::jsonb) || jsonb_build_object(
      'duplicate_wa_message_id', d.wa_message_id,
      'duplicate_of_local_message_id', d.canonical_id
    )
FROM duplicate_messages d
WHERE m.id = d.id;

-- best-effort backfill if historical rows have NULL conversation_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM messages WHERE conversation_id IS NULL)
     AND NOT EXISTS (SELECT 1 FROM conversations)
  THEN
    INSERT INTO conversations (
      wa_phone_number,
      wa_psid,
      status,
      subject,
      last_activity_at,
      created_at,
      updated_at
    )
    VALUES ('0000000000000', NULL, 'open', 'migration-fallback-conversation', now(), now(), now())
    ON CONFLICT (wa_phone_number) DO NOTHING;
  END IF;
END $$;

WITH fallback_conversation AS (
  SELECT id
  FROM conversations
  ORDER BY id ASC
  LIMIT 1
)
UPDATE messages m
SET conversation_id = f.id
FROM fallback_conversation f
WHERE m.conversation_id IS NULL;

ALTER TABLE conversations
  ALTER COLUMN wa_phone_number SET NOT NULL;

ALTER TABLE messages
  ALTER COLUMN conversation_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_wa_phone_number_key'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_wa_phone_number_key UNIQUE (wa_phone_number);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_wa_psid_key'
  ) THEN
    ALTER TABLE conversations
      ADD CONSTRAINT conversations_wa_psid_key UNIQUE (wa_psid);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_wa_message_id_key'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_wa_message_id_key UNIQUE (wa_message_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'message_status_events_wa_message_id_status_provider_timestamp_key'
  ) THEN
    ALTER TABLE message_status_events
      ADD CONSTRAINT message_status_events_wa_message_id_status_provider_timestamp_key
      UNIQUE (wa_message_id, status, provider_timestamp);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'webhook_events_payload_hash_key'
  ) THEN
    ALTER TABLE webhook_events
      ADD CONSTRAINT webhook_events_payload_hash_key UNIQUE (payload_hash);
  END IF;
END $$;

-- audit_logs foreign keys are added as NOT VALID to avoid breaking legacy data.
-- TODO: run VALIDATE CONSTRAINT in maintenance window after verifying historical integrity.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_conversation_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_conversation_id_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES conversations(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_agent_id_fkey'
  ) THEN
    ALTER TABLE audit_logs
      ADD CONSTRAINT audit_logs_agent_id_fkey
      FOREIGN KEY (agent_id)
      REFERENCES agents(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

DROP INDEX IF EXISTS idx_conversations_phone;
DROP INDEX IF EXISTS idx_messages_wa_message_id;

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_agent ON conversations(last_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_activity_desc ON conversations(last_activity_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_participants_conversation_agent ON conversation_participants(conversation_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_left_at ON conversation_participants(conversation_id, left_at);
CREATE INDEX IF NOT EXISTS idx_participants_agent_left_at ON conversation_participants(agent_id, left_at);

CREATE INDEX IF NOT EXISTS idx_message_status_events_message_id ON message_status_events(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_message_status_events_conversation_created
  ON message_status_events(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status_received_at
  ON webhook_events(processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at_desc
  ON webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_event_cleanup_runs_created_at_desc
  ON webhook_event_cleanup_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_event_cleanup_runs_status_created_at
  ON webhook_event_cleanup_runs(status, created_at DESC);
