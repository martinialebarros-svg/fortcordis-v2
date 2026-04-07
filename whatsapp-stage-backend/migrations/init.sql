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
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- messages
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id BIGINT REFERENCES conversations(id) ON DELETE CASCADE,
  wa_message_id VARCHAR(128),
  from_me BOOLEAN NOT NULL,
  body TEXT,
  type VARCHAR(32) NOT NULL DEFAULT 'text',
  metadata JSONB,
  status VARCHAR(32) DEFAULT 'received',
  created_at TIMESTAMPTZ DEFAULT now()
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

CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(wa_phone_number);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_agent ON conversations(last_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_message_id ON messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_participants_conversation_agent ON conversation_participants(conversation_id, agent_id);
