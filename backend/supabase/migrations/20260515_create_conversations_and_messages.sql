-- Add user-owned chat persistence tables for frontend auth + history sidebar.
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversations_user_id_updated_at_idx
ON conversations (user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx
ON messages (conversation_id, created_at ASC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conversations_select_own ON conversations;
CREATE POLICY conversations_select_own
ON conversations
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS conversations_insert_own ON conversations;
CREATE POLICY conversations_insert_own
ON conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS conversations_update_own ON conversations;
CREATE POLICY conversations_update_own
ON conversations
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS conversations_delete_own ON conversations;
CREATE POLICY conversations_delete_own
ON conversations
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS messages_select_own ON messages;
CREATE POLICY messages_select_own
ON messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS messages_insert_own ON messages;
CREATE POLICY messages_insert_own
ON messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS messages_update_own ON messages;
CREATE POLICY messages_update_own
ON messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS messages_delete_own ON messages;
CREATE POLICY messages_delete_own
ON messages
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM conversations
    WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
  )
);
