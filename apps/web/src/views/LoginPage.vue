<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';

type Props = {
  presetCode?: string;
  title?: string;
};

const props = defineProps<Props>();

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const settings = useSettingsStore();

const code = ref(props.presetCode ?? '');
const pin = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(() => {
  if (props.presetCode) code.value = props.presetCode;
});

const logo = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());
const isAdminLogin = computed(() => (props.title ?? '').toLowerCase().includes('admin'));

function isValidPin(value: string) {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return false;
  return v.length === 4 || v.length === 6;
}

function clearPin() {
  if (loading.value) return;
  pin.value = '';
}

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    if (!code.value.trim()) {
      error.value = 'Informe o código';
      return;
    }
    if (!isValidPin(pin.value)) {
      error.value = 'Informe um PIN de 4 ou 6 dígitos';
      return;
    }
    await auth.login(code.value.trim(), pin.value.trim());
    if (auth.isAdmin) await router.push('/admin');
    else {
      const raw = route.query.redirect;
      const redirect = typeof raw === 'string' ? raw : '';
      const defaultAfterLogin = '/colaborador/inicio';
      const safe =
        redirect && redirect.startsWith('/') && !redirect.startsWith('/admin')
          ? redirect
          : defaultAfterLogin;
      await router.push(safe);
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha no login';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-0px)] bg-[#EAF3FF]">
    <div class="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-2 md:py-12">
      <div class="flex flex-col justify-center">
        <div class="flex items-center gap-3">
          <img :src="logo" class="h-40 w-40 object-contain md:h-64 md:w-64" :alt="settings.marketName" />
        </div>
        <div class="mt-8">
          <div class="text-2xl font-semibold text-[#003B8E]">{{ title ?? 'Entrar' }}</div>
          <div class="mt-2 text-sm text-slate-600">Acesse pelo navegador para consultar consumo, pendências e pagamentos.</div>
        </div>
      </div>

      <div class="rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <form class="space-y-5" @submit.prevent="submit">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">{{ isAdminLogin ? 'Código de acesso' : 'Código do colaborador' }}</label>
            <InputText
              v-model="code"
              class="w-full text-lg"
              inputmode="numeric"
              autocomplete="username"
              placeholder="Ex: 0001"
            />
          </div>

          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-700">PIN (4 ou 6 dígitos)</label>
            <div class="flex items-center gap-2">
              <Password
                v-model="pin"
                class="w-full"
                :feedback="false"
                toggleMask
                autocomplete="current-password"
                inputmode="numeric"
              />
              <Button type="button" icon="pi pi-times" rounded severity="secondary" @click="clearPin" />
            </div>
          </div>

          <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">
            {{ error }}
          </div>

          <Button class="h-14 w-full text-lg" label="Entrar" :loading="loading" type="submit" />
        </form>
      </div>
    </div>
  </div>
</template>
