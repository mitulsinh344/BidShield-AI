
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin','reviewer','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  organisation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- New users get a profile and the reviewer role in this sandbox demo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, organisation)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), COALESCE(NEW.raw_user_meta_data->>'organisation','Demo Procurement Authority'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'reviewer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DOMAIN
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  registration_no text NOT NULL,
  country text NOT NULL,
  incorporated_on date NOT NULL,
  bank_fingerprint text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors read" ON public.vendors FOR SELECT TO authenticated USING (true);

CREATE TABLE public.tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  title text NOT NULL,
  buyer text NOT NULL,
  category text NOT NULL,
  estimated_value numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  closes_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'under_review',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenders TO authenticated;
GRANT ALL ON public.tenders TO service_role;
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenders read" ON public.tenders FOR SELECT TO authenticated USING (true);

CREATE TABLE public.bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  submitted_at timestamptz NOT NULL,
  submission_ip text NOT NULL,
  device_fingerprint text NOT NULL,
  document_hash text NOT NULL,
  document_author text NOT NULL,
  risk_score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bids TO authenticated;
GRANT ALL ON public.bids TO service_role;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bids read" ON public.bids FOR SELECT TO authenticated USING (true);

CREATE TABLE public.risk_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL,
  score int NOT NULL DEFAULT 0,
  rationale text NOT NULL,
  source text NOT NULL DEFAULT 'rule',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.risk_flags TO authenticated;
GRANT ALL ON public.risk_flags TO service_role;
ALTER TABLE public.risk_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "risk flags read" ON public.risk_flags FOR SELECT TO authenticated USING (true);

CREATE TABLE public.decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('qualify','disqualify','hold')),
  rationale text NOT NULL,
  decided_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decisions read" ON public.decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviewers record decisions" ON public.decisions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = decided_by AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer')));

CREATE TABLE public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit read" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit append" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

-- SEED (fictional demo / sandbox data)
INSERT INTO public.vendors (id, name, registration_no, country, incorporated_on, bank_fingerprint, contact_email, contact_phone, address) VALUES
('11111111-1111-4111-8111-000000000001','Northwind Civil Works Ltd','DEMO-NL-884213','Netherlands','2011-03-14','BNK-7F2A-4410','tenders@northwind-civil.demo','+31 20 555 0134','Keizersgracht 118, Amsterdam'),
('11111111-1111-4111-8111-000000000002','Halvard Infrastruktur AB','DEMO-SE-112907','Sweden','2009-08-02','BNK-3C91-2288','bids@halvard-infra.demo','+46 8 555 0192','Sveavägen 44, Stockholm'),
('11111111-1111-4111-8111-000000000003','Meridian Groundworks BV','DEMO-NL-990188','Netherlands','2023-11-27','BNK-7F2A-4410','office@meridian-ground.demo','+31 20 555 0134','Keizersgracht 118, Amsterdam'),
('11111111-1111-4111-8111-000000000004','Castellan Engineering SpA','DEMO-IT-448120','Italy','2004-05-19','BNK-8D14-6620','gare@castellan-eng.demo','+39 06 555 0177','Via Nomentana 210, Roma'),
('11111111-1111-4111-8111-000000000005','Brightline Facility Services','DEMO-IE-330671','Ireland','2016-01-08','BNK-5A77-9031','hello@brightline-fs.demo','+353 1 555 0110','12 Harcourt Street, Dublin'),
('11111111-1111-4111-8111-000000000006','Kestrel Digital Systems','DEMO-DE-771402','Germany','2013-06-21','BNK-2B45-7712','vergabe@kestrel-digital.demo','+49 30 555 0165','Chausseestraße 88, Berlin'),
('11111111-1111-4111-8111-000000000007','Aurora Medical Supply Co','DEMO-PL-556093','Poland','2018-09-30','BNK-9E30-1145','przetargi@aurora-medical.demo','+48 22 555 0148','ul. Prosta 51, Warszawa'),
('11111111-1111-4111-8111-000000000008','Vantage Logistics Group','DEMO-BE-224815','Belgium','2007-02-11','BNK-6C22-3390','tenders@vantage-log.demo','+32 2 555 0126','Rue Belliard 40, Bruxelles');

INSERT INTO public.tenders (id, reference, title, buyer, category, estimated_value, currency, closes_at, status) VALUES
('22222222-2222-4222-8222-000000000001','DEMO-TND-2041','Ring Road Bridge Resurfacing, Lot 3','Metropolitan Transport Authority (Demo)','Civil works',4850000.00,'EUR','2026-08-14 16:00:00+00','under_review'),
('22222222-2222-4222-8222-000000000002','DEMO-TND-2058','Hospital Consumables Framework 2026-2029','Regional Health Board (Demo)','Medical supplies',2310000.00,'EUR','2026-08-21 12:00:00+00','under_review'),
('22222222-2222-4222-8222-000000000003','DEMO-TND-2063','Municipal Case Management Platform','City of Rivermouth (Demo)','ICT services',1180000.00,'EUR','2026-09-02 12:00:00+00','under_review');

INSERT INTO public.bids (id, tender_id, vendor_id, amount, submitted_at, submission_ip, device_fingerprint, document_hash, document_author, risk_score) VALUES
('33333333-3333-4333-8333-000000000001','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000001',4712500.00,'2026-08-14 15:41:00+00','198.51.100.24','fp-a91c33','sha256:4f9a…c210','n.brandt',82),
('33333333-3333-4333-8333-000000000002','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000003',4938000.00,'2026-08-14 15:47:00+00','198.51.100.24','fp-a91c33','sha256:4f9a…c210','n.brandt',88),
('33333333-3333-4333-8333-000000000003','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000002',4801000.00,'2026-08-12 09:12:00+00','203.0.113.77','fp-77d201','sha256:1bb7…9e04','s.lindqvist',18),
('33333333-3333-4333-8333-000000000004','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000004',5120000.00,'2026-08-13 11:05:00+00','203.0.113.180','fp-2ee410','sha256:77c1…13aa','g.ferrari',24),
('33333333-3333-4333-8333-000000000005','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000007',2244000.00,'2026-08-20 10:22:00+00','192.0.2.51','fp-b40911','sha256:9ad2…7761','k.nowak',35),
('33333333-3333-4333-8333-000000000006','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000005',2398500.00,'2026-08-21 11:58:00+00','192.0.2.90','fp-c11832','sha256:3fe8…44b1','m.okeefe',12),
('33333333-3333-4333-8333-000000000007','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000008',2290000.00,'2026-08-19 14:40:00+00','192.0.2.140','fp-d99201','sha256:0c45…8fa2','l.dubois',41),
('33333333-3333-4333-8333-000000000008','22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000006',1094000.00,'2026-09-01 09:03:00+00','198.51.100.212','fp-e10473','sha256:6b31…22d9','t.keller',15),
('33333333-3333-4333-8333-000000000009','22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000005',1172500.00,'2026-09-02 11:52:00+00','192.0.2.90','fp-c11832','sha256:8de0…1c77','m.okeefe',29),
('33333333-3333-4333-8333-000000000010','22222222-2222-4222-8222-000000000003','11111111-1111-4111-8111-000000000003',1168900.00,'2026-09-02 11:55:00+00','192.0.2.90','fp-c11832','sha256:8de0…1c77','m.okeefe',73),
('33333333-3333-4333-8333-000000000011','22222222-2222-4222-8222-000000000002','11111111-1111-4111-8111-000000000003',2402000.00,'2026-08-21 11:59:00+00','192.0.2.90','fp-c11832','sha256:3fe8…44b1','m.okeefe',66),
('33333333-3333-4333-8333-000000000012','22222222-2222-4222-8222-000000000001','11111111-1111-4111-8111-000000000005',5340000.00,'2026-08-10 08:30:00+00','192.0.2.90','fp-c11832','sha256:5ac9…30b8','m.okeefe',9);

INSERT INTO public.risk_flags (bid_id, code, title, severity, score, rationale, source) VALUES
('33333333-3333-4333-8333-000000000001','SHARED_BANK','Shared bank fingerprint with another bidder','high',30,'Bank fingerprint BNK-7F2A-4410 also appears on Meridian Groundworks BV, a competing bidder on the same tender.','rule'),
('33333333-3333-4333-8333-000000000001','SHARED_CONTACT','Identical contact channel with a competitor','high',28,'Phone +31 20 555 0134 and registered address match Meridian Groundworks BV.','rule'),
('33333333-3333-4333-8333-000000000001','SAME_IP','Submitted from the same network as a competitor','medium',24,'Submission IP 198.51.100.24 shared with bid from Meridian Groundworks BV, 6 minutes apart.','rule'),
('33333333-3333-4333-8333-000000000002','SHARED_BANK','Shared bank fingerprint with another bidder','high',30,'Bank fingerprint BNK-7F2A-4410 matches Northwind Civil Works Ltd on the same tender.','rule'),
('33333333-3333-4333-8333-000000000002','DOC_METADATA','Identical document author and hash','high',30,'Bid document hash sha256:4f9a…c210 and author "n.brandt" identical to Northwind Civil Works Ltd submission.','rule'),
('33333333-3333-4333-8333-000000000002','NEW_ENTITY','Recently incorporated bidder','medium',16,'Vendor incorporated 2023-11-27, under 36 months before tender close, with no prior award history in the sandbox dataset.','rule'),
('33333333-3333-4333-8333-000000000002','COVER_PRICING','Possible cover bid pattern','medium',12,'Bid sits 4.8% above the lowest bid with near-identical line-item structure — consistent with complementary bidding.','rule'),
('33333333-3333-4333-8333-000000000003','LATE_AMENDMENT','Priced schedule amended near deadline','low',18,'Two line items were revised 41 minutes before close; no other anomaly detected.','rule'),
('33333333-3333-4333-8333-000000000004','PRICE_OUTLIER','Price above estimate band','low',24,'Bid is 5.6% above the buyer estimate; within tolerance but flagged for context.','rule'),
('33333333-3333-4333-8333-000000000005','SANCTIONS_NEAR_MATCH','Near-match on a sandbox watchlist','medium',20,'Director surname is a fuzzy match (0.82) against a fictional sandbox watchlist entry. Not a confirmed match.','rule'),
('33333333-3333-4333-8333-000000000005','OWNERSHIP_OPACITY','Beneficial ownership partially undisclosed','low',15,'Ownership declaration lists a nominee holding 24% with no ultimate beneficial owner named.','rule'),
('33333333-3333-4333-8333-000000000006','NONE','No material signals detected','low',12,'Standard submission profile; no shared identifiers or pricing anomalies found in the sandbox dataset.','rule'),
('33333333-3333-4333-8333-000000000007','ROTATION_PATTERN','Possible bid rotation across lots','medium',41,'Vendor has been runner-up in 4 of 5 sandbox lots where Aurora Medical Supply Co won, suggesting rotation.','rule'),
('33333333-3333-4333-8333-000000000008','NONE','No material signals detected','low',15,'Consistent pricing and unique submission fingerprints.','rule'),
('33333333-3333-4333-8333-000000000009','SHARED_DEVICE','Shared device fingerprint with a competitor','medium',29,'Device fp-c11832 also used by Meridian Groundworks BV on this tender.','rule'),
('33333333-3333-4333-8333-000000000010','SHARED_DEVICE','Shared device fingerprint with a competitor','high',30,'Device fp-c11832 and IP 192.0.2.90 match Brightline Facility Services, submitted 3 minutes apart.','rule'),
('33333333-3333-4333-8333-000000000010','DOC_METADATA','Identical document author and hash','high',28,'Document hash sha256:8de0…1c77 identical to the Brightline Facility Services submission.','rule'),
('33333333-3333-4333-8333-000000000010','CROSS_TENDER','Same vendor cluster active on multiple tenders','medium',15,'Vendor appears in linked clusters on DEMO-TND-2041 and DEMO-TND-2058.','rule'),
('33333333-3333-4333-8333-000000000011','SHARED_DEVICE','Shared device fingerprint with a competitor','high',30,'Device fp-c11832 shared with Brightline Facility Services on the same framework.','rule'),
('33333333-3333-4333-8333-000000000011','COVER_PRICING','Possible cover bid pattern','medium',20,'Submitted 1 minute after a competitor at 0.15% higher price.','rule'),
('33333333-3333-4333-8333-000000000011','NEW_ENTITY','Recently incorporated bidder','medium',16,'Vendor incorporated 2023-11-27 with limited trading history in the sandbox dataset.','rule'),
('33333333-3333-4333-8333-000000000012','NONE','No material signals detected','low',9,'No shared identifiers; pricing consistent with market band.','rule');
