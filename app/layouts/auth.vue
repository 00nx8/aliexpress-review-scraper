<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
    <div class="w-full max-w-md">
      <div class="flex items-center justify-center gap-2 mb-8">
        <UIcon name="i-lucide-wrench" class="size-8 text-primary" />
        <span class="text-2xl font-bold">Torq</span>
      </div>
      <slot />
    </div>
  </div>
</template>
