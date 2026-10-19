-- Auditoría 360 (19-oct-2026), C-23 / DAT-10: DDL versionado de las tablas que
-- se crearon a mano o desde invest-web y que ninguna migración de este repo
-- crea (licencias, sync, push, perfiles y portafolios de Invest, consentimientos,
-- trial_emails, webhook_events, invest_leads, invest_activity_days), con sus
-- secuencias, constraints, índices, triggers, RLS y políticas, más las 3
-- funciones de trigger que usan. Generado del esquema de producción
-- (`supabase db dump --linked --schema public,private`, 19-oct-2026) y
-- contrastado con invest-web/supabase/migrations.
--
-- Idempotente: en producción no cambia nada (todo IF NOT EXISTS o guardado).
-- Sirve para reconstruir el esquema: en una base nueva, correr este archivo
-- ANTES que el resto de las migraciones (varias de ellas usan estas tablas).
-- Los grants los fija 20261019190000_leads_rate_limit_and_db_hardening.sql.
-- Ver docs/esquema-base.md.

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."protect_trial_reuse"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' then
    return new;
  end if;

  -- Una vez fijada la fecha de inicio, ya no se puede mover.
  if old.trial_started_at is not null then
    new.trial_started_at := old.trial_started_at;
  end if;

  -- IS TRUE en vez de = TRUE: con NULL, "= TRUE" evalua a NULL y no protegia.
  if old.trial_used is true then
    new.trial_used := true;
  end if;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE TABLE IF NOT EXISTS "public"."cloud_backups" (
    "user_id" "uuid" NOT NULL,
    "data" "jsonb" NOT NULL,
    "app_version" "text" DEFAULT '1.5'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);

CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "version" "text" NOT NULL,
    "accepted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text",
    "user_agent" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "consents_document_type_check" CHECK (("document_type" = ANY (ARRAY['terms'::"text", 'privacy'::"text", 'investment_disclaimer'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."invest_activity_days" (
    "user_id" "uuid" NOT NULL,
    "day" "date" DEFAULT (("now"() AT TIME ZONE 'utc'::"text"))::"date" NOT NULL
);

COMMENT ON TABLE "public"."invest_activity_days" IS 'Un día por cuenta en que se abrió MOY IQ Invest con sesión (fecha UTC). Mide los usuarios activos por semana. Solo escribe la propia cuenta; solo lee service_role.';

CREATE TABLE IF NOT EXISTS "public"."invest_leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "perfil" "text",
    "score" integer,
    "fuente" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email1_sent_at" timestamp with time zone,
    "email2_sent_at" timestamp with time zone,
    "email3_sent_at" timestamp with time zone,
    "consent_marketing" boolean DEFAULT false NOT NULL,
    "unsubscribed_at" timestamp with time zone,
    "account_created_at" timestamp with time zone,
    "consent_confirmed_at" timestamp with time zone
);

CREATE OR REPLACE VIEW "public"."invest_weekly_active" WITH ("security_invoker"='true') AS
 SELECT "week_start",
    "to_char"(("week_start")::timestamp with time zone, 'IYYY-"W"IW'::"text") AS "iso_week",
    "count"(DISTINCT "user_id") AS "wau"
   FROM ( SELECT "invest_activity_days"."user_id",
            ("invest_activity_days"."day" - ((EXTRACT(isodow FROM "invest_activity_days"."day"))::integer - 1)) AS "week_start"
           FROM "public"."invest_activity_days") "w"
  GROUP BY "week_start"
  ORDER BY "week_start" DESC;

CREATE TABLE IF NOT EXISTS "public"."licenses" (
    "key_hash" "text" NOT NULL,
    "plan" "text" DEFAULT 'personal'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "email" "text",
    "stripe_session_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "activated_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "payment_intent_id" "text",
    "stripe_subscription_id" "text",
    CONSTRAINT "licenses_plan_check" CHECK (("plan" = ANY (ARRAY['personal'::"text", 'pro'::"text"]))),
    CONSTRAINT "licenses_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'revoked'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."portfolio_holdings" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticker" "text" NOT NULL,
    "asset_type" "text" DEFAULT 'Stock'::"text" NOT NULL,
    "shares" numeric NOT NULL,
    "avg_cost" numeric NOT NULL,
    "note" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stop" numeric,
    CONSTRAINT "portfolio_holdings_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['Stock'::"text", 'ETF'::"text", 'Crypto'::"text", 'Bond'::"text"]))),
    CONSTRAINT "portfolio_holdings_avg_cost_check" CHECK (("avg_cost" >= (0)::numeric)),
    CONSTRAINT "portfolio_holdings_shares_check" CHECK (("shares" >= (0)::numeric)),
    CONSTRAINT "portfolio_holdings_stop_positive" CHECK ((("stop" IS NULL) OR ("stop" > (0)::numeric)))
);

COMMENT ON COLUMN "public"."portfolio_holdings"."stop" IS 'Stop por posición definido por la persona (precio, misma moneda que avg_cost). NULL = sin stop. Invest, I03.';

DO $do$ BEGIN
  ALTER TABLE "public"."portfolio_holdings" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."portfolio_holdings_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "name" "text" DEFAULT 'Usuario'::"text" NOT NULL,
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "capital" numeric DEFAULT 0 NOT NULL,
    "trial_started_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "trial_used" boolean DEFAULT false,
    CONSTRAINT "profiles_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'trial'::"text", 'pro'::"text", 'teams'::"text"])))
);

CREATE TABLE IF NOT EXISTS "public"."push_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key_hash" "text" NOT NULL,
    "endpoint" "text" NOT NULL,
    "p256dh" "text" NOT NULL,
    "auth" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_sent_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "public"."synced_data" (
    "key_hash" "text" NOT NULL,
    "blob" "text" NOT NULL,
    "updated_at" bigint DEFAULT 0 NOT NULL,
    "saved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."trial_emails" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "day" integer NOT NULL,
    "email_id" "text",
    "sent_at" timestamp with time zone DEFAULT "now"()
);

CREATE SEQUENCE IF NOT EXISTS "public"."trial_emails_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

DO $do$ BEGIN
  ALTER SEQUENCE "public"."trial_emails_id_seq" OWNED BY "public"."trial_emails"."id";
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS "public"."watchlist" (
    "id" bigint NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ticker" "text" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

DO $do$ BEGIN
  ALTER TABLE "public"."watchlist" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."watchlist_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

CREATE TABLE IF NOT EXISTS "public"."webhook_events" (
    "id" "text" NOT NULL,
    "type" "text",
    "received_at" timestamp with time zone DEFAULT "now"()
);

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."trial_emails" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."trial_emails_id_seq"'::"regclass");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."cloud_backups"
    ADD CONSTRAINT "cloud_backups_pkey" PRIMARY KEY ("user_id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_user_id_document_type_version_key" UNIQUE ("user_id", "document_type", "version");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."invest_activity_days"
    ADD CONSTRAINT "invest_activity_days_pkey" PRIMARY KEY ("user_id", "day");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."invest_leads"
    ADD CONSTRAINT "invest_leads_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_pkey" PRIMARY KEY ("key_hash");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."licenses"
    ADD CONSTRAINT "licenses_stripe_session_id_key" UNIQUE ("stripe_session_id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."portfolio_holdings"
    ADD CONSTRAINT "portfolio_holdings_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_endpoint_key" UNIQUE ("endpoint");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."synced_data"
    ADD CONSTRAINT "synced_data_pkey" PRIMARY KEY ("key_hash");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."trial_emails"
    ADD CONSTRAINT "trial_emails_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."trial_emails"
    ADD CONSTRAINT "trial_emails_user_id_day_key" UNIQUE ("user_id", "day");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."watchlist"
    ADD CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."watchlist"
    ADD CONSTRAINT "watchlist_user_id_ticker_key" UNIQUE ("user_id", "ticker");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."webhook_events"
    ADD CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

CREATE INDEX IF NOT EXISTS "consents_user_id_idx" ON "public"."consents" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_licenses_session" ON "public"."licenses" USING "btree" ("stripe_session_id");

CREATE INDEX IF NOT EXISTS "idx_portfolio_user" ON "public"."portfolio_holdings" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "idx_profiles_stripe_customer" ON "public"."profiles" USING "btree" ("stripe_customer_id");

CREATE INDEX IF NOT EXISTS "idx_watchlist_user" ON "public"."watchlist" USING "btree" ("user_id");

CREATE INDEX IF NOT EXISTS "invest_leads_nurture_eligible_idx" ON "public"."invest_leads" USING "btree" ("unsubscribed_at", "consent_marketing", "account_created_at") WHERE (("unsubscribed_at" IS NULL) AND ("consent_marketing" = true) AND ("account_created_at" IS NULL));

CREATE INDEX IF NOT EXISTS "licenses_payment_intent_idx" ON "public"."licenses" USING "btree" ("payment_intent_id");

CREATE UNIQUE INDEX IF NOT EXISTS "licenses_stripe_subscription_id_key" ON "public"."licenses" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "push_subscriptions_key_hash_idx" ON "public"."push_subscriptions" USING "btree" ("key_hash");

CREATE OR REPLACE TRIGGER "set_holdings_updated_at" BEFORE UPDATE ON "public"."portfolio_holdings" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "trg_crm_touch_invest" AFTER UPDATE OF "email1_sent_at", "email2_sent_at", "email3_sent_at" ON "public"."invest_leads" FOR EACH ROW WHEN ((("old"."email1_sent_at" IS DISTINCT FROM "new"."email1_sent_at") OR ("old"."email2_sent_at" IS DISTINCT FROM "new"."email2_sent_at") OR ("old"."email3_sent_at" IS DISTINCT FROM "new"."email3_sent_at"))) EXECUTE FUNCTION "public"."crm_touch_on_nurture_sent"();

CREATE OR REPLACE TRIGGER "trg_protect_trial" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."protect_trial_reuse"();

CREATE OR REPLACE TRIGGER "trg_sync_invest_lead_to_crm" AFTER INSERT ON "public"."invest_leads" FOR EACH ROW EXECUTE FUNCTION "public"."sync_invest_lead_to_crm"();

CREATE OR REPLACE TRIGGER "trg_sync_license_activation_to_crm" AFTER INSERT OR UPDATE OF "status", "email" ON "public"."licenses" FOR EACH ROW EXECUTE FUNCTION "public"."sync_license_activation_to_crm"();

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."cloud_backups"
    ADD CONSTRAINT "cloud_backups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."invest_activity_days"
    ADD CONSTRAINT "invest_activity_days_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."portfolio_holdings"
    ADD CONSTRAINT "portfolio_holdings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."push_subscriptions"
    ADD CONSTRAINT "push_subscriptions_key_hash_fkey" FOREIGN KEY ("key_hash") REFERENCES "public"."licenses"("key_hash") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."synced_data"
    ADD CONSTRAINT "synced_data_key_hash_fkey" FOREIGN KEY ("key_hash") REFERENCES "public"."licenses"("key_hash") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."trial_emails"
    ADD CONSTRAINT "trial_emails_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  ALTER TABLE ONLY "public"."watchlist"
    ADD CONSTRAINT "watchlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition OR object_not_in_prerequisite_state THEN NULL;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_holdings' AND policyname = 'Users can delete own holdings') THEN
    CREATE POLICY "Users can delete own holdings" ON "public"."portfolio_holdings" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watchlist' AND policyname = 'Users can delete own watchlist') THEN
    CREATE POLICY "Users can delete own watchlist" ON "public"."watchlist" FOR DELETE USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_holdings' AND policyname = 'Users can insert own holdings') THEN
    CREATE POLICY "Users can insert own holdings" ON "public"."portfolio_holdings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watchlist' AND policyname = 'Users can insert own watchlist') THEN
    CREATE POLICY "Users can insert own watchlist" ON "public"."watchlist" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_holdings' AND policyname = 'Users can update own holdings') THEN
    CREATE POLICY "Users can update own holdings" ON "public"."portfolio_holdings" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'portfolio_holdings' AND policyname = 'Users can view own holdings') THEN
    CREATE POLICY "Users can view own holdings" ON "public"."portfolio_holdings" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile') THEN
    CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'watchlist' AND policyname = 'Users can view own watchlist') THEN
    CREATE POLICY "Users can view own watchlist" ON "public"."watchlist" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

ALTER TABLE "public"."cloud_backups" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."invest_activity_days" ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invest_activity_days' AND policyname = 'invest_activity_days_insert_own') THEN
    CREATE POLICY "invest_activity_days_insert_own" ON "public"."invest_activity_days" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("day" = (("now"() AT TIME ZONE 'utc'::"text"))::"date")));
  END IF;
END $do$;

ALTER TABLE "public"."invest_leads" ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invest_leads' AND policyname = 'invest_leads_admin_select') THEN
    CREATE POLICY "invest_leads_admin_select" ON "public"."invest_leads" FOR SELECT TO "authenticated" USING ((("auth"."jwt"() ->> 'email'::"text") = 'maxnovaluciglobal@gmail.com'::"text"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'invest_leads' AND policyname = 'invest_leads_insert_anon') THEN
    CREATE POLICY "invest_leads_insert_anon" ON "public"."invest_leads" FOR INSERT TO "anon" WITH CHECK (true);
  END IF;
END $do$;

ALTER TABLE "public"."licenses" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."portfolio_holdings" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."push_subscriptions" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."synced_data" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."trial_emails" ENABLE ROW LEVEL SECURITY;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cloud_backups' AND policyname = 'users can manage own backup') THEN
    CREATE POLICY "users can manage own backup" ON "public"."cloud_backups" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consents' AND policyname = 'users_insert_own_consents') THEN
    CREATE POLICY "users_insert_own_consents" ON "public"."consents" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

DO $do$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'consents' AND policyname = 'users_read_own_consents') THEN
    CREATE POLICY "users_read_own_consents" ON "public"."consents" FOR SELECT USING (("auth"."uid"() = "user_id"));
  END IF;
END $do$;

ALTER TABLE "public"."watchlist" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."webhook_events" ENABLE ROW LEVEL SECURITY;
