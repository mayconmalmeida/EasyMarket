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

const lastAccessLabel = computed(() => new Date().toLocaleString('pt-BR'));

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
    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Perfil</div>
          <div class="mt-1 text-sm text-slate-600">Seus dados de acesso ao mercadinho.</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="loading" class="w-full sm:w-auto" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
    <div v-if="info" class="rounded-xl bg-green-50 p-3 text-sm text-green-700">{{ info }}</div>

    <div class="rounded-[24px] bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] p-5 text-white shadow-[0_18px_40px_rgba(0,59,142,0.22)]">
      <div class="flex items-center gap-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
          <span class="text-base font-semibold">{{ avatarInitials }}</span>
        </div>
        <div class="min-w-0">
          <div class="truncate text-lg font-semibold">{{ me?.name || auth.user?.name || '-' }}</div>
          <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/80">
            <span class="inline-flex items-center gap-2">
              <UserIcon class="h-4 w-4 text-white/70" />
              {{ me?.sector || auth.user?.sector || '-' }}
            </span>
            <span class="text-white/30">•</span>
            <span class="font-medium text-white/90">Código {{ me?.code || auth.user?.code || '-' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div class="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="text-xs font-medium text-slate-600">Status da conta</div>
        <div class="mt-2 text-sm font-semibold" :class="me?.status === 'BLOCKED' ? 'text-[#DC2626]' : 'text-[#16A34A]'">
          {{ me?.status === 'BLOCKED' ? 'Bloqueada' : 'Ativa' }}
        </div>
      </div>

      <div class="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="text-xs font-medium text-slate-600">Último acesso (sessão atual)</div>
        <div class="mt-2 text-sm font-semibold text-slate-900">{{ lastAccessLabel }}</div>
      </div>

      <div class="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm md:col-span-2">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-600">PIN</div>
            <div class="mt-2 text-sm text-slate-700">Solicite alteração quando necessário.</div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <KeyRound class="h-5 w-5" />
          </div>
        </div>
        <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            label="Solicitar alteração de PIN"
            :loading="requesting"
            severity="secondary"
            class="w-full sm:w-auto"
            @click="requestPinReset"
          />
        </div>
      </div>
    </div>

  </div>
</template>
