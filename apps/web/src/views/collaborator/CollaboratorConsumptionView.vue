<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { useMyWithdrawalsStore, type PaymentMethod, type PaymentStatus } from '../../stores/my-withdrawals';
import { formatBRL } from '../../lib/money';

type Row = {
  id: string;
  createdAt: string;
  product: string;
  quantity: number;
  valueCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
};

const my = useMyWithdrawalsStore();

const from = ref<string>('');
const to = ref<string>('');
const status = ref<'ALL' | 'PAID' | 'PENDING'>('ALL');
const method = ref<'ALL' | PaymentMethod>('ALL');

const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  for (const w of my.mine) {
    for (const i of w.items) {
      out.push({
        id: `${w.id}:${i.id}`,
        createdAt: w.createdAt,
        product: i.product.name,
        quantity: i.quantity,
        valueCents: i.quantity * i.unitPriceCents,
        paymentMethod: w.paymentMethod,
        paymentStatus: w.paymentStatus,
      });
    }
  }
  return out;
});

function parseDateInput(value: string) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

const filtered = computed(() => {
  const fromDate = parseDateInput(from.value);
  const toDate = parseDateInput(to.value);
  const toEnd = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000) : null;

  return rows.value.filter((r) => {
    const d = new Date(r.createdAt);
    if (fromDate && d < fromDate) return false;
    if (toEnd && d >= toEnd) return false;
    if (status.value !== 'ALL') {
      const s = r.paymentStatus === 'PENDING' ? 'PENDING' : 'PAID';
      if (s !== status.value) return false;
    }
    if (method.value !== 'ALL' && r.paymentMethod !== method.value) return false;
    return true;
  });
});

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
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="text-sm font-semibold text-slate-900">Meu Consumo</div>
      <div class="mt-1 text-sm text-slate-600">Use os filtros para consultar seu extrato.</div>
      <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
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

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <DataTable :value="filtered" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines>
        <Column header="Data" style="min-width: 12rem">
          <template #body="{ data }">
            <span class="text-sm text-slate-900">{{ fmtDateTime(data.createdAt) }}</span>
          </template>
        </Column>
        <Column header="Produto" field="product" sortable style="min-width: 16rem" />
        <Column header="Qtde" field="quantity" sortable style="min-width: 6rem" />
        <Column header="Valor" sortable sortField="valueCents" style="min-width: 10rem">
          <template #body="{ data }">
            <span class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(data.valueCents) }}</span>
          </template>
        </Column>
        <Column header="Pagamento" field="paymentMethod" style="min-width: 10rem">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">{{ methodLabel(data.paymentMethod) }}</span>
          </template>
        </Column>
        <Column header="Status" field="paymentStatus" style="min-width: 10rem">
          <template #body="{ data }">
            <Tag :value="statusLabel(data.paymentStatus)" :severity="statusSeverity(data.paymentStatus)" />
          </template>
        </Column>
        <template #empty>
          <div class="p-6 text-center text-sm text-slate-600">Sem registros para os filtros selecionados.</div>
        </template>
      </DataTable>
    </div>
  </div>
</template>
