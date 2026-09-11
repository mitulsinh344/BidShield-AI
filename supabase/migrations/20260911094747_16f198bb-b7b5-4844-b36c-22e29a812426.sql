-- =========================================================
-- ORGANIZATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'government',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- PERMISSIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  code text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission_code text NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_code)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- COLUMN EXTENSIONS (before helper functions that reference them)
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_code text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_code_key ON public.profiles(user_code) WHERE user_code IS NOT NULL;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS gstin text,
  ADD COLUMN IF NOT EXISTS udyam text,
  ADD COLUMN IF NOT EXISTS annual_turnover numeric,
  ADD COLUMN IF NOT EXISTS msme_class text;

ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS department text NOT NULL DEFAULT 'Procurement Division',
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS bid_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'UNDER_REVIEW',
  ADD COLUMN IF NOT EXISTS compliance_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS scenario text NOT NULL DEFAULT 'A';
CREATE UNIQUE INDEX IF NOT EXISTS bids_bid_code_key ON public.bids(bid_code) WHERE bid_code IS NOT NULL;

ALTER TABLE public.audit_events
  ADD COLUMN IF NOT EXISTS actor_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS actor_role text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS organisation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS result text NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN IF NOT EXISTS client_info text NOT NULL DEFAULT '';

-- =========================================================
-- HELPER FUNCTIONS
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND rp.permission_code = _perm
      AND rp.scope = 'all'
      AND p.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission_unused_placeholder(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.user_id = _user_id
      AND rp.permission_code = _perm
      AND rp.scope = 'all'
      AND p.status = 'ACTIVE'
  )
$$;

CREATE OR REPLACE FUNCTION public.owns_bid(_user_id uuid, _bid_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bids b
    JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.id = _bid_id AND v.owner_user_id = _user_id
  )
$$;

-- =========================================================
-- TENDER REQUIREMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.tender_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  expected_value text NOT NULL,
  mandatory boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tender_requirements TO authenticated;
GRANT ALL ON public.tender_requirements TO service_role;
ALTER TABLE public.tender_requirements ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- DOCUMENTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  ai_confidence integer NOT NULL DEFAULT 0,
  verification_status text NOT NULL DEFAULT 'PENDING',
  page_count integer NOT NULL DEFAULT 1,
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- VERIFICATION
-- =========================================================
CREATE TABLE IF NOT EXISTS public.verification_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'AVAILABLE',
  environment text NOT NULL DEFAULT 'DEMO / SANDBOX',
  connection_status text NOT NULL DEFAULT 'SIMULATED',
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.verification_sources TO authenticated;
GRANT ALL ON public.verification_sources TO service_role;
ALTER TABLE public.verification_sources ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.verification_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  source_code text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  reference text NOT NULL DEFAULT '',
  detail text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.verification_results TO authenticated;
GRANT ALL ON public.verification_results TO service_role;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- COMPLIANCE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.tender_requirements(id) ON DELETE CASCADE,
  requirement_title text NOT NULL,
  expected_value text NOT NULL,
  detected_value text NOT NULL,
  result text NOT NULL DEFAULT 'PENDING',
  confidence integer NOT NULL DEFAULT 0,
  evidence_document text NOT NULL DEFAULT '',
  evidence_page integer,
  verification_status text NOT NULL DEFAULT 'PENDING',
  rationale text NOT NULL DEFAULT '',
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.compliance_checks TO authenticated;
GRANT ALL ON public.compliance_checks TO service_role;
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- AI RECOMMENDATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  recommendation text NOT NULL,
  rationale text NOT NULL,
  confidence integer NOT NULL DEFAULT 0,
  model text NOT NULL DEFAULT 'rules-engine',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  level text NOT NULL DEFAULT 'info',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SYSTEM CONFIG
-- =========================================================
CREATE TABLE IF NOT EXISTS public.system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.system_config TO authenticated;
GRANT ALL ON public.system_config TO service_role;
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- SEED: ORGANIZATIONS
-- =========================================================
INSERT INTO public.organizations (code, name, kind) VALUES
  ('CPCL', 'Chennai Petroleum Corporation Ltd (CPSE)', 'cpse'),
  ('MOPNG', 'Ministry Department — Petroleum & Natural Gas', 'ministry'),
  ('PROC-DIV', 'Procurement Division', 'government'),
  ('AUDIT-CELL', 'Internal Audit Cell', 'government'),
  ('DEMO-ORG', 'Demo Organization', 'government'),
  ('VND-NORTHGATE', 'Northgate Infra Systems Pvt Ltd', 'bidder'),
  ('VND-SARASWATI', 'Saraswati Electricals Pvt Ltd', 'bidder'),
  ('VND-VELTRIX', 'Veltrix Technologies Pvt Ltd', 'bidder'),
  ('VND-ORIONBUILD', 'Orion Buildtech Pvt Ltd', 'bidder')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- SEED: PERMISSIONS
-- =========================================================
INSERT INTO public.permissions (code, label, category) VALUES
  ('dashboard.view','View Dashboard','General'),
  ('tender.view','View Tenders','Tenders'),
  ('tender.create','Create Tender','Tenders'),
  ('tender.update','Update Tender','Tenders'),
  ('tender.delete','Delete Tender','Tenders'),
  ('bid.view','View Bids','Bids'),
  ('bid.create','Create Bid','Bids'),
  ('bid.update','Update Bid','Bids'),
  ('bid.submit','Submit Bid','Bids'),
  ('bidder.view','View Bidders','Bidders'),
  ('bidder.manage','Manage Bidders','Bidders'),
  ('document.view','View Documents','Documents'),
  ('document.upload','Upload Documents','Documents'),
  ('document.delete','Delete Documents','Documents'),
  ('document.verify','Verify Documents','Documents'),
  ('verification.run','Run Verification','Verification'),
  ('verification.view','View Verification','Verification'),
  ('compliance.view','View Compliance','Compliance'),
  ('compliance.run','Run Compliance Checks','Compliance'),
  ('risk.view','View Risk Analysis','Risk'),
  ('recommendation.view','View AI Recommendations','AI'),
  ('decision.make','Make Final Decision','Decisions'),
  ('report.view','View Reports','Reports'),
  ('report.generate','Generate Reports','Reports'),
  ('audit.view','View Audit Logs','Audit'),
  ('user.view','View Users','Administration'),
  ('user.create','Create Users','Administration'),
  ('user.update','Update Users','Administration'),
  ('user.disable','Disable Users','Administration'),
  ('user.reset_password','Reset Passwords','Administration'),
  ('role.view','View Roles','Administration'),
  ('role.manage','Manage Roles & Permissions','Administration'),
  ('system.configure','System Configuration','Administration')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- SEED: ROLE PERMISSIONS
-- =========================================================
DELETE FROM public.role_permissions;

INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'super_admin'::public.app_role, code, 'all' FROM public.permissions;

INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'procurement_admin'::public.app_role, code, 'all' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','tender.create','tender.update','bid.view','bidder.view','bidder.manage',
  'document.view','document.upload','document.verify','verification.run','verification.view','compliance.view','compliance.run',
  'risk.view','recommendation.view','report.view','report.generate','audit.view','user.view','user.create','user.update',
  'user.disable','user.reset_password','role.view');

INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'government_officer'::public.app_role, code, 'all' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','tender.create','tender.update','bid.view','bidder.view',
  'document.view','document.verify','verification.run','verification.view','compliance.view','compliance.run',
  'risk.view','recommendation.view','decision.make','report.view','report.generate','audit.view');

INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'auditor'::public.app_role, code, 'all' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','bid.view','bidder.view','document.view','verification.view',
  'compliance.view','risk.view','recommendation.view','report.view','report.generate','audit.view');

INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'bidder'::public.app_role, code, 'own' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','bid.view','bid.create','bid.submit','document.view','document.upload','compliance.view','report.view');

-- legacy roles keep working
INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'admin'::public.app_role, code, 'all' FROM public.permissions;
INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'reviewer'::public.app_role, code, 'all' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','bid.view','bidder.view','document.view','verification.view','verification.run',
  'compliance.view','risk.view','recommendation.view','decision.make','report.view','audit.view');
INSERT INTO public.role_permissions (role, permission_code, scope)
SELECT 'viewer'::public.app_role, code, 'all' FROM public.permissions
WHERE code IN ('dashboard.view','tender.view','bid.view','compliance.view','risk.view','report.view');

-- =========================================================
-- SEED: VERIFICATION SOURCES
-- =========================================================
INSERT INTO public.verification_sources (code, name, status, environment, connection_status) VALUES
  ('GST','GST Network (GSTN)','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('UDYAM','Udyam Registration','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('MCA','Ministry of Corporate Affairs','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('ITD','Income Tax Department','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('EPFO','Employees Provident Fund Organisation','DEGRADED','DEMO / SANDBOX','SIMULATED'),
  ('ESIC','Employees State Insurance Corporation','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('STARTUP_INDIA','Startup India Registry','AVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('NSIC','National Small Industries Corporation','UNAVAILABLE','DEMO / SANDBOX','SIMULATED'),
  ('GEM','Government e-Marketplace (GeM)','AVAILABLE','DEMO / SANDBOX','SIMULATED')
ON CONFLICT (code) DO NOTHING;

-- =========================================================
-- SEED: SYSTEM CONFIG
-- =========================================================
INSERT INTO public.system_config (key, value, label, category) VALUES
  ('ai_confidence_threshold','80','AI Confidence Threshold (%)','ai'),
  ('risk_low_max','30','Risk — Low band upper limit','risk'),
  ('risk_medium_max','60','Risk — Medium band upper limit','risk'),
  ('session_timeout_minutes','30','Session Timeout (minutes)','security'),
  ('document_max_size_mb','10','Maximum Document Size (MB)','documents'),
  ('allowed_file_types','pdf,png,jpg,jpeg','Allowed File Types','documents'),
  ('notify_on_high_risk','true','Notify officers on high-risk bids','notifications'),
  ('notify_on_document_upload','true','Notify officers on document upload','notifications')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- SEED: TENDER REQUIREMENTS
-- =========================================================
INSERT INTO public.tender_requirements (tender_id, code, title, expected_value, mandatory, sort_order)
SELECT t.id, r.code, r.title, r.expected_value, r.mandatory, r.sort_order
FROM public.tenders t
CROSS JOIN (VALUES
  ('REQ-PAN','Valid PAN of bidding entity','PAN present and matching registered entity name', true, 1),
  ('REQ-GST','Active GST registration','GSTIN active and linked to declared PAN', true, 2),
  ('REQ-UDYAM','Udyam / MSME registration','Valid Udyam registration number', false, 3),
  ('REQ-ITR','Income tax returns (last 3 years)','ITR filed for FY 2022-23, 2023-24, 2024-25', true, 4),
  ('REQ-TURNOVER','Average annual turnover','At least INR 5,00,00,000', true, 5),
  ('REQ-OEM','OEM authorisation certificate','Valid OEM authorisation for the quoted make', true, 6),
  ('REQ-LC','Local content declaration','Class-I local supplier with at least 50% local content', true, 7)
) AS r(code, title, expected_value, mandatory, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.tender_requirements x WHERE x.tender_id = t.id AND x.code = r.code);

-- =========================================================
-- BID CODES, SCENARIOS, STATUS
-- =========================================================
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY submitted_at, created_at) AS rn FROM public.bids
)
UPDATE public.bids b
SET bid_code = 'BID-' || (1000 + ranked.rn)::text,
    scenario = (ARRAY['A','B','C','D'])[((ranked.rn - 1) % 4) + 1]
FROM ranked
WHERE ranked.id = b.id AND b.bid_code IS NULL;

UPDATE public.bids SET
  status = CASE scenario WHEN 'A' THEN 'VERIFIED' WHEN 'B' THEN 'UNDER_REVIEW' WHEN 'C' THEN 'MANUAL_REVIEW' ELSE 'PROCESSING' END,
  compliance_score = CASE scenario WHEN 'A' THEN 96 WHEN 'B' THEN 74 WHEN 'C' THEN 41 ELSE 58 END,
  verification_status = CASE scenario WHEN 'A' THEN 'VERIFIED' WHEN 'B' THEN 'PARTIAL' WHEN 'C' THEN 'FAILED' ELSE 'PENDING' END;

UPDATE public.vendors v SET
  pan = 'AAB' || upper(substr(md5(v.id::text),1,3)) || substr(md5(v.name),1,4) || 'K',
  gstin = '33' || upper(substr(md5(v.name),1,10)) || '1Z5',
  udyam = 'UDYAM-TN-05-' || lpad((abs(hashtext(v.name)) % 9000000 + 1000000)::text, 7, '0'),
  annual_turnover = 40000000 + (abs(hashtext(v.name)) % 90) * 1000000,
  msme_class = CASE WHEN abs(hashtext(v.name)) % 3 = 0 THEN 'Micro' WHEN abs(hashtext(v.name)) % 3 = 1 THEN 'Small' ELSE 'Medium' END
WHERE v.pan IS NULL;

-- =========================================================
-- SEED: DOCUMENTS
-- =========================================================
INSERT INTO public.documents (bid_id, doc_type, file_name, status, ai_confidence, verification_status, page_count, extracted, uploaded_at)
SELECT b.id,
  d.doc_type,
  lower(replace(d.doc_type,' ','_')) || '_' || coalesce(b.bid_code,'bid') || '.pdf',
  CASE
    WHEN b.scenario = 'C' AND d.doc_type IN ('PAN','GST Certificate') THEN 'MISMATCH'
    WHEN b.scenario = 'D' THEN 'PROCESSING'
    ELSE 'EXTRACTED' END,
  CASE WHEN b.scenario = 'A' THEN 94 WHEN b.scenario = 'B' THEN 88 WHEN b.scenario = 'C' THEN 61 ELSE 72 END,
  CASE WHEN b.scenario = 'A' THEN 'VERIFIED' WHEN b.scenario = 'C' THEN 'FAILED' WHEN b.scenario = 'D' THEN 'PENDING' ELSE 'PARTIAL' END,
  CASE WHEN d.doc_type = 'ITR' THEN 6 WHEN d.doc_type = 'Experience Certificate' THEN 3 ELSE 2 END,
  jsonb_build_object('entity', v.name, 'pan', v.pan, 'gstin', v.gstin, 'source', 'AI extraction (DEMO)'),
  b.submitted_at
FROM public.bids b
JOIN public.vendors v ON v.id = b.vendor_id
CROSS JOIN (VALUES ('PAN'),('GST Certificate'),('Udyam'),('ITR'),('OEM Authorization'),('Experience Certificate'),('Local Content Declaration')) AS d(doc_type)
WHERE NOT (b.scenario = 'B' AND d.doc_type = 'OEM Authorization')
  AND NOT EXISTS (SELECT 1 FROM public.documents x WHERE x.bid_id = b.id AND x.doc_type = d.doc_type);

-- =========================================================
-- SEED: COMPLIANCE CHECKS
-- =========================================================
INSERT INTO public.compliance_checks (bid_id, requirement_id, requirement_title, expected_value, detected_value, result, confidence, evidence_document, evidence_page, verification_status, rationale)
SELECT b.id, r.id, r.title, r.expected_value,
  CASE
    WHEN b.scenario = 'C' AND r.code = 'REQ-PAN' THEN v.pan || ' — entity name differs from GST record'
    WHEN b.scenario = 'C' AND r.code = 'REQ-GST' THEN v.gstin || ' — PAN linkage mismatch'
    WHEN b.scenario = 'C' AND r.code = 'REQ-TURNOVER' THEN 'INR 2,10,00,000 (below threshold)'
    WHEN b.scenario = 'B' AND r.code = 'REQ-OEM' THEN 'Not submitted'
    WHEN b.scenario = 'D' AND r.code IN ('REQ-PAN','REQ-GST','REQ-UDYAM') THEN 'Awaiting external verification response'
    WHEN r.code = 'REQ-PAN' THEN v.pan
    WHEN r.code = 'REQ-GST' THEN v.gstin
    WHEN r.code = 'REQ-UDYAM' THEN v.udyam
    WHEN r.code = 'REQ-ITR' THEN 'ITR filed FY23, FY24, FY25'
    WHEN r.code = 'REQ-TURNOVER' THEN 'INR ' || to_char(v.annual_turnover, 'FM99,99,99,999')
    WHEN r.code = 'REQ-OEM' THEN 'OEM authorisation valid until 31 Mar 2027'
    ELSE 'Class-I local supplier, 62% local content' END,
  CASE
    WHEN b.scenario = 'C' AND r.code IN ('REQ-PAN','REQ-GST','REQ-TURNOVER') THEN 'FAIL'
    WHEN b.scenario = 'B' AND r.code = 'REQ-OEM' THEN 'FAIL'
    WHEN b.scenario = 'B' AND r.code = 'REQ-LC' THEN 'REVIEW'
    WHEN b.scenario = 'D' AND r.code IN ('REQ-PAN','REQ-GST','REQ-UDYAM') THEN 'PENDING'
    ELSE 'PASS' END,
  CASE WHEN b.scenario = 'A' THEN 96 WHEN b.scenario = 'B' THEN 84 WHEN b.scenario = 'C' THEN 63 ELSE 70 END,
  CASE r.code
    WHEN 'REQ-PAN' THEN 'PAN' WHEN 'REQ-GST' THEN 'GST Certificate' WHEN 'REQ-UDYAM' THEN 'Udyam'
    WHEN 'REQ-ITR' THEN 'ITR' WHEN 'REQ-TURNOVER' THEN 'ITR' WHEN 'REQ-OEM' THEN 'OEM Authorization'
    ELSE 'Local Content Declaration' END,
  CASE WHEN r.code IN ('REQ-TURNOVER','REQ-ITR') THEN 4 ELSE 1 END,
  CASE
    WHEN b.scenario = 'D' THEN 'PENDING'
    WHEN b.scenario = 'C' AND r.code IN ('REQ-PAN','REQ-GST') THEN 'FAILED'
    WHEN b.scenario = 'A' THEN 'VERIFIED' ELSE 'PARTIAL' END,
  CASE
    WHEN b.scenario = 'C' AND r.code = 'REQ-PAN' THEN 'Entity name on the PAN document does not match the name on the GST certificate. Cross-document check failed.'
    WHEN b.scenario = 'C' AND r.code = 'REQ-GST' THEN 'PAN embedded in the GSTIN does not match the submitted PAN.'
    WHEN b.scenario = 'C' AND r.code = 'REQ-TURNOVER' THEN 'Average annual turnover derived from the submitted ITR is below the tender threshold.'
    WHEN b.scenario = 'B' AND r.code = 'REQ-OEM' THEN 'Mandatory OEM authorisation certificate was not present in the submission set.'
    WHEN b.scenario = 'B' AND r.code = 'REQ-LC' THEN 'Local content percentage declared but the supporting cost breakup was not attached.'
    WHEN b.scenario = 'D' AND r.code IN ('REQ-PAN','REQ-GST','REQ-UDYAM') THEN 'External verification source did not respond within the configured window. Result held as pending.'
    ELSE 'Extracted value matches the tender requirement; corroborated by the sandbox verification response.' END
FROM public.bids b
JOIN public.vendors v ON v.id = b.vendor_id
JOIN public.tender_requirements r ON r.tender_id = b.tender_id
WHERE NOT EXISTS (SELECT 1 FROM public.compliance_checks c WHERE c.bid_id = b.id AND c.requirement_id = r.id);

-- =========================================================
-- SEED: VERIFICATION RESULTS
-- =========================================================
INSERT INTO public.verification_results (bid_id, source_code, status, reference, detail, checked_at)
SELECT b.id, s.code,
  CASE
    WHEN b.scenario = 'D' THEN 'PENDING'
    WHEN b.scenario = 'C' AND s.code IN ('GST','ITD') THEN 'MISMATCH'
    WHEN s.code = 'NSIC' THEN 'UNAVAILABLE'
    ELSE 'VERIFIED' END,
  'DEMO-VRF-' || upper(substr(md5(b.id::text || s.code),1,8)),
  CASE
    WHEN b.scenario = 'D' THEN 'Sandbox source did not respond. Result held as pending for officer follow-up.'
    WHEN b.scenario = 'C' AND s.code = 'GST' THEN 'Sandbox GST record returns a different legal name for the submitted PAN.'
    WHEN b.scenario = 'C' AND s.code = 'ITD' THEN 'Declared turnover does not reconcile with the sandbox ITR summary.'
    WHEN s.code = 'NSIC' THEN 'Sandbox source is currently unavailable.'
    ELSE 'Sandbox record matched the submitted particulars.' END,
  b.submitted_at
FROM public.bids b
CROSS JOIN (VALUES ('GST'),('UDYAM'),('MCA'),('ITD'),('NSIC'),('GEM')) AS s(code)
WHERE NOT EXISTS (SELECT 1 FROM public.verification_results x WHERE x.bid_id = b.id AND x.source_code = s.code);

-- =========================================================
-- SEED: AI RECOMMENDATIONS
-- =========================================================
INSERT INTO public.ai_recommendations (bid_id, recommendation, rationale, confidence, model)
SELECT b.id,
  CASE b.scenario WHEN 'A' THEN 'ELIGIBLE' WHEN 'C' THEN 'NOT_ELIGIBLE' ELSE 'MANUAL_REVIEW' END,
  CASE b.scenario
    WHEN 'A' THEN 'All mandatory requirements matched against submitted documents and sandbox verification responses. No cross-document inconsistencies detected. Advisory only — the qualification decision rests with the human reviewer.'
    WHEN 'B' THEN 'Mandatory OEM authorisation is absent and the local content declaration lacks a supporting cost breakup. Advisory only — the qualification decision rests with the human reviewer.'
    WHEN 'C' THEN 'PAN and GST records disagree on the legal entity name and average annual turnover falls below the tender threshold. Advisory only — the qualification decision rests with the human reviewer.'
    ELSE 'Several external verification sources did not respond, so compliance for identity documents could not be established. Advisory only — the qualification decision rests with the human reviewer.' END,
  CASE b.scenario WHEN 'A' THEN 93 WHEN 'B' THEN 81 WHEN 'C' THEN 88 ELSE 55 END,
  'rules-engine'
FROM public.bids b
WHERE NOT EXISTS (SELECT 1 FROM public.ai_recommendations x WHERE x.bid_id = b.id);

-- =========================================================
-- RLS POLICIES
-- =========================================================
CREATE POLICY "organizations read" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role permissions read" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role permissions manage" ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'role.manage')) WITH CHECK (public.has_permission(auth.uid(),'role.manage'));

CREATE POLICY "requirements read" ON public.tender_requirements FOR SELECT TO authenticated USING (true);

CREATE POLICY "documents read" ON public.documents FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'document.view') OR public.owns_bid(auth.uid(), bid_id));
CREATE POLICY "documents upload" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'document.upload') OR public.owns_bid(auth.uid(), bid_id));
CREATE POLICY "documents update" ON public.documents FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'document.verify') OR public.owns_bid(auth.uid(), bid_id))
  WITH CHECK (public.has_permission(auth.uid(),'document.verify') OR public.owns_bid(auth.uid(), bid_id));

CREATE POLICY "verification sources read" ON public.verification_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "verification sources manage" ON public.verification_sources FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'system.configure')) WITH CHECK (public.has_permission(auth.uid(),'system.configure'));

CREATE POLICY "verification results read" ON public.verification_results FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'verification.view') OR public.owns_bid(auth.uid(), bid_id));
CREATE POLICY "verification results run" ON public.verification_results FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'verification.run'));
CREATE POLICY "verification results update" ON public.verification_results FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'verification.run')) WITH CHECK (public.has_permission(auth.uid(),'verification.run'));

CREATE POLICY "compliance read" ON public.compliance_checks FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'compliance.view') OR public.owns_bid(auth.uid(), bid_id));
CREATE POLICY "compliance run" ON public.compliance_checks FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'compliance.run'));
CREATE POLICY "compliance update" ON public.compliance_checks FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'compliance.run')) WITH CHECK (public.has_permission(auth.uid(),'compliance.run'));

CREATE POLICY "recommendation read" ON public.ai_recommendations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'recommendation.view'));
CREATE POLICY "recommendation insert" ON public.ai_recommendations FOR INSERT TO authenticated
  WITH CHECK (public.has_permission(auth.uid(),'recommendation.view'));

CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "config read" ON public.system_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "config manage" ON public.system_config FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'system.configure')) WITH CHECK (public.has_permission(auth.uid(),'system.configure'));

DROP POLICY IF EXISTS "bids read" ON public.bids;
CREATE POLICY "bids read" ON public.bids FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'bid.view') OR EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = bids.vendor_id AND v.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "tenders read" ON public.tenders;
CREATE POLICY "tenders read" ON public.tenders FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'tender.view') OR EXISTS (
    SELECT 1 FROM public.bids b JOIN public.vendors v ON v.id = b.vendor_id
    WHERE b.tender_id = tenders.id AND v.owner_user_id = auth.uid()));

DROP POLICY IF EXISTS "vendors read" ON public.vendors;
CREATE POLICY "vendors read" ON public.vendors FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'bidder.view') OR owner_user_id = auth.uid());

DROP POLICY IF EXISTS "risk flags read" ON public.risk_flags;
CREATE POLICY "risk flags read" ON public.risk_flags FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'risk.view'));

DROP POLICY IF EXISTS "audit read" ON public.audit_events;
CREATE POLICY "audit read" ON public.audit_events FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'audit.view'));

DROP POLICY IF EXISTS "decisions read" ON public.decisions;
CREATE POLICY "decisions read" ON public.decisions FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(),'bid.view') OR public.owns_bid(auth.uid(), bid_id));

DROP POLICY IF EXISTS "reviewers record decisions" ON public.decisions;
CREATE POLICY "officers record decisions" ON public.decisions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = decided_by AND public.has_permission(auth.uid(),'decision.make'));

DROP POLICY IF EXISTS "own profile read" ON public.profiles;
CREATE POLICY "profile read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_permission(auth.uid(),'user.view'));
CREATE POLICY "admin profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_permission(auth.uid(),'user.update')) WITH CHECK (public.has_permission(auth.uid(),'user.update'));

DROP POLICY IF EXISTS "own roles read" ON public.user_roles;
CREATE POLICY "roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_permission(auth.uid(),'role.view'));
CREATE POLICY "roles manage" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(),'role.manage')) WITH CHECK (public.has_permission(auth.uid(),'role.manage'));

-- =========================================================
-- TRIGGERS
-- =========================================================
DROP TRIGGER IF EXISTS documents_updated_at ON public.documents;
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SIGN-UP HANDLER (extended, non-destructive)
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid;
  v_seq integer;
BEGIN
  SELECT id INTO v_org FROM public.organizations WHERE code = COALESCE(NEW.raw_user_meta_data->>'org_code','DEMO-ORG');
  SELECT COALESCE(MAX(NULLIF(regexp_replace(user_code,'\D','','g'),''))::int,0) + 1 INTO v_seq
    FROM public.profiles WHERE user_code LIKE 'GOV-OFF-%';

  INSERT INTO public.profiles (id, full_name, organisation, email, org_id, user_code, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'organisation','Demo Organization'),
    NEW.email,
    v_org,
    'GOV-OFF-' || lpad(v_seq::text, 3, '0'),
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'government_officer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- backfill existing accounts
UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND p.email IS NULL;
UPDATE public.profiles p SET org_id = o.id FROM public.organizations o WHERE o.code = 'DEMO-ORG' AND p.org_id IS NULL;
WITH ranked AS (SELECT id, row_number() OVER (ORDER BY created_at) rn FROM public.profiles WHERE user_code IS NULL)
UPDATE public.profiles p SET user_code = 'GOV-OFF-' || lpad((900 + ranked.rn)::text,3,'0') FROM ranked WHERE ranked.id = p.id;