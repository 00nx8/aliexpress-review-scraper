<script setup lang="ts">
const props = defineProps<{ visitId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()
const { user } = useUserSession()
const linkPreviousCustomer = ref(true)

const plate = ref('')
const country = ref((user.value as any)?.billingCountry?.toLowerCase() || 'uk')
const loading = ref(false)
const result = ref<any>(null)
const error = ref('')
const selectedTemplate = ref<any>(null)

const countries = [
  { label: 'UK', value: 'uk' },
  { label: 'Ireland', value: 'ie' },
  { label: 'Netherlands', value: 'nl' }
]

async function lookup() {
  if (!plate.value) return
  error.value = ''
  loading.value = true
  result.value = null
  try {
    result.value = await $fetch('/api/cars/lookup', {
      method: 'POST',
      body: { plate: plate.value, country: country.value }
    })
  } catch (e: any) {
    error.value = e?.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}

async function saveExisting() {
  loading.value = true
  try {
    await $fetch('/api/cars/save', {
      method: 'POST',
      body: {
        visitId: props.visitId,
        plate: plate.value,
        source: 'existing',
        existingLicensePlateId: result.value.licensePlateId,
        linkCustomerId: (linkPreviousCustomer.value && result.value.previousCustomer?.id) ? result.value.previousCustomer.id : null
      }
    })
    emit('saved')
  } finally {
    loading.value = false
  }
}

async function saveNl() {
  loading.value = true
  try {
    await $fetch('/api/cars/save', {
      method: 'POST',
      body: {
        visitId: props.visitId,
        plate: plate.value,
        source: 'nl',
        raw: result.value.raw
      }
    })
    emit('saved')
  } finally {
    loading.value = false
  }
}

async function saveUk() {
  if (!selectedTemplate.value) return
  loading.value = true
  try {
    await $fetch('/api/cars/save', {
      method: 'POST',
      body: {
        visitId: props.visitId,
        plate: plate.value,
        source: 'uk',
        raw: result.value.raw,
        templateId: selectedTemplate.value.id
      }
    })
    emit('saved')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="true" @close="emit('close')">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">{{ t('car.lookupTitle') }}</h3>
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="emit('close')" />
          </div>
        </template>

        <div class="space-y-4">
          <div class="flex gap-2">
            <USelect v-model="country" :items="countries" class="w-28" />
            <UInput
              v-model="plate"
              :placeholder="t('car.platePlaceholder')"
              class="flex-1 font-mono uppercase"
              @input="plate = plate.toUpperCase()"
              @keyup.enter="lookup"
            />
            <UButton :loading="loading" icon="i-lucide-search" @click="lookup" />
          </div>

          <UAlert v-if="error" color="error" :description="error" />

          <!-- Existing plate already in system -->
          <div v-if="result?.type === 'existing'" class="space-y-3">
            <div class="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1 text-sm">
              <div class="font-semibold">{{ result.vehicle?.data?.brand }} {{ result.vehicle?.data?.make }}</div>
              <div class="text-gray-500">{{ result.vehicle?.data?.year }} · {{ result.vehicle?.data?.engineSize }}</div>
            </div>
            <div v-if="result.previousCustomer" class="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm">
              <UCheckbox v-model="linkPreviousCustomer" />
              <div>
                <div class="font-medium">{{ result.previousCustomer.name }}</div>
                <div class="text-xs text-gray-400">{{ t('car.linkPreviousCustomer') }}</div>
              </div>
            </div>
            <UButton block :loading="loading" @click="saveExisting">{{ t('car.linkAndSave') }}</UButton>
          </div>

          <!-- NL result -->
          <div v-if="result?.type === 'nl_new'" class="space-y-3">
            <div class="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1 text-sm">
              <div class="font-semibold">{{ result.preview.brand }} {{ result.preview.make }}</div>
              <div class="text-gray-500">{{ result.preview.year }} · {{ result.preview.engineSize }} · {{ result.preview.fuelType }}</div>
              <div class="text-gray-500">{{ result.preview.color }}</div>
            </div>
            <UButton block :loading="loading" @click="saveNl">{{ t('car.confirmAndSave') }}</UButton>
          </div>

          <!-- UK result with template selection -->
          <div v-if="result?.type === 'uk_new'" class="space-y-3">
            <div class="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 space-y-1 text-sm">
              <div class="font-semibold">{{ result.preview.brand }}</div>
              <div class="text-gray-500">{{ result.preview.year }} · {{ result.preview.engineCc }}cc · {{ result.preview.fuelType }}</div>
            </div>

            <div v-if="result.templates?.length" class="space-y-2">
              <p class="text-sm font-medium">{{ t('car.selectTemplate') }}</p>
              <div class="space-y-1 max-h-48 overflow-y-auto">
                <button
                  v-for="tpl in result.templates"
                  :key="tpl.id"
                  class="w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors"
                  :class="selectedTemplate?.id === tpl.id ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'"
                  @click="selectedTemplate = tpl"
                >
                  <div class="font-medium">{{ tpl.brand }} {{ tpl.make }}</div>
                  <div class="text-xs text-gray-500">{{ tpl.engineSize }} · {{ tpl.minYear }}–{{ tpl.maxYear || 'present' }}</div>
                </button>
              </div>
              <UButton block :loading="loading" :disabled="!selectedTemplate" @click="saveUk">
                {{ t('car.confirmAndSave') }}
              </UButton>
            </div>
            <UAlert v-else color="warning" :description="t('car.noTemplatesFound')" />
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
