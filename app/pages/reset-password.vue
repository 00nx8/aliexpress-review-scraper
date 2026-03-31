<script setup lang="ts">
definePageMeta({ layout: 'auth', auth: false })
const { t } = useI18n()
const route = useRoute()

const token = computed(() => route.query.token as string)
const password = ref('')
const repeatPassword = ref('')
const error = ref('')
const success = ref(false)
const loading = ref(false)

async function submit() {
  error.value = ''
  if (password.value !== repeatPassword.value) {
    error.value = t('auth.passwordMismatch')
    return
  }
  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: password.value }
    })
    success.value = true
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
      <h1 class="text-xl font-semibold">{{ t('auth.resetPassword') }}</h1>
    </template>

    <div v-if="success" class="space-y-4 text-center">
      <UIcon name="i-lucide-check-circle" class="size-12 text-primary mx-auto" />
      <p>{{ t('auth.passwordReset') }}</p>
      <UButton to="/login" block>{{ t('auth.backToLogin') }}</UButton>
    </div>

    <form v-else class="space-y-4" @submit.prevent="submit">
      <UFormField :label="t('auth.newPassword')">
        <UInput v-model="password" type="password" required class="w-full" />
      </UFormField>
      <UFormField :label="t('auth.repeatPassword')">
        <UInput v-model="repeatPassword" type="password" required class="w-full" />
      </UFormField>
      <UAlert v-if="error" color="error" :description="error" />
      <UButton type="submit" :loading="loading" block>
        {{ t('auth.resetPassword') }}
      </UButton>
    </form>
  </UCard>
</template>
