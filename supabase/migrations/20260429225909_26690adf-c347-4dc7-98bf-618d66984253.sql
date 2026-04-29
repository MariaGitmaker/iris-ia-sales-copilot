
-- Add objective + loss_reason to negotiations
ALTER TABLE public.negotiations
  ADD COLUMN IF NOT EXISTS objective TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS loss_reason TEXT DEFAULT '';

-- Training sessions
CREATE TABLE IF NOT EXISTS public.training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  scenario TEXT NOT NULL DEFAULT '',
  client_profile TEXT NOT NULL DEFAULT '',
  difficulty TEXT NOT NULL DEFAULT 'medium',
  product TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  score INTEGER DEFAULT 0,
  feedback JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own training" ON public.training_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own training" ON public.training_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own training" ON public.training_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own training" ON public.training_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Training messages
CREATE TABLE IF NOT EXISTS public.training_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'client',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.training_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own training msgs" ON public.training_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = training_messages.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users insert own training msgs" ON public.training_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = training_messages.session_id AND s.user_id = auth.uid()));
CREATE POLICY "Users delete own training msgs" ON public.training_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.id = training_messages.session_id AND s.user_id = auth.uid()));

-- Insights table
CREATE TABLE IF NOT EXISTS public.insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own insights" ON public.insights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own insights" ON public.insights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own insights" ON public.insights FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Storage bucket for imported conversations
INSERT INTO storage.buckets (id, name, public)
VALUES ('conversation-imports', 'conversation-imports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own imports" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'conversation-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own imports" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'conversation-imports' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own imports" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'conversation-imports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_training_sessions_updated ON public.training_sessions;
CREATE TRIGGER trg_training_sessions_updated BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
