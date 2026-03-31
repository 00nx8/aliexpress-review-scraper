<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false })
const { t } = useI18n()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function login() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.message || t('auth.invalidCredentials')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h1 class="text-xl font-semibold">{{ t('auth.login') }}</h1>
    </template>

    <form class="space-y-4" @submit.prevent="login">
      <UFormField :label="t('auth.email')">
        <UInput v-model="email" type="email" autocomplete="email" required class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.password')">
        <UInput v-model="password" type="password" autocomplete="current-password" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" :description="error" />
      <UButton type="submit" :loading="loading" block>
        {{ t('auth.login') }}
      </UButton>
    </form>

    <template #footer>
      <div class="flex flex-col gap-2 text-sm text-center">
        <NuxtLink to="/forgot-password" class="text-primary hover:underline">
          {{ t('auth.forgotPassword') }}
        </NuxtLink>
        <NuxtLink to="/register" class="text-primary hover:underline">
          {{ t('auth.noAccount') }}
        </NuxtLink>
      </div>
    </template>
  </UCard>
</template>
