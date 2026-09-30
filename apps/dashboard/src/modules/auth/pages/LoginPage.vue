<script setup lang="ts">
import AuthLayout from "@/shared/layouts/AuthLayout.vue";
import LoginForm from "../components/LoginForm.vue";
</script>

<template>
  <AuthLayout
    title="Sign in to Capuchoo"
    subtitle="Accounts are created by invitation. Ask an organization admin for a link."
  >
    <LoginForm />
  </AuthLayout>
</template>
