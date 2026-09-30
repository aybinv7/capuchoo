<script setup lang="ts">
import PageContainer from "@/shared/components/PageContainer.vue";
import PageHeader from "@/shared/components/PageHeader.vue";
import PasswordForm from "../components/PasswordForm.vue";
import ProfileForm from "../components/ProfileForm.vue";
</script>

<template>
  <PageContainer width="narrow">
    <PageHeader title="Profile and password" />
    <ProfileForm />
    <PasswordForm />
  </PageContainer>
</template>
