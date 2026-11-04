<script setup lang="ts">
// /categoria/<slug>/ and /en/category/<english slug>/: see LandingPage.vue.
definePageMeta({ alias: ['/en/category/:slug'] })
</script>

<template>
  <LandingPage kind="categoria" />
</template>
