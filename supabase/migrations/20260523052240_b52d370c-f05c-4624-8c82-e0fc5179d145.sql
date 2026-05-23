
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'fleet_manager', 'driver');
CREATE TYPE public.vehicle_status AS ENUM ('active', 'inactive', 'maintenance', 'sold');
CREATE TYPE public.driver_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.trip_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
CREATE TYPE public.fuel_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.ticket_status AS ENUM ('pending', 'paid', 'appealed', 'cancelled');
CREATE TYPE public.maintenance_type AS ENUM ('preventive', 'corrective');
CREATE TYPE public.company_plan AS ENUM ('starter', 'professional', 'enterprise');

-- =====================================================
-- TABLES
-- =====================================================
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  plan public.company_plan NOT NULL DEFAULT 'starter',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);

CREATE TABLE public.vehicles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  brand TEXT NOT NULL,
  year INTEGER,
  color TEXT,
  vehicle_type TEXT,
  renavam TEXT,
  chassis TEXT,
  tank_capacity NUMERIC,
  fuel_type TEXT,
  current_km NUMERIC NOT NULL DEFAULT 0,
  status public.vehicle_status NOT NULL DEFAULT 'active',
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, plate)
);

CREATE TABLE public.drivers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID,
  full_name TEXT NOT NULL,
  cpf TEXT,
  phone TEXT,
  email TEXT,
  cnh TEXT,
  cnh_category TEXT,
  cnh_expiry DATE,
  address TEXT,
  status public.driver_status NOT NULL DEFAULT 'active',
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  origin TEXT,
  destination TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  start_km NUMERIC,
  end_km NUMERIC,
  distance_m NUMERIC,
  status public.trip_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.gps_points (
  id BIGSERIAL PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed NUMERIC,
  heading NUMERIC,
  accuracy NUMERIC,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gps_trip_recorded ON public.gps_points (trip_id, recorded_at DESC);

CREATE TABLE public.fuel_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips(id) ON DELETE SET NULL,
  station TEXT,
  fuel_type TEXT,
  liters NUMERIC NOT NULL,
  price_per_liter NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  current_km NUMERIC,
  receipt_url TEXT,
  status public.fuel_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  filled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  infraction_date DATE NOT NULL,
  location TEXT,
  infraction_type TEXT,
  value NUMERIC NOT NULL,
  points INTEGER,
  due_date DATE,
  status public.ticket_status NOT NULL DEFAULT 'pending',
  attachment_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  maintenance_type public.maintenance_type NOT NULL DEFAULT 'preventive',
  workshop TEXT,
  service_date DATE NOT NULL,
  current_km NUMERIC,
  value NUMERIC,
  parts TEXT,
  services TEXT,
  invoice_url TEXT,
  next_km NUMERIC,
  next_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- SECURITY DEFINER HELPERS (prevent recursive RLS)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = _user_id AND company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.get_driver_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.drivers WHERE user_id = _user_id LIMIT 1;
$$;

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tr_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_vehicles_updated BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_drivers_updated BEFORE UPDATE ON public.drivers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_trips_updated BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- AUTO-CREATE COMPANY + PROFILE + ADMIN ROLE ON SIGNUP
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _company_name TEXT;
  _full_name TEXT;
BEGIN
  _company_name := COALESCE(NEW.raw_user_meta_data->>'company_name', 'Minha Empresa');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  INSERT INTO public.companies (name) VALUES (_company_name) RETURNING id INTO _company_id;
  INSERT INTO public.profiles (id, company_id, full_name) VALUES (NEW.id, _company_id, _full_name);
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (NEW.id, _company_id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

-- COMPANIES
CREATE POLICY "members view own company" ON public.companies FOR SELECT
  USING (id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin updates own company" ON public.companies FOR UPDATE
  USING (id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- PROFILES
CREATE POLICY "view profiles in company" ON public.profiles FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "user updates own profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "admin inserts profiles" ON public.profiles FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));

-- USER_ROLES
CREATE POLICY "view roles in company" ON public.user_roles FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- Helper: admin OR fleet_manager
-- VEHICLES
CREATE POLICY "company members view vehicles" ON public.vehicles FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin/manager manage vehicles" ON public.vehicles FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- DRIVERS
CREATE POLICY "company members view drivers" ON public.drivers FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin/manager manage drivers" ON public.drivers FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- TRIPS
CREATE POLICY "company members view trips" ON public.trips FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "driver creates own trip" ON public.trips FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'fleet_manager')
      OR driver_id = public.get_driver_id(auth.uid())));
CREATE POLICY "driver updates own trip" ON public.trips FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'fleet_manager')
      OR driver_id = public.get_driver_id(auth.uid())));
CREATE POLICY "admin/manager delete trips" ON public.trips FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- GPS_POINTS
CREATE POLICY "company members view gps" ON public.gps_points FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "driver inserts gps" ON public.gps_points FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.id = trip_id
        AND (public.has_role(auth.uid(), 'admin')
          OR public.has_role(auth.uid(), 'fleet_manager')
          OR t.driver_id = public.get_driver_id(auth.uid()))
    ));

-- FUEL_LOGS
CREATE POLICY "company members view fuel" ON public.fuel_logs FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "users create fuel logs" ON public.fuel_logs FOR INSERT
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin/manager update fuel" ON public.fuel_logs FOR UPDATE
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));
CREATE POLICY "admin/manager delete fuel" ON public.fuel_logs FOR DELETE
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- TICKETS
CREATE POLICY "company members view tickets" ON public.tickets FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin/manager manage tickets" ON public.tickets FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- MAINTENANCE
CREATE POLICY "company members view maintenance" ON public.maintenance FOR SELECT
  USING (company_id = public.get_user_company_id(auth.uid()));
CREATE POLICY "admin/manager manage maintenance" ON public.maintenance FOR ALL
  USING (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid())
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'fleet_manager')));

-- Realtime para mapa em tempo real
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
