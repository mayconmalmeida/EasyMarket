<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';

type Props = {
  presetCode?: string;
};

const props = defineProps<Props>();

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

const code = ref(props.presetCode ?? '');
const pin = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

const logo = computed(() => settings.logoUrl || new URL('../../assets/logo.png', import.meta.url).toString());

onMounted(async () => {
  await settings.loadPublic();
  if (props.presetCode) code.value = props.presetCode;
});

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    if (!code.value.trim()) {
      error.value = 'Informe o código';
      return;
    }
    if (!pin.value.trim()) {
      error.value = 'Informe a senha';
      return;
    }
    await auth.login(code.value.trim(), pin.value.trim());
    await router.push('/admin');
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha no login';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[100vh] bg-[#F5F7FB]">
    <div class="mx-auto grid min-h-[100vh] max-w-6xl grid-cols-1 lg:grid-cols-2">
      <div class="hidden flex-col justify-between px-10 py-12 lg:flex">
        <div class="flex items-center gap-3">
          <img :src="logo" class="h-24 w-24 object-cover" alt="EasyMarket" />
          <div>
            <div class="text-sm font-semibold text-[#003B8E]">{{ settings.marketName }}</div>
            <div class="text-xs text-slate-600">Portal Administrativo</div>
          </div>
        </div>

        <div class="max-w-md">
          <div class="text-3xl font-semibold tracking-tight text-slate-900">Gestão do EasyMarket</div>
          <div class="mt-3 text-sm leading-6 text-slate-600">
            Controle de retiradas, pendências, produtos e fechamento mensal em um portal corporativo.
          </div>

          <div class="mt-8 grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div class="text-xs font-medium text-slate-600">Operacional</div>
              <div class="mt-1 text-sm font-semibold text-slate-900">Retiradas</div>
            </div>
            <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
              <div class="text-xs font-medium text-slate-600">Financeiro</div>
              <div class="mt-1 text-sm font-semibold text-slate-900">Fechamento</div>
            </div>
          </div>
        </div>

        <div class="text-xs text-slate-500">© {{ new Date().getFullYear() }} EasyMarket</div>
      </div>

      <div class="flex items-center justify-center px-4 py-10">
        <div class="w-full max-w-md">
          <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div class="text-lg font-semibold text-slate-900">Entrar</div>
            <div class="mt-1 text-sm text-slate-600">Use seu código e senha para acessar.</div>

            <form class="mt-6 space-y-4" @submit.prevent="submit">
              <div class="space-y-1">
                <label class="text-sm font-medium text-slate-700">Código ou e-mail</label>
                <InputText v-model="code" class="w-full" autocomplete="username" />
              </div>

              <div class="space-y-1">
                <label class="text-sm font-medium text-slate-700">Senha</label>
                <Password v-model="pin" class="w-full" :feedback="false" toggleMask autocomplete="current-password" />
              </div>

              <div v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {{ error }}
              </div>

              <Button class="w-full" label="Entrar" :loading="loading" type="submit" />
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
