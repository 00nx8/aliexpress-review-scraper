<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false })
const { t } = useI18n()

const email = ref('')
const password = ref('')
const repeatPassword = ref('')
const country = ref('uk')
const error = ref('')
const loading = ref(false)

const countries = [
  { label: 'United Kingdom', value: 'uk' },
  { label: 'Ireland', value: 'ie' },
  { label: 'Netherlands', value: 'nl' }
]

async function register() {
  error.value = ''
  if (password.value !== repeatPassword.value) {
    error.value = t('auth.passwordMismatch')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/register', {
      method: 'POST',
      body: { email: email.value, password: password.value, country: country.value }
    })
    await navigateTo('/subscribe')
  } catch (e: any) {
    error.value = e?.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-xl font-semibold">{{ t('auth.register') }}</h1>
    </template>

    <form class="space-y-4" @submit.prevent="register">
      <UFormField :label="t('auth.email')">
        <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')">
        <UInput v-model="password" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.repeatPassword')">
        <UInput v-model="repeatPassword" type="password" autocomplete="new-password" required class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.country')">
        <USelect v-model="country" :items="countries" class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" :description="error" />
      <UButton type="submit" :loading="loading" block>
        {{ t('auth.register') }}
      </UButton>
    </form>

    <template #footer>
      <div class="text-sm text-center">
        <NuxtLink to="/login" class="text-primary hover:underline">
          {{ t('auth.haveAccount') }}
        </NuxtLink>
      </div>
    </template>
  </UCard>
</template>
