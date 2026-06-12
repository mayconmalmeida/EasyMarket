<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useProductsStore } from '../../stores/products';
import { useUsersStore } from '../../stores/users';
import { useWithdrawalsStore } from '../../stores/withdrawals';
import { formatBRL } from '../../lib/money';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { AlertCircle, BadgeDollarSign, PackageSearch, TrendingUp, UsersRound } from 'lucide-vue-next';

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
    foreColor: '#64748B',
  },
  stroke: { curve: 'smooth' as const, width: 3 },
  fill: { type: 'gradient', gradient: { shadeIntensity: 0.2, opacityFrom: 0.35, opacityTo: 0.05 } },
  colors: ['#0057D9'],
  grid: { borderColor: '#EDF2F7', strokeDashArray: 5, padding: { left: 8, right: 8 } },
  xaxis: {
    categories: dailySales.value.labels,
    labels: { style: { colors: '#64748B' } },
    axisBorder: { color: '#EDF2F7' },
    axisTicks: { color: '#EDF2F7' },
  },
  yaxis: {
    labels: {
      style: { colors: '#64748B' },
      formatter: (v: number) => `R$ ${v.toFixed(0)}`,
    },
  },
  markers: {
    size: 0,
    hover: { size: 6 },
  },
  legend: {
    show: true,
    position: 'top',
    horizontalAlign: 'left',
    labels: { colors: '#475569' },
  },
  dataLabels: { enabled: false },
  tooltip: {
    theme: 'light',
    x: { show: true },
    y: { formatter: (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  },
}));

const chartSeries = computed(() => [{ name: 'Vendas', data: dailySales.value.values }]);

const kpiCards = computed(() => [
  {
    title: 'Total vendido',
    value: formatBRL(totalSoldMonth.value),
    helper: 'Mês atual',
    badge: 'Receita',
    icon: BadgeDollarSign,
    iconWrap: 'bg-[#EAF3FF] text-[#0057D9]',
    valueClass: 'text-[#003B8E]',
    badgeClass: 'bg-[#EAF3FF] text-[#0057D9]',
  },
  {
    title: 'Total pago',
    value: formatBRL(totalPaidMonth.value),
    helper: 'Baixa confirmada',
    badge: 'Saudável',
    icon: TrendingUp,
    iconWrap: 'bg-green-50 text-[#16A34A]',
    valueClass: 'text-[#16A34A]',
    badgeClass: 'bg-green-50 text-[#16A34A]',
  },
  {
    title: 'Total pendente',
    value: formatBRL(totalPending.value),
    helper: 'Atenção financeira',
    badge: 'Pendente',
    icon: AlertCircle,
    iconWrap: 'bg-amber-50 text-[#F59E0B]',
    valueClass: 'text-[#F59E0B]',
    badgeClass: 'bg-amber-50 text-[#B45309]',
  },
  {
    title: 'Estoque baixo',
    value: String(countLowStock.value),
    helper: 'Itens abaixo do mínimo',
    badge: countLowStock.value > 0 ? 'Atenção' : 'Controlado',
    icon: PackageSearch,
    iconWrap: 'bg-red-50 text-[#DC2626]',
    valueClass: 'text-[#DC2626]',
    badgeClass: countLowStock.value > 0 ? 'bg-red-50 text-[#DC2626]' : 'bg-slate-100 text-slate-600',
  },
  {
    title: 'Colaboradores',
    value: String(users.items.length),
    helper: 'Base ativa',
    badge: 'Cadastro',
    icon: UsersRound,
    iconWrap: 'bg-[#EEF4FF] text-[#003B8E]',
    valueClass: 'text-[#003B8E]',
    badgeClass: 'bg-[#EEF4FF] text-[#003B8E]',
  },
]);

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
  <div class="space-y-5">
    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      <div
        v-for="card in kpiCards"
        :key="card.title"
        class="group rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFDFF_100%)] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]"
      >
        <div class="flex items-start justify-between gap-3">
          <div :class="['inline-flex h-11 w-11 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5', card.iconWrap]">
            <component :is="card.icon" class="h-5 w-5" />
          </div>
          <span :class="['inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold', card.badgeClass]">
            {{ card.badge }}
          </span>
        </div>
        <div class="mt-5 text-sm font-medium text-slate-500">{{ card.title }}</div>
        <div class="mt-1 text-3xl font-semibold tracking-[-0.03em]" :class="card.valueClass">{{ card.value }}</div>
        <div class="mt-3 flex items-center justify-between gap-2">
          <div class="text-xs font-medium text-slate-500">{{ card.helper }}</div>
          <div class="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full rounded-full bg-[linear-gradient(90deg,#8AB5FF,#0057D9)]" />
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFF_100%)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Desempenho</div>
          <div class="mt-1 text-base font-semibold text-slate-900">Vendas nos últimos 14 dias</div>
          <div class="mt-1 text-sm text-slate-500">Mesmo conjunto de dados, com leitura visual mais clara.</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
      </div>
      <div class="mt-5 overflow-hidden rounded-[20px] border border-[#EEF2F7] bg-[#FCFDFE] p-2">
        <VueApexCharts height="260" type="area" :options="chartOptions" :series="chartSeries" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFF_100%)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-lg font-semibold text-slate-900">Últimas retiradas</div>
            <div class="mt-1 text-sm text-slate-500">Acompanhamento recente das movimentações.</div>
          </div>
          <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
        </div>

        <div class="mt-5 overflow-hidden rounded-[20px] border border-[#EEF2F7] bg-white">
          <table class="w-full text-left text-sm">
            <thead class="bg-[#F8FAFC] text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th class="px-4 py-3">Data/Hora</th>
                <th class="px-4 py-3">Colaborador</th>
                <th class="px-4 py-3">Pagamento</th>
                <th class="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="w in recentWithdrawals"
                :key="w.id"
                class="border-t border-[#EEF2F7] transition-colors duration-200 hover:bg-[#FAFCFF]"
              >
                <td class="px-4 py-4 text-slate-700">{{ new Date(w.createdAt).toLocaleString('pt-BR') }}</td>
                <td class="px-4 py-4 text-slate-700">
                  <div class="font-medium text-text">{{ w.user.name }}</div>
                  <div class="text-xs text-slate-500">{{ w.user.code }}</div>
                </td>
                <td class="px-4 py-4">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1"
                    :class="
                      w.paymentStatus === 'PAID'
                        ? 'bg-green-50 text-status-paid ring-green-100'
                        : 'bg-amber-50 text-status-pending ring-amber-100'
                    "
                  >
                    {{ w.paymentStatus === 'PAID' ? 'Pago' : 'Pendente' }}
                  </span>
                </td>
                <td class="px-4 py-4 text-right font-semibold text-primary-dark">{{ formatBRL(w.totalCents) }}</td>
              </tr>
              <tr v-if="recentWithdrawals.length === 0">
                <td class="px-4 py-8 text-center text-sm text-slate-600" colspan="4">Sem retiradas.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFDFF_100%)] p-6 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-lg font-semibold text-slate-900">Alertas de estoque</div>
            <div class="mt-1 text-sm text-slate-500">Produtos que exigem ação no curto prazo.</div>
          </div>
          <RouterLink class="text-sm font-semibold text-primary-dark" to="/admin/produtos">Ver produtos</RouterLink>
        </div>

        <div class="mt-5 space-y-3">
          <div
            v-for="p in stockAlerts"
            :key="p.id"
            class="flex items-center justify-between rounded-[18px] border border-[#EEF2F7] bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.03)] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(15,23,42,0.06)]"
          >
            <div class="min-w-0">
              <div class="truncate font-semibold text-text">{{ p.name }}</div>
              <div class="text-xs text-slate-500">{{ p.category }}</div>
            </div>
            <div class="text-right">
              <div class="inline-flex items-center rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#DC2626] ring-1 ring-red-100">
                Estoque: {{ p.stock }}
              </div>
              <div class="mt-1 text-xs text-slate-500">mín. {{ p.minStock }}</div>
            </div>
          </div>
          <div v-if="stockAlerts.length === 0" class="rounded-[18px] bg-slate-50 p-4 text-sm text-slate-600">
            Sem alertas de estoque.
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
