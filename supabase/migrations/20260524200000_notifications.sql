-- =====================================================
-- NOTIFICATIONS + DRIVER PUSH TOKENS
-- =====================================================
-- Cria histórico de notificações + tokens push por motorista.
-- Trigger: ao inserir trip com driver_id, gera uma notification "new_trip".
-- RLS: motorista só vê as próprias; admins veem da empresa.
-- Safe to re-run.
-- =====================================================

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'new_trip', 'trip_updated', 'trip_cancelled', 'route_changed',
    'document_alert', 'fuel_approved', 'fuel_rejected', 'maintenance_due',
    'ticket_added', 'general_alert'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.push_platform AS ENUM ('web', 'android', 'ios');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id   UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id     UUID,
  trip_id     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  type        public.notification_type NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT,
  data        JSONB,
  status      public.notification_status NOT NULL DEFAULT 'pending',
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_driver_created_idx
  ON public.notifications (driver_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_company_created_idx
  ON public.notifications (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (driver_id) WHERE read_at IS NULL;

-- ---------- driver_push_tokens ----------
CREATE TABLE IF NOT EXISTS public.driver_push_tokens (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id    UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  user_id      UUID,
  device_id    TEXT NOT NULL,
  push_token   TEXT,
  platform     public.push_platform NOT NULL DEFAULT 'web',
  user_agent   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, device_id)
);

CREATE INDEX IF NOT EXISTS push_tokens_driver_idx
  ON public.driver_push_tokens (driver_id) WHERE is_active = true;

-- =====================================================
-- TRIGGER: trip insert → notification "new_trip"
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_notify_trip_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin TEXT;
  v_dest   TEXT;
  v_title  TEXT;
BEGIN
  -- Only notify if driver_id is set
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_origin := COALESCE(NEW.origin, '—');
  v_dest   := COALESCE(NEW.destination, '—');
  v_title  := COALESCE(NEW.title, v_origin || ' → ' || v_dest);

  INSERT INTO public.notifications
    (company_id, driver_id, trip_id, type, title, message, data, status, sent_at)
  VALUES
    (
      NEW.company_id,
      NEW.driver_id,
      NEW.id,
      'new_trip',
      'Nova viagem atribuída',
      v_title,
      jsonb_build_object(
        'trip_id', NEW.id,
        'vehicle_id', NEW.vehicle_id,
        'scheduled_start_at', NEW.scheduled_start_at,
        'origin', v_origin,
        'destination', v_dest
      ),
      'sent',
      now()
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_notify_assignment ON public.trips;
CREATE TRIGGER trg_trips_notify_assignment
AFTER INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_trip_assignment();

-- Notify on driver reassignment too
CREATE OR REPLACE FUNCTION public.fn_notify_trip_reassign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin TEXT;
  v_dest   TEXT;
  v_title  TEXT;
BEGIN
  IF NEW.driver_id IS NULL OR NEW.driver_id IS NOT DISTINCT FROM OLD.driver_id THEN
    RETURN NEW;
  END IF;

  v_origin := COALESCE(NEW.origin, '—');
  v_dest   := COALESCE(NEW.destination, '—');
  v_title  := COALESCE(NEW.title, v_origin || ' → ' || v_dest);

  INSERT INTO public.notifications
    (company_id, driver_id, trip_id, type, title, message, data, status, sent_at)
  VALUES
    (
      NEW.company_id, NEW.driver_id, NEW.id, 'new_trip',
      'Viagem atribuída a você', v_title,
      jsonb_build_object('trip_id', NEW.id, 'reassigned', true),
      'sent', now()
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_notify_reassign ON public.trips;
CREATE TRIGGER trg_trips_notify_reassign
AFTER UPDATE OF driver_id ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.fn_notify_trip_reassign();

-- =====================================================
-- RPC: mark notification as read
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_mark_notification_read(_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.notifications
     SET read_at = COALESCE(read_at, now()),
         status = 'read',
         updated_at = now()
   WHERE id = _id
     AND (
       EXISTS (SELECT 1 FROM public.drivers d WHERE d.id = notifications.driver_id AND d.user_id = auth.uid())
       OR public.is_company_member(company_id, auth.uid())
     );
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_mark_all_notifications_read()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INT;
BEGIN
  WITH upd AS (
    UPDATE public.notifications
       SET read_at = now(), status = 'read', updated_at = now()
     WHERE read_at IS NULL
       AND EXISTS (
         SELECT 1 FROM public.drivers d
         WHERE d.id = notifications.driver_id AND d.user_id = auth.uid()
       )
     RETURNING 1
  ) SELECT COUNT(*) INTO n FROM upd;
  RETURN COALESCE(n, 0);
END;
$$;

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_push_tokens   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "drivers read own notifications" ON public.notifications;
CREATE POLICY "drivers read own notifications"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = notifications.driver_id AND d.user_id = auth.uid()
    )
    OR public.is_company_member(company_id, auth.uid())
  );

DROP POLICY IF EXISTS "drivers update own notifications" ON public.notifications;
CREATE POLICY "drivers update own notifications"
  ON public.notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = notifications.driver_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = notifications.driver_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "managers insert notifications" ON public.notifications;
CREATE POLICY "managers insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  );

-- push tokens
DROP POLICY IF EXISTS "drivers manage own push tokens" ON public.driver_push_tokens;
CREATE POLICY "drivers manage own push tokens"
  ON public.driver_push_tokens FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_push_tokens.driver_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = driver_push_tokens.driver_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "managers read push tokens" ON public.driver_push_tokens;
CREATE POLICY "managers read push tokens"
  ON public.driver_push_tokens FOR SELECT
  USING (public.is_company_member(company_id, auth.uid()));

-- =====================================================
-- REALTIME
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'supabase_realtime publication not found, skipping';
END $$;
