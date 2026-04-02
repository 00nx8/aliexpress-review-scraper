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
  <div class="min-h-screen flex bg-gray-50 dark:bg-gray-950">
    <!-- Sidebar: desktop only -->
    <aside class="hidden lg:flex flex-col fixed inset-y-0 w-56 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div class="flex items-center gap-2 px-4 h-14 shrink-0 border-b border-gray-200 dark:border-gray-800">
        <UIcon name="i-lucide-wrench" class="size-5 text-primary" />
        <span class="font-bold text-lg">Wrenko</span>
      </div>
      <nav class="flex-1 flex flex-col gap-1 p-3">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          :class="(item.exact ? route.path === item.to : route.path.startsWith(item.to))
            ? 'bg-primary/10 text-primary'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'"
        >
          <UIcon :name="item.icon" class="size-5 shrink-0" />
          <span>{{ t(item.label) }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <!-- Main area (offset by sidebar on desktop) -->
    <div class="flex flex-col flex-1 min-w-0 lg:ml-56">
      <!-- Header -->
      <header class="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 px-4 h-14">
          <UButton
            v-if="showBack"
            icon="i-lucide-arrow-left"
            variant="ghost"
            color="neutral"
            @click="router.back()"
          />
          <!-- Logo: mobile only (desktop shows it in the sidebar) -->
          <div class="flex items-center gap-2 lg:hidden">
            <UIcon name="i-lucide-wrench" class="size-5 text-primary" />
            <span class="font-bold text-lg">Wrenko</span>
          </div>
        </div>

        <!-- Status filters (index page only) -->
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
      <main class="flex-1 overflow-y-auto pb-20 lg:pb-8">
        <div class="max-w-3xl mx-auto">
          <slot />
        </div>
      </main>
    </div>

    <!-- Bottom nav: mobile only -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
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
