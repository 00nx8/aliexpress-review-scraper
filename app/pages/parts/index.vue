<script setup lang="ts">
const { t } = useI18n()
const showAdd = ref(false)
</script>

<template>
  <div class="p-4 space-y-4">
    <h1 class="text-lg font-bold">{{ t('parts.addParts') }}</h1>

    <div class="grid grid-cols-1 gap-4">
      <NuxtLink to="/fluids">
        <UCard class="cursor-pointer hover:shadow-md transition-shadow">
          <div class="flex items-center gap-4">
            <div class="rounded-full bg-primary/10 p-3">
              <UIcon name="i-lucide-droplets" class="size-6 text-primary" />
            </div>
            <div>
              <div class="font-semibold">{{ t('nav.fluids') }}</div>
              <div class="text-sm text-gray-500">{{ t('fluids.desc') }}</div>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/torque">
        <UCard class="cursor-pointer hover:shadow-md transition-shadow">
          <div class="flex items-center gap-4">
            <div class="rounded-full bg-primary/10 p-3">
              <UIcon name="i-lucide-gauge" class="size-6 text-primary" />
            </div>
            <div>
              <div class="font-semibold">{{ t('nav.torque') }}</div>
              <div class="text-sm text-gray-500">{{ t('torque.desc') }}</div>
            </div>
          </div>
        </UCard>
      </NuxtLink>

      <NuxtLink to="/dtc">
        <UCard class="cursor-pointer hover:shadow-md transition-shadow">
          <div class="flex items-center gap-4">
            <div class="rounded-full bg-primary/10 p-3">
              <UIcon name="i-lucide-alert-triangle" class="size-6 text-primary" />
            </div>
            <div>
              <div class="font-semibold">{{ t('nav.dtc') }}</div>
              <div class="text-sm text-gray-500">{{ t('dtc.desc') }}</div>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
