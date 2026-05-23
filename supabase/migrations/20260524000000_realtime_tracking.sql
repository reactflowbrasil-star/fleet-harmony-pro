-- =====================================================
-- REALTIME TRACKING & GEOFENCING
-- =====================================================
-- This migration adds:
--   * battery_level + status on gps_points
--   * current_vehicle_positions (fast "last position" lookup for the live map)
--   * geofences + geofence_events
--   * trigger that mirrors each gps_points insert into current_vehicle_positions
--   * RLS policies (company_id isolation)
--   * Realtime publication for live updates
--
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE).
-- =====================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.gps_status AS ENUM ('moving', 'stopped', 'idle', 'signal_lost', 'offline', 'finished');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.geofence_event_type AS ENUM ('enter', 'exit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- gps_points: enrich ----------
ALTER TABLE public.gps_points
  ADD COLUMN IF NOT EXISTS battery_level NUMERIC,
  ADD COLUMN IF NOT EXISTS altitude NUMERIC,
  ADD COLUMN IF NOT EXISTS status public.gps_status NOT NULL DEFAULT 'moving';

CREATE INDEX IF NOT EXISTS gps_points_trip_recorded_idx
  ON public.gps_points (trip_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS gps_points_company_recorded_idx
  ON public.gps_points (company_id, recorded_at DESC);

-- ---------- current_vehicle_positions ----------
CREATE TABLE IF NOT EXISTS public.current_vehicle_positions (
  vehicle_id  UUID NOT NULL PRIMARY KEY REFERENCES public.vehicles(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  driver_id   UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  trip_id     UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  speed       NUMERIC,
  heading     NUMERIC,
  accuracy    NUMERIC,
  battery_level NUMERIC,
  status      public.gps_status NOT NULL DEFAULT 'moving',
  gps_active  BOOLEAN NOT NULL DEFAULT true,
  last_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS current_positions_company_idx
  ON public.current_vehicle_positions (company_id);

-- ---------- Trigger: mirror inserts to current_vehicle_positions ----------
CREATE OR REPLACE FUNCTION public.fn_upsert_current_position()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle_id UUID;
  v_driver_id  UUID;
BEGIN
  SELECT t.vehicle_id, t.driver_id
    INTO v_vehicle_id, v_driver_id
  FROM public.trips t
  WHERE t.id = NEW.trip_id;

  IF v_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.current_vehicle_positions AS c
    (vehicle_id, company_id, driver_id, trip_id, lat, lng, speed, heading, accuracy, battery_level, status, gps_active, last_update, updated_at)
  VALUES
    (v_vehicle_id, NEW.company_id, v_driver_id, NEW.trip_id, NEW.lat, NEW.lng, NEW.speed, NEW.heading, NEW.accuracy, NEW.battery_level, NEW.status, true, NEW.recorded_at, now())
  ON CONFLICT (vehicle_id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        driver_id  = EXCLUDED.driver_id,
        trip_id    = EXCLUDED.trip_id,
        lat        = EXCLUDED.lat,
        lng        = EXCLUDED.lng,
        speed      = EXCLUDED.speed,
        heading    = EXCLUDED.heading,
        accuracy   = EXCLUDED.accuracy,
        battery_level = EXCLUDED.battery_level,
        status     = EXCLUDED.status,
        gps_active = true,
        last_update = EXCLUDED.last_update,
        updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gps_points_upsert_current ON public.gps_points;
CREATE TRIGGER trg_gps_points_upsert_current
AFTER INSERT ON public.gps_points
FOR EACH ROW
EXECUTE FUNCTION public.fn_upsert_current_position();

-- When a trip finishes, mark its vehicle position as finished
CREATE OR REPLACE FUNCTION public.fn_mark_position_finished_on_trip_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed','cancelled') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.current_vehicle_positions
       SET status = 'finished',
           gps_active = false,
           updated_at = now()
     WHERE trip_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trips_mark_position_finished ON public.trips;
CREATE TRIGGER trg_trips_mark_position_finished
AFTER UPDATE OF status ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.fn_mark_position_finished_on_trip_end();

-- ---------- Geofences ----------
CREATE TABLE IF NOT EXISTS public.geofences (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  center_lat  DOUBLE PRECISION NOT NULL,
  center_lng  DOUBLE PRECISION NOT NULL,
  radius_m    NUMERIC NOT NULL CHECK (radius_m > 0),
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geofences_company_idx ON public.geofences (company_id) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.geofence_events (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  geofence_id  UUID NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  vehicle_id   UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  driver_id    UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  trip_id      UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  event_type   public.geofence_event_type NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS geofence_events_company_time_idx
  ON public.geofence_events (company_id, occurred_at DESC);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.current_vehicle_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofences                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_events           ENABLE ROW LEVEL SECURITY;

-- current_vehicle_positions: members of the company can read, system writes via trigger (SECURITY DEFINER).
DROP POLICY IF EXISTS "company members can read positions" ON public.current_vehicle_positions;
CREATE POLICY "company members can read positions"
  ON public.current_vehicle_positions FOR SELECT
  USING (public.is_company_member(company_id, auth.uid()));

-- Allow admins/managers to write directly if needed
DROP POLICY IF EXISTS "managers can write positions" ON public.current_vehicle_positions;
CREATE POLICY "managers can write positions"
  ON public.current_vehicle_positions FOR ALL
  USING (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  )
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  );

-- geofences: members read, admins/managers write
DROP POLICY IF EXISTS "company members can read geofences" ON public.geofences;
CREATE POLICY "company members can read geofences"
  ON public.geofences FOR SELECT
  USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "managers can write geofences" ON public.geofences;
CREATE POLICY "managers can write geofences"
  ON public.geofences FOR ALL
  USING (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  )
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  );

-- geofence_events: members read; insert allowed for members (driver app)
DROP POLICY IF EXISTS "company members can read geofence events" ON public.geofence_events;
CREATE POLICY "company members can read geofence events"
  ON public.geofence_events FOR SELECT
  USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "company members can insert geofence events" ON public.geofence_events;
CREATE POLICY "company members can insert geofence events"
  ON public.geofence_events FOR INSERT
  WITH CHECK (public.is_company_member(company_id, auth.uid()));

-- =====================================================
-- REALTIME PUBLICATION
-- =====================================================
-- Add these tables to the realtime publication if not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'current_vehicle_positions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.current_vehicle_positions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gps_points'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_points';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trips'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trips';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Publication may not exist on local-only databases; safe to skip.
  RAISE NOTICE 'supabase_realtime publication not found, skipping realtime add';
END $$;

-- =====================================================
-- BACKFILL: populate current_vehicle_positions from the latest gps_points
-- =====================================================
INSERT INTO public.current_vehicle_positions
  (vehicle_id, company_id, driver_id, trip_id, lat, lng, speed, heading, accuracy, battery_level, status, gps_active, last_update, updated_at)
SELECT DISTINCT ON (t.vehicle_id)
  t.vehicle_id, p.company_id, t.driver_id, p.trip_id, p.lat, p.lng, p.speed, p.heading, p.accuracy, p.battery_level,
  p.status, (t.status = 'in_progress'), p.recorded_at, now()
FROM public.gps_points p
JOIN public.trips t ON t.id = p.trip_id
ORDER BY t.vehicle_id, p.recorded_at DESC
ON CONFLICT (vehicle_id) DO NOTHING;
