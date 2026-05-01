-- Channels: conexões de canais (WhatsApp Cloud API, Messenger, etc.)
CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'whatsapp_cloud', -- 'whatsapp_cloud' | 'messenger' | 'whatsapp_evolution'
  name text NOT NULL DEFAULT '',
  phone_number_id text DEFAULT '',        -- WhatsApp Cloud: Phone Number ID
  business_account_id text DEFAULT '',    -- WABA ID
  display_phone text DEFAULT '',
  webhook_verify_token text NOT NULL DEFAULT '', -- token Meta verify
  access_token_secret_name text DEFAULT '', -- nome do secret onde token longo está
  access_token text DEFAULT '',           -- alternativamente armazenado (criptografado idealmente)
  status text NOT NULL DEFAULT 'inactive',-- inactive | active | error
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels read own" ON public.channels FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "channels insert own" ON public.channels FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "channels update own" ON public.channels FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "channels delete own" ON public.channels FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_channels_user ON public.channels(user_id);
CREATE INDEX idx_channels_phone_number_id ON public.channels(phone_number_id);

-- Bot settings: configuração global de comportamento por usuário
CREATE TABLE public.bot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  objective text NOT NULL DEFAULT 'Qualificar lead, entender necessidade e avançar para proposta.',
  product text NOT NULL DEFAULT '',
  audience text NOT NULL DEFAULT '',
  tone integer NOT NULL DEFAULT 50,
  aggressiveness integer NOT NULL DEFAULT 40,
  methodology text NOT NULL DEFAULT 'spin',
  rules text NOT NULL DEFAULT '',                -- regras livres (não falar de preço antes de X, etc.)
  greeting text NOT NULL DEFAULT 'Olá! Sou o assistente comercial. Como posso ajudar?',
  fallback_message text NOT NULL DEFAULT 'Vou chamar um atendente humano para você. Um momento.',
  business_hours jsonb NOT NULL DEFAULT '{"enabled": false, "tz": "America/Sao_Paulo", "start": "08:00", "end": "20:00", "days": [1,2,3,4,5]}'::jsonb,
  handoff_keywords text[] NOT NULL DEFAULT ARRAY['humano','atendente','pessoa real']::text[],
  auto_crm boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_settings read own" ON public.bot_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bot_settings insert own" ON public.bot_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bot_settings update own" ON public.bot_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bot_settings_updated_at BEFORE UPDATE ON public.bot_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Conversations: thread por contato em um canal (omnichannel)
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  external_contact_id text NOT NULL,             -- número WhatsApp / PSID Messenger
  contact_name text NOT NULL DEFAULT '',
  contact_phone text NOT NULL DEFAULT '',
  lead_id uuid,
  negotiation_id uuid,
  bot_active boolean NOT NULL DEFAULT true,      -- handoff: false = humano assumiu
  status text NOT NULL DEFAULT 'open',           -- open | closed | snoozed
  last_message_at timestamptz NOT NULL DEFAULT now(),
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel_id, external_contact_id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations read own" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "conversations insert own" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations update own" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations delete own" ON public.conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_conversations_user ON public.conversations(user_id);
CREATE INDEX idx_conversations_last ON public.conversations(user_id, last_message_at DESC);

-- Channel messages: mensagens trafegadas por canal
CREATE TABLE public.channel_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,                  -- inbound | outbound
  sender text NOT NULL DEFAULT 'client',    -- client | bot | human
  content text NOT NULL DEFAULT '',
  media_url text DEFAULT '',
  media_type text DEFAULT '',
  external_message_id text DEFAULT '',
  status text NOT NULL DEFAULT 'received',  -- received | sent | delivered | read | failed
  feedback text DEFAULT '',                 -- '', up, down  (avaliação do operador na resposta do bot)
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_messages read via conv" ON public.channel_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "channel_messages insert via conv" ON public.channel_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "channel_messages update via conv" ON public.channel_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "channel_messages delete via conv" ON public.channel_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE INDEX idx_channel_messages_conv ON public.channel_messages(conversation_id, created_at);

-- Bot knowledge: base de conhecimento manual + exemplos few-shot vindos de feedback
CREATE TABLE public.bot_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'faq',         -- faq | objection | example | rule
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  source text NOT NULL DEFAULT 'manual',    -- manual | feedback
  rating integer NOT NULL DEFAULT 0,        -- soma de votos (👍+1 / 👎-1)
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_knowledge read own" ON public.bot_knowledge FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "bot_knowledge insert own" ON public.bot_knowledge FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bot_knowledge update own" ON public.bot_knowledge FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bot_knowledge delete own" ON public.bot_knowledge FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER bot_knowledge_updated_at BEFORE UPDATE ON public.bot_knowledge FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_bot_knowledge_user ON public.bot_knowledge(user_id, active);

-- Realtime para painel ao vivo
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_messages;