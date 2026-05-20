-- Klar Affiliate · Attribution-Path for Kelva + Moto
--
-- Both apps currently have `influencers`, `referral_revenue_events`,
-- `influencer_payout_batches/items` (from affiliates_v1_init) but NO way
-- to map a buying user back to an influencer. Without attribution the
-- ingest function would have no handle to write to the event row.
--
-- This migration adds the Shape-B-style attribution path used by Yarn-Stash:
-- a profile-side foreign key referenced_by_code_id pointing at an
-- influencer_codes row, which has an influencer handle.
--
-- Why Shape B over Shape A:
-- - Shape A (referrals table) requires the app to write to `referrals`
--   server-side at install/sign-up. We'd need to add API or RPC for it.
-- - Shape B reuses the existing influencer_codes pattern Yarn-Stash already
--   has — landing page writes a code to clipboard, app captures, profile
--   row updated client-side via a single update RPC.
--
-- APPLY SEPARATELY per app via MCP `apply_migration` with name e.g.
-- "kelva_attribution_v1" / "moto_attribution_v1".

-- 1) influencer_codes: minted by admin, claimed by influencer for sharing
CREATE TABLE IF NOT EXISTS public.influencer_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text UNIQUE NOT NULL,
  handle              text,
  display_name        text,
  influencer_user_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  commission_pct      numeric NOT NULL DEFAULT 0.50
                          CHECK (commission_pct >= 0 AND commission_pct <= 1),
  status              text NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'closed')),
  total_referrals_count   integer NOT NULL DEFAULT 0,
  total_commission_cents  bigint  NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_codes ENABLE ROW LEVEL SECURITY;
-- no policies → service-role only

-- 2) profiles.referred_by_code_id + referred_at columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referred_by_code_id uuid
    REFERENCES public.influencer_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_referred_by_code_id_idx
  ON public.profiles (referred_by_code_id)
  WHERE referred_by_code_id IS NOT NULL;

-- 3) admin_create_influencer_code: mint a code (service-role only)
CREATE OR REPLACE FUNCTION public.admin_create_influencer_code(
  p_code          text,
  p_display_name  text,
  p_handle        text,
  p_commission_pct numeric DEFAULT 0.50
)
RETURNS public.influencer_codes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_row public.influencer_codes;
BEGIN
  INSERT INTO public.influencer_codes (code, handle, display_name, commission_pct)
  VALUES (
    upper(trim(p_code)),
    nullif(trim(p_handle), ''),
    nullif(trim(p_display_name), ''),
    p_commission_pct
  )
  RETURNING * INTO new_row;
  RETURN new_row;
END
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_influencer_code(text, text, text, numeric) FROM PUBLIC, anon, authenticated;

-- 4) validate_referral_code: looked up by app on install attribution
CREATE OR REPLACE FUNCTION public.validate_referral_code(p_code text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.influencer_codes
  WHERE code = upper(trim(p_code))
    AND status = 'active'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO authenticated, anon;

-- 5) capture_referral: app calls this when clipboard token is read at install
CREATE OR REPLACE FUNCTION public.capture_referral(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_code_id FROM public.influencer_codes
  WHERE code = upper(trim(p_code))
    AND status = 'active'
  LIMIT 1;
  IF v_code_id IS NULL THEN RETURN false; END IF;

  -- One-shot: only set if not already referred (clipboard is at install time,
  -- a later code-paste should not overwrite an earlier one).
  UPDATE public.profiles
  SET referred_by_code_id = v_code_id,
      referred_at = now()
  WHERE id = auth.uid()
    AND referred_by_code_id IS NULL;

  -- Counter increment (best-effort; not a hard fail if it errors)
  IF FOUND THEN
    UPDATE public.influencer_codes
    SET total_referrals_count = total_referrals_count + 1
    WHERE id = v_code_id;
    RETURN true;
  END IF;
  RETURN false;
END
$$;

GRANT EXECUTE ON FUNCTION public.capture_referral(text) TO authenticated;

-- After applying:
-- - The affiliate-ingest Edge Function (Shape B) can now resolve buyers
-- - User-side: app needs `captureReferralFromClipboard()` calling
--   capture_referral RPC at first cold-start (Yarn-Stash pattern)
-- - Marketing-side: getklar.org/i/<app>/<code> landing writes
--   "<app>ref:<CODE>:v1" to clipboard
