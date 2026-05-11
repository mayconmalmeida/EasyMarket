<template>
  <div class="min-h-full">
    <RouterView v-if="isStandaloneLayout" />

    <template v-else>
      <header class="bg-white shadow-sm">
        <div class="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <img :src="headerLogo" class="h-20 w-20 object-cover" alt="EasyMarket" />
        </div>
      </header>

      <main class="mx-auto max-w-5xl p-4">
        <RouterView />
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import { computed, onMounted } from 'vue';
import { useSettingsStore } from './stores/settings';

const route = useRoute();
const settings = useSettingsStore();

const isStandaloneLayout = computed(() => route.path.startsWith('/admin') || route.path.startsWith('/colaborador') || route.path.startsWith('/tablet'));
const headerLogo = computed(() => settings.logoUrl || new URL('./assets/logo.png', import.meta.url).toString());

onMounted(() => {
  settings.loadPublic();
});
</script>
