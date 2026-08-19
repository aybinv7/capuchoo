<script setup lang="ts">
import { ref } from 'vue'
import { useOnboardingStore } from '@/modules/onboarding/stores/onboarding.store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'vue-sonner'

const emit = defineEmits<{
  (e: 'next'): void
}>()

const onboardingStore = useOnboardingStore()
const orgName = ref(onboardingStore.organizationData.name || '')

async function handleCreateOrg() {
  if (!orgName.value) {
    toast.error('Please enter an organization name')
    return
  }

  onboardingStore.setOrganizationDraft(orgName.value)
  emit('next')
}
</script>

<template>
  <Card class="w-full">
    <CardHeader>
      <CardTitle>Create Organization</CardTitle>
      <CardDescription> Organizations help you group your apps. </CardDescription>
    </CardHeader>
    <CardContent>
      <div class="grid gap-4">
        <div class="grid gap-2">
          <Label for="orgName">Organization Name</Label>
          <Input
            id="orgName"
            v-model="orgName"
            placeholder="Acme Corp"
            @keyup.enter="handleCreateOrg"
          />
        </div>
      </div>
    </CardContent>
    <CardFooter class="flex justify-end">
      <Button @click="handleCreateOrg"> Continue </Button>
    </CardFooter>
  </Card>
</template>
