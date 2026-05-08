<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { api } from '../lib/api';
import { formatBRL } from '../lib/money';

const auth = useAuthStore();
const settings = useSettingsStore();

type PaymentMethod = 'CASH' | 'PIX' | 'NONE';
type PaymentStatus = 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';

type WithdrawalItem = {
  id: string;
  quantity: number;
  unitPriceCents: number;
  product: { id: string; name: string };
};

type Withdrawal = {
  id: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  items: WithdrawalItem[];
};

const loading = ref(false);
const error = ref<string | null>(null);
const mine = ref<Withdrawal[]>([]);
const pending = ref<Withdrawal[]>([]);
const confirming = ref<string | null>(null);

const pixKey = computed(() => settings.pixKey || import.meta.env.VITE_PIX_KEY || '');
const pixQrUrl = computed(() => settings.pixQrCodeUrl || import.meta.env.VITE_PIX_QR_CODE_URL || '');
const pendingTotal = computed(() => pending.value.reduce((sum, w) => sum + w.totalCents, 0));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [a, b] = await Promise.all([
      api.get<Withdrawal[]>('/withdrawals/mine'),
      api.get<Withdrawal[]>('/withdrawals/mine/pending'),
    ]);
    mine.value = a.data;
    pending.value = b.data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar';
  } finally {
    loading.value = false;
  }
}

async function confirmPix(withdrawalId: string) {
  confirming.value = withdrawalId;
  error.value = null;
  try {
    await api.patch(`/withdrawals/${withdrawalId}/confirm-pix`);
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao confirmar Pix';
  } finally {
    confirming.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between rounded-xl bg-white p-4 shadow">
      <div>
        <div class="text-sm text-slate-500">Portal do Colaborador</div>
        <div class="text-text font-semibold">Meu consumo</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Tablet" severity="secondary" @click="$router.push('/tablet')" />
      </div>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="text-text text-lg font-semibold">{{ auth.user?.name }}</div>
      <div class="mt-1 text-sm text-slate-600">Setor: {{ auth.user?.sector || '-' }}</div>
      <div class="mt-4 flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
      </div>
    </div>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="text-text text-lg font-semibold">Pendências</div>
      <div v-if="pendingTotal > 0" class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-status-pending">
        Você possui {{ formatBRL(pendingTotal) }} pendentes no EasyMarket.
      </div>
      <div v-if="pending.length === 0" class="mt-3 text-sm text-slate-600">Nenhuma pendência.</div>
      <div v-else class="mt-4 space-y-3">
        <div v-for="w in pending" :key="w.id" class="rounded-lg border border-slate-100 p-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-text">{{ w.id }}</div>
              <div class="text-xs text-slate-500">{{ new Date(w.createdAt).toLocaleString('pt-BR') }}</div>
            </div>
            <div class="text-sm font-semibold text-primary-dark">{{ formatBRL(w.totalCents) }}</div>
          </div>
          <div class="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="text-sm text-slate-600">Pagamento: {{ w.paymentMethod }}</div>
            <div class="flex items-center gap-2">
              <Button
                v-if="w.paymentMethod === 'PIX'"
                label="Confirmar Pix"
                :loading="confirming === w.id"
                @click="confirmPix(w.id)"
              />
              <div v-else class="text-sm text-slate-600">Aguardando baixa do administrador</div>
            </div>
          </div>

          <div v-if="w.paymentMethod === 'PIX'" class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-xs text-slate-500">Chave Pix</div>
              <div class="mt-1 break-all text-sm text-text">
                {{ pixKey || 'Configure VITE_PIX_KEY' }}
              </div>
            </div>
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-xs text-slate-500">QRCode</div>
              <div class="mt-2">
                <img
                  v-if="pixQrUrl"
                  :src="pixQrUrl"
                  class="h-32 w-32 rounded-md border border-slate-200 object-contain"
                  alt="QRCode Pix"
                />
                <div v-else class="text-sm text-slate-600">Configure VITE_PIX_QR_CODE_URL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="text-text text-lg font-semibold">Histórico</div>
      <div v-if="mine.length === 0" class="mt-3 text-sm text-slate-600">Sem retiradas.</div>
      <div v-else class="mt-4 space-y-3">
        <div v-for="w in mine" :key="w.id" class="rounded-lg border border-slate-100 p-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-text">{{ w.id }}</div>
              <div class="text-xs text-slate-500">{{ new Date(w.createdAt).toLocaleString('pt-BR') }}</div>
            </div>
            <div class="text-sm font-semibold text-primary-dark">{{ formatBRL(w.totalCents) }}</div>
          </div>
          <div class="mt-2 text-sm text-slate-600">
            {{ w.paymentMethod }} • {{ w.paymentStatus }}
          </div>
          <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div v-for="i in w.items" :key="i.id" class="flex items-center justify-between rounded-md bg-slate-50 p-2">
              <div class="truncate text-sm text-text">{{ i.product.name }}</div>
              <div class="text-sm text-slate-600">x{{ i.quantity }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
