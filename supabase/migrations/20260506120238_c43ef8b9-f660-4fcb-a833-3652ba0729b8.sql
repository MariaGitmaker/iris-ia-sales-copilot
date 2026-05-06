
-- ============================================================
-- 1. channel_messages: edição/exclusão + auditoria
-- ============================================================
ALTER TABLE public.channel_messages
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_content text;

CREATE TABLE IF NOT EXISTS public.channel_message_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edit','delete')),
  previous_content text,
  new_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cma_msg ON public.channel_message_audit(message_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cma_user ON public.channel_message_audit(user_id, created_at DESC);

ALTER TABLE public.channel_message_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit read own" ON public.channel_message_audit
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.channel_messages_audit_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  SELECT user_id INTO v_user FROM public.conversations WHERE id = NEW.conversation_id;
  IF v_user IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.channel_message_audit(message_id, conversation_id, user_id, action, previous_content, new_content)
      VALUES (NEW.id, NEW.conversation_id, v_user, 'delete', OLD.content, NULL);
    ELSIF NEW.content IS DISTINCT FROM OLD.content THEN
      IF NEW.original_content IS NULL THEN NEW.original_content := OLD.content; END IF;
      NEW.edited_at := now();
      INSERT INTO public.channel_message_audit(message_id, conversation_id, user_id, action, previous_content, new_content)
      VALUES (NEW.id, NEW.conversation_id, v_user, 'edit', OLD.content, NEW.content);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_channel_messages_audit ON public.channel_messages;
CREATE TRIGGER trg_channel_messages_audit
  BEFORE UPDATE ON public.channel_messages
  FOR EACH ROW EXECUTE FUNCTION public.channel_messages_audit_trg();

-- ============================================================
-- 2. leads: soft delete + birthday
-- ============================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_reason text,
  ADD COLUMN IF NOT EXISTS birthday date;

CREATE INDEX IF NOT EXISTS idx_leads_active ON public.leads(user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_trash ON public.leads(user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_birthday ON public.leads(user_id, birthday) WHERE birthday IS NOT NULL AND deleted_at IS NULL;

-- ============================================================
-- 3. reminder_rules
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reminder_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  trigger_type text NOT NULL DEFAULT 'inactivity' CHECK (trigger_type IN ('inactivity','stage_age','date')),
  threshold_hours integer NOT NULL DEFAULT 24,
  stages text[] NOT NULL DEFAULT ARRAY[]::text[],
  enabled boolean NOT NULL DEFAULT true,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rr select own" ON public.reminder_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rr insert own" ON public.reminder_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rr update own" ON public.reminder_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rr delete own" ON public.reminder_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_rr_updated BEFORE UPDATE ON public.reminder_rules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. lead_reminders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid,
  kind text NOT NULL DEFAULT 'followup' CHECK (kind IN ('followup','birthday','holiday','custom','recovery')),
  due_at timestamptz NOT NULL DEFAULT now(),
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','snoozed','dismissed')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lead_id, kind, due_at)
);
ALTER TABLE public.lead_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lr select own" ON public.lead_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "lr insert own" ON public.lead_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lr update own" ON public.lead_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lr delete own" ON public.lead_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_lr_pending ON public.lead_reminders(user_id, due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_lr_lead ON public.lead_reminders(lead_id);
CREATE TRIGGER trg_lr_updated BEFORE UPDATE ON public.lead_reminders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. lead_events (timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'note',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le select own" ON public.lead_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "le insert own" ON public.lead_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "le delete own" ON public.lead_events FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_le_user_time ON public.lead_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_le_lead_time ON public.lead_events(lead_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_le_meta ON public.lead_events USING GIN(metadata);

-- Trigger: leads stage / create
CREATE OR REPLACE FUNCTION public.leads_event_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.lead_events(user_id, lead_id, type, title, description, metadata)
    VALUES (NEW.user_id, NEW.id, 'created', 'Lead criado', COALESCE(NEW.name,''), jsonb_build_object('stage', NEW.stage));
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      INSERT INTO public.lead_events(user_id, lead_id, type, title, description, metadata)
      VALUES (NEW.user_id, NEW.id, 'stage_change', 'Mudança de estágio',
              COALESCE(OLD.stage,'') || ' → ' || COALESCE(NEW.stage,''),
              jsonb_build_object('from', OLD.stage, 'to', NEW.stage));
    END IF;
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at AND NEW.deleted_at IS NOT NULL THEN
      INSERT INTO public.lead_events(user_id, lead_id, type, title, description, metadata)
      VALUES (NEW.user_id, NEW.id, 'deleted', 'Lead movido para lixeira', COALESCE(NEW.deleted_reason,''), '{}'::jsonb);
    ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
      INSERT INTO public.lead_events(user_id, lead_id, type, title, description, metadata)
      VALUES (NEW.user_id, NEW.id, 'restored', 'Lead restaurado', '', '{}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_leads_event ON public.leads;
CREATE TRIGGER trg_leads_event
  AFTER INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.leads_event_trg();

-- Trigger: channel_messages → lead event (se a conversa estiver linkada a lead)
CREATE OR REPLACE FUNCTION public.channel_messages_event_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid; v_lead uuid;
BEGIN
  SELECT user_id, lead_id INTO v_user, v_lead FROM public.conversations WHERE id = NEW.conversation_id;
  IF v_lead IS NULL OR v_user IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.lead_events(user_id, lead_id, type, title, description, metadata, occurred_at)
  VALUES (v_user, v_lead, 'message',
          CASE WHEN NEW.direction = 'outbound' THEN 'Mensagem enviada' ELSE 'Mensagem recebida' END,
          LEFT(COALESCE(NEW.content,''), 240),
          jsonb_build_object('direction', NEW.direction, 'sender', NEW.sender, 'message_id', NEW.id),
          NEW.created_at);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_channel_messages_event ON public.channel_messages;
CREATE TRIGGER trg_channel_messages_event
  AFTER INSERT ON public.channel_messages
  FOR EACH ROW EXECUTE FUNCTION public.channel_messages_event_trg();

-- ============================================================
-- 6. holiday_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.holiday_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  holiday_key text NOT NULL,
  name text NOT NULL DEFAULT '',
  date_rule text NOT NULL DEFAULT '',
  message_template text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, holiday_key)
);
ALTER TABLE public.holiday_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ht select own" ON public.holiday_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ht insert own" ON public.holiday_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ht update own" ON public.holiday_templates FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ht delete own" ON public.holiday_templates FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_ht_updated BEFORE UPDATE ON public.holiday_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
