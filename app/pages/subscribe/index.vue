<script setup lang="ts">
definePageMeta({ layout: false })
const { t } = useI18n()
const { user, fetch: refreshSession } = useUserSession()

const selected = ref<'freelance' | 'business' | null>(null)
const loading = ref(false)
const checkoutError = ref('')

const tiers = [
  {
    key: 'freelance' as const,
    price: 29,
    title: t('subscribe.freelance'),
    summary: t('subscribe.freelanceSummary'),
    features: [
      t('subscribe.featurePartsManagement'),
      t('subscribe.featureLaborHours'),
      t('subscribe.featureInvoiceManagement'),
      t('subscribe.featureSpecs')
    ]
  },
  {
    key: 'business' as const,
    price: 49,
    title: t('subscribe.business'),
    summary: t('subscribe.businessSummary'),
    features: [
      t('subscribe.featurePartsManagement'),
      t('subscribe.featureLaborHours'),
      t('subscribe.featureInvoiceManagement'),
      t('subscribe.featureSpecs'),
      t('subscribe.featureTeam')
    ]
  }
]

async function startTrial() {
  loading.value = true
  try {
    await $fetch('/api/subscribe/trial', { method: 'POST' })
    await refreshSession()
    await navigateTo('/')
  } catch (e: any) {
    if (e?.status === 401) { await navigateTo('/login'); return }
  } finally {
    loading.value = false
  }
}

async function continueToPayment() {
  if (!selected.value) return
  loading.value = true
  checkoutError.value = ''
  try {
    const { url } = await $fetch<{ url: string }>('/api/subscribe/checkout', {
      method: 'POST',
      body: { plan: selected.value }
    })
    window.location.href = url
  } catch (e: any) {
    if (e?.status === 401) { await navigateTo('/login'); return }
    checkoutError.value = e?.data?.message || t('common.error')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
    <div class="max-w-2xl mx-auto">
      <div class="flex items-center justify-center gap-2 mb-8">
        <UIcon name="i-lucide-wrench" class="size-8 text-primary" />
        <span class="text-2xl font-bold">Torq</span>
      </div>

      <h1 class="text-2xl font-bold text-center mb-2">{{ t('subscribe.choosePlan') }}</h1>
      <p class="text-gray-500 text-center mb-8">{{ t('subscribe.choosePlanDesc') }}</p>

      <div class="grid gap-4 sm:grid-cols-2 mb-6">
        <div
          v-for="tier in tiers"
          :key="tier.key"
          class="cursor-pointer rounded-xl border-2 transition-all overflow-hidden bg-white dark:bg-gray-900"
          :class="selected === tier.key ? 'border-primary' : 'border-gray-200 dark:border-gray-700'"
          @click="selected = tier.key"
        >
          <!-- Card header -->
          <div
            class="flex items-center justify-between px-4 py-3"
            :class="selected === tier.key ? 'bg-primary/10' : 'bg-white dark:bg-gray-900'"
          >
            <h2 class="font-semibold text-lg">{{ tier.title }}</h2>
            <span class="font-bold text-lg">€{{ tier.price }}<span class="text-sm font-normal text-gray-500">/mo</span></span>
          </div>

          <!-- Card body (collapsed when selected) -->
          <div
            v-if="selected !== tier.key"
            class="px-4 py-3 bg-white dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400"
          >
            {{ tier.summary }}
          </div>

          <!-- Expanded body -->
          <div v-else class="px-4 py-3 bg-white dark:bg-gray-900 space-y-2">
            <ul class="space-y-1">
              <li v-for="f in tier.features" :key="f" class="flex items-start gap-2 text-sm">
                <UIcon name="i-lucide-check" class="size-4 text-primary mt-0.5 shrink-0" />
                <span>{{ f }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <UAlert v-if="checkoutError" color="error" :description="checkoutError" class="mb-3" />

      <UButton
        v-if="selected"
        block
        size="lg"
        :loading="loading"
        @click="continueToPayment"
      >
        {{ t('subscribe.continue') }}
      </UButton>

      <div class="text-center mt-4">
        <button
          class="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          :disabled="loading"
          @click="startTrial"
        >
          {{ t('subscribe.skipTrial') }}
        </button>
      </div>
    </div>
  </div>
</template>
