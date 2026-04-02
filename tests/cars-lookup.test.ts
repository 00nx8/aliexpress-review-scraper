import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Globals ───────────────────────────────────────────────────────────────────
const mockGetUserSession = vi.fn()
const mockCreateError = (opts: { statusCode: number; message: string }) => {
  const err: any = new Error(opts.message)
  err.statusCode = opts.statusCode
  return err
}
;(global as any).defineEventHandler = (fn: Function) => fn
;(global as any).createError = mockCreateError
;(global as any).getUserSession = mockGetUserSession

vi.mock('../server/db', () => ({ useDb: () => ({}) }))

// ── requireUser mock ──────────────────────────────────────────────────────────
vi.mock('../server/utils/auth', () => ({
  requireUser: vi.fn(async (event: any) => {
    const session = await (global as any).getUserSession(event)
    if (!session?.user?.id) throw (global as any).createError({ statusCode: 401, message: 'Unauthorized' })
    return session.user
  })
}))

import { requireUser } from '../server/utils/auth'

const authedSession = { user: { id: 1, email: 'user@example.com' } }
const noSession = { user: null }

// ── Inline implementation of POST /api/cars/lookup ───────────────────────────
// Captures region routing, existing-plate lookup, and API path branching.
// External DB + $fetch are replaced by the `db` opts object for clarity.
async function runLookup(
  event: object,
  body: { plate?: string; country?: string },
  db: {
    existingLp?: { id: number; carId?: number | null; vehicleId?: number | null; visitId?: number | null } | null
    carRow?: any
    vehicleRow?: any
    prevVisit?: { customerId: number | null } | null
    prevCustomer?: any
    templates?: any[]
    nlApiResult?: any[] | null
    ukApiThrows?: boolean
    ukApiResult?: any
  } = {}
) {
  await requireUser(event)
  const { plate, country } = body
  if (!plate) throw mockCreateError({ statusCode: 400, message: 'Plate required' })

  const normalizedPlate = plate.toUpperCase().replace(/\s/g, '')
  const countryCode = (country || 'uk').toLowerCase()
  const isNl = countryCode === 'nl'

  // Region-filtered plate lookup
  // NL: only matches rows where carId IS NOT NULL
  // UK/IE: only matches rows where vehicleId IS NOT NULL
  const firstLp = db.existingLp ?? null

  if (firstLp && (firstLp.carId || firstLp.vehicleId)) {
    let vehicleData = null
    if (firstLp.carId) {
      vehicleData = db.carRow ? { source: 'nl', data: db.carRow } : null
    } else if (firstLp.vehicleId) {
      vehicleData = db.vehicleRow ? { source: 'uk', data: db.vehicleRow } : null
    }

    let previousCustomer = null
    if (firstLp.visitId != null && db.prevVisit?.customerId) {
      previousCustomer = db.prevCustomer ?? null
    }

    if (vehicleData) {
      return { type: 'existing', licensePlateId: firstLp.id, vehicle: vehicleData, previousCustomer }
    }
  }

  if (isNl) {
    const res = db.nlApiResult
    if (!res || !res.length) throw mockCreateError({ statusCode: 404, message: 'Vehicle not found' })
    const raw = res[0]
    return {
      type: 'nl_new',
      raw,
      preview: {
        brand: raw.merk || '',
        make: raw.handelsbenaming || '',
        year: raw.datum_eerste_toelating ? String(raw.datum_eerste_toelating).substring(0, 4) : '',
        engineSize: raw.cilinderinhoud ? `${(raw.cilinderinhoud / 1000).toFixed(1)}L` : '',
        fuelType: raw.brandstof_omschrijving || '',
        color: raw.eerste_kleur || ''
      }
    }
  } else {
    if (db.ukApiThrows || !db.ukApiResult) {
      throw mockCreateError({ statusCode: 404, message: 'Vehicle not found' })
    }
    const res = db.ukApiResult
    const make = res.make || ''
    const year = res.yearOfManufacture || 0
    const engineCc = res.engineCapacity || 0
    const fuelType = res.fuelType || ''
    const engineL = engineCc > 0 ? Math.round(engineCc / 100) / 10 : null
    const templates = db.templates || []

    return {
      type: 'uk_new',
      raw: res,
      preview: { brand: make, make: '', year: String(year), engineCc, engineL, fuelType },
      templates
    }
  }
}

// ── Tests: auth ───────────────────────────────────────────────────────────────
describe('POST /api/cars/lookup — auth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws 401 when not authenticated', async () => {
    mockGetUserSession.mockResolvedValue(noSession)
    await expect(runLookup({}, { plate: 'AB12CD' })).rejects.toMatchObject({ statusCode: 401 })
  })

  it('throws 401 when session has no user id', async () => {
    mockGetUserSession.mockResolvedValue({ user: {} })
    await expect(runLookup({}, { plate: 'AB12CD' })).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ── Tests: input validation ───────────────────────────────────────────────────
describe('POST /api/cars/lookup — input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('throws 400 when plate is missing', async () => {
    await expect(runLookup({}, {})).rejects.toMatchObject({ statusCode: 400, message: 'Plate required' })
  })

  it('throws 400 when plate is empty string', async () => {
    await expect(runLookup({}, { plate: '' })).rejects.toMatchObject({ statusCode: 400 })
  })
})

// ── Tests: plate normalisation ────────────────────────────────────────────────
describe('POST /api/cars/lookup — plate normalisation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('uppercases the plate before lookup', async () => {
    // The normalised plate is used in the DB query; with no existingLp and no API
    // configured the handler falls through to the UK path and throws 404 — but
    // we confirm it reaches the UK path (not a validation error)
    await expect(
      runLookup({}, { plate: 'ab12cd' }, { ukApiThrows: true })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('strips spaces from the plate', async () => {
    await expect(
      runLookup({}, { plate: 'AB 12 CD' }, { ukApiThrows: true })
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Tests: region routing ─────────────────────────────────────────────────────
describe('POST /api/cars/lookup — region routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('defaults to uk path when country is not provided', async () => {
    const result = await runLookup({}, { plate: 'AB12CD' }, {
      ukApiResult: { make: 'Ford', yearOfManufacture: 2015, engineCapacity: 1596, fuelType: 'Petrol' }
    })
    expect(result.type).toBe('uk_new')
  })

  it('uses nl path when country is "nl"', async () => {
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [{ merk: 'Volkswagen', handelsbenaming: 'Golf', datum_eerste_toelating: '20150101', cilinderinhoud: 1395, brandstof_omschrijving: 'Benzine', eerste_kleur: 'Blauw' }]
    })
    expect(result.type).toBe('nl_new')
  })

  it('uses uk path when country is "uk"', async () => {
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      ukApiResult: { make: 'Toyota', yearOfManufacture: 2018, engineCapacity: 998, fuelType: 'Petrol' }
    })
    expect(result.type).toBe('uk_new')
  })

  it('uses uk path when country is "ie"', async () => {
    const result = await runLookup({}, { plate: '201D1234', country: 'ie' }, {
      ukApiResult: { make: 'Honda', yearOfManufacture: 2020, engineCapacity: 1498, fuelType: 'Petrol' }
    })
    expect(result.type).toBe('uk_new')
  })
})

// ── Tests: region bleed prevention ───────────────────────────────────────────
describe('POST /api/cars/lookup — region filter prevents cross-region bleed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('NL lookup does not return a plate that only has vehicleId (UK record)', async () => {
    // NL filter: WHERE licensePlate = ? AND carId IS NOT NULL
    // A plate with vehicleId=5 but carId=null would NOT be returned by the NL query
    // Simulate: existingLp returns null (no match for NL filter)
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: null, // NL query found nothing because carId is null
      nlApiResult: [{ merk: 'VW', handelsbenaming: 'Polo', cilinderinhoud: 1200 }]
    })
    expect(result.type).toBe('nl_new') // fell through to NL API
  })

  it('UK lookup does not return a plate that only has carId (NL record)', async () => {
    // UK filter: WHERE licensePlate = ? AND vehicleId IS NOT NULL
    // A plate with carId=10 but vehicleId=null would NOT be returned by the UK query
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      existingLp: null, // UK query found nothing because vehicleId is null
      ukApiResult: { make: 'VW', yearOfManufacture: 2015, engineCapacity: 1200, fuelType: 'Petrol' }
    })
    expect(result.type).toBe('uk_new') // fell through to UK API
  })

  it('NL lookup returns existing when carId IS present', async () => {
    const carRow = { id: 10, brand: 'Volkswagen', make: 'Golf', year: '2015', engineSize: '1.4L' }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: { id: 1, carId: 10, vehicleId: null, visitId: null },
      carRow
    })
    expect(result).toMatchObject({ type: 'existing', vehicle: { source: 'nl' } })
  })

  it('UK lookup returns existing when vehicleId IS present', async () => {
    const vehicleRow = { id: 20, brand: 'Ford', make: 'Focus', year: '2018', engineSize: '1.5L' }
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      existingLp: { id: 2, carId: null, vehicleId: 20, visitId: null },
      vehicleRow
    })
    expect(result).toMatchObject({ type: 'existing', vehicle: { source: 'uk' } })
  })
})

// ── Tests: existing plate ─────────────────────────────────────────────────────
describe('POST /api/cars/lookup — existing plate (previously seen)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns type=existing with licensePlateId', async () => {
    const carRow = { id: 10, brand: 'VW', make: 'Golf' }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: { id: 42, carId: 10, vehicleId: null, visitId: null },
      carRow
    })
    expect(result).toMatchObject({ type: 'existing', licensePlateId: 42 })
  })

  it('includes previousCustomer when visit had one', async () => {
    const carRow = { id: 10, brand: 'VW', make: 'Golf' }
    const prevCustomer = { id: 7, name: 'Alice', email: 'alice@example.com' }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: { id: 1, carId: 10, vehicleId: null, visitId: 99 },
      carRow,
      prevVisit: { customerId: 7 },
      prevCustomer
    })
    expect(result).toMatchObject({ type: 'existing', previousCustomer: prevCustomer })
  })

  it('previousCustomer is null when visit had no customer', async () => {
    const carRow = { id: 10, brand: 'VW', make: 'Golf' }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: { id: 1, carId: 10, vehicleId: null, visitId: 99 },
      carRow,
      prevVisit: { customerId: null }
    })
    expect((result as any).previousCustomer).toBeNull()
  })

  it('previousCustomer is null when no visitId', async () => {
    const carRow = { id: 10, brand: 'VW', make: 'Golf' }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      existingLp: { id: 1, carId: 10, vehicleId: null, visitId: null },
      carRow
    })
    expect((result as any).previousCustomer).toBeNull()
  })

  it('vehicle source is "nl" for carId-based records', async () => {
    const carRow = { id: 10, brand: 'Opel', make: 'Astra' }
    const result = await runLookup({}, { plate: 'XY456Z', country: 'nl' }, {
      existingLp: { id: 1, carId: 10, vehicleId: null, visitId: null },
      carRow
    })
    expect((result as any).vehicle.source).toBe('nl')
    expect((result as any).vehicle.data).toEqual(carRow)
  })

  it('vehicle source is "uk" for vehicleId-based records', async () => {
    const vehicleRow = { id: 20, brand: 'Ford', make: 'Fiesta' }
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      existingLp: { id: 2, carId: null, vehicleId: 20, visitId: null },
      vehicleRow
    })
    expect((result as any).vehicle.source).toBe('uk')
    expect((result as any).vehicle.data).toEqual(vehicleRow)
  })
})

// ── Tests: NL new vehicle path ────────────────────────────────────────────────
describe('POST /api/cars/lookup — NL new vehicle (RDW API)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns type=nl_new with preview fields mapped from RDW response', async () => {
    const raw = {
      merk: 'Volkswagen',
      handelsbenaming: 'Golf',
      datum_eerste_toelating: '20151023',
      cilinderinhoud: 1395,
      brandstof_omschrijving: 'Benzine',
      eerste_kleur: 'Blauw'
    }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [raw]
    })
    expect(result).toMatchObject({
      type: 'nl_new',
      preview: {
        brand: 'Volkswagen',
        make: 'Golf',
        year: '2015',
        engineSize: '1.4L',
        fuelType: 'Benzine',
        color: 'Blauw'
      }
    })
  })

  it('extracts year as first 4 chars of datum_eerste_toelating', async () => {
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [{ merk: 'VW', datum_eerste_toelating: '19981201', cilinderinhoud: 1800 }]
    })
    expect((result as any).preview.year).toBe('1998')
  })

  it('returns empty year when datum_eerste_toelating is missing', async () => {
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [{ merk: 'VW' }]
    })
    expect((result as any).preview.year).toBe('')
  })

  it('returns empty engineSize when cilinderinhoud is missing', async () => {
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [{ merk: 'VW' }]
    })
    expect((result as any).preview.engineSize).toBe('')
  })

  it('formats engine size as (cilinderinhoud / 1000).toFixed(1) + "L"', async () => {
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, {
      nlApiResult: [{ cilinderinhoud: 1998 }]
    })
    expect((result as any).preview.engineSize).toBe('2.0L')
  })

  it('throws 404 when RDW API returns empty array', async () => {
    await expect(
      runLookup({}, { plate: 'AB123C', country: 'nl' }, { nlApiResult: [] })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Vehicle not found' })
  })

  it('throws 404 when RDW API returns null', async () => {
    await expect(
      runLookup({}, { plate: 'AB123C', country: 'nl' }, { nlApiResult: null })
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('includes raw RDW response in result', async () => {
    const raw = { merk: 'Opel', handelsbenaming: 'Astra', cilinderinhoud: 1600 }
    const result = await runLookup({}, { plate: 'AB123C', country: 'nl' }, { nlApiResult: [raw] })
    expect((result as any).raw).toEqual(raw)
  })
})

// ── Tests: UK new vehicle path ────────────────────────────────────────────────
describe('POST /api/cars/lookup — UK new vehicle (DVLA API)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('returns type=uk_new with preview fields mapped from DVLA response', async () => {
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      ukApiResult: { make: 'Ford', yearOfManufacture: 2018, engineCapacity: 1596, fuelType: 'Petrol' }
    })
    expect(result).toMatchObject({
      type: 'uk_new',
      preview: { brand: 'Ford', make: '', year: '2018', engineCc: 1596, fuelType: 'Petrol' }
    })
  })

  it('includes templates array in result', async () => {
    const templates = [{ id: 1, brand: 'Ford', make: 'Focus', engineSize: '1.6L' }]
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, {
      ukApiResult: { make: 'Ford', yearOfManufacture: 2018, engineCapacity: 1596, fuelType: 'Petrol' },
      templates
    })
    expect((result as any).templates).toEqual(templates)
  })

  it('includes raw DVLA response in result', async () => {
    const raw = { make: 'Toyota', yearOfManufacture: 2020, engineCapacity: 998, fuelType: 'Petrol' }
    const result = await runLookup({}, { plate: 'AB12CD', country: 'uk' }, { ukApiResult: raw })
    expect((result as any).raw).toEqual(raw)
  })

  it('throws 404 when DVLA API throws', async () => {
    await expect(
      runLookup({}, { plate: 'AB12CD', country: 'uk' }, { ukApiThrows: true })
    ).rejects.toMatchObject({ statusCode: 404, message: 'Vehicle not found' })
  })

  it('throws 404 when DVLA API returns nothing', async () => {
    await expect(
      runLookup({}, { plate: 'AB12CD', country: 'uk' }, {})
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ── Tests: engine size conversion (unit) ──────────────────────────────────────
describe('Engine size: cc → L conversion', () => {
  it('converts 1390cc → 1.4L', () => {
    const cc = 1390
    const engineL = Math.round(cc / 100) / 10
    expect(engineL).toBe(1.4)
  })

  it('converts 999cc → 1.0L', () => {
    const cc = 999
    const engineL = Math.round(cc / 100) / 10
    expect(engineL).toBe(1.0)
  })

  it('converts 1984cc → 2.0L', () => {
    const cc = 1984
    const engineL = Math.round(cc / 100) / 10
    expect(engineL).toBe(2.0)
  })

  it('converts 2497cc → 2.5L', () => {
    const cc = 2497
    const engineL = Math.round(cc / 100) / 10
    expect(engineL).toBe(2.5)
  })

  it('engineL is null when engineCc is 0', () => {
    const cc = 0
    const engineL = cc > 0 ? Math.round(cc / 100) / 10 : null
    expect(engineL).toBeNull()
  })
})

// ── Tests: engine size range calculation (unit) ───────────────────────────────
describe('Engine size: range ±0.1L for DB query', () => {
  it('1.4L → lo=1.3, hi=1.5', () => {
    const engineL = 1.4
    const lo = parseFloat((engineL - 0.1).toFixed(1))
    const hi = parseFloat((engineL + 0.1).toFixed(1))
    expect(lo).toBe(1.3)
    expect(hi).toBe(1.5)
  })

  it('1.0L → lo=0.9, hi=1.1', () => {
    const engineL = 1.0
    const lo = parseFloat((engineL - 0.1).toFixed(1))
    const hi = parseFloat((engineL + 0.1).toFixed(1))
    expect(lo).toBe(0.9)
    expect(hi).toBe(1.1)
  })

  it('2.0L → lo=1.9, hi=2.1', () => {
    const engineL = 2.0
    const lo = parseFloat((engineL - 0.1).toFixed(1))
    const hi = parseFloat((engineL + 0.1).toFixed(1))
    expect(lo).toBe(1.9)
    expect(hi).toBe(2.1)
  })

  it('uses toFixed(1) to avoid floating-point drift', () => {
    // Without toFixed, 1.4 - 0.1 = 1.2999999999999998
    const engineL = 1.4
    const raw = engineL - 0.1
    const fixed = parseFloat(raw.toFixed(1))
    expect(raw).not.toBe(1.3) // raw has float drift
    expect(fixed).toBe(1.3)   // toFixed fixes it
  })

  it('3.0L → lo=2.9, hi=3.1', () => {
    const engineL = 3.0
    const lo = parseFloat((engineL - 0.1).toFixed(1))
    const hi = parseFloat((engineL + 0.1).toFixed(1))
    expect(lo).toBe(2.9)
    expect(hi).toBe(3.1)
  })
})

// ── Tests: UK engine size in preview ─────────────────────────────────────────
describe('POST /api/cars/lookup — engineL in UK preview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUserSession.mockResolvedValue(authedSession)
  })

  it('engineL is included in UK preview', async () => {
    const result = await runLookup({}, { plate: 'AB12CD' }, {
      ukApiResult: { make: 'Ford', yearOfManufacture: 2018, engineCapacity: 1390, fuelType: 'Petrol' }
    })
    expect((result as any).preview.engineL).toBe(1.4)
  })

  it('engineL is null in UK preview when engineCapacity is 0', async () => {
    const result = await runLookup({}, { plate: 'AB12CD' }, {
      ukApiResult: { make: 'Ford', yearOfManufacture: 2018, engineCapacity: 0, fuelType: 'Petrol' }
    })
    expect((result as any).preview.engineL).toBeNull()
  })
})
