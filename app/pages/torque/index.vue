<script setup lang="ts">
const { t } = useI18n()
const search = ref('')
const selectedTemplate = ref<any>(null)

const { data: templates } = await useFetch<any[]>('/api/reference/car-templates', {
  query: computed(() => ({ search: search.value })),
  watch: [search]
})

const { data: specs } = await useFetch<any[]>('/api/reference/torque', {
  query: computed(() => ({ templateId: selectedTemplate.value?.id, search: search.value })),
  watch: [selectedTemplate]
})
</script>

<template>
  <div class="p-4 space-y-4">
    <UInput v-model="search" :placeholder="t('common.searchCars')" icon="i-lucide-search" class="w-full" />

    <div v-if="!selectedTemplate" class="space-y-1">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{{ t('reference.selectCar') }}</h2>
      <button
        v-for="tpl in templates"
        :key="tpl.id"
        class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
        @click="selectedTemplate = tpl"
      >
        <div class="font-medium">{{ tpl.brand }} {{ tpl.make }}</div>
        <div class="text-xs text-gray-400">{{ tpl.engineSize }} · {{ tpl.minYear }}–{{ tpl.maxYear || 'present' }}</div>
      </button>
    </div>

    <div v-else class="space-y-3">
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="xs" @click="selectedTemplate = null; search = ''" />
        <div>
          <div class="font-semibold">{{ selectedTemplate.brand }} {{ selectedTemplate.make }}</div>
          <div class="text-xs text-gray-500">{{ selectedTemplate.engineSize }}</div>
        </div>
      </div>

      <UInput v-model="search" :placeholder="t('common.searchComponent')" icon="i-lucide-search" class="w-full" />

      <div v-if="!specs?.length" class="text-center py-8 text-gray-400">
        <UIcon name="i-lucide-gauge" class="size-10 mx-auto mb-2" />
        {{ t('reference.noTorque') }}
      </div>

      <div v-else class="space-y-2">
        <UCard v-for="s in specs" :key="s.id">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold text-sm">{{ s.component }}</div>
              <div v-if="s.notes" class="text-xs text-gray-400 mt-0.5">{{ s.notes }}</div>
            </div>
            <div class="text-right">
              <div class="font-bold text-lg">{{ s.nm }} Nm</div>
              <div v-if="s.lbft" class="text-xs text-gray-400">{{ s.lbft }} lb·ft</div>
            </div>
          </div>
          <div class="flex gap-3 mt-2 text-xs">
            <UBadge v-if="s.isCritical" color="error" variant="subtle">Critical</UBadge>
            <span v-if="s.angleDegrees" class="text-gray-500">+{{ s.angleDegrees }}°</span>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
