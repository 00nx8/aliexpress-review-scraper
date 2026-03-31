<script setup lang="ts">
interface VisitCard {
  id: number
  status: 'in_progress' | 'complete' | 'invoiced'
  customer: { name: string } | null
  licensePlate: string | null
  vehicle: { brand: string | null; make: string | null; engineSize: string | null; year: string | null } | null
  jobs: string[]
  moreJobs: number
  totalCost: number
}

const { t } = useI18n()
const activeFilter = useState('visitFilter', () => 'all')

const { data: visits, pending, refresh } = await useFetch<VisitCard[]>('/api/visits', {
  query: computed(() => ({ status: activeFilter.value === 'all' ? undefined : activeFilter.value })),
  watch: [activeFilter]
})

onMounted(() => refresh())

async function startJob() {
  const visit = await $fetch('/api/visits', { method: 'POST' })
  await navigateTo(`/visits/${(visit as any).id}`)
}

type BadgeColor = 'info' | 'warning' | 'success' | 'neutral'
function statusColor(status: string): BadgeColor {
  const map: Record<string, BadgeColor> = {
    'in_progress': 'info',
    'complete': 'warning',
    'invoiced': 'success'
  }
  return map[status] ?? 'neutral'
}
</script>

<template>
  <div class="p-4 space-y-4">
    <UButton
      size="lg"
      block
      icon="i-lucide-plus"
      @click="startJob"
    >
      {{ t('visits.startJob') }}
    </UButton>

    <div v-if="pending" class="space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-28 rounded-xl" />
    </div>

    <div v-else-if="!visits?.length" class="text-center py-12 text-gray-400">
      <UIcon name="i-lucide-clipboard-list" class="size-12 mx-auto mb-3" />
      <p>{{ t('visits.noJobs') }}</p>
    </div>

    <div v-else class="space-y-3">
      <NuxtLink
        v-for="visit in visits"
        :key="visit.id"
        :to="`/visits/${visit.id}`"
        class="block"
      >
        <UCard class="hover:shadow-md transition-shadow cursor-pointer">
          <div class="flex justify-between items-start">
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-sm truncate">
                {{ visit.vehicle?.brand }} {{ visit.vehicle?.make }}
                <span v-if="visit.vehicle?.engineSize" class="text-gray-400 font-normal">({{ visit.vehicle.engineSize }})</span>
              </div>
              <div v-if="visit.licensePlate" class="text-xs text-gray-500 font-mono mt-0.5">
                {{ visit.licensePlate }}
              </div>
              <div v-else class="text-xs text-gray-400 italic">
                {{ t('visits.noCarAdded') }}
              </div>
            </div>
            <div class="flex flex-col items-end gap-1 ml-3">
              <UBadge :color="statusColor(visit.status)" variant="subtle" size="xs">
                {{ t(`status.${visit.status}`) }}
              </UBadge>
            </div>
          </div>

          <div class="flex justify-between items-end mt-3">
            <div class="text-xs text-gray-500 space-y-0.5">
              <div v-for="(job, i) in visit.jobs" :key="i" class="truncate max-w-48">
                {{ job }}
              </div>
              <div v-if="visit.moreJobs > 0" class="text-primary">+{{ visit.moreJobs }} {{ t('common.more') }}</div>
              <div v-if="!visit.jobs?.length" class="italic">{{ t('visits.noJobsAdded') }}</div>
            </div>
            <div class="font-semibold text-sm">
              €{{ visit.totalCost?.toFixed(2) || '0.00' }}
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
