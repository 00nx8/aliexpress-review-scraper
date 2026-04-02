<script setup lang="ts">
const { t } = useI18n()
const search = ref('')
const selectedTemplate = ref<any>(null)

const { data: templates } = await useFetch<any[]>('/api/reference/car-templates', {
  query: computed(() => ({ search: search.value })),
  watch: [search]
})

const { data: fluids } = await useFetch<any[]>('/api/reference/fluids', {
  query: computed(() => ({ templateId: selectedTemplate.value?.id, search: search.value })),
  watch: [selectedTemplate]
})
</script>

<template>
  <div class="p-4 space-y-4">
    <UInput v-model="search" :placeholder="t('common.searchCars')" icon="i-lucide-search" class="w-full" />

    <div v-if="!selectedTemplate" class="space-y-2">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ t('reference.selectCar') }}</h2>
      <div class="space-y-1">
        <button
          v-for="tpl in templates"
          :key="tpl.id"
          class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
          @click="search = ''; selectedTemplate = tpl"
        >
          <div class="font-medium">{{ tpl.brand }} {{ tpl.make }}</div>
          <div class="text-xs text-gray-400">{{ tpl.engineSize }} · {{ tpl.minYear }}–{{ tpl.maxYear || 'present' }} · {{ tpl.fuelType }}</div>
        </button>
      </div>
    </div>

    <div v-else class="space-y-3">
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="xs" @click="selectedTemplate = null; search = ''" />
        <div>
          <div class="font-semibold">{{ selectedTemplate.brand }} {{ selectedTemplate.make }}</div>
          <div class="text-xs text-gray-500">{{ selectedTemplate.engineSize }}</div>
        </div>
      </div>

      <UInput v-model="search" :placeholder="t('common.searchFluids')" icon="i-lucide-search" class="w-full" />

      <div v-if="!fluids?.length" class="text-center py-8 text-gray-400">
        <UIcon name="i-lucide-droplets" class="size-10 mx-auto mb-2" />
        {{ t('reference.noFluids') }}
      </div>

      <div v-else class="space-y-2">
        <UCard v-for="f in fluids" :key="f.id" class="p-3">
          <div class="font-semibold text-sm">{{ f.systemName }}</div>
          <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">{{ f.type }}</div>
          <div v-if="f.spec" class="text-xs text-gray-500">{{ f.spec }}</div>
          <div class="flex gap-4 mt-2 text-xs text-gray-500">
            <span v-if="f.liters">{{ f.liters }}L</span>
            <span v-if="f.intervalKm">Every {{ f.intervalKm.toLocaleString() }}km</span>
          </div>
          <div v-if="f.notes" class="text-xs text-gray-400 mt-1 italic">{{ f.notes }}</div>
        </UCard>
      </div>
    </div>
  </div>
</template>
