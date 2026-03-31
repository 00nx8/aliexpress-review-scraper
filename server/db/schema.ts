import {
  pgTable, serial, varchar, text, integer, numeric, boolean,
  timestamp, bigint, jsonb, pgEnum, pgSchema
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Enums
export const subscriptionTypeEnum = pgEnum('subscription_type', ['business', 'freelance', 'trial', 'unset'])
export const visitStatusEnum = pgEnum('visit_status', ['in_progress', 'complete', 'invoiced'])
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue'])
export const jobPartSourceEnum = pgEnum('job_part_source', ['email', 'receipt', 'manual'])

// Users & Auth
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  phoneNo: varchar('phone_no', { length: 50 }).default(''),
  subscriptionType: subscriptionTypeEnum('subscription_type'),
  subscriptionStartDate: bigint('subscription_start_date', { mode: 'number' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  vatNumber: varchar('vat_number', { length: 50 }),
  billingAddressLine1: varchar('billing_address_line1', { length: 255 }),
  billingCity: varchar('billing_city', { length: 100 }),
  billingPostalCode: varchar('billing_postal_code', { length: 20 }),
  billingCountry: varchar('billing_country', { length: 100 }),
  hourlyRate: numeric('hourly_rate', { precision: 12, scale: 2 }).default('0'),
  partsMarkup: numeric('parts_markup', { precision: 6, scale: 2 }).default('0'),
  vatRate: numeric('VAT_rate', { precision: 5, scale: 2 }).default('0'),
  garageId: integer('garage_id').references(() => garages.id)
})

export const passwordReset = pgTable('password_reset', {
  id: bigint('id', { mode: 'number' }).primaryKey().$defaultFn(() => Date.now()),
  passwordResetKey: varchar('password_reset_key'),
  userId: integer('user_id').references(() => users.id),
  isValid: boolean('is_valid').default(true)
})

// Garages
export const garages = pgTable('garages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).default(''),
  phoneNo: varchar('phone_no', { length: 50 }).default(''),
  address: text('address').default('')
})

// Customers
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).default(''),
  phoneNo: varchar('phone_no', { length: 50 }).default('')
})

// Car Templates (reference data for UK/IE lookup)
export const carTemplates = pgTable('car_templates', {
  id: serial('id').primaryKey(),
  brand: varchar('brand', { length: 255 }).notNull().default(''),
  make: varchar('make', { length: 255 }).notNull().default(''),
  brandSlug: varchar('brand_slug', { length: 255 }).notNull().default(''),
  modelSlug: varchar('model_slug', { length: 255 }).notNull().default(''),
  engineSize: varchar('engine_size', { length: 100 }).notNull().default(''),
  engineSlug: varchar('engine_slug', { length: 255 }).notNull().default(''),
  minYear: integer('min_year').notNull().default(0),
  maxYear: integer('max_year').notNull().default(0),
  drivetrain: varchar('drivetrain', { length: 50 }).notNull().default(''),
  fuelType: varchar('fuel_type', { length: 50 }).notNull().default(''),
  transmissionType: varchar('transmission_type', { length: 50 }).notNull().default(''),
  timingType: varchar('timing_type', { length: 50 }).notNull().default(''),
  forcedInduction: varchar('forced_induction', { length: 100 })
})

// Actual cars (NL/UK detailed vehicle data)
export const cars = pgTable('cars', {
  id: serial('id').primaryKey(),
  brand: varchar('brand', { length: 255 }).default(''),
  make: varchar('make', { length: 255 }).default(''),
  year: varchar('year', { length: 100 }),
  fuelType: varchar('fuel_type', { length: 50 }).default(''),
  engineSize: varchar('engine_size', { length: 100 }).default(''),
  engineType: varchar('engine_type', { length: 100 }).default(''),
  drivetrain: varchar('drivetrain', { length: 50 }).default(''),
  vehicleType: varchar('vehicle_type', { length: 100 }),
  bodyType: varchar('body_type', { length: 100 }),
  primaryColor: varchar('primary_color', { length: 100 }),
  secondaryColor: varchar('secondary_color', { length: 100 }),
  seatCount: integer('seat_count'),
  doorCount: integer('door_count'),
  wheelCount: integer('wheel_count'),
  cylinderCount: integer('cylinder_count'),
  engineDisplacement: integer('engine_displacement'),
  emptyWeight: integer('empty_weight'),
  kerbWeight: integer('kerb_weight'),
  maxPermittedWeight: integer('max_permitted_weight'),
  technicalMaxWeight: integer('technical_max_weight'),
  maxCombinedWeight: integer('max_combined_weight'),
  maxUnbrakedTowingWeight: integer('max_unbraked_towing_weight'),
  maxBrakedTowingWeight: integer('max_braked_towing_weight'),
  length: integer('length'),
  width: integer('width'),
  height: integer('height'),
  wheelbase: integer('wheelbase'),
  maxSpeed: integer('max_speed'),
  powerToWeightRatio: numeric('power_to_weight_ratio', { precision: 8, scale: 4 }),
  listPrice: integer('list_price'),
  grossBpm: integer('gross_bpm'),
  euVehicleCategory: varchar('eu_vehicle_category', { length: 20 }),
  typeApprovalNumber: varchar('type_approval_number', { length: 100 }),
  typeCode: varchar('type_code', { length: 50 }),
  variant: varchar('variant', { length: 100 }),
  version: varchar('version', { length: 100 }),
  euTypeApprovalRevision: varchar('eu_type_approval_revision', { length: 10 }),
  apkExpiryDate: varchar('apk_expiry_date', { length: 8 }),
  apkExpiryDatetime: timestamp('apk_expiry_datetime', { withTimezone: true }),
  firstAdmissionDate: varchar('first_admission_date', { length: 8 }),
  firstAdmissionDatetime: timestamp('first_admission_datetime', { withTimezone: true }),
  registrationDate: varchar('registration_date', { length: 8 }),
  registrationDatetime: timestamp('registration_datetime', { withTimezone: true }),
  firstNlRegistrationDate: varchar('first_nl_registration_date', { length: 8 }),
  firstNlRegistrationDatetime: timestamp('first_nl_registration_datetime', { withTimezone: true }),
  bpmApprovalDate: varchar('bpm_approval_date', { length: 8 }),
  bpmApprovalDatetime: timestamp('bpm_approval_datetime', { withTimezone: true }),
  lastOdometerYear: integer('last_odometer_year'),
  odometerJudgement: varchar('odometer_judgement', { length: 100 }),
  odometerJudgementCode: varchar('odometer_judgement_code', { length: 10 }),
  thirdPartyInsured: varchar('third_party_insured', { length: 10 }),
  exportIndicator: varchar('export_indicator', { length: 10 }),
  recallPending: varchar('recall_pending', { length: 10 }),
  taxiIndicator: varchar('taxi_indicator', { length: 10 }),
  pendingInspection: varchar('pending_inspection', { length: 100 }),
  transferable: varchar('transferable', { length: 10 })
})

// Vehicles (UK/IE - same structure as cars)
export const vehicles = pgTable('vehicles', {
  id: serial('id').primaryKey(),
  brand: varchar('brand', { length: 255 }).default(''),
  make: varchar('make', { length: 255 }).default(''),
  year: varchar('year', { length: 10 }),
  fuelType: varchar('fuel_type', { length: 50 }).default(''),
  engineSize: varchar('engine_size', { length: 100 }).default(''),
  engineType: varchar('engine_type', { length: 100 }).default(''),
  drivetrain: varchar('drivetrain', { length: 50 }).default(''),
  vehicleType: varchar('vehicle_type', { length: 100 }),
  bodyType: varchar('body_type', { length: 100 }),
  primaryColor: varchar('primary_color', { length: 100 }),
  engineDisplacement: integer('engine_displacement')
})

// License Plates
export const licensePlates = pgTable('license_plates', {
  id: serial('id').primaryKey(),
  licensePlate: varchar('license_plate', { length: 50 }).notNull(),
  carId: integer('car_id').references(() => cars.id),
  vehicleId: integer('vehicle_id').references(() => vehicles.id),
  visitId: integer('visit_id').references(() => visits.id)
})

// Visits
export const visits = pgTable('visits', {
  id: serial('id').primaryKey(),
  status: visitStatusEnum('status').notNull().default('in_progress'),
  customerId: integer('customer_id').references(() => customers.id),
  userId: integer('user_id').references(() => users.id),
  licensePlateId: integer('license_plate_id')
})

// Categories
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull()
})

// Jobs (labor time library)
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }),
  category: varchar('category', { length: 255 }).default(''),
  labourHours: numeric('labour_hours', { precision: 6, scale: 2 }).default('0'),
  lowRange: numeric('low_range', { precision: 6, scale: 2 }),
  highRange: numeric('high_range', { precision: 6, scale: 2 }),
  confidence: varchar('confidence', { length: 100 }),
  techNotes: jsonb('tech_notes'),
  categoryId: integer('category_id').references(() => categories.id)
})

// Car <-> Job junction (which jobs available for which car template)
export const carJobs = pgTable('car_jobs', {
  id: serial('id').primaryKey(),
  carId: integer('car_id').references(() => carTemplates.id),
  jobId: integer('job_id').references(() => jobs.id)
})

// Job Visits (jobs performed in a visit / license plate)
export const jobVisits = pgTable('job_visits', {
  id: serial('id').primaryKey(),
  licensePlateId: integer('licensePlateId').notNull(),
  jobId: integer('job_id').notNull().references(() => jobs.id)
})

// Parts
export const parts = pgTable('parts', {
  id: serial('id').primaryKey(),
  brand: varchar('brand', { length: 255 }).default(''),
  partNo: varchar('part_no', { length: 255 }).default(''),
  name: varchar('name', { length: 255 }).notNull()
})

// Job Parts (parts used in a job)
export const jobParts = pgTable('job_parts', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobs.id),
  partId: integer('part_id').references(() => parts.id),
  quantity: integer('quantity').default(1),
  unitCost: numeric('unit_cost', { precision: 12, scale: 2 }).default('0'),
  source: jobPartSourceEnum('source').notNull().default('manual')
})

// Charge Templates
export const chargeTemplates = pgTable('charge_templates', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).default('0'),
  description: text('description').default('')
})

// Charges (actual charges on a job)
export const charges = pgTable('charges', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  price: numeric('price', { precision: 12, scale: 2 }).default('0'),
  description: text('description').default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  chargeTemplateId: integer('charge_template_id').references(() => chargeTemplates.id),
  jobId: integer('job_id').references(() => jobs.id),
  visitId: integer('visit_id').references(() => visits.id)
})

// Invoices
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  prefix: varchar('prefix', { length: 20 }).default(''),
  invoiceNo: integer('invoice_no').default(0),
  visitId: integer('visit_id').references(() => visits.id),
  customerId: integer('customer_id').references(() => customers.id),
  garageId: integer('garage_id').references(() => garages.id),
  labourCost: numeric('labour_cost', { precision: 12, scale: 2 }).default('0'),
  partsCost: numeric('parts_cost', { precision: 12, scale: 2 }).default('0'),
  vatAmount: numeric('vat_amount', { precision: 12, scale: 2 }).default('0'),
  vatRate: numeric('vat_rate', { precision: 6, scale: 2 }).default('0'),
  partsMarkup: numeric('parts_markup', { precision: 6, scale: 2 }).default('0'),
  total: numeric('total', { precision: 14, scale: 2 }).default('0'),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  stripePaymentLink: varchar('stripe_payment_link', { length: 500 }),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})

// Parsed Documents (email/receipt parsing results)
export const parsedDocuments = pgTable('parsed_documents', {
  id: serial('id').primaryKey(),
  garageId: integer('garage_id').references(() => garages.id),
  userId: integer('user_id').references(() => users.id),
  visitId: integer('visit_id').references(() => visits.id),
  sourceType: varchar('source_type', { length: 100 }).default(''),
  rawContent: text('raw_content').default(''),
  parsedContent: jsonb('parsed_content').default({}),
  status: varchar('status', { length: 100 }).default(''),
  jobPartId: integer('job_part_id').references(() => jobParts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
})

// Fluids (reference data)
export const fluids = pgTable('fluids', {
  id: serial('id').primaryKey(),
  systemType: varchar('system_type', { length: 100 }).notNull(),
  systemName: varchar('system_name', { length: 255 }).notNull(),
  type: varchar('type', { length: 255 }).notNull(),
  spec: varchar('spec', { length: 255 }),
  quarts: numeric('quarts', { precision: 8, scale: 2 }),
  liters: numeric('liters', { precision: 8, scale: 2 }),
  drainRefillQuarts: numeric('drain_refill_quarts', { precision: 8, scale: 2 }),
  drainRefillLiters: numeric('drain_refill_liters', { precision: 8, scale: 2 }),
  intervalMiles: integer('interval_miles'),
  intervalKm: integer('interval_km'),
  notes: text('notes'),
  confidence: varchar('confidence', { length: 100 }).notNull()
})

// Car Template <-> Fluid junction
export const carTemplateFluids = pgTable('car_template_fluids', {
  id: serial('id').primaryKey(),
  fluidId: integer('fluid_id').references(() => fluids.id),
  carId: integer('car_id').references(() => carTemplates.id)
})

// Vehicle Fluids (actual car to fluid)
export const vehicleFluids = pgTable('vehicle_fluids', {
  id: serial('id').primaryKey(),
  fluidId: integer('fluid_id').references(() => fluids.id),
  carId: integer('car_id').references(() => cars.id),
  systemType: varchar('system_type', { length: 100 })
})

// Job Fluids
export const jobFluids = pgTable('job_fluids', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobs.id),
  fluidId: integer('fluid_id').references(() => fluids.id)
})

// Torque Specs
export const torqueSpecs = pgTable('torque_specs', {
  id: serial('id').primaryKey(),
  nm: numeric('nm', { precision: 8, scale: 2 }),
  lbft: numeric('lbft', { precision: 8, scale: 2 }),
  sequence: boolean('sequence').default(false),
  angleDegrees: numeric('angle_degrees', { precision: 6, scale: 2 }),
  isCritical: boolean('is_critical').default(false),
  notes: text('notes'),
  component: varchar('component', { length: 255 }),
  confidence: varchar('confidence', { length: 100 })
})

// Torque Spec <-> Car Template junction
export const torqueSpecCars = pgTable('torque_spec_cars', {
  id: serial('id').primaryKey(),
  torqueSpecId: integer('torque_spec_id').references(() => torqueSpecs.id),
  carId: integer('car_id').references(() => cars.id)
})

// Torque Spec <-> Job junction
export const torqueSpecJobs = pgTable('torque_spec_jobs', {
  id: serial('id').primaryKey(),
  torqueSpecId: integer('torque_spec_id').references(() => torqueSpecs.id),
  jobId: integer('job_id').references(() => jobs.id)
})

// DTC Codes
export const dtcCodes = pgTable('dtc_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 20 }).notNull(),
  codeSlug: varchar('code_slug', { length: 50 }).notNull(),
  category: varchar('category', { length: 100 }),
  categoryName: varchar('category_name', { length: 100 }),
  subcategory: varchar('subcategory', { length: 100 }),
  shortDescription: varchar('short_description', { length: 500 }),
  description: text('description'),
  symptoms: text('symptoms').array(),
  commonCauses: text('common_causes').array(),
  diagnosticSteps: text('diagnostic_steps').array(),
  repairNotes: text('repair_notes'),
  severity: varchar('severity', { length: 50 }),
  isGeneric: boolean('is_generic'),
  confidence: varchar('confidence', { length: 100 })
})

// Car Template <-> DTC junction
export const carTemplateDtcCodes = pgTable('car_template_dtc_codes', {
  id: serial('id').primaryKey(),
  carId: integer('car_id').references(() => carTemplates.id),
  dtcCodeId: integer('dtc_code_id').references(() => dtcCodes.id)
})

export const dtcRelatedCodes = pgTable('dtc_related_codes', {
  id: serial('id').primaryKey(),
  codeId: integer('code_id').references(() => dtcCodes.id),
  relatedCodeId: integer('related_code_id').references(() => dtcCodes.id)
})

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  garage: one(garages, { fields: [users.garageId], references: [garages.id] }),
  visits: many(visits),
  parsedDocuments: many(parsedDocuments),
  passwordResets: many(passwordReset)
}))

export const visitsRelations = relations(visits, ({ one, many }) => ({
  customer: one(customers, { fields: [visits.customerId], references: [customers.id] }),
  user: one(users, { fields: [visits.userId], references: [users.id] }),
  licensePlate: many(licensePlates),
  jobVisits: many(jobVisits),
  invoices: many(invoices),
  parsedDocuments: many(parsedDocuments)
}))

export const licensePlatesRelations = relations(licensePlates, ({ one }) => ({
  car: one(cars, { fields: [licensePlates.carId], references: [cars.id] }),
  vehicle: one(vehicles, { fields: [licensePlates.vehicleId], references: [vehicles.id] }),
  visit: one(visits, { fields: [licensePlates.visitId], references: [visits.id] })
}))

export const jobVisitsRelations = relations(jobVisits, ({ one }) => ({
  job: one(jobs, { fields: [jobVisits.jobId], references: [jobs.id] })
}))

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  category: one(categories, { fields: [jobs.categoryId], references: [categories.id] }),
  carJobs: many(carJobs),
  jobParts: many(jobParts),
  jobFluids: many(jobFluids),
  charges: many(charges),
  torqueSpecJobs: many(torqueSpecJobs)
}))

export const jobPartsRelations = relations(jobParts, ({ one }) => ({
  job: one(jobs, { fields: [jobParts.jobId], references: [jobs.id] }),
  part: one(parts, { fields: [jobParts.partId], references: [parts.id] })
}))

export const carTemplatesRelations = relations(carTemplates, ({ many }) => ({
  carJobs: many(carJobs),
  carTemplateFluids: many(carTemplateFluids),
  carTemplateDtcCodes: many(carTemplateDtcCodes)
}))
