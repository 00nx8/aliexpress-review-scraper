<script setup lang="ts">
const props = defineProps<{ visitId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()

const search = ref('')
const saving = ref(false)
const showCreate = ref(false)
const newName = ref('')
const newPrice = ref('')
const newDesc = ref('')

const { data: templates } = await useFetch<any[]>('/api/charges', {
  query: computed(() => ({ search: search.value })),
  watch: [search]
})

async function addCharge(template: any) {
  saving.value = true
  try {
    await $fetch(`/api/visits/${props.visitId}/charges`, {
      method: 'POST',
      body: { chargeTemplateId: template.id, name: template.name, price: template.price }
    })
    emit('saved')
  } finally {
    saving.value = false
  }
}

async function createAndAdd() {
  if (!newName.value) return
  saving.value = true
  try {
    const ct = await $fetch<any>('/api/charges', {
      method: 'POST',
      body: { name: newName.value, price: newPrice.value, description: newDesc.value }
    })
    await $fetch(`/api/visits/${props.visitId}/charges`, {
      method: 'POST',
      body: { chargeTemplateId: ct.id, name: ct.name, price: ct.price }
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
            <h3 class="font-semibold">{{ t('visit.addCharge') }}</h3>
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="emit('close')" />
          </div>
          <UInput v-model="search" :placeholder="t('common.search')" icon="i-lucide-search" class="mt-3" />
        </template>

        <div class="space-y-1 max-h-60 overflow-y-auto">
          <button
            v-for="tmpl in templates"
            :key="tmpl.id"
            class="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 hover:border-primary hover:bg-primary/5 text-sm transition-colors"
            :disabled="saving"
            @click="addCharge(tmpl)"
          >
            <div class="flex justify-between">
              <span>{{ tmpl.name }}</span>
              <span class="text-gray-500">€{{ Number(tmpl.price).toFixed(2) }}</span>
            </div>
          </button>
          <div v-if="!templates?.length" class="text-center py-4 text-gray-400 text-sm">{{ t('common.noResults') }}</div>
        </div>

        <div class="mt-4 pt-4 border-t">
          <UButton v-if="!showCreate" variant="ghost" size="sm" icon="i-lucide-plus" block @click="showCreate = true">
            {{ t('charges.createNew') }}
          </UButton>
          <div v-else class="space-y-3">
            <UFormField :label="$t('charges.name')">
              <UInput v-model="newName" class="w-full" />
            </UFormField>
            <UFormField :label="$t('charges.price')">
              <UInput v-model="newPrice" type="number" step="0.01" class="w-full" />
            </UFormField>
            <div class="flex gap-2">
              <UButton variant="outline" size="sm" class="flex-1" @click="showCreate = false">{{ $t('common.cancel') }}</UButton>
              <UButton size="sm" class="flex-1" :loading="saving" @click="createAndAdd">{{ $t('common.save') }}</UButton>
            </div>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
