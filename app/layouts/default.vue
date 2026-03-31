<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const showBack = computed(() => route.path !== '/')

const navItems = [
  { to: '/', icon: 'i-lucide-wrench', label: 'nav.visits', exact: true },
  { to: '/fluids', icon: 'i-lucide-droplets', label: 'nav.fluids', exact: false },
  { to: '/torque', icon: 'i-lucide-gauge', label: 'nav.torque', exact: false },
  { to: '/dtc', icon: 'i-lucide-alert-triangle', label: 'nav.dtc', exact: false },
  { to: '/settings', icon: 'i-lucide-settings', label: 'nav.settings', exact: false }
]

const statusFilters = ['all', 'in_progress', 'complete', 'invoiced']
const activeFilter = useState('visitFilter', () => 'all')
const showFilters = computed(() => route.path === '/')
</script>

<template>
  <div class="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
    <!-- Header -->
    <header class="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div class="flex items-center justify-between px-4 h-14">
        <div class="flex items-center gap-2">
          <UButton
            v-if="showBack"
            icon="i-lucide-arrow-left"
            variant="ghost"
            color="neutral"
            @click="router.back()"
          />
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-wrench" class="size-5 text-primary" />
            <span class="font-bold text-lg">Torq</span>
          </div>
        </div>
      </div>

      <!-- Status filters (only on index) -->
      <div v-if="showFilters" class="flex gap-1 px-4 pb-3 overflow-x-auto">
        <UButton
          v-for="f in statusFilters"
          :key="f"
          :variant="activeFilter === f ? 'solid' : 'outline'"
          size="xs"
          @click="activeFilter = f"
        >
          {{ t(`filter.${f}`) }}
        </UButton>
      </div>
    </header>

    <!-- Content -->
    <main class="flex-1 overflow-y-auto pb-20">
      <slot />
    </main>

    <!-- Bottom nav -->
    <nav class="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div class="flex items-center justify-around h-16">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex flex-col items-center gap-0.5 flex-1 py-2 text-xs"
          :class="(item.exact ? route.path === item.to : route.path.startsWith(item.to)) ? 'text-primary' : 'text-gray-500 dark:text-gray-400'"
        >
          <UIcon :name="item.icon" class="size-5" />
          <span>{{ t(item.label) }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
