<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const {fetch: refreshSession} = useUserSession()
onMounted(async () => {
  // Verify subscription was updated
  await $fetch('/api/subscribe/verify', { method: 'POST' })
  await refreshSession()
  setTimeout(() => navigateTo({path: "/"}), 200)
})
</script>

<template>
  <div class="min-h-screen flex flex-col items-center justify-center gap-4">
    <UIcon name="i-lucide-check-circle" class="size-16 text-primary" />
    <h1 class="text-2xl font-bold">{{ t('subscribe.success') }}</h1>
    <p class="text-gray-500">{{ t('subscribe.redirecting') }}</p>
    <NuxtLink class="text-gray-500 text-xs" to="/">Click here to go to dashboard</NuxtLink>
  </div>
</template>
