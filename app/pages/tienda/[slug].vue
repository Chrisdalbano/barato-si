<script setup lang="ts">
// /tienda/<slug>/ and /en/store/<slug>/: see LandingPage.vue.
definePageMeta({ alias: ['/en/store/:slug'] })
</script>

<template>
  <LandingPage kind="tienda" />
</template>
