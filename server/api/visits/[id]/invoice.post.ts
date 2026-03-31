import { requireUser } from '~~/server/utils/auth'
import { useDb } from '~~/server/db'
import { visits, users, jobs, jobVisits, jobParts, parts, charges, invoices, licensePlates, cars, vehicles } from '~~/server/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const visitId = Number(getRouterParam(event, 'id'))
  const config = useRuntimeConfig()
  const db = useDb()

  const [visit] = await db.select().from(visits)
    .where(and(eq(visits.id, visitId), eq(visits.userId, user.id))).limit(1)
  if (!visit) throw createError({ statusCode: 404, message: 'Visit not found' })

  const [userRecord] = await db.select().from(users).where(eq(users.id, user.id)).limit(1)
  if (!userRecord) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, message: 'Session expired. Please log in again.' })
  }
  const hourlyRate = Number(userRecord.hourlyRate) || 50
  const partsMarkup = Number(userRecord?.partsMarkup) || 0
  const vatRate = Number(userRecord?.vatRate) || 0

  // Get all jobs for this visit
  const visitJobList = visit.licensePlateId
    ? await db.select({ id: jobVisits.id, jobId: jobs.id, labourHours: jobs.labourHours })
        .from(jobVisits)
        .innerJoin(jobs, eq(jobVisits.jobId, jobs.id))
        .where(eq(jobVisits.licensePlateId, visit.licensePlateId))
    : []

  const jobIds = visitJobList.map(j => j.jobId)

  const [partsList, chargesList] = await Promise.all([
    jobIds.length
      ? db.select({ unitCost: jobParts.unitCost, quantity: jobParts.quantity })
          .from(jobParts)
          .where(inArray(jobParts.jobId, jobIds))
      : [],
    jobIds.length
      ? db.select({ price: charges.price })
          .from(charges)
          .where(inArray(charges.jobId, jobIds))
      : []
  ])

  const partsTotal = partsList.reduce((s, p) => s + Number(p.unitCost) * (p.quantity || 1), 0)
  const partsWithMarkup = partsTotal * (1 + partsMarkup / 100)
  const labourTotal = visitJobList.reduce((s, j) => s + Number(j.labourHours), 0) * hourlyRate
  const chargesTotal = chargesList.reduce((s, c) => s + Number(c.price), 0)
  const subtotal = partsWithMarkup + labourTotal + chargesTotal
  const vatAmount = subtotal * (vatRate / 100)
  const total = subtotal + vatAmount

  // Get vehicle info for invoice description
  let vehicleDesc = 'Vehicle'
  if (visit.licensePlateId) {
    const [lp] = await db.select().from(licensePlates).where(eq(licensePlates.id, visit.licensePlateId)).limit(1)
    if (lp?.carId) {
      const [c] = await db.select({ brand: cars.brand, make: cars.make }).from(cars).where(eq(cars.id, lp.carId)).limit(1)
      if (c) vehicleDesc = `${c.brand} ${c.make} - ${lp.licensePlate}`
    } else if (lp?.vehicleId) {
      const [v] = await db.select({ brand: vehicles.brand, make: vehicles.make }).from(vehicles).where(eq(vehicles.id, lp.vehicleId)).limit(1)
      if (v) vehicleDesc = `${v.brand} ${v.make} - ${lp.licensePlate}`
    }
  }

  // Create Stripe payment link
  const stripe = new Stripe(config.stripeSecretKey as string)
  let paymentLinkUrl: string | null = null
  try {
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(total * 100),
      product_data: { name: `Invoice - ${vehicleDesc}` }
    })
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }]
    })
    paymentLinkUrl = paymentLink.url
  } catch { /* stripe not configured, skip */ }

  // Get next invoice number for this garage
  const [lastInvoice] = await db.select({ invoiceNo: invoices.invoiceNo })
    .from(invoices)
    .where(eq(invoices.garageId, userRecord.garageId!))
    .orderBy(invoices.id)
    .limit(1)
  const nextNo = (lastInvoice?.invoiceNo || 0) + 1

  const [invoice] = await db.insert(invoices).values({
    visitId,
    customerId: visit.customerId || null,
    garageId: userRecord.garageId || null,
    labourCost: String(labourTotal.toFixed(2)),
    partsCost: String(partsWithMarkup.toFixed(2)),
    vatAmount: String(vatAmount.toFixed(2)),
    vatRate: String(vatRate),
    partsMarkup: String(partsMarkup),
    total: String(total.toFixed(2)),
    invoiceNo: nextNo,
    prefix: 'INV',
    status: 'draft',
    stripePaymentLink: paymentLinkUrl
  }).returning()

  // Update visit status to invoiced
  await db.update(visits).set({ status: 'invoiced' }).where(eq(visits.id, visitId))

  return { invoice, paymentLink: paymentLinkUrl }
})
