-- =====================================================
-- FIX: RLS POLICIES with swapped helper-function arguments
-- =====================================================
-- The migrations 20260524000000, 20260524100000 and 20260524200000
-- accidentally invoked the helpers with arguments in the wrong order:
--
--   public.has_role(_user_id UUID, _role app_role)      -- signature
--   public.is_company_member(_user_id UUID, _company_id UUID)
--
-- ...but the policies called:
--   has_role('admin', auth.uid())              -- wrong (role, user)
--   is_company_member(company_id, auth.uid())  -- wrong (company, user)
--
-- Effect: every WITH CHECK / USING using those calls effectively
-- denies access, so inserts into trip_route_points, geofences,
-- current_vehicle_positions and notifications fail with
-- "new row violates row-level security policy".
--
-- This migration drops the broken policies and recreates them with
-- the correct argument order.
-- =====================================================

-- ---------- current_vehicle_positions ----------
DROP POLICY IF EXISTS "company members can read positions" ON public.current_vehicle_positions;
CREATE POLICY "company members can read positions"
  ON public.current_vehicle_positions FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "managers can write positions" ON public.current_vehicle_positions;
CREATE POLICY "managers can write positions"
  ON public.current_vehicle_positions FOR ALL
  USING (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  )
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  );

-- ---------- geofences ----------
DROP POLICY IF EXISTS "company members can read geofences" ON public.geofences;
CREATE POLICY "company members can read geofences"
  ON public.geofences FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "managers can write geofences" ON public.geofences;
CREATE POLICY "managers can write geofences"
  ON public.geofences FOR ALL
  USING (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  )
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  );

-- ---------- geofence_events ----------
DROP POLICY IF EXISTS "company members can read geofence events" ON public.geofence_events;
CREATE POLICY "company members can read geofence events"
  ON public.geofence_events FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "company members can insert geofence events" ON public.geofence_events;
CREATE POLICY "company members can insert geofence events"
  ON public.geofence_events FOR INSERT
  WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- ---------- trip_route_points ----------
DROP POLICY IF EXISTS "company members can read route points" ON public.trip_route_points;
CREATE POLICY "company members can read route points"
  ON public.trip_route_points FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

DROP POLICY IF EXISTS "managers can write route points" ON public.trip_route_points;
CREATE POLICY "managers can write route points"
  ON public.trip_route_points FOR ALL
  USING (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  )
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  );

DROP POLICY IF EXISTS "drivers can update own trip points" ON public.trip_route_points;
CREATE POLICY "drivers can update own trip points"
  ON public.trip_route_points FOR UPDATE
  USING (
    public.is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.drivers d ON d.id = t.driver_id
      WHERE t.id = trip_route_points.trip_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.drivers d ON d.id = t.driver_id
      WHERE t.id = trip_route_points.trip_id AND d.user_id = auth.uid()
    )
  );

-- ---------- notifications ----------
DROP POLICY IF EXISTS "drivers read own notifications" ON public.notifications;
CREATE POLICY "drivers read own notifications"
  ON public.notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.drivers d
      WHERE d.id = notifications.driver_id AND d.user_id = auth.uid()
    )
    OR public.is_company_member(auth.uid(), company_id)
  );

DROP POLICY IF EXISTS "managers insert notifications" ON public.notifications;
CREATE POLICY "managers insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    public.is_company_member(auth.uid(), company_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager'))
  );

-- ---------- driver_push_tokens ----------
DROP POLICY IF EXISTS "managers read push tokens" ON public.driver_push_tokens;
CREATE POLICY "managers read push tokens"
  ON public.driver_push_tokens FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

-- ---------- Fix the SECURITY DEFINER helper functions too ----------
-- These functions were also calling is_company_member with swapped args.
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
       OR public.is_company_member(auth.uid(), company_id)
     );
END;
$$;
