<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import Tag from 'primevue/tag';
import { useMyWithdrawalsStore, type PaymentMethod, type PaymentStatus } from '../../stores/my-withdrawals';
import { formatBRL } from '../../lib/money';

const my = useMyWithdrawalsStore();

const from = ref<string>('');
const to = ref<string>('');
const status = ref<'ALL' | 'PAID' | 'PENDING'>('ALL');
const method = ref<'ALL' | PaymentMethod>('ALL');

function parseDateInput(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const filteredWithdrawals = computed(() => {
  const fromDate = parseDateInput(from.value);
  const toDate = parseDateInput(to.value);
  const toEnd = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null;

  return my.mine.filter((w) => {
    const d = new Date(w.createdAt);
    if (fromDate && d < fromDate) return false;
    if (toEnd && d >= toEnd) return false;
    if (status.value !== 'ALL') {
      const s = w.paymentStatus === 'PENDING' ? 'PENDING' : 'PAID';
      if (s !== status.value) return false;
    }
    if (method.value !== 'ALL' && w.paymentMethod !== method.value) return false;
    return true;
  });
});

const totalCents = computed(() => filteredWithdrawals.value.reduce((sum, w) => sum + (w.totalCents ?? 0), 0));
const totalPurchases = computed(() => filteredWithdrawals.value.length);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function statusLabel(s: PaymentStatus) {
  if (s === 'PENDING') return 'Pendente';
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function statusSeverity(s: PaymentStatus) {
  return s === 'PENDING' ? 'warning' : 'success';
}

function methodLabel(m: PaymentMethod) {
  if (m === 'CASH') return 'Dinheiro';
  if (m === 'PIX') return 'Pix';
  return 'Não pago agora';
}

onMounted(() => {
  if (!my.mine.length) my.fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Meu Extrato</div>
          <div class="mt-1 text-sm text-slate-600">Compras registradas no mercadinho.</div>
        </div>
        <div class="flex items-center gap-2 rounded-2xl bg-[#EAF3FF] px-3 py-2 text-xs font-semibold text-[#003B8E]">
          <span>{{ totalPurchases }} compras</span>
          <span class="text-slate-300">•</span>
          <span>Total {{ formatBRL(totalCents) }}</span>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div class="space-y-1">
          <label class="text-xs font-medium text-slate-600">Período (de)</label>
          <input v-model="from" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-slate-600">Período (até)</label>
          <input v-model="to" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-900" />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-slate-600">Status</label>
          <select v-model="status" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-900">
            <option value="ALL">Todos</option>
            <option value="PAID">Pago</option>
            <option value="PENDING">Pendente</option>
          </select>
        </div>
        <div class="space-y-1 md:col-span-3">
          <label class="text-xs font-medium text-slate-600">Forma de pagamento</label>
          <select v-model="method" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-slate-900">
            <option value="ALL">Todas</option>
            <option value="CASH">Dinheiro</option>
            <option value="PIX">Pix</option>
            <option value="NONE">Não pago agora</option>
          </select>
        </div>
      </div>

      <div v-if="my.error" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ my.error }}</div>
    </div>

    <div class="space-y-3">
      <div
        v-for="w in filteredWithdrawals"
        :key="w.id"
        class="rounded-[22px] border border-[#E5E7EB] bg-white p-4 shadow-sm"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900">
              {{ w.items.map((i) => i.product.name).slice(0, 2).join(', ') }}<span v-if="w.items.length > 2">…</span>
            </div>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span>{{ fmtDateTime(w.createdAt) }}</span>
              <span class="text-slate-300">•</span>
              <span class="font-medium text-slate-700">{{ methodLabel(w.paymentMethod) }}</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(w.totalCents) }}</div>
            <Tag class="mt-2" :value="statusLabel(w.paymentStatus)" :severity="statusSeverity(w.paymentStatus)" />
          </div>
        </div>
      </div>

      <div v-if="filteredWithdrawals.length === 0" class="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center text-sm text-slate-600">
        Sem compras para os filtros selecionados.
      </div>
    </div>
  </div>
</template>
