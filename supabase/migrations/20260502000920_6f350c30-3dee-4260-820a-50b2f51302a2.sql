-- Restrict Realtime subscriptions: users can only join topics scoped to their own user_id
-- Topic convention: "user:<auth.uid()>:..." (e.g. "user:<uid>:conv-list", "user:<uid>:conv-<id>")

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can receive own-scoped broadcasts" ON realtime.messages;
CREATE POLICY "Authenticated users can receive own-scoped broadcasts"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
);

DROP POLICY IF EXISTS "Authenticated users can send to own-scoped topics" ON realtime.messages;
CREATE POLICY "Authenticated users can send to own-scoped topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('user:' || auth.uid()::text || ':%')
);

-- Add missing UPDATE policy on insights (scanner warning)
DROP POLICY IF EXISTS "Users update own insights" ON public.insights;
CREATE POLICY "Users update own insights"
ON public.insights
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);