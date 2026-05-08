<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import { useMyWithdrawalsStore } from '../../stores/my-withdrawals';
import { useSettingsStore } from '../../stores/settings';
import { formatBRL } from '../../lib/money';

const route = useRoute();
const my = useMyWithdrawalsStore();
const settings = useSettingsStore();

const payOpen = ref(false);
const paying = ref(false);
const error = ref<string | null>(null);

const pendingTotal = computed(() => my.pending.reduce((sum, w) => sum + w.totalCents, 0));
const pixKey = computed(() => settings.pixKey || import.meta.env.VITE_PIX_KEY || '');
const pixQrUrl = computed(() => settings.pixQrCodeUrl || import.meta.env.VITE_PIX_QR_CODE_URL || '');

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function methodLabel(m: string) {
  if (m === 'CASH') return 'Dinheiro';
  if (m === 'PIX') return 'Pix';
  return 'Não pago agora';
}

async function openPay() {
  payOpen.value = true;
}

async function confirmPaid() {
  paying.value = true;
  error.value = null;
  try {
    await my.confirmPixAll();
    payOpen.value = false;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao confirmar pagamento';
  } finally {
    paying.value = false;
  }
}

watch(
  () => route.query.pay,
  (v) => {
    if (v && pendingTotal.value > 0) payOpen.value = true;
  },
  { immediate: true },
);

onMounted(() => {
  if (!my.mine.length && !my.pending.length) my.fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Minhas Pendências</div>
          <div class="mt-1 text-sm text-slate-600">Aqui aparece o que ainda está em aberto.</div>
        </div>
        <Button
          label="Pagar agora via Pix"
          class="w-full md:w-auto"
          :disabled="pendingTotal <= 0"
          @click="openPay"
        />
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="text-xs font-medium text-slate-600">Total em aberto</div>
      <div class="mt-2 text-2xl font-semibold text-[#F59E0B]">{{ formatBRL(pendingTotal) }}</div>
    </div>

    <div v-if="my.error || error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error || my.error }}</div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-slate-900">Retiradas pendentes</div>
        <Button label="Atualizar" severity="secondary" :loading="my.loading" @click="my.fetchAll()" />
      </div>

      <div v-if="my.pending.length === 0" class="mt-3 text-sm text-slate-600">Nenhuma pendência.</div>
      <div v-else class="mt-3 space-y-2">
        <div v-for="w in my.pending" :key="w.id" class="rounded-xl border border-slate-100 p-3">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-medium text-slate-900">{{ fmtDateTime(w.createdAt) }}</div>
              <div class="mt-1 flex items-center gap-2 text-xs text-slate-600">
                <span>{{ methodLabel(w.paymentMethod) }}</span>
                <Tag value="Pendente" severity="warning" />
              </div>
            </div>
            <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(w.totalCents) }}</div>
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="payOpen" modal header="Pagamento via Pix" :style="{ width: '36rem' }" :draggable="false">
      <div class="space-y-4">
        <div class="rounded-xl bg-[#EAF3FF] p-4">
          <div class="text-sm font-semibold text-[#003B8E]">Valor total</div>
          <div class="mt-1 text-2xl font-semibold text-[#003B8E]">{{ formatBRL(pendingTotal) }}</div>
        </div>

        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="rounded-xl border border-slate-100 bg-white p-3">
            <div class="text-xs font-medium text-slate-600">Chave Pix</div>
            <div class="mt-2 break-all text-sm text-slate-900">{{ pixKey || 'Chave Pix não configurada' }}</div>
          </div>
          <div class="rounded-xl border border-slate-100 bg-white p-3">
            <div class="text-xs font-medium text-slate-600">QR Code</div>
            <div class="mt-2">
              <img
                v-if="pixQrUrl"
                :src="pixQrUrl"
                class="h-40 w-40 rounded-xl border border-slate-200 object-contain"
                alt="QR Code Pix"
              />
              <div v-else class="text-sm text-slate-600">QR Code não configurado</div>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Após pagar, clique em “Confirmo que paguei” para registrar a confirmação no sistema.
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col gap-2 md:flex-row md:justify-end">
          <Button label="Cancelar" severity="secondary" class="w-full md:w-auto" @click="payOpen = false" />
          <Button
            label="Confirmo que paguei"
            class="w-full md:w-auto"
            :loading="paying"
            :disabled="pendingTotal <= 0"
            @click="confirmPaid"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
