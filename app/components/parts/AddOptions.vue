<script setup lang="ts">
const props = defineProps<{ visitId: number }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const { t } = useI18n()

type Mode = 'options' | 'manual' | 'saved' | 'email' | 'photo'
const mode = ref<Mode>('options')

// Manual form
const partName = ref('')
const partNo = ref('')
const brand = ref('')
const unitCost = ref('')
const addToJob = ref(true)
const saving = ref(false)
const error = ref('')
const suggestions = ref<any[]>([])

// Saved parts
const savedSearch = ref('')
const savedResults = ref<any[]>([])
const savedCost = ref<Record<number, string>>({})
const savedSelected = ref<Set<number>>(new Set())
const savedSearching = ref(false)

async function searchSaved() {
  if (savedSearch.value.length < 2) { savedResults.value = []; return }
  savedSearching.value = true
  try {
    savedResults.value = await $fetch<any[]>('/api/parts', { query: { search: savedSearch.value } })
  } finally {
    savedSearching.value = false
  }
}

function toggleSaved(id: number) {
  if (savedSelected.value.has(id)) savedSelected.value.delete(id)
  else savedSelected.value.add(id)
}

async function linkSavedParts() {
  const selected = savedResults.value.filter(p => savedSelected.value.has(p.id))
  if (!selected.length) return
  saving.value = true
  error.value = ''
  try {
    for (const p of selected) {
      await $fetch(`/api/visits/${props.visitId}/parts`, {
        method: 'POST',
        body: { name: p.name, partNo: p.partNo, brand: p.brand, unitCost: savedCost.value[p.id] || '0', source: 'manual' }
      })
    }
    emit('saved')
  } catch (e: any) {
    error.value = e?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

// Email form
const emailContent = ref('')
const parsedParts = ref<any[]>([])
const selectedParts = ref<Set<number>>(new Set())
const parsing = ref(false)
const showLinkModal = ref(false)

// Photo form
const photos = ref<File[]>([])
const photoIdx = ref(0)
const photoParsedParts = ref<any[]>([])
const photoSelectedParts = ref<Set<number>>(new Set())

async function searchParts() {
  if (partName.value.length < 2) { suggestions.value = []; return }
  suggestions.value = await $fetch<any[]>('/api/parts', { query: { search: partName.value } })
}

function selectSuggestion(p: any) {
  partName.value = p.name
  partNo.value = p.partNo || ''
  brand.value = p.brand || ''
  suggestions.value = []
}

async function saveManual() {
  if (!partName.value || !unitCost.value) return
  saving.value = true
  error.value = ''
  try {
    if (addToJob.value) {
      await $fetch(`/api/visits/${props.visitId}/parts`, {
        method: 'POST',
        body: { name: partName.value, partNo: partNo.value, brand: brand.value, unitCost: unitCost.value, source: 'manual' }
      })
      emit('saved')
    } else {
      await $fetch('/api/parts', {
        method: 'POST',
        body: { name: partName.value, partNo: partNo.value, brand: brand.value }
      })
      emit('saved')
    }
  } catch (e: any) {
    error.value = e?.data?.message || t('common.error')
  } finally {
    saving.value = false
  }
}

async function parseEmail() {
  if (!emailContent.value) return
  parsing.value = true
  try {
    const res = await $fetch<any>('/api/parts/parse-email', {
      method: 'POST',
      body: { rawContent: emailContent.value }
    })
    parsedParts.value = res.parts.map((p: any, i: number) => ({ ...p, _idx: i, _docId: res.id }))
    selectedParts.value = new Set(parsedParts.value.map(p => p._idx))
  } finally {
    parsing.value = false
  }
}

async function linkEmailParts() {
  const selected = parsedParts.value.filter(p => selectedParts.value.has(p._idx))
  if (!selected.length) return
  saving.value = true
  try {
    await $fetch('/api/parts/link', {
      method: 'POST',
      body: { visitId: props.visitId, parsedParts: selected, docId: selected[0]?._docId }
    })
    emit('saved')
  } finally {
    saving.value = false
  }
}

function handlePhotoUpload(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) photos.value = Array.from(input.files)
}

function removePhoto(i: number) {
  photos.value.splice(i, 1)
  if (photoIdx.value >= photos.value.length) photoIdx.value = Math.max(0, photos.value.length - 1)
}

async function parsePhotos() {
  if (!photos.value.length) return
  parsing.value = true
  try {
    const form = new FormData()
    for (const f of photos.value) form.append('files', f)
    const res = await $fetch<any>('/api/parts/parse-photo', { method: 'POST', body: form })
    photoParsedParts.value = res.parts.map((p: any, i: number) => ({ ...p, _idx: i, _docId: res.id }))
    photoSelectedParts.value = new Set(photoParsedParts.value.map(p => p._idx))
  } finally {
    parsing.value = false
  }
}

async function linkPhotoParts() {
  const selected = photoParsedParts.value.filter(p => photoSelectedParts.value.has(p._idx))
  if (!selected.length) return
  saving.value = true
  try {
    await $fetch('/api/parts/link', {
      method: 'POST',
      body: { visitId: props.visitId, parsedParts: selected.map(p => ({ ...p, source: 'receipt' })), docId: selected[0]?._docId }
    })
    emit('saved')
  } finally {
    saving.value = false
  }
}

function toggleSelect(set: Set<number>, idx: number) {
  if (set.has(idx)) set.delete(idx)
  else set.add(idx)
}
</script>

<template>
  <UModal :open="true" @close="emit('close')">
    <template #content>
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">{{ t('parts.addParts') }}</h3>
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="emit('close')" />
          </div>
        </template>

        <!-- Options screen -->
        <div v-if="mode === 'options'" class="grid grid-cols-2 gap-3">
          <button
            v-for="opt in [
              { key: 'manual', icon: 'i-lucide-pencil', label: t('parts.manual') },
              { key: 'saved', icon: 'i-lucide-package-search', label: t('parts.saved') },
              { key: 'email', icon: 'i-lucide-mail', label: t('parts.email') },
              { key: 'photo', icon: 'i-lucide-camera', label: t('parts.photo') }
            ]"
            :key="opt.key"
            class="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-primary hover:bg-primary/5 transition-colors"
            @click="mode = opt.key as Mode"
          >
            <UIcon :name="opt.icon" class="size-8 text-primary" />
            <span class="text-sm font-medium">{{ opt.label }}</span>
          </button>
        </div>

        <!-- Manual form -->
        <div v-else-if="mode === 'manual'" class="space-y-4">
          <div class="relative">
            <UFormField :label="t('parts.name')">
              <UInput v-model="partName" required class="w-full" @input="searchParts" />
            </UFormField>
            <div
              v-if="suggestions.length"
              class="absolute z-10 top-full mt-1 left-0 right-0 bg-white dark:bg-gray-900 rounded-lg border shadow-lg overflow-hidden"
            >
              <button
                v-for="s in suggestions"
                :key="s.id"
                type="button"
                class="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
                @click="selectSuggestion(s)"
              >
                {{ s.name }} <span class="text-gray-400">{{ s.brand }}</span>
              </button>
            </div>
          </div>
          <UFormField :label="t('parts.partNo')">
            <UInput v-model="partNo" class="w-full" />
          </UFormField>
          <UFormField :label="t('parts.brand')">
            <UInput v-model="brand" class="w-full" />
          </UFormField>
          <UFormField :label="t('parts.cost')">
            <UInput v-model="unitCost" type="number" step="0.01" required class="w-full" />
          </UFormField>
          <label class="flex items-center gap-2 text-sm cursor-pointer">
            <input v-model="addToJob" type="checkbox" class="rounded" />
            {{ t('parts.addToCurrentJob') }}
          </label>
          <UAlert v-if="error" color="error" :description="error" />
          <div class="flex gap-2">
            <UButton variant="outline" class="flex-1" @click="mode = 'options'">{{ t('common.back') }}</UButton>
            <UButton class="flex-1" :loading="saving" @click="saveManual">{{ t('common.save') }}</UButton>
          </div>
        </div>

        <!-- Saved parts -->
        <div v-else-if="mode === 'saved'" class="space-y-4">
          <UInput
            v-model="savedSearch"
            :placeholder="t('parts.searchSaved')"
            icon="i-lucide-search"
            class="w-full"
            @input="searchSaved"
          />
          <div class="space-y-1 max-h-64 overflow-y-auto">
            <div v-if="savedSearching" class="text-center py-4 text-gray-400 text-sm">...</div>
            <div v-else-if="savedSearch.length > 1 && !savedResults.length" class="text-center py-4 text-gray-400 text-sm">
              {{ t('common.noResults') }}
            </div>
            <label
              v-for="p in savedResults"
              :key="p.id"
              class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
              :class="savedSelected.has(p.id) ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'"
            >
              <input :checked="savedSelected.has(p.id)" type="checkbox" @change="toggleSaved(p.id)" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ p.name }}</div>
                <div class="text-xs text-gray-400">{{ p.brand }} {{ p.partNo }}</div>
              </div>
              <UInput
                v-if="savedSelected.has(p.id)"
                v-model="savedCost[p.id]"
                type="number"
                step="0.01"
                placeholder="€"
                class="w-20"
                @click.prevent
              />
            </label>
          </div>
          <UAlert v-if="error" color="error" :description="error" />
          <div class="flex gap-2">
            <UButton variant="outline" class="flex-1" @click="mode = 'options'">{{ t('common.back') }}</UButton>
            <UButton class="flex-1" :loading="saving" :disabled="!savedSelected.size" @click="linkSavedParts">
              {{ t('parts.addSelected', { count: savedSelected.size }) }}
            </UButton>
          </div>
        </div>

        <!-- Email form -->
        <div v-else-if="mode === 'email'" class="space-y-4">
          <div v-if="!parsedParts.length">
            <p class="text-sm text-gray-500 mb-2">{{ t('parts.emailHint') }}</p>
            <UTextarea v-model="emailContent" :placeholder="t('parts.emailPaste')" class="w-full h-32" />
            <div class="flex gap-2 mt-3">
              <UButton variant="outline" class="flex-1" @click="mode = 'options'">{{ t('common.back') }}</UButton>
              <UButton class="flex-1" :loading="parsing" @click="parseEmail">{{ t('parts.parse') }}</UButton>
            </div>
          </div>
          <div v-else class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span>{{ parsedParts.length }} {{ t('parts.partsFound') }}</span>
              <button class="text-primary text-xs" @click="selectedParts = new Set(parsedParts.map(p => p._idx))">
                {{ t('common.selectAll') }}
              </button>
            </div>
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <label
                v-for="p in parsedParts"
                :key="p._idx"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
                :class="selectedParts.has(p._idx) ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'"
              >
                <input :checked="selectedParts.has(p._idx)" type="checkbox" @change="toggleSelect(selectedParts, p._idx)" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ p.name }}</div>
                  <div class="text-xs text-gray-400">{{ p.brand }} · {{ p.partNo }}</div>
                </div>
                <span class="text-sm font-medium">€{{ p.unitCost?.toFixed(2) }}</span>
              </label>
            </div>
            <UButton block :loading="saving" :disabled="!selectedParts.size" @click="linkEmailParts">
              {{ t('parts.linkSelected', { count: selectedParts.size }) }}
            </UButton>
          </div>
        </div>

        <!-- Photo form -->
        <div v-else-if="mode === 'photo'" class="space-y-4">
          <div v-if="!photoParsedParts.length">
            <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
              <UIcon name="i-lucide-upload" class="size-10 mx-auto text-gray-400 mb-2" />
              <p class="text-sm text-gray-500 mb-3">{{ t('parts.photoHint') }}</p>
              <label class="cursor-pointer">
                <UButton as="span" variant="outline">{{ t('parts.selectPhotos') }}</UButton>
                <input type="file" accept="image/*" multiple class="hidden" @change="handlePhotoUpload" />
              </label>
            </div>
            <div v-if="photos.length" class="space-y-2 mt-3">
              <div class="flex items-center gap-2 text-sm text-gray-500">
                <UIcon name="i-lucide-image" class="size-4" />
                {{ photos.length }} {{ t('parts.photosSelected') }}
                <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="photos = []" />
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <UButton variant="outline" class="flex-1" @click="mode = 'options'">{{ t('common.back') }}</UButton>
              <UButton class="flex-1" :loading="parsing" :disabled="!photos.length" @click="parsePhotos">
                {{ t('parts.parse') }}
              </UButton>
            </div>
          </div>
          <div v-else class="space-y-3">
            <div class="flex items-center justify-between text-sm">
              <span>{{ photoParsedParts.length }} {{ t('parts.partsFound') }}</span>
              <button class="text-primary text-xs" @click="photoSelectedParts = new Set(photoParsedParts.map(p => p._idx))">
                {{ t('common.selectAll') }}
              </button>
            </div>
            <div class="space-y-1 max-h-48 overflow-y-auto">
              <label
                v-for="p in photoParsedParts"
                :key="p._idx"
                class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer"
                :class="photoSelectedParts.has(p._idx) ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'"
              >
                <input :checked="photoSelectedParts.has(p._idx)" type="checkbox" @change="toggleSelect(photoSelectedParts, p._idx)" />
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium truncate">{{ p.name }}</div>
                  <div class="text-xs text-gray-400">{{ p.brand }} · {{ p.partNo }}</div>
                </div>
                <span class="text-sm font-medium">€{{ p.unitCost?.toFixed(2) }}</span>
              </label>
            </div>
            <UButton block :loading="saving" :disabled="!photoSelectedParts.size" @click="linkPhotoParts">
              {{ t('parts.linkSelected', { count: photoSelectedParts.size }) }}
            </UButton>
          </div>
        </div>
      </UCard>
    </template>
  </UModal>
</template>
