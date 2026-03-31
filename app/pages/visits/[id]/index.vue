<script setup lang="ts">
interface CarInfo { brand: string; make: string; engineSize: string; year: string; fuelType: string }
interface InvoiceInfo { id: number; status: string; paidAt: string | null; stripePaymentLink: string | null; total: string; vatAmount: string }

const { t } = useI18n()
const route = useRoute()
const visitId = computed(() => Number(route.params.id))

const { data, refresh, pending } = await useFetch(`/api/visits/${visitId.value}`)

const visit = computed(() => data.value?.visit)
const customer = computed(() => data.value?.customer)
const licensePlate = computed(() => data.value?.licensePlate)
const car = computed(() => data.value?.car as CarInfo | null)
const visitJobs = computed(() => data.value?.jobs ?? [])
const visitParts = computed(() => data.value?.parts ?? [])
const visitCharges = computed(() => data.value?.charges ?? [])
const invoice = computed(() => data.value?.invoice as InvoiceInfo | null)

// Modals
const showCarFlow = ref(false)
const showCustomerForm = ref(false)
const showJobSelector = ref(false)
const showPartOptions = ref(false)
const showChargeSelector = ref(false)

// Settings for totals (loaded lazily)
const { data: meData } = await useFetch('/api/auth/me')
const settings = computed(() => meData.value?.user)

const hourlyRate = computed(() => Number(settings.value?.hourlyRate) || 50)
const partsMarkup = computed(() => Number(settings.value?.partsMarkup) || 0)
const vatRate = computed(() => Number(settings.value?.vatRate) || 0)

const partsTotal = computed(() =>
  visitParts.value.reduce((s: number, p: any) => s + Number(p.unitCost) * (p.quantity || 1), 0)
)
const partsWithMarkup = computed(() => partsTotal.value * (1 + partsMarkup.value / 100))
const labourTotal = computed(() =>
  visitJobs.value.reduce((s: number, j: any) => s + Number(j.labourHours), 0) * hourlyRate.value
)
const chargesTotal = computed(() =>
  visitCharges.value.reduce((s: number, c: any) => s + Number(c.price), 0)
)
const subtotal = computed(() => partsWithMarkup.value + labourTotal.value + chargesTotal.value)
const vatAmount = computed(() => subtotal.value * (vatRate.value / 100))
const grandTotal = computed(() => subtotal.value + vatAmount.value)

const isLocked = computed(() => visit.value?.status === 'invoiced' || !!invoice.value?.paidAt)

async function removeJob(jobVisitId: number) {
  await $fetch(`/api/visits/${visitId.value}/jobs/${jobVisitId}`, { method: 'DELETE' })
  refresh()
}

async function markComplete() {
  await $fetch(`/api/visits/${visitId.value}`, { method: 'PATCH', body: { status: 'complete' } })
  refresh()
}

async function generateInvoice() {
  await $fetch(`/api/visits/${visitId.value}/invoice`, { method: 'POST' })
  refresh()
}

async function markPaid() {
  await $fetch(`/api/visits/${visitId.value}/invoice/paid`, { method: 'POST' })
  await refreshNuxtData()
  refresh()
}
</script>

<template>
  <div v-if="pending" class="p-4 space-y-4">
    <USkeleton v-for="i in 4" :key="i" class="h-32 rounded-xl" />
  </div>

  <div v-else class="p-4 space-y-4 pb-8">
    <!-- Row 1: Customer + Car -->
    <div class="grid grid-cols-2 gap-3">
      <!-- Customer Card -->
      <UCard>
        <template #header>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t('visit.customer') }}</span>
        </template>
        <div v-if="customer" class="space-y-1">
          <p class="font-semibold text-sm">{{ customer.name }}</p>
          <p v-if="customer.email" class="text-xs text-gray-500">{{ customer.email }}</p>
          <p v-if="customer.phoneNo" class="text-xs text-gray-500">{{ customer.phoneNo }}</p>
        </div>
        <div v-else>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-plus-circle"
            variant="soft"
            size="xs"
            block
            @click="showCustomerForm = true"
          >
            {{ t('visit.addCustomer') }}
          </UButton>
        </div>
      </UCard>

      <!-- Car Card -->
      <UCard>
        <template #header>
          <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">{{ t('visit.car') }}</span>
        </template>
        <div v-if="car">
          <p class="font-semibold text-sm">{{ car.brand }} {{ car.make }}</p>
          <p class="text-xs text-gray-500">{{ car.engineSize }}</p>
          <p v-if="licensePlate" class="text-xs font-mono text-gray-700 mt-1">{{ licensePlate }}</p>
        </div>
        <div v-else>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-plus-circle"
            variant="soft"
            size="xs"
            block
            @click="showCarFlow = true"
          >
            {{ t('visit.addCar') }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Jobs Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ t('visit.jobs') }}</span>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            @click="showJobSelector = true"
          />
        </div>
      </template>

      <div v-if="!visitJobs.length" class="text-sm text-gray-400 italic py-2">
        {{ t('visit.noJobs') }}
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="job in visitJobs"
          :key="job.id"
          class="flex items-center justify-between text-sm py-1"
        >
          <span class="flex-1">{{ job.name }}</span>
          <span class="text-gray-500 mr-3">{{ job.labourHours }}h</span>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            @click="removeJob(job.id)"
          />
        </div>
        <div class="flex justify-between text-xs text-gray-500 pt-1 border-t">
          <span>{{ t('visit.totalHours') }}</span>
          <span>{{ visitJobs.reduce((s: number, j: any) => s + Number(j.labourHours), 0).toFixed(2) }}h</span>
        </div>
      </div>
    </UCard>

    <!-- Parts Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ t('visit.parts') }}</span>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            @click="showPartOptions = true"
          />
        </div>
      </template>

      <div v-if="!visitParts.length" class="text-sm text-gray-400 italic py-2">
        {{ t('visit.noParts') }}
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="part in visitParts"
          :key="part.id"
          class="flex items-center justify-between text-sm py-1"
        >
          <div class="flex-1 min-w-0">
            <div class="truncate">{{ part.name }}</div>
            <div v-if="part.partNo" class="text-xs text-gray-400">{{ part.partNo }}</div>
          </div>
          <span class="ml-2 text-gray-600">€{{ (Number(part.unitCost) * (part.quantity || 1)).toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-xs text-gray-500 pt-1 border-t">
          <span>{{ t('common.total') }}</span>
          <span>€{{ partsTotal.toFixed(2) }}</span>
        </div>
      </div>
    </UCard>

    <!-- Charges Card -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-semibold">{{ t('visit.charges') }}</span>
          <UButton
            v-if="!isLocked"
            icon="i-lucide-plus"
            size="xs"
            variant="ghost"
            @click="showChargeSelector = true"
          />
        </div>
      </template>

      <div v-if="!visitCharges.length" class="text-sm text-gray-400 italic py-2">
        {{ t('visit.noCharges') }}
      </div>
      <div v-else class="space-y-1">
        <div
          v-for="charge in visitCharges"
          :key="charge.id"
          class="flex justify-between text-sm py-1"
        >
          <span>{{ charge.name }}</span>
          <span>€{{ Number(charge.price).toFixed(2) }}</span>
        </div>
        <div class="flex justify-between text-xs text-gray-500 pt-1 border-t">
          <span>{{ t('common.total') }}</span>
          <span>€{{ chargesTotal.toFixed(2) }}</span>
        </div>
      </div>
    </UCard>

    <!-- Summary Card -->
    <UCard>
      <template #header>
        <span class="font-semibold">{{ t('visit.summary') }}</span>
      </template>
      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">{{ t('visit.parts') }} + {{ partsMarkup }}% markup</span>
          <span>€{{ partsWithMarkup.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">
            {{ t('visit.labour') }}
            ({{ visitJobs.reduce((s: number, j: any) => s + Number(j.labourHours), 0).toFixed(2) }}h @ €{{ hourlyRate }}/h)
          </span>
          <span>€{{ labourTotal.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">{{ t('visit.charges') }}</span>
          <span>€{{ chargesTotal.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">VAT ({{ vatRate }}%)</span>
          <span>€{{ vatAmount.toFixed(2) }}</span>
        </div>
        <div class="flex justify-between font-bold text-base pt-2 border-t">
          <span>{{ t('common.total') }}</span>
          <span>€{{ grandTotal.toFixed(2) }}</span>
        </div>
      </div>
    </UCard>

    <!-- Invoice card (if generated) -->
    <UCard v-if="invoice">
      <template #header>
        <span class="font-semibold">{{ t('visit.invoice') }}</span>
      </template>
      <div class="space-y-3">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">{{ t('invoice.status') }}</span>
          <UBadge :color="invoice.paidAt ? 'success' : 'warning'">
            {{ invoice.paidAt ? t('invoice.paid') : t('invoice.pending') }}
          </UBadge>
        </div>
        <div class="flex gap-2 flex-wrap">
          <UButton
            v-if="invoice.stripePaymentLink"
            :to="invoice.stripePaymentLink"
            target="_blank"
            icon="i-lucide-link"
            size="sm"
            variant="outline"
          >
            {{ t('invoice.paymentLink') }}
          </UButton>
          <UButton icon="i-lucide-printer" size="sm" variant="outline" @click="$router.push(`/visits/${visitId}/invoice`)">
            {{ t('invoice.print') }}
          </UButton>
          <UButton
            v-if="!invoice.paidAt"
            icon="i-lucide-check"
            size="sm"
            color="success"
            @click="markPaid"
          >
            {{ t('invoice.markPaid') }}
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Action buttons -->
    <div v-if="!isLocked" class="space-y-2">
      <UButton
        v-if="visit?.status === 'in_progress'"
        block
        size="lg"
        color="warning"
        variant="soft"
        icon="i-lucide-check-circle"
        @click="markComplete"
      >
        {{ t('visit.markComplete') }}
      </UButton>
      <UButton
        v-if="visit?.status === 'complete' && !invoice"
        block
        size="lg"
        icon="i-lucide-file-text"
        @click="generateInvoice"
      >
        {{ t('visit.generateInvoice') }}
      </UButton>
    </div>
  </div>

  <!-- Car Lookup Modal -->
  <VisitsCarLookup
    v-if="showCarFlow"
    :visit-id="visitId"
    @close="showCarFlow = false"
    @saved="refresh(); showCarFlow = false"
  />

  <!-- Customer Form Modal -->
  <VisitsCustomerForm
    v-if="showCustomerForm"
    :visit-id="visitId"
    @close="showCustomerForm = false"
    @saved="refresh(); showCustomerForm = false"
  />

  <!-- Job Selector Modal -->
  <VisitsJobSelector
    v-if="showJobSelector"
    :visit-id="visitId"
    :car="car"
    @close="showJobSelector = false"
    @saved="refresh(); showJobSelector = false"
  />

  <!-- Part Add Modal -->
  <PartsAddOptions
    v-if="showPartOptions"
    :visit-id="visitId"
    @close="showPartOptions = false"
    @saved="refresh(); showPartOptions = false"
  />

  <!-- Charge Selector -->
  <VisitsChargeSelector
    v-if="showChargeSelector"
    :visit-id="visitId"
    @close="showChargeSelector = false"
    @saved="refresh(); showChargeSelector = false"
  />
</template>
