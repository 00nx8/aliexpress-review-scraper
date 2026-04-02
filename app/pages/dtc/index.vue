<script setup lang="ts">
const { t } = useI18n()
const search = ref('')
const selectedTemplate = ref<any>(null)
const selectedCode = ref<any>(null)

const { data: templates } = await useFetch<any[]>('/api/reference/car-templates', {
  query: computed(() => ({ search: selectedTemplate.value ? '' : search.value })),
  watch: [search]
})

const { data: codes } = await useFetch<any[]>('/api/reference/dtc', {
  query: computed(() => ({ search: selectedTemplate.value ? search.value : '', templateId: selectedTemplate.value?.id })),
  watch: [search, selectedTemplate]
})

type BadgeColor = 'error' | 'warning' | 'info' | 'neutral'
function severityColor(s: string): BadgeColor {
  const map: Record<string, BadgeColor> = { high: 'error', moderate: 'warning', low: 'info' }
  return map[s?.toLowerCase()] ?? 'neutral'
}

async function selectCode(code: any) {
  const full = await $fetch<any>(`/api/reference/dtc/${code.id}`)
  selectedCode.value = full
}
</script>

<template>
  <div class="p-4 space-y-4">
    <UInput v-model="search" :placeholder="selectedTemplate ? t('dtc.searchPlaceholder') : t('common.searchCars')" icon="i-lucide-search" class="w-full" />

    <!-- Code detail view -->
    <div v-if="selectedCode" class="space-y-3">
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="xs" @click="selectedCode = null" />
        <span class="font-bold font-mono text-lg">{{ selectedCode.code }}</span>
        <UBadge :color="severityColor(selectedCode.severity)" variant="subtle">{{ selectedCode.severity }}</UBadge>
      </div>
      <UCard>
        <div class="space-y-3">
          <div>
            <p class="text-sm font-semibold">{{ selectedCode.shortDescription }}</p>
            <p class="text-xs text-gray-500 mt-0.5">{{ selectedCode.categoryName }}</p>
          </div>
          <div v-if="selectedCode.description">
            <p class="text-xs font-semibold uppercase text-gray-400 mb-1">{{ t('dtc.description') }}</p>
            <p class="text-sm">{{ selectedCode.description }}</p>
          </div>
          <div v-if="selectedCode.symptoms?.length">
            <p class="text-xs font-semibold uppercase text-gray-400 mb-1">{{ t('dtc.symptoms') }}</p>
            <ul class="list-disc list-inside text-sm space-y-0.5">
              <li v-for="s in selectedCode.symptoms" :key="s">{{ s }}</li>
            </ul>
          </div>
          <div v-if="selectedCode.commonCauses?.length">
            <p class="text-xs font-semibold uppercase text-gray-400 mb-1">{{ t('dtc.commonCauses') }}</p>
            <ul class="list-disc list-inside text-sm space-y-0.5">
              <li v-for="c in selectedCode.commonCauses" :key="c">{{ c }}</li>
            </ul>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Car picker -->
    <div v-else-if="!selectedTemplate" class="space-y-2">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide">{{ t('reference.selectCar') }}</h2>
        <UButton variant="ghost" size="xs" @click="search = ''; selectedTemplate = { id: null }">{{ t('dtc.allCodes') }}</UButton>
      </div>
      <div class="space-y-1">
        <button
          v-for="tpl in templates"
          :key="tpl.id"
          class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm hover:border-primary hover:bg-primary/5 transition-colors"
          @click="search = ''; selectedTemplate = tpl"
        >
          <div class="font-medium">{{ tpl.brand }} {{ tpl.make }}</div>
          <div class="text-xs text-gray-400">{{ tpl.engineSize }} · {{ tpl.minYear }}–{{ tpl.maxYear || 'present' }}</div>
        </button>
      </div>
      <div v-if="!templates?.length" class="text-center py-8 text-gray-400 text-sm">{{ t('common.noResults') }}</div>
    </div>

    <!-- Code list -->
    <div v-else class="space-y-2">
      <div class="flex items-center gap-2">
        <UButton icon="i-lucide-arrow-left" variant="ghost" size="xs" @click="selectedTemplate = null; search = ''" />
        <div v-if="selectedTemplate.id" class="text-sm font-semibold">{{ selectedTemplate.brand }} {{ selectedTemplate.make }}</div>
        <div v-else class="text-sm font-semibold text-gray-500">{{ t('dtc.allCodes') }}</div>
      </div>

      <div v-if="!codes?.length" class="text-center py-8 text-gray-400">
        <UIcon name="i-lucide-alert-triangle" class="size-10 mx-auto mb-2" />
        {{ search ? t('common.noResults') : t('dtc.searchHint') }}
      </div>

      <button
        v-for="code in codes"
        :key="code.id"
        class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:border-primary hover:bg-primary/5 transition-colors"
        @click="selectCode(code)"
      >
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold">{{ code.code }}</span>
          <UBadge :color="severityColor(code.severity)" variant="subtle" size="xs">{{ code.severity }}</UBadge>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mt-0.5 truncate">{{ code.shortDescription }}</div>
        <div class="text-xs text-gray-400">{{ code.categoryName }}</div>
      </button>
    </div>
  </div>
</template>
