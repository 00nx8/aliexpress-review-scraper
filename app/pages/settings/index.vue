<script setup lang="ts">
const { t, locale, setLocale } = useI18n()
const colorMode = useColorMode()
const router = useRouter()

const locales = [
  { label: 'English', value: 'en' },
  { label: 'Nederlands', value: 'nl' },
  { label: 'Română', value: 'ro' },
  { label: 'Polski', value: 'pl' },
  { label: 'Magyar', value: 'hu' },
  { label: 'Deutsch', value: 'de' },
  { label: 'Български', value: 'bg' },
  { label: 'Türkçe', value: 'tr' },
  { label: 'Français', value: 'fr' }
]
const { fetch: refreshSession } = useUserSession()

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
const confirmCancel = ref(false)
const cancelling = ref(false)
const showDeleteAccount = ref(false)
const deleteAccountEmail = ref('')
const deletingAccount = ref(false)
const deleteAccountError = ref('')

const subscriptionType = computed(() => data.value?.user?.subscriptionType)
const hasPaidPlan = computed(() => subscriptionType.value === 'freelance' || subscriptionType.value === 'business')
const planLabel = computed(() => {
  if (subscriptionType.value === 'trial') return t('settings.planTrial')
  if (subscriptionType.value === 'freelance') return t('subscribe.freelance')
  if (subscriptionType.value === 'business') return t('subscribe.business')
  return t('settings.planNone')
})
const planBadgeColor = computed(() => {
  if (subscriptionType.value === 'trial') return 'warning' as const
  if (subscriptionType.value === 'freelance' || subscriptionType.value === 'business') return 'primary' as const
  return 'neutral' as const
})

async function cancelSubscription() {
  cancelling.value = true
  try {
    await $fetch('/api/subscribe/cancel', { method: 'POST' })
    confirmCancel.value = false
    await refresh()
    await refreshSession()
  } finally {
    cancelling.value = false
  }
}

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

async function deleteAccount() {
  const userEmail = data.value?.user?.email || ''
  if (deleteAccountEmail.value !== userEmail) {
    deleteAccountError.value = t('settings.deleteAccountEmailMismatch')
    return
  }
  deletingAccount.value = true
  deleteAccountError.value = ''
  try {
    await $fetch('/api/auth/account', { method: 'DELETE' })
    await router.replace('/login')
  } catch (e: any) {
    deleteAccountError.value = e?.data?.message || t('common.error')
  } finally {
    deletingAccount.value = false
  }
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

    <!-- Language -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.language') }}</h2>
      <UCard>
        <USelect
          :model-value="locale"
          :items="locales"
          class="w-full"
          @update:model-value="setLocale($event)"
        />
      </UCard>
    </div>

    <!-- Appearance -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.appearance') }}</h2>
      <UCard>
        <div class="flex gap-2">
          <UButton
            v-for="mode in ['light', 'dark', 'system']"
            :key="mode"
            :variant="colorMode.preference === mode ? 'solid' : 'outline'"
            :color="colorMode.preference === mode ? 'primary' : 'neutral'"
            :icon="mode === 'light' ? 'i-lucide-sun' : mode === 'dark' ? 'i-lucide-moon' : 'i-lucide-monitor'"
            class="flex-1"
            @click="colorMode.preference = mode"
          >
            {{ t(`settings.${mode}`) }}
          </UButton>
        </div>
      </UCard>
    </div>

    <!-- Subscription -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.subscription') }}</h2>
      <UCard class="space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.currentPlan') }}</span>
          <UBadge :color="planBadgeColor" variant="subtle">{{ planLabel }}</UBadge>
        </div>
        <div v-if="confirmCancel" class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.cancelPlanConfirm') }}</p>
          <div class="flex gap-2">
            <UButton size="sm" color="error" :loading="cancelling" @click="cancelSubscription">{{ t('settings.cancelPlan') }}</UButton>
            <UButton size="sm" variant="outline" @click="confirmCancel = false">{{ t('common.cancel') }}</UButton>
          </div>
        </div>
        <div v-else class="flex gap-2 flex-wrap">
          <UButton v-if="hasPaidPlan" size="sm" variant="outline" to="/subscribe">{{ t('settings.changePlan') }}</UButton>
          <UButton v-if="!hasPaidPlan" size="sm" to="/subscribe">{{ t('settings.subscribe') }}</UButton>
          <UButton v-if="hasPaidPlan" size="sm" variant="outline" color="error" @click="confirmCancel = true">{{ t('settings.cancelPlan') }}</UButton>
        </div>
      </UCard>
    </div>

    <div class="space-y-2">
      <UAlert v-if="saved" color="success" :description="t('common.saved')" />
      <UButton block :loading="saving" @click="save">{{ t('common.save') }}</UButton>
      <UButton block variant="outline" color="error" @click="logout">{{ t('auth.logout') }}</UButton>
    </div>

    <!-- Privacy -->
    <div>
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{{ t('settings.yourPrivacy') }}</h2>
      <UCard>
        <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.privacyBody') }}</p>
      </UCard>
    </div>

    <!-- Danger Zone -->
    <div>
      <h2 class="text-sm font-semibold text-red-500 uppercase tracking-wide mb-3">{{ t('settings.dangerZone') }}</h2>
      <UCard class="border-red-200 dark:border-red-900">
        <div class="space-y-3">
          <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.deleteAccountWarning') }}</p>
          <UButton size="sm" color="error" variant="outline" @click="showDeleteAccount = !showDeleteAccount">
            {{ t('settings.deleteAccount') }}
          </UButton>
          <div v-if="showDeleteAccount" class="space-y-3 pt-2 border-t">
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ t('settings.deleteAccountConfirm') }}</p>
            <UInput v-model="deleteAccountEmail" type="email" :placeholder="data?.user?.email" class="w-full" />
            <UAlert v-if="deleteAccountError" color="error" :description="deleteAccountError" />
            <div class="flex gap-2">
              <UButton size="sm" color="error" :loading="deletingAccount" @click="deleteAccount">
                {{ t('settings.deleteAccount') }}
              </UButton>
              <UButton size="sm" variant="outline" @click="showDeleteAccount = false; deleteAccountEmail = ''">
                {{ t('common.cancel') }}
              </UButton>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
