<script setup lang="ts">
const { t } = useI18n()

const { data, refresh } = await useFetch('/api/settings')

const email = ref('')
const phone = ref('')
const garageName = ref('')
const garageEmail = ref('')
const garagePhone = ref('')
const garageAddress = ref('')
const hourlyRate = ref('')
const partsMarkup = ref('')
const vatRate = ref('')
const saving = ref(false)
const saved = ref(false)

watch(data, (d) => {
  if (!d) return
  email.value = d.user?.email || ''
  phone.value = d.user?.phoneNo || ''
  hourlyRate.value = d.user?.hourlyRate || '50'
  partsMarkup.value = d.user?.partsMarkup || '0'
  vatRate.value = d.user?.vatRate || '0'
  if (d.garage) {
    garageName.value = d.garage.name || ''
    garageEmail.value = d.garage.email || ''
    garagePhone.value = d.garage.phoneNo || ''
    garageAddress.value = d.garage.address || ''
  }
}, { immediate: true })

async function save() {
  saving.value = true
  try {
    await $fetch('/api/settings', {
      method: 'PATCH',
      body: {
        phoneNo: phone.value,
        hourlyRate: hourlyRate.value,
        partsMarkup: partsMarkup.value,
        vatRate: vatRate.value,
        garageName: garageName.value,
        garageEmail: garageEmail.value,
        garagePhone: garagePhone.value,
        garageAddress: garageAddress.value
      }
    })
    saved.value = true
    setTimeout(() => { saved.value = false }, 2000)
    refresh()
  } finally {
    saving.value = false
  }
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await navigateTo('/login')
}
</script>

<template>
  <div class="p-4 space-y-6">
    <!-- Account -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.account') }}</h2>
      <UCard class="space-y-4">
        <UFormField :label="t('auth.email')">
          <UInput :value="email" disabled class="w-full" />
        </UFormField>
        <UFormField :label="t('customer.phone')">
          <UInput v-model="phone" class="w-full" />
        </UFormField>
        <UButton variant="outline" size="sm" to="/forgot-password">
          {{ t('auth.forgotPassword') }}
        </UButton>
      </UCard>
    </div>

    <!-- Garage info -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.garage') }}</h2>
      <UCard class="space-y-4">
        <UFormField :label="t('settings.garageName')">
          <UInput v-model="garageName" class="w-full" />
        </UFormField>
        <UFormField :label="t('auth.email')">
          <UInput v-model="garageEmail" type="email" class="w-full" />
        </UFormField>
        <UFormField :label="t('customer.phone')">
          <UInput v-model="garagePhone" type="tel" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.address')">
          <UTextarea v-model="garageAddress" class="w-full" :rows="2" />
        </UFormField>
      </UCard>
    </div>

    <!-- Pricing -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.pricing') }}</h2>
      <UCard class="space-y-4">
        <UFormField :label="t('settings.hourlyRate') + ' (€)'">
          <UInput v-model="hourlyRate" type="number" step="0.01" min="0" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.partsMarkup') + ' (%)'">
          <UInput v-model="partsMarkup" type="number" step="0.1" min="0" max="100" class="w-full" />
        </UFormField>
        <UFormField :label="t('settings.vatRate') + ' (%)'">
          <UInput v-model="vatRate" type="number" step="0.1" min="0" max="100" class="w-full" />
        </UFormField>
      </UCard>
    </div>

    <div class="space-y-2">
      <UAlert v-if="saved" color="success" :description="t('common.saved')" />
      <UButton block :loading="saving" @click="save">{{ t('common.save') }}</UButton>
      <UButton block variant="outline" color="error" @click="logout">{{ t('auth.logout') }}</UButton>
    </div>
  </div>
</template>
