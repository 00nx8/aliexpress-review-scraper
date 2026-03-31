<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false })
const { t } = useI18n()

const email = ref('')
const sent = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
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
      <h1 class="text-xl font-semibold">{{ t('auth.forgotPassword') }}</h1>
    </template>

    <div v-if="sent" class="space-y-4 text-center">
      <UIcon name="i-lucide-mail-check" class="size-12 text-primary mx-auto" />
      <p>{{ t('auth.resetEmailSent') }}</p>
      <UButton to="/login" variant="outline" block>
        {{ t('auth.backToLogin') }}
      </UButton>
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <UFormField :label="t('auth.email')">
        <UInput v-model="email" type="email" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" :description="error" />
      <UButton type="submit" :loading="loading" block>
        {{ t('auth.sendResetLink') }}
      </UButton>
    </form>

    <template #footer>
      <div class="flex justify-center gap-4 text-sm">
        <NuxtLink to="/login" class="text-primary hover:underline">{{ t('auth.login') }}</NuxtLink>
        <NuxtLink to="/register" class="text-primary hover:underline">{{ t('auth.register') }}</NuxtLink>
      </div>
    </template>
  </UCard>
</template>
