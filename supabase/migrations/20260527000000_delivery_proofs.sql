-- =====================================================
-- DELIVERY PROOFS
-- =====================================================
-- Stores delivery confirmation: photos of the goods/recipient, hand-drawn
-- signature, recipient name and GPS coordinates at delivery time.
--
-- Photos and signatures live in Supabase Storage bucket "delivery-proofs"
-- (you must create it manually or via the dashboard, public read OFF).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.trip_deliveries (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trip_id         UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  route_point_id  UUID REFERENCES public.trip_route_points(id) ON DELETE SET NULL,
  driver_id       UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  recipient_name  TEXT NOT NULL,
  recipient_doc   TEXT,
  notes           TEXT,
  photo_paths     TEXT[] NOT NULL DEFAULT '{}',
  signature_path  TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trip_deliveries_trip_idx ON public.trip_deliveries (trip_id, delivered_at DESC);
CREATE INDEX IF NOT EXISTS trip_deliveries_company_idx ON public.trip_deliveries (company_id, delivered_at DESC);

ALTER TABLE public.trip_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company members read deliveries" ON public.trip_deliveries;
CREATE POLICY "company members read deliveries"
  ON public.trip_deliveries FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "drivers insert own deliveries" ON public.trip_deliveries;
CREATE POLICY "drivers insert own deliveries"
  ON public.trip_deliveries FOR INSERT
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'fleet_manager')
      OR EXISTS (
        SELECT 1 FROM public.drivers d
        WHERE d.id = trip_deliveries.driver_id AND d.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "managers delete deliveries" ON public.trip_deliveries;
CREATE POLICY "managers delete deliveries"
  ON public.trip_deliveries FOR DELETE
  USING (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  );

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trip_deliveries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_deliveries';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'realtime publication not found, skipping';
END $$;

-- =====================================================
-- Storage bucket policies (apply once the bucket is created)
-- =====================================================
-- Manual step in Supabase dashboard:
--   Storage → New bucket → name: "delivery-proofs", public: OFF
-- Then run the SQL below to scope access by company_id (encoded as the first
-- path segment: /{company_id}/{trip_id}/{filename}).

DO $$ BEGIN
  -- read: any company member
  EXECUTE $POL$
    CREATE POLICY "company members read delivery-proofs"
    ON storage.objects FOR SELECT
    USING (
      bucket_id = 'delivery-proofs'
      AND public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    );
  $POL$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  -- upload: any company member (driver app uses signed URL via own session)
  EXECUTE $POL$
    CREATE POLICY "company members upload delivery-proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'delivery-proofs'
      AND public.is_company_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    );
  $POL$;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
