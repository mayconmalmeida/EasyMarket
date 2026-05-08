<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { KeyRound, User as UserIcon } from 'lucide-vue-next';

type Me = {
  id: string;
  name: string;
  code: string;
  sector?: string | null;
  role: 'ADMIN' | 'COLLABORATOR';
  status: 'ACTIVE' | 'BLOCKED';
};

const auth = useAuthStore();

const loading = ref(false);
const error = ref<string | null>(null);
const info = ref<string | null>(null);
const me = ref<Me | null>(null);
const requesting = ref(false);

const avatarInitials = computed(() => {
  const name = (me.value?.name ?? auth.user?.name ?? '').trim();
  if (!name) return 'C';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'C';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const { data } = await api.get<Me>('/me');
    me.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar perfil';
  } finally {
    loading.value = false;
  }
}

async function requestPinReset() {
  requesting.value = true;
  error.value = null;
  info.value = null;
  try {
    await api.post('/me/request-pin-reset');
    info.value = 'Solicitação enviada. Um administrador pode redefinir seu PIN.';
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao solicitar alteração de PIN';
  } finally {
    requesting.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Meu Perfil</div>
          <div class="mt-1 text-sm text-slate-600">Informações da sua conta no EasyMarket.</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="info" class="rounded-xl bg-green-50 p-3 text-sm text-green-700">{{ info }}</div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF3FF] text-[#003B8E]">
          <span class="text-base font-semibold">{{ avatarInitials }}</span>
        </div>
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold text-slate-900">{{ me?.name || auth.user?.name || '-' }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span class="inline-flex items-center gap-2">
              <UserIcon class="h-4 w-4 text-slate-400" />
              {{ me?.sector || auth.user?.sector || '-' }}
            </span>
            <span class="text-slate-300">•</span>
            <span class="font-medium text-slate-700">Código {{ me?.code || auth.user?.code || '-' }}</span>
          </div>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div class="text-xs font-medium text-slate-600">Status da conta</div>
          <div class="mt-2 text-sm font-semibold" :class="me?.status === 'BLOCKED' ? 'text-[#DC2626]' : 'text-[#16A34A]'">
            {{ me?.status === 'BLOCKED' ? 'Bloqueada' : 'Ativa' }}
          </div>
        </div>
        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs font-medium text-slate-600">PIN</div>
              <div class="mt-2 text-sm text-slate-700">Solicite alteração quando necessário.</div>
            </div>
            <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
              <KeyRound class="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 flex flex-col gap-2 md:flex-row md:justify-end">
        <Button
          label="Solicitar alteração de PIN"
          :loading="requesting"
          severity="secondary"
          class="w-full md:w-auto"
          @click="requestPinReset"
        />
      </div>
    </div>
  </div>
</template>
