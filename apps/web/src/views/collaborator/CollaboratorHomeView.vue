<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMyWithdrawalsStore } from '../../stores/my-withdrawals';
import { formatBRL } from '../../lib/money';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { ArrowDownRight, ArrowUpRight, AlertCircle, Wallet, ShoppingBag, CreditCard, ReceiptText } from 'lucide-vue-next';

const router = useRouter();
const my = useMyWithdrawalsStore();

const pendingTotal = computed(() => my.pending.reduce((sum, w) => sum + w.totalCents, 0));

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

const monthRange = computed(() => {
  const now = new Date();
  const start = startOfMonth(now);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
});

const monthWithdrawals = computed(() => {
  const { start, end } = monthRange.value;
  return my.mine.filter((w) => {
    const d = new Date(w.createdAt);
    return d >= start && d < end;
  });
});

const totalConsumedMonth = computed(() => monthWithdrawals.value.reduce((sum, w) => sum + w.totalCents, 0));
const totalPaidMonth = computed(() =>
  monthWithdrawals.value
    .filter((w) => w.paymentStatus !== 'PENDING')
    .reduce((sum, w) => sum + w.totalCents, 0),
);
const totalPendingMonth = computed(() =>
  monthWithdrawals.value.filter((w) => w.paymentStatus === 'PENDING').reduce((sum, w) => sum + w.totalCents, 0),
);

const lastMonthTotal = computed(() => {
  const now = new Date();
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const end = startOfMonth(now);
  return my.mine
    .filter((w) => {
      const d = new Date(w.createdAt);
      return d >= start && d < end;
    })
    .reduce((sum, w) => sum + w.totalCents, 0);
});

const monthDelta = computed(() => {
  const prev = lastMonthTotal.value;
  const curr = totalConsumedMonth.value;
  if (prev <= 0) return { pct: null as number | null, direction: 'up' as const };
  const pct = ((curr - prev) / prev) * 100;
  return { pct, direction: pct >= 0 ? ('up' as const) : ('down' as const) };
});

const lastWithdrawal = computed(() => my.mine[0] ?? null);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

type Row = {
  id: string;
  createdAt: string;
  product: string;
  quantity: number;
  valueCents: number;
  status: 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';
};

const lastRows = computed<Row[]>(() => {
  const rows: Row[] = [];
  for (const w of my.mine.slice(0, 20)) {
    for (const i of w.items) {
      rows.push({
        id: `${w.id}:${i.id}`,
        createdAt: w.createdAt,
        product: i.product.name,
        quantity: i.quantity,
        valueCents: i.quantity * i.unitPriceCents,
        status: w.paymentStatus,
      });
    }
  }
  return rows
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);
});

const monthlyConsumption = computed(() => {
  const months = 6;
  const now = new Date();
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1));
  const keys: Array<{ y: number; m: number; key: string }> = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    keys.push({ y, m, key: `${y}-${String(m).padStart(2, '0')}` });
  }
  const map = new Map(keys.map((k) => [k.key, 0]));
  for (const w of my.mine) {
    const d = new Date(w.createdAt);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + w.totalCents);
  }
  const labels = keys.map((k) => {
    const dt = new Date(k.y, k.m - 1, 1);
    return dt.toLocaleDateString('pt-BR', { month: 'short' });
  });
  const values = keys.map((k) => (map.get(k.key) ?? 0) / 100);
  return { labels, values };
});

const chartOptions = computed<ApexOptions>(() => ({
  chart: { type: 'bar' as const, toolbar: { show: false }, fontFamily: 'Inter, system-ui, sans-serif' },
  plotOptions: { bar: { borderRadius: 10, columnWidth: '45%' } },
  colors: ['#0057D9'],
  grid: { borderColor: '#E5E7EB', strokeDashArray: 4 },
  xaxis: {
    categories: monthlyConsumption.value.labels,
    labels: { style: { colors: '#64748B' } },
    axisBorder: { color: '#E5E7EB' },
    axisTicks: { color: '#E5E7EB' },
  },
  yaxis: {
    labels: {
      style: { colors: '#64748B' },
      formatter: (v: number) => `R$ ${v.toFixed(0)}`,
    },
  },
  dataLabels: { enabled: false },
  tooltip: {
    y: { formatter: (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  },
}));

const chartSeries = computed(() => [{ name: 'Consumo', data: monthlyConsumption.value.values }]);

function statusLabel(s: Row['status']) {
  if (s === 'PENDING') return 'Pendente';
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function statusSeverity(s: Row['status']) {
  return s === 'PENDING' ? 'warning' : 'success';
}

onMounted(() => {
  my.fetchAll();
});
</script>

<template>
  <div class="space-y-6">
    <div v-if="my.error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ my.error }}</div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-medium text-slate-600">Total consumido no mês</div>
            <div class="mt-2 text-2xl font-semibold text-[#003B8E]">{{ formatBRL(totalConsumedMonth) }}</div>
            <div class="mt-2 flex items-center gap-2 text-xs text-slate-600">
              <template v-if="monthDelta.pct !== null">
                <component :is="monthDelta.direction === 'up' ? ArrowUpRight : ArrowDownRight" class="h-4 w-4" :class="monthDelta.direction === 'up' ? 'text-[#16A34A]' : 'text-[#DC2626]'" />
                <span :class="monthDelta.direction === 'up' ? 'text-[#16A34A]' : 'text-[#DC2626]'">
                  {{ Math.abs(monthDelta.pct).toFixed(0) }}% vs mês anterior
                </span>
              </template>
              <span v-else class="text-slate-500">Sem base de comparação</span>
            </div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <ShoppingBag class="h-5 w-5" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-medium text-slate-600">Total já pago</div>
            <div class="mt-2 text-2xl font-semibold text-[#16A34A]">{{ formatBRL(totalPaidMonth) }}</div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-50 text-[#16A34A]">
            <CreditCard class="h-5 w-5" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-medium text-slate-600">Total pendente</div>
            <div class="mt-2 text-2xl font-semibold text-[#F59E0B]">{{ formatBRL(totalPendingMonth) }}</div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-[#F59E0B]">
            <AlertCircle class="h-5 w-5" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-medium text-slate-600">Última retirada</div>
            <div v-if="lastWithdrawal" class="mt-2">
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(lastWithdrawal.totalCents) }}</div>
              <div class="mt-1 text-xs text-slate-600">{{ fmtDateTime(lastWithdrawal.createdAt) }}</div>
            </div>
            <div v-else class="mt-2 text-sm text-slate-600">Sem retiradas</div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <ReceiptText class="h-5 w-5" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="pendingTotal > 0" class="rounded-2xl border border-red-100 bg-red-50 p-5">
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-[#DC2626]">Atenção: há pendências em aberto</div>
          <div class="mt-1 text-sm text-slate-700">Valor pendente: {{ formatBRL(pendingTotal) }}</div>
        </div>
        <Button label="Pagar agora" @click="router.push('/colaborador/pendencias?pay=1')" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs font-medium text-slate-500">Indicadores</div>
            <div class="mt-1 text-sm font-semibold text-slate-900">Consumo mensal (últimos 6 meses)</div>
          </div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <Wallet class="h-5 w-5" />
          </div>
        </div>
        <div class="mt-4">
          <VueApexCharts height="260" type="bar" :options="chartOptions" :series="chartSeries" />
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">Últimas retiradas</div>
          <Button label="Atualizar" severity="secondary" :loading="my.loading" @click="my.fetchAll()" />
        </div>
        <div class="mt-4">
          <DataTable :value="lastRows" dataKey="id" :rows="10" stripedRows showGridlines>
            <Column header="Data" style="min-width: 10rem">
              <template #body="{ data }">
                <span class="text-sm text-slate-900">{{ fmtDateTime(data.createdAt) }}</span>
              </template>
            </Column>
            <Column header="Produto" field="product" style="min-width: 14rem" />
            <Column header="Qtde" field="quantity" style="min-width: 6rem" />
            <Column header="Valor" sortField="valueCents" sortable style="min-width: 10rem">
              <template #body="{ data }">
                <span class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(data.valueCents) }}</span>
              </template>
            </Column>
            <Column header="Status" field="status" style="min-width: 10rem">
              <template #body="{ data }">
                <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
              </template>
            </Column>
            <template #empty>
              <div class="p-6 text-center text-sm text-slate-600">Sem retiradas.</div>
            </template>
          </DataTable>
        </div>
      </div>
    </div>
  </div>
</template>
