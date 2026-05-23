-- =====================================================
-- PLANNED TRIPS + ROUTE POINTS
-- =====================================================
-- Adds:
--   * title, planned coordinates, scheduled times, estimates, real metrics on trips
--   * extra status values (assigned, viewed, paused, late, incident)
--   * trip_route_points table (multi-stop routes)
--   * RLS, indexes, realtime
-- Safe to re-run.
-- =====================================================

-- ---------- Extend trip_status enum ----------
DO $$ BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'assigned';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'viewed';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'paused';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'late';
EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN
  ALTER TYPE public.trip_status ADD VALUE IF NOT EXISTS 'incident';
EXCEPTION WHEN others THEN NULL; END $$;

-- ---------- Route point type ----------
DO $$ BEGIN
  CREATE TYPE public.route_point_type AS ENUM (
    'origin', 'stop', 'pickup', 'delivery', 'fuel', 'rest', 'destination'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.route_point_status AS ENUM ('pending', 'visited', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Extend trips ----------
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS title              TEXT,
  ADD COLUMN IF NOT EXISTS origin_lat         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS origin_lng         DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_lat    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS destination_lng    DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimated_distance_m NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_duration_s NUMERIC,
  ADD COLUMN IF NOT EXISTS real_distance_m    NUMERIC,
  ADD COLUMN IF NOT EXISTS real_duration_s    NUMERIC,
  ADD COLUMN IF NOT EXISTS priority           TEXT,
  ADD COLUMN IF NOT EXISTS client_name        TEXT,
  ADD COLUMN IF NOT EXISTS service_order      TEXT,
  ADD COLUMN IF NOT EXISTS cargo_type         TEXT,
  ADD COLUMN IF NOT EXISTS driver_instructions TEXT,
  ADD COLUMN IF NOT EXISTS created_by         UUID,
  ADD COLUMN IF NOT EXISTS viewed_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS trips_driver_status_idx
  ON public.trips (driver_id, status, scheduled_start_at DESC);

CREATE INDEX IF NOT EXISTS trips_company_scheduled_idx
  ON public.trips (company_id, scheduled_start_at DESC);

-- ---------- trip_route_points ----------
CREATE TABLE IF NOT EXISTS public.trip_route_points (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id     UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  point_order INT  NOT NULL,
  point_type  public.route_point_type NOT NULL,
  name        TEXT,
  address     TEXT,
  latitude    DOUBLE PRECISION NOT NULL,
  longitude   DOUBLE PRECISION NOT NULL,
  notes       TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  status      public.route_point_status NOT NULL DEFAULT 'pending',
  visited_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, point_order)
);

CREATE INDEX IF NOT EXISTS trip_route_points_trip_order_idx
  ON public.trip_route_points (trip_id, point_order);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.trip_route_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members can read route points" ON public.trip_route_points;
CREATE POLICY "company members can read route points"
  ON public.trip_route_points FOR SELECT
  USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "managers can write route points" ON public.trip_route_points;
CREATE POLICY "managers can write route points"
  ON public.trip_route_points FOR ALL
  USING (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  )
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    AND (public.has_role('admin', auth.uid()) OR public.has_role('fleet_manager', auth.uid()))
  );

-- Drivers can update their own trip points' visited_at (e.g., mark visited)
DROP POLICY IF EXISTS "drivers can update own trip points" ON public.trip_route_points;
CREATE POLICY "drivers can update own trip points"
  ON public.trip_route_points FOR UPDATE
  USING (
    public.is_company_member(company_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.drivers d ON d.id = t.driver_id
      WHERE t.id = trip_route_points.trip_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_company_member(company_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.drivers d ON d.id = t.driver_id
      WHERE t.id = trip_route_points.trip_id AND d.user_id = auth.uid()
    )
  );

-- =====================================================
-- REALTIME
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_route_points'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_route_points';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'supabase_realtime publication not found, skipping';
END $$;

-- =====================================================
-- Auto-set viewed_at when driver loads an assigned trip (via RPC, optional)
-- =====================================================
CREATE OR REPLACE FUNCTION public.fn_mark_trip_viewed(_trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.trips
     SET viewed_at = COALESCE(viewed_at, now()),
         status = CASE
                    WHEN status = 'assigned' THEN 'viewed'::public.trip_status
                    ELSE status
                  END,
         updated_at = now()
   WHERE id = _trip_id
     AND EXISTS (
       SELECT 1 FROM public.drivers d
       WHERE d.id = trips.driver_id AND d.user_id = auth.uid()
     );
END;
$$;
