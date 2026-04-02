<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const route = useRoute()
const visitId = Number(route.params.id)

const { data: visitData } = await useFetch(`/api/visits/${visitId}`)
const { data: settingsData } = await useFetch('/api/settings')

const visit = computed(() => visitData.value?.visit)
const customer = computed(() => visitData.value?.customer)
const licensePlate = computed(() => visitData.value?.licensePlate)
const car = computed(() => visitData.value?.car as any)
const jobs = computed(() => visitData.value?.jobs ?? [])
const parts = computed(() => visitData.value?.parts ?? [])
const charges = computed(() => visitData.value?.charges ?? [])
const invoice = computed(() => visitData.value?.invoice as any)
const garage = computed(() => settingsData.value?.garage)
const settings = computed(() => settingsData.value?.user)

const hourlyRate = computed(() => Number(settings.value?.hourlyRate) || 50)
const partsMarkup = computed(() => Number(settings.value?.partsMarkup) || 0)
const vatRate = computed(() => Number(settings.value?.vatRate) || 0)

const partsTotal = computed(() => parts.value.reduce((s: number, p: any) => s + Number(p.unitCost) * (p.quantity || 1), 0))
const partsWithMarkup = computed(() => partsTotal.value * (1 + partsMarkup.value / 100))
const labourTotal = computed(() => jobs.value.reduce((s: number, j: any) => s + Number(j.labourHours), 0) * hourlyRate.value)
const chargesTotal = computed(() => charges.value.reduce((s: number, c: any) => s + Number(c.price), 0))
const subtotal = computed(() => partsWithMarkup.value + labourTotal.value + chargesTotal.value)
const vatAmount = computed(() => subtotal.value * (vatRate.value / 100))
const grandTotal = computed(() => subtotal.value + vatAmount.value)

const invoiceDate = computed(() => {
  const d = invoice.value?.createdAt ? new Date(invoice.value.createdAt) : new Date()
  return d.toLocaleDateString()
})

function print() {
  window.print()
}
</script>

<template>
  <div class="min-h-screen bg-white text-gray-900">
    <!-- Print toolbar (hidden on print) -->
    <div class="no-print flex items-center justify-between px-6 py-3 bg-gray-100 border-b">
      <NuxtLink :to="`/visits/${visitId}`" class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <UIcon name="i-lucide-arrow-left" class="size-4" />
        Back
      </NuxtLink>
      <UButton icon="i-lucide-printer" size="sm" @click="print">{{ t('invoice.print') }}</UButton>
    </div>

    <div class="max-w-3xl mx-auto px-8 py-10 space-y-8">
      <!-- Header -->
      <div class="flex justify-between items-start">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <UIcon name="i-lucide-wrench" class="size-6 text-primary" />
            <span class="text-xl font-bold">{{ garage?.name || 'Wrenko' }}</span>
          </div>
          <div v-if="garage?.address" class="text-sm text-gray-500 whitespace-pre-line">{{ garage.address }}</div>
          <div v-if="garage?.email" class="text-sm text-gray-500">{{ garage.email }}</div>
          <div v-if="garage?.phoneNo" class="text-sm text-gray-500">{{ garage.phoneNo }}</div>
        </div>
        <div class="text-right">
          <h1 class="text-3xl font-bold text-gray-800">{{ t('invoice.invoiceNo') }} #{{ invoice?.prefix || 'INV' }}-{{ invoice?.invoiceNo || '—' }}</h1>
          <p class="text-sm text-gray-500 mt-1">{{ t('invoice.date') }}: {{ invoiceDate }}</p>
          <UBadge :color="invoice?.paidAt ? 'success' : 'warning'" class="mt-2">
            {{ invoice?.paidAt ? t('invoice.paid') : t('invoice.pending') }}
          </UBadge>
        </div>
      </div>

      <!-- Bill To + Vehicle -->
      <div class="grid grid-cols-2 gap-6">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{{ t('invoice.billTo') }}</p>
          <div v-if="customer" class="space-y-0.5">
            <p class="font-semibold">{{ customer.name }}</p>
            <p v-if="customer.email" class="text-sm text-gray-600">{{ customer.email }}</p>
            <p v-if="customer.phoneNo" class="text-sm text-gray-600">{{ customer.phoneNo }}</p>
          </div>
          <p v-else class="text-sm text-gray-400 italic">—</p>
        </div>
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{{ t('invoice.vehicle') }}</p>
          <div v-if="car" class="space-y-0.5">
            <p class="font-semibold">{{ car.brand }} {{ car.make }}</p>
            <p class="text-sm text-gray-600">{{ car.year }} · {{ car.engineSize }}</p>
            <p v-if="licensePlate" class="text-sm font-mono text-gray-600">{{ licensePlate }}</p>
          </div>
          <p v-else class="text-sm text-gray-400 italic">—</p>
        </div>
      </div>

      <!-- Labour -->
      <div v-if="jobs.length">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{{ t('invoice.labour') }}</p>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 font-medium text-gray-500">{{ t('invoice.description') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.hours') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.rate') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id" class="border-b border-gray-100">
              <td class="py-2">{{ job.name }}</td>
              <td class="text-right py-2">{{ job.labourHours }}h</td>
              <td class="text-right py-2">€{{ hourlyRate }}/h</td>
              <td class="text-right py-2">€{{ (Number(job.labourHours) * hourlyRate).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Parts -->
      <div v-if="parts.length">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
          {{ t('invoice.parts') }}<span v-if="partsMarkup > 0" class="ml-1 font-normal text-gray-400">(+{{ partsMarkup }}% markup)</span>
        </p>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 font-medium text-gray-500">{{ t('invoice.description') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.qty') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.unitPrice') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="part in parts" :key="part.id" class="border-b border-gray-100">
              <td class="py-2">
                {{ part.name }}
                <span v-if="part.partNo" class="text-gray-400 text-xs ml-1">{{ part.partNo }}</span>
              </td>
              <td class="text-right py-2">{{ part.quantity || 1 }}</td>
              <td class="text-right py-2">€{{ Number(part.unitCost).toFixed(2) }}</td>
              <td class="text-right py-2">€{{ (Number(part.unitCost) * (part.quantity || 1)).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Charges -->
      <div v-if="charges.length">
        <p class="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{{ t('invoice.charges') }}</p>
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-2 font-medium text-gray-500">{{ t('invoice.description') }}</th>
              <th class="text-right py-2 font-medium text-gray-500">{{ t('invoice.amount') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="charge in charges" :key="charge.id" class="border-b border-gray-100">
              <td class="py-2">{{ charge.name }}</td>
              <td class="text-right py-2">€{{ Number(charge.price).toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div class="flex justify-end">
        <div class="w-64 space-y-1 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-500">{{ t('invoice.subtotal') }}</span>
            <span>€{{ subtotal.toFixed(2) }}</span>
          </div>
          <div v-if="vatRate > 0" class="flex justify-between">
            <span class="text-gray-500">{{ t('invoice.vat') }} ({{ vatRate }}%)</span>
            <span>€{{ vatAmount.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
            <span>{{ t('invoice.total') }}</span>
            <span>€{{ grandTotal.toFixed(2) }}</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t pt-4 text-center text-sm text-gray-400">
        {{ t('invoice.thankYou') }}
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  .no-print { display: none !important; }
  body { background: white; }
}
</style>
