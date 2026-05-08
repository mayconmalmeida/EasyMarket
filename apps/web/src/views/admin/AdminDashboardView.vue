<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useProductsStore } from '../../stores/products';
import { useUsersStore } from '../../stores/users';
import { useWithdrawalsStore } from '../../stores/withdrawals';
import { formatBRL } from '../../lib/money';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';

const products = useProductsStore();
const users = useUsersStore();
const withdrawals = useWithdrawalsStore();

const loading = ref(false);
const error = ref<string | null>(null);

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

const monthWithdrawals = computed(() => {
  const now = new Date();
  const start = startOfMonth(now).getTime();
  return withdrawals.items.filter((w) => new Date(w.createdAt).getTime() >= start);
});

const totalSoldMonth = computed(() => monthWithdrawals.value.reduce((sum, w) => sum + w.totalCents, 0));
const totalPending = computed(() => withdrawals.items.filter((w) => w.paymentStatus === 'PENDING').reduce((sum, w) => sum + w.totalCents, 0));
const countLowStock = computed(() => products.lowStockItems.length);

const totalPaidMonth = computed(() =>
  monthWithdrawals.value.filter((w) => w.paymentStatus !== 'PENDING').reduce((sum, w) => sum + w.totalCents, 0),
);

const recentWithdrawals = computed(() =>
  [...withdrawals.items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8),
);

const stockAlerts = computed(() =>
  products.lowStockItems
    .slice()
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8),
);

const dailySales = computed(() => {
  const days = 14;
  const today = startOfDay(new Date());
  const start = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const buckets = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(d.getTime(), 0);
  }
  for (const w of withdrawals.items) {
    const d = startOfDay(new Date(w.createdAt));
    const t = d.getTime();
    if (t < start.getTime() || t > today.getTime()) continue;
    buckets.set(t, (buckets.get(t) ?? 0) + w.totalCents);
  }
  const keys = [...buckets.keys()].sort((a, b) => a - b);
  return {
    labels: keys.map((t) => {
      const d = new Date(t);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }),
    values: keys.map((t) => (buckets.get(t) ?? 0) / 100),
  };
});

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'area' as const,
    toolbar: { show: false },
    animations: { enabled: true },
    fontFamily: 'Inter, system-ui, sans-serif',
  },
  stroke: { curve: 'smooth' as const, width: 3 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.2, opacityFrom: 0.35, opacityTo: 0.05 } },
  colors: ['#0057D9'],
  grid: { borderColor: '#E5E7EB', strokeDashArray: 4 },
  xaxis: {
    categories: dailySales.value.labels,
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

const chartSeries = computed(() => [{ name: 'Vendas', data: dailySales.value.values }]);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([products.fetchAll(), users.fetchAll(), withdrawals.fetchAllAdmin()]);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar dashboard';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Total vendido no mês</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ formatBRL(totalSoldMonth) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Total pago no mês</div>
        <div class="mt-1 text-2xl font-bold text-[#16A34A]">{{ formatBRL(totalPaidMonth) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Total pendente</div>
        <div class="mt-1 text-2xl font-bold text-status-pending">{{ formatBRL(totalPending) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Estoque baixo</div>
        <div class="mt-1 text-2xl font-bold text-status-low">{{ countLowStock }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Colaboradores</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ users.items.length }}</div>
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-medium text-slate-500">Desempenho</div>
          <div class="mt-1 text-sm font-semibold text-slate-900">Vendas (últimos 14 dias)</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
      </div>
      <div class="mt-4">
        <VueApexCharts height="260" type="area" :options="chartOptions" :series="chartSeries" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-text text-lg font-semibold">Últimas retiradas</div>
          <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
        </div>

        <div class="mt-4 overflow-hidden rounded-lg border border-slate-100">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th class="px-3 py-2">Data/Hora</th>
                <th class="px-3 py-2">Colaborador</th>
                <th class="px-3 py-2">Pagamento</th>
                <th class="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="w in recentWithdrawals" :key="w.id" class="border-t border-slate-100">
                <td class="px-3 py-2 text-slate-700">{{ new Date(w.createdAt).toLocaleString('pt-BR') }}</td>
                <td class="px-3 py-2 text-slate-700">
                  <div class="font-medium text-text">{{ w.user.name }}</div>
                  <div class="text-xs text-slate-500">{{ w.user.code }}</div>
                </td>
                <td class="px-3 py-2">
                  <span
                    class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                    :class="w.paymentStatus === 'PAID' ? 'bg-green-50 text-status-paid' : 'bg-amber-50 text-status-pending'"
                  >
                    {{ w.paymentStatus === 'PAID' ? 'Pago' : 'Pendente' }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right font-semibold text-primary-dark">{{ formatBRL(w.totalCents) }}</td>
              </tr>
              <tr v-if="recentWithdrawals.length === 0">
                <td class="px-3 py-6 text-center text-sm text-slate-600" colspan="4">Sem retiradas.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-text text-lg font-semibold">Alertas de estoque</div>
          <RouterLink class="text-sm font-semibold text-primary-dark" to="/admin/produtos">Ver produtos</RouterLink>
        </div>

        <div class="mt-4 space-y-3">
          <div
            v-for="p in stockAlerts"
            :key="p.id"
            class="flex items-center justify-between rounded-lg border border-slate-100 p-3"
          >
            <div class="min-w-0">
              <div class="truncate font-semibold text-text">{{ p.name }}</div>
              <div class="text-xs text-slate-500">{{ p.category }}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-status-low">{{ p.stock }}</div>
              <div class="text-xs text-slate-500">mín. {{ p.minStock }}</div>
            </div>
          </div>
          <div v-if="stockAlerts.length === 0" class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
            Sem alertas de estoque.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
