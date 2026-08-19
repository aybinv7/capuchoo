<template>
  <div class="space-y-6">
    <UpdatesBundlesUploadHeader :is-uploading @click:upload="handleSubmit" />
    <Tabs v-model="formData.type" class="w-full" @update:modelValue="handleTypeChange">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TabsList class="grid lg:col-span-2 w-full grid-cols-2">
          <TabsTrigger value="bundle" class="flex items-center gap-2">
            <Package class="h-4 w-4" />
            Web Bundle
          </TabsTrigger>
          <TabsTrigger value="native" class="flex items-center gap-2">
            <Smartphone class="h-4 w-4" />
            Native Binary
          </TabsTrigger>
        </TabsList>

        <div
          class="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-md"
        >
          <Info class="h-4 w-4" />
          <span
            >Uploading for
            {{
              formData.platform === 'android'
                ? 'Android'
                : formData.platform === 'ios'
                  ? 'iOS'
                  : 'Web'
            }}</span
          >
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Configuration -->
        <Card class="lg:col-span-2 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription> Define the environment and versioning details. </CardDescription>
          </CardHeader>
          <CardContent class="space-y-6">
            <!-- Platform Row -->
            <div class="grid grid-cols-1 gap-4">
              <div class="space-y-2">
                <Label>Platform</Label>
                <Select v-model="formData.platform" required>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="android">
                      <div class="flex items-center gap-2">
                        <IStreamlineLogosAndroidLogoBlock />
                        Android
                      </div>
                    </SelectItem>
                    <SelectItem value="ios">
                      <div class="flex items-center gap-2">
                        <IStreamlineLogosAppleLogoBlock />
                        iOS
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <!-- Versioning Row -->
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="version">Semantic Version</Label>
                <div class="relative">
                  <Hash class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="version"
                    v-model="formData.version_name"
                    class="pl-9"
                    placeholder="1.0.0"
                    required
                  />
                </div>
              </div>

              <div class="space-y-2">
                <Label>Channel</Label>
                <Select v-model="formData.channel">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prod">Prod</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="dev">Dev</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <!-- Conditional Fields -->
            <div
              v-if="formData.type === 'native'"
              class="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-dashed"
            >
              <div class="space-y-2">
                <Label for="versionCode">Version Code</Label>
                <Input
                  id="versionCode"
                  v-model.number="formData.version_code"
                  type="number"
                  placeholder="e.g. 102"
                />
              </div>
              <div class="space-y-2">
                <Label for="checksum">Checksum (SHA)</Label>
                <Input id="checksum" v-model="formData.checksum" placeholder="Optional" />
              </div>
            </div>

            <div
              v-if="formData.type === 'bundle'"
              class="space-y-2 p-4 bg-muted/30 rounded-lg border border-dashed"
            >
              <Label for="sessionKey">Session Key verification</Label>
              <Input
                id="sessionKey"
                v-model="formData.session_key"
                placeholder="Key for secure bundle validation"
              />
            </div>

            <div class="space-y-2">
              <Label>Release Notes</Label>
              <Textarea
                v-model="formData.release_notes"
                placeholder="What's new in this update?"
                class="resize-none min-h-[100px]"
              />
            </div>
          </CardContent>
        </Card>

        <!-- Right Column: Upload & Actions -->
        <div class="space-y-6">
          <!-- Drag & Drop Zone -->
          <Card class="border-border/60 shadow-sm flex flex-col h-full">
            <CardHeader>
              <CardTitle>Asset File</CardTitle>
              <CardDescription>{{ acceptedFileTypesText }}</CardDescription>
            </CardHeader>
            <CardContent class="flex-1 flex flex-col">
              <div
                class="flex-1 border-2 border-dashed rounded-xl flex flex-col items-center justify-center p-8 transition-colors hover:bg-muted/50 cursor-pointer relative"
                :class="{
                  'border-primary bg-primary/5': isDragging,
                  'border-muted-foreground/25': !isDragging,
                }"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
                @click="triggerFileInput"
              >
                <input
                  ref="fileInputRef"
                  type="file"
                  class="hidden"
                  :accept="acceptedFileTypes"
                  @change="handleFileChange"
                />

                <div v-if="!formData.file" class="text-center space-y-4">
                  <div class="p-4 bg-background rounded-full shadow-sm inline-flex">
                    <CloudUpload class="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p class="font-medium">Click to upload</p>
                    <p class="text-sm text-muted-foreground mt-1">or drag and drop</p>
                  </div>
                </div>

                <div v-else class="text-center space-y-4 w-full">
                  <div class="p-4 bg-green-50 rounded-full shadow-sm inline-flex">
                    <FileCheck class="h-8 w-8 text-green-600" />
                  </div>
                  <div class="space-y-1">
                    <p class="font-medium truncate max-w-[200px] mx-auto">
                      {{ formData.file.name }}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {{ formatFileSize(formData.file.size) }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-destructive hover:text-destructive h-8"
                    @click.stop="removeFile"
                  >
                    Remove
                  </Button>
                </div>
              </div>

              <div class="mt-6 space-y-4">
                <div class="flex items-center justify-between space-x-2 border p-3 rounded-lg">
                  <div class="space-y-0.5">
                    <Label class="text-base">Active</Label>
                    <p class="text-xs text-muted-foreground">Immediate rollout</p>
                  </div>
                  <Switch v-model:checked="formData.active" />
                </div>

                <div
                  class="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-red-50/50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30"
                >
                  <div class="space-y-0.5">
                    <Label class="text-base text-red-700 dark:text-red-400">Required</Label>
                    <p class="text-xs text-red-600/80 dark:text-red-400/70">Force update</p>
                  </div>
                  <Switch v-model:checked="formData.required" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { Package, Smartphone, CloudUpload, FileCheck, Info, Hash } from 'lucide-vue-next'
import type { Bundle, NativeUpdate } from '@/modules/updates-bundles/types/updates-bundles.types'
import {
  useCreateBundleFormDataMutation,
  useCreateNativeUpdateFormDataMutation,
} from '@/modules/updates-bundles/composables/useUpdatesBundlesQuery'
import { useAppStore } from '@/stores/app.store'

interface FormDataState {
  type: 'bundle' | 'native'
  platform: 'android' | 'ios' | 'web'
  version_name: string
  channel: 'prod' | 'staging' | 'dev'
  required: boolean
  active: boolean
  file: File | null
  version_code?: number
  checksum?: string
  session_key?: string
  release_notes?: string
}

definePage({
  meta: {
    title: 'New Release - CapGO',
    category: 'updates-bundles',
  },
})

const isUploading = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const router = useRouter()
const appStore = useAppStore()

const formData = ref<FormDataState>({
  type: 'bundle',
  platform: 'web',
  version_name: '',
  channel: 'prod',
  required: false,
  active: true,
  file: null,
})

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleTypeChange = (val: string | number) => {
  if (val === 'bundle') {
    formData.value.platform = 'web'
  } else {
    if (formData.value.platform === 'web') formData.value.platform = 'android'
  }
}

const acceptedFileTypes = computed(() => {
  if (formData.value.type === 'bundle') {
    return '.zip,.tar,.tar.gz'
  } else {
    return formData.value.platform === 'android' ? '.apk,.aab' : '.ipa'
  }
})

const acceptedFileTypesText = computed(() => {
  if (formData.value.type === 'bundle') return 'Archives (.zip, .tar.gz)'
  if (formData.value.platform === 'android') return 'Android App Bundle (.aab, .apk)'
  if (formData.value.platform === 'ios') return 'iOS App Store Package (.ipa)'
  return 'Web Archives'
})

const triggerFileInput = () => fileInputRef.value?.click()

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files?.length) {
    formData.value.file = target.files[0] ?? null
  }
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files.length) {
    formData.value.file = e.dataTransfer.files[0] ?? null
  }
}

const removeFile = () => {
  formData.value.file = null
  if (fileInputRef.value) fileInputRef.value.value = ''
}

const createBundleMutation = useCreateBundleFormDataMutation({
  onSuccess: (data: Bundle) => {
    toast.success('Bundle deployed successfully')
    router.push(`/updates-bundles/${data.id}?type=bundle`)
  },
  onError: (e: any) => toast.error(e.message || 'Failed to upload bundle'),
})

const createNativeUpdateMutation = useCreateNativeUpdateFormDataMutation({
  onSuccess: (data: NativeUpdate) => {
    toast.success('Native update deployed successfully')
    router.push(`/updates-bundles/${data.id}?type=native`)
  },
  onError: (e: any) => toast.error(e.message || 'Failed to upload native update'),
})

const handleSubmit = async () => {
  if (!formData.value.file) {
    toast.error('File is required')
    return
  }

  isUploading.value = true

  try {
    const payload = new FormData()

    payload.append('file', formData.value.file)
    if (appStore.activeApp?.app_id) {
      payload.append('app_id', appStore.activeApp.app_id)
    }
    payload.append('version', formData.value.version_name)
    payload.append('platform', formData.value.platform)
    payload.append('channel', formData.value.channel)
    payload.append('required', String(formData.value.required))
    payload.append('active', String(formData.value.active))

    if (formData.value.type === 'bundle') {
      if (formData.value.session_key) {
        payload.append('session_key', formData.value.session_key)
      }
      if (formData.value.checksum) {
        payload.append('checksum', formData.value.checksum)
      }

      await createBundleMutation.mutateAsync(payload)
    } else {
      if (formData.value.version_code) {
        payload.append('version_code', String(formData.value.version_code))
      }
      if (formData.value.release_notes) {
        payload.append('release_notes', formData.value.release_notes)
      }
      if (formData.value.checksum) {
        payload.append('checksum', formData.value.checksum)
      }

      await createNativeUpdateMutation.mutateAsync(payload)
    }
  } catch (error: any) {
    console.error('Upload failed:', error)
  } finally {
    isUploading.value = false
  }
}

const resetForm = () => {
  const currentType = formData.value.type
  const currentPlatform = formData.value.platform

  formData.value = {
    type: currentType,
    platform: currentPlatform,
    version_name: '',
    channel: 'prod',
    required: false,
    active: true,
    file: null,
    version_code: undefined,
    checksum: '',
    session_key: '',
    release_notes: '',
  }
  removeFile()
}
</script>
