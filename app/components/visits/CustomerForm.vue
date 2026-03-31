<script setup lang="ts">
const props = defineProps<{ visitId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()

const name = ref('')
const email = ref('')
const phone = ref('')
const selectedCustomerId = ref<number | null>(null)
const loading = ref(false)
const error = ref('')
const suggestions = ref<any[]>([])
const showSuggestions = ref(false)

async function searchCustomers() {
  selectedCustomerId.value = null
  if (name.value.length < 2) { suggestions.value = []; return }
  const res = await $fetch<any[]>('/api/customers', { query: { search: name.value } })
  suggestions.value = res
  showSuggestions.value = res.length > 0
}

function hideSuggestions() {
  setTimeout(() => { showSuggestions.value = false }, 200)
}

function selectSuggestion(c: any) {
  selectedCustomerId.value = c.id
  name.value = c.name
  email.value = c.email || ''
  phone.value = c.phoneNo || ''
  showSuggestions.value = false
}

async function save() {
  if (!name.value) return
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/customers', {
      method: 'POST',
      body: {
        name: name.value,
        email: email.value,
        phoneNo: phone.value,
        visitId: props.visitId,
        existingCustomerId: selectedCustomerId.value
      }
    })
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.message || t('common.error')
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
            <h3 class="font-semibold">{{ t('visit.addCustomer') }}</h3>
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="emit('close')" />
          </div>
        </template>

        <form class="space-y-4" @submit.prevent="save">
          <div class="relative">
            <UFormField :label="t('customer.name')">
              <UInput v-model="name" required class="w-full" @input="searchCustomers" @blur="hideSuggestions" />
            </UFormField>
            <div
              v-if="showSuggestions"
              class="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden"
            >
              <button
                v-for="s in suggestions"
                :key="s.id"
                type="button"
                class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                @click="selectSuggestion(s)"
              >
                {{ s.name }}
              </button>
            </div>
          </div>

          <UFormField :label="t('customer.email')">
            <UInput v-model="email" type="email" class="w-full" />
          </UFormField>
          <UFormField :label="t('customer.phone')">
            <UInput v-model="phone" type="tel" class="w-full" />
          </UFormField>

          <UAlert v-if="error" color="error" :description="error" />

          <div class="flex gap-2">
            <UButton variant="outline" class="flex-1" @click="emit('close')">{{ t('common.cancel') }}</UButton>
            <UButton type="submit" :loading="loading" class="flex-1">{{ t('common.save') }}</UButton>
          </div>
        </form>
      </UCard>
    </template>
  </UModal>
</template>
