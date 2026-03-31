<script setup lang="ts">
const props = defineProps<{ visitId: number; car?: any }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()

const search = ref('')
const loading = ref(false)
const saving = ref(false)

const { data: grouped, refresh } = await useFetch(`/api/visits/${props.visitId}/jobs-available`, {
  query: computed(() => ({ search: search.value })),
  watch: [search]
})

async function addJob(jobId: number) {
  saving.value = true
  try {
    await $fetch(`/api/visits/${props.visitId}/jobs`, {
      method: 'POST',
      body: { jobId }
    })
    emit('saved')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal :open="true" @close="emit('close')">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">{{ t('visit.addJob') }}</h3>
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="emit('close')" />
          </div>
          <UInput v-model="search" :placeholder="t('common.search')" icon="i-lucide-search" class="mt-3" />
        </template>

        <div v-if="!props.car" class="py-8 text-center text-sm text-gray-400 px-4">
          <UIcon name="i-lucide-car" class="size-8 mx-auto mb-2 opacity-40" />
          {{ t('visit.addCarFirst') }}
        </div>

        <div v-else class="overflow-y-auto flex-1 min-h-0 space-y-4 py-2" style="max-height: 60vh">
          <div v-for="(jobList, category) in grouped" :key="category">
            <div class="text-xs font-semibold uppercase text-gray-400 tracking-wide mb-1 px-1">{{ category }}</div>
            <div class="space-y-1">
              <button
                v-for="job in jobList"
                :key="job.id"
                class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:border-primary hover:bg-primary/5 transition-colors text-sm"
                :disabled="saving"
                @click="addJob(job.id)"
              >
                <div class="flex justify-between">
                  <span>{{ job.name }}</span>
                  <span class="text-gray-500 shrink-0 ml-2">{{ job.labourHours }}h</span>
                </div>
              </button>
            </div>
          </div>
          <div v-if="!grouped || !Object.keys(grouped).length" class="text-center py-8 text-gray-400 text-sm">
            {{ t('common.noResults') }}
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
