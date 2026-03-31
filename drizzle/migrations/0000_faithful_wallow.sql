CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."job_part_source" AS ENUM('email', 'receipt', 'manual');--> statement-breakpoint
CREATE TYPE "public"."subscription_type" AS ENUM('business', 'freelance', 'trial', 'unset');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('in_progress', 'complete', 'invoiced');--> statement-breakpoint
CREATE TABLE "car_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"car_id" integer,
	"job_id" integer
);
--> statement-breakpoint
CREATE TABLE "car_template_dtc_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"car_id" integer,
	"dtc_code_id" integer
);
--> statement-breakpoint
CREATE TABLE "car_template_fluids" (
	"id" serial PRIMARY KEY NOT NULL,
	"fluid_id" integer,
	"car_id" integer
);
--> statement-breakpoint
CREATE TABLE "car_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar(255) DEFAULT '' NOT NULL,
	"make" varchar(255) DEFAULT '' NOT NULL,
	"brand_slug" varchar(255) DEFAULT '' NOT NULL,
	"model_slug" varchar(255) DEFAULT '' NOT NULL,
	"engine_size" varchar(100) DEFAULT '' NOT NULL,
	"engine_slug" varchar(255) DEFAULT '' NOT NULL,
	"min_year" integer DEFAULT 0 NOT NULL,
	"max_year" integer DEFAULT 0 NOT NULL,
	"drivetrain" varchar(50) DEFAULT '' NOT NULL,
	"fuel_type" varchar(50) DEFAULT '' NOT NULL,
	"transmission_type" varchar(50) DEFAULT '' NOT NULL,
	"timing_type" varchar(50) DEFAULT '' NOT NULL,
	"forced_induction" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "cars" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar(255) DEFAULT '',
	"make" varchar(255) DEFAULT '',
	"year" varchar(100),
	"fuel_type" varchar(50) DEFAULT '',
	"engine_size" varchar(100) DEFAULT '',
	"engine_type" varchar(100) DEFAULT '',
	"drivetrain" varchar(50) DEFAULT '',
	"vehicle_type" varchar(100),
	"body_type" varchar(100),
	"primary_color" varchar(100),
	"secondary_color" varchar(100),
	"seat_count" integer,
	"door_count" integer,
	"wheel_count" integer,
	"cylinder_count" integer,
	"engine_displacement" integer,
	"empty_weight" integer,
	"kerb_weight" integer,
	"max_permitted_weight" integer,
	"technical_max_weight" integer,
	"max_combined_weight" integer,
	"max_unbraked_towing_weight" integer,
	"max_braked_towing_weight" integer,
	"length" integer,
	"width" integer,
	"height" integer,
	"wheelbase" integer,
	"max_speed" integer,
	"power_to_weight_ratio" numeric(8, 4),
	"list_price" integer,
	"gross_bpm" integer,
	"eu_vehicle_category" varchar(20),
	"type_approval_number" varchar(100),
	"type_code" varchar(50),
	"variant" varchar(100),
	"version" varchar(100),
	"eu_type_approval_revision" varchar(10),
	"apk_expiry_date" varchar(8),
	"apk_expiry_datetime" timestamp with time zone,
	"first_admission_date" varchar(8),
	"first_admission_datetime" timestamp with time zone,
	"registration_date" varchar(8),
	"registration_datetime" timestamp with time zone,
	"first_nl_registration_date" varchar(8),
	"first_nl_registration_datetime" timestamp with time zone,
	"bpm_approval_date" varchar(8),
	"bpm_approval_datetime" timestamp with time zone,
	"last_odometer_year" integer,
	"odometer_judgement" varchar(100),
	"odometer_judgement_code" varchar(10),
	"third_party_insured" varchar(10),
	"export_indicator" varchar(10),
	"recall_pending" varchar(10),
	"taxi_indicator" varchar(10),
	"pending_inspection" varchar(100),
	"transferable" varchar(10)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "charge_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" numeric(12, 2) DEFAULT '0',
	"description" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "charges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"price" numeric(12, 2) DEFAULT '0',
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now(),
	"charge_template_id" integer,
	"job_id" integer,
	"visit_id" integer
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) DEFAULT '',
	"phone_no" varchar(50) DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "dtc_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"code_slug" varchar(50) NOT NULL,
	"category" varchar(100),
	"category_name" varchar(100),
	"subcategory" varchar(100),
	"short_description" varchar(500),
	"description" text,
	"symptoms" text[],
	"common_causes" text[],
	"diagnostic_steps" text[],
	"repair_notes" text,
	"severity" varchar(50),
	"is_generic" boolean,
	"confidence" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "dtc_related_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code_id" integer,
	"related_code_id" integer
);
--> statement-breakpoint
CREATE TABLE "fluids" (
	"id" serial PRIMARY KEY NOT NULL,
	"system_type" varchar(100) NOT NULL,
	"system_name" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"spec" varchar(255),
	"quarts" numeric(8, 2),
	"liters" numeric(8, 2),
	"drain_refill_quarts" numeric(8, 2),
	"drain_refill_liters" numeric(8, 2),
	"interval_miles" integer,
	"interval_km" integer,
	"notes" text,
	"confidence" varchar(100) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"email" varchar(255) DEFAULT '',
	"phone_no" varchar(50) DEFAULT '',
	"address" text DEFAULT ''
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"prefix" varchar(20) DEFAULT '',
	"invoice_no" integer DEFAULT 0,
	"visit_id" integer,
	"customer_id" integer,
	"garage_id" integer,
	"labour_cost" numeric(12, 2) DEFAULT '0',
	"parts_cost" numeric(12, 2) DEFAULT '0',
	"vat_amount" numeric(12, 2) DEFAULT '0',
	"vat_rate" numeric(6, 2) DEFAULT '0',
	"parts_markup" numeric(6, 2) DEFAULT '0',
	"total" numeric(14, 2) DEFAULT '0',
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"stripe_payment_link" varchar(500),
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_fluids" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"fluid_id" integer
);
--> statement-breakpoint
CREATE TABLE "job_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer,
	"part_id" integer,
	"quantity" integer DEFAULT 1,
	"unit_cost" numeric(12, 2) DEFAULT '0',
	"source" "job_part_source" DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"licensePlateId" integer NOT NULL,
	"job_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255),
	"category" varchar(255) DEFAULT '',
	"labour_hours" numeric(6, 2) DEFAULT '0',
	"low_range" numeric(6, 2),
	"high_range" numeric(6, 2),
	"confidence" varchar(100),
	"tech_notes" jsonb,
	"category_id" integer
);
--> statement-breakpoint
CREATE TABLE "license_plates" (
	"id" serial PRIMARY KEY NOT NULL,
	"license_plate" varchar(50) NOT NULL,
	"car_id" integer,
	"vehicle_id" integer,
	"visit_id" integer
);
--> statement-breakpoint
CREATE TABLE "parsed_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"garage_id" integer,
	"user_id" integer,
	"visit_id" integer,
	"source_type" varchar(100) DEFAULT '',
	"raw_content" text DEFAULT '',
	"parsed_content" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(100) DEFAULT '',
	"job_part_id" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar(255) DEFAULT '',
	"part_no" varchar(255) DEFAULT '',
	"name" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset" (
	"id" bigint PRIMARY KEY NOT NULL,
	"password_reset_key" varchar,
	"user_id" integer,
	"is_valid" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "torque_spec_cars" (
	"id" serial PRIMARY KEY NOT NULL,
	"torque_spec_id" integer,
	"car_id" integer
);
--> statement-breakpoint
CREATE TABLE "torque_spec_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"torque_spec_id" integer,
	"job_id" integer
);
--> statement-breakpoint
CREATE TABLE "torque_specs" (
	"id" serial PRIMARY KEY NOT NULL,
	"nm" numeric(8, 2),
	"lbft" numeric(8, 2),
	"sequence" boolean DEFAULT false,
	"angle_degrees" numeric(6, 2),
	"is_critical" boolean DEFAULT false,
	"notes" text,
	"component" varchar(255),
	"confidence" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"phone_no" varchar(50) DEFAULT '',
	"subscription_type" "subscription_type",
	"subscription_start_date" bigint,
	"stripe_customer_id" varchar(255),
	"stripe_subscription_id" varchar(255),
	"vat_number" varchar(50),
	"billing_address_line1" varchar(255),
	"billing_city" varchar(100),
	"billing_postal_code" varchar(20),
	"billing_country" varchar(100),
	"hourly_rate" numeric(12, 2) DEFAULT '0',
	"parts_markup" numeric(6, 2) DEFAULT '0',
	"VAT_rate" numeric(5, 2) DEFAULT '0',
	"garage_id" integer,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicle_fluids" (
	"id" serial PRIMARY KEY NOT NULL,
	"fluid_id" integer,
	"car_id" integer,
	"system_type" varchar(100)
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" varchar(255) DEFAULT '',
	"make" varchar(255) DEFAULT '',
	"year" varchar(10),
	"fuel_type" varchar(50) DEFAULT '',
	"engine_size" varchar(100) DEFAULT '',
	"engine_type" varchar(100) DEFAULT '',
	"drivetrain" varchar(50) DEFAULT '',
	"vehicle_type" varchar(100),
	"body_type" varchar(100),
	"primary_color" varchar(100),
	"engine_displacement" integer
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"status" "visit_status" DEFAULT 'in_progress' NOT NULL,
	"customer_id" integer,
	"user_id" integer,
	"license_plate_id" integer
);
--> statement-breakpoint
ALTER TABLE "car_jobs" ADD CONSTRAINT "car_jobs_car_id_car_templates_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."car_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_jobs" ADD CONSTRAINT "car_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_template_dtc_codes" ADD CONSTRAINT "car_template_dtc_codes_car_id_car_templates_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."car_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_template_dtc_codes" ADD CONSTRAINT "car_template_dtc_codes_dtc_code_id_dtc_codes_id_fk" FOREIGN KEY ("dtc_code_id") REFERENCES "public"."dtc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_template_fluids" ADD CONSTRAINT "car_template_fluids_fluid_id_fluids_id_fk" FOREIGN KEY ("fluid_id") REFERENCES "public"."fluids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_template_fluids" ADD CONSTRAINT "car_template_fluids_car_id_car_templates_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."car_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_charge_template_id_charge_templates_id_fk" FOREIGN KEY ("charge_template_id") REFERENCES "public"."charge_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charges" ADD CONSTRAINT "charges_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_related_codes" ADD CONSTRAINT "dtc_related_codes_code_id_dtc_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."dtc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dtc_related_codes" ADD CONSTRAINT "dtc_related_codes_related_code_id_dtc_codes_id_fk" FOREIGN KEY ("related_code_id") REFERENCES "public"."dtc_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fluids" ADD CONSTRAINT "job_fluids_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_fluids" ADD CONSTRAINT "job_fluids_fluid_id_fluids_id_fk" FOREIGN KEY ("fluid_id") REFERENCES "public"."fluids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_parts" ADD CONSTRAINT "job_parts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_visits" ADD CONSTRAINT "job_visits_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_plates" ADD CONSTRAINT "license_plates_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_plates" ADD CONSTRAINT "license_plates_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "license_plates" ADD CONSTRAINT "license_plates_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_documents" ADD CONSTRAINT "parsed_documents_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_documents" ADD CONSTRAINT "parsed_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_documents" ADD CONSTRAINT "parsed_documents_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parsed_documents" ADD CONSTRAINT "parsed_documents_job_part_id_job_parts_id_fk" FOREIGN KEY ("job_part_id") REFERENCES "public"."job_parts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset" ADD CONSTRAINT "password_reset_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torque_spec_cars" ADD CONSTRAINT "torque_spec_cars_torque_spec_id_torque_specs_id_fk" FOREIGN KEY ("torque_spec_id") REFERENCES "public"."torque_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torque_spec_cars" ADD CONSTRAINT "torque_spec_cars_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torque_spec_jobs" ADD CONSTRAINT "torque_spec_jobs_torque_spec_id_torque_specs_id_fk" FOREIGN KEY ("torque_spec_id") REFERENCES "public"."torque_specs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "torque_spec_jobs" ADD CONSTRAINT "torque_spec_jobs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_garage_id_garages_id_fk" FOREIGN KEY ("garage_id") REFERENCES "public"."garages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_fluids" ADD CONSTRAINT "vehicle_fluids_fluid_id_fluids_id_fk" FOREIGN KEY ("fluid_id") REFERENCES "public"."fluids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_fluids" ADD CONSTRAINT "vehicle_fluids_car_id_cars_id_fk" FOREIGN KEY ("car_id") REFERENCES "public"."cars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;