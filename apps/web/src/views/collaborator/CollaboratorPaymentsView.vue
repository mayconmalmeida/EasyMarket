<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import { useMyWithdrawalsStore, type Withdrawal } from '../../stores/my-withdrawals';
import { useSettingsStore } from '../../stores/settings';
import { formatBRL } from '../../lib/money';
import { QrCode, Wallet, ReceiptText } from 'lucide-vue-next';

const my = useMyWithdrawalsStore();
const settings = useSettingsStore();
const receiptOpen = ref(false);
const selected = ref<Withdrawal | null>(null);
const paying = ref(false);
const error = ref<string | null>(null);

const payments = computed(() => my.mine.filter((w) => w.paymentStatus !== 'PENDING'));
const pendingTotal = computed(() => my.pending.reduce((sum, w) => sum + w.totalCents, 0));
const pixKey = computed(() => settings.pixKey || import.meta.env.VITE_PIX_KEY || '');
const pixQrUrl = computed(() => settings.pixQrCodeUrl || import.meta.env.VITE_PIX_QR_CODE_URL || '');

const timeline = computed(() =>
  [...payments.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8),
);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function statusLabel(s: Withdrawal['paymentStatus']) {
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function methodLabel(m: Withdrawal['paymentMethod']) {
  if (m === 'CASH') return 'Dinheiro';
  if (m === 'PIX') return 'Pix';
  return 'Não pago agora';
}

function openReceipt(w: Withdrawal) {
  selected.value = w;
  receiptOpen.value = true;
}

async function markAsPaid() {
  paying.value = true;
  error.value = null;
  try {
    await my.confirmPixAll();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao confirmar pagamento';
  } finally {
    paying.value = false;
  }
}

onMounted(() => {
  settings.loadPublic().catch(() => null);
  if (!my.mine.length || !my.pending.length) my.fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Pagamentos</div>
          <div class="mt-1 text-sm text-slate-600">Área pessoal para acompanhar Pix e comprovantes.</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="my.loading" class="w-full sm:w-auto" @click="my.fetchAll()" />
      </div>
      <div v-if="my.error || error" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ error || my.error }}</div>
    </div>

    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Pix</div>
          <div class="mt-1 text-sm text-slate-600">Use este QR Code para quitar pendências.</div>
        </div>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
          <QrCode class="h-5 w-5" />
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded-2xl bg-[#EAF3FF] p-4">
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Valor pendente</div>
          <div class="mt-2 text-2xl font-semibold text-[#F59E0B]">{{ formatBRL(pendingTotal) }}</div>
          <div class="mt-3 text-sm text-slate-600">Após pagar, marque como pago para registrar no sistema.</div>
          <Button
            label="Marcar como pago"
            class="mt-4 w-full"
            :disabled="pendingTotal <= 0"
            :loading="paying"
            @click="markAsPaid"
          />
        </div>

        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-xs font-medium text-slate-600">QR Code</div>
              <div class="mt-1 text-xs text-slate-500">Chave: {{ pixKey ? 'disponível' : 'não configurada' }}</div>
            </div>
          </div>
          <div class="mt-3">
            <img
              v-if="pixQrUrl"
              :src="pixQrUrl"
              class="h-44 w-44 max-w-full rounded-2xl border border-slate-200 object-contain"
              alt="QR Code Pix"
            />
            <div v-else class="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">QR Code não configurado</div>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Histórico</div>
          <div class="mt-1 text-sm text-slate-600">Pagamentos e registros finalizados.</div>
        </div>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
          <Wallet class="h-5 w-5" />
        </div>
      </div>

      <div v-if="timeline.length === 0" class="mt-4 text-sm text-slate-600">Nenhum pagamento registrado.</div>
      <div v-else class="mt-4 space-y-3">
        <div v-for="p in timeline" :key="p.id" class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-slate-900">{{ fmtDateTime(p.createdAt) }}</div>
              <div class="mt-1 text-xs text-slate-600">{{ methodLabel(p.paymentMethod) }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(p.totalCents) }}</div>
              <Tag :value="statusLabel(p.paymentStatus)" severity="success" class="mt-2" />
            </div>
          </div>
          <div class="mt-3 flex justify-end">
            <Button label="Ver comprovante" severity="secondary" size="small" class="w-full sm:w-auto" @click="openReceipt(p)" />
          </div>
        </div>
      </div>
    </div>

    <Dialog v-model:visible="receiptOpen" modal header="Comprovante interno" :style="{ width: 'min(52rem, 96vw)' }" :draggable="false">
      <div v-if="selected" class="space-y-4">
        <div class="rounded-xl bg-[#EAF3FF] p-4">
          <div class="text-xs font-medium text-slate-600">ID</div>
          <div class="mt-1 break-all text-sm font-semibold text-[#003B8E]">{{ selected.id }}</div>
          <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div class="rounded-xl bg-white p-3">
              <div class="text-xs font-medium text-slate-600">Data</div>
              <div class="mt-1 text-sm text-slate-900">{{ fmtDateTime(selected.createdAt) }}</div>
            </div>
            <div class="rounded-xl bg-white p-3">
              <div class="text-xs font-medium text-slate-600">Valor</div>
              <div class="mt-1 text-sm font-semibold text-[#003B8E]">{{ formatBRL(selected.totalCents) }}</div>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-white">
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold text-[#003B8E]">Itens</div>
            <ReceiptText class="h-4 w-4 text-[#003B8E]" />
          </div>
          <div class="mt-3 space-y-2">
            <div v-for="i in selected.items" :key="i.id" class="flex items-center justify-between rounded-xl border border-slate-100 p-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-slate-900">{{ i.product.name }}</div>
                <div class="mt-1 text-xs text-slate-600">x{{ i.quantity }}</div>
              </div>
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(i.quantity * i.unitPriceCents) }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <Button label="Fechar" severity="secondary" @click="receiptOpen = false" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
