<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/money';
import type { Product } from '../../stores/products';

type StockDetailResponse = {
  product: Product;
  stock: { current: number; min: number; status: 'OK' | 'BAIXO' | 'SEM_ESTOQUE' };
  stats: {
    outDay: number;
    outWeek: number;
    outMonth: number;
    outYear: number;
    totalSoldCents: number;
    topBuyer: { userId: string; name: string; code: string; quantity: number; totalCents: number } | null;
  };
  history: {
    entries: Array<{ id: string; quantity: number; occurredAt: string; unitCostCents?: number | null; unitPriceCents?: number | null; note?: string | null; actor: { id: string; name: string; code: string } }>;
    adjustments: Array<{ id: string; quantity: number; occurredAt: string; note?: string | null; actor: { id: string; name: string; code: string } }>;
    outs: Array<{ quantity: number; unitPriceCents: number; occurredAt: string; actor: { id: string; name: string; code: string } }>;
  };
  chart: { labels: string[]; data: number[] };
  ranking: Array<{ userId: string; name: string; code: string; quantity: number; totalCents: number }>;
};

const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id || ''));

const loading = ref(false);
const error = ref<string | null>(null);
const detail = ref<StockDetailResponse | null>(null);

function stockSeverity(status: StockDetailResponse['stock']['status']) {
  if (status === 'SEM_ESTOQUE') return 'danger';
  if (status === 'BAIXO') return 'warning';
  return 'success';
}

function stockLabel(status: StockDetailResponse['stock']['status']) {
  if (status === 'SEM_ESTOQUE') return 'Sem estoque';
  if (status === 'BAIXO') return 'Estoque baixo';
  return 'OK';
}

const chartOptions = computed<ApexOptions>(() => {
  const labels = detail.value?.chart.labels ?? [];
  const categories = labels.map((x) => {
    const d = new Date(`${x}T00:00:00`);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  });
  return {
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
      animations: { enabled: true },
      fontFamily: 'Inter, system-ui, sans-serif',
    },
    colors: ['#0057D9'],
    grid: { borderColor: '#E5E7EB', strokeDashArray: 4 },
    xaxis: {
      categories,
      labels: { style: { colors: '#64748B' } },
      axisBorder: { color: '#E5E7EB' },
      axisTicks: { color: '#E5E7EB' },
    },
    yaxis: {
      labels: { style: { colors: '#64748B' } },
      title: { text: 'Qtd', style: { color: '#64748B' } },
    },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v: number) => `${v} un` } },
  };
});

const chartSeries = computed(() => [{ name: 'Consumo', data: detail.value?.chart.data ?? [] }]);

async function load() {
  if (!id.value) return;
  loading.value = true;
  error.value = null;
  try {
    const { data } = await api.get<StockDetailResponse>(`/admin/products/${id.value}/stock-detail`);
    detail.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar produto';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Produto</div>
        <div class="text-sm text-slate-600">Detalhe, estoque e consumo.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Voltar" severity="secondary" @click="router.push('/admin/produtos')" />
        <Button label="Atualizar" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div v-if="detail" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-lg font-bold text-slate-900">{{ detail.product.name }}</div>
              <div class="mt-1 text-sm text-slate-600">
                {{ detail.product.category }}
                <span v-if="detail.product.barcode" class="text-slate-400">•</span>
                <span v-if="detail.product.barcode">Barcode {{ detail.product.barcode }}</span>
              </div>
            </div>
            <Tag :value="detail.product.status === 'ACTIVE' ? 'Ativo' : 'Inativo'" :severity="detail.product.status === 'ACTIVE' ? 'success' : 'secondary'" />
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Preço de venda</div>
              <div class="mt-1 text-lg font-bold text-[#003B8E]">{{ formatBRL(detail.product.priceCents) }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Preço de custo</div>
              <div class="mt-1 text-lg font-bold text-slate-900">{{ detail.product.costCents ? formatBRL(detail.product.costCents) : '-' }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Estoque</div>
              <div class="mt-1 flex items-center gap-2">
                <div class="text-lg font-bold text-slate-900">{{ detail.stock.current }}</div>
                <Tag :value="stockLabel(detail.stock.status)" :severity="stockSeverity(detail.stock.status)" />
              </div>
              <div class="mt-1 text-xs text-slate-500">Mínimo: {{ detail.stock.min }}</div>
            </div>
          </div>
        </div>

        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-2">
          <div class="text-sm font-semibold text-slate-900">Relatórios</div>
          <div class="mt-1 text-sm text-slate-600">Saídas e total vendido.</div>
          <div class="mt-4 grid grid-cols-2 gap-3">
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Saídas (dia)</div>
              <div class="mt-1 text-xl font-bold text-slate-900">{{ detail.stats.outDay }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Saídas (semana)</div>
              <div class="mt-1 text-xl font-bold text-slate-900">{{ detail.stats.outWeek }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Saídas (mês)</div>
              <div class="mt-1 text-xl font-bold text-slate-900">{{ detail.stats.outMonth }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4">
              <div class="text-xs text-slate-500">Saídas (ano)</div>
              <div class="mt-1 text-xl font-bold text-slate-900">{{ detail.stats.outYear }}</div>
            </div>
            <div class="rounded-xl bg-[#F5F7FB] p-4 col-span-2">
              <div class="text-xs text-slate-500">Total vendido (histórico)</div>
              <div class="mt-1 text-xl font-bold text-[#003B8E]">{{ formatBRL(detail.stats.totalSoldCents) }}</div>
            </div>
          </div>
          <div class="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-4">
            <div class="text-xs font-semibold text-slate-600">Colaborador que mais comprou</div>
            <div v-if="detail.stats.topBuyer" class="mt-2 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-900">{{ detail.stats.topBuyer.name }} ({{ detail.stats.topBuyer.code }})</div>
                <div class="text-xs text-slate-600">{{ detail.stats.topBuyer.quantity }} un • {{ formatBRL(detail.stats.topBuyer.totalCents) }}</div>
              </div>
            </div>
            <div v-else class="mt-2 text-sm text-slate-600">Sem consumo registrado.</div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Consumo (últimos 30 dias)</div>
        <div class="mt-1 text-sm text-slate-600">Quantidade de saídas por dia.</div>
        <div class="mt-4">
          <VueApexCharts height="280" :options="chartOptions" :series="chartSeries" />
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div class="mb-3">
            <div class="text-sm font-semibold text-slate-900">Histórico de entradas</div>
            <div class="text-sm text-slate-600">Últimos lançamentos.</div>
          </div>
          <DataTable :value="detail.history.entries" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20]" stripedRows showGridlines>
            <Column header="Data/Hora" style="min-width: 12rem">
              <template #body="{ data }">{{ new Date(data.occurredAt).toLocaleString() }}</template>
            </Column>
            <Column header="Qtd" style="min-width: 6rem">
              <template #body="{ data }"><span class="font-semibold text-slate-900">{{ data.quantity }}</span></template>
            </Column>
            <Column header="Custo" style="min-width: 10rem">
              <template #body="{ data }">{{ data.unitCostCents ? formatBRL(data.unitCostCents) : '-' }}</template>
            </Column>
            <Column header="Venda" style="min-width: 10rem">
              <template #body="{ data }">{{ data.unitPriceCents ? formatBRL(data.unitPriceCents) : '-' }}</template>
            </Column>
            <Column header="Usuário" style="min-width: 12rem">
              <template #body="{ data }">{{ data.actor.name }} ({{ data.actor.code }})</template>
            </Column>
            <Column header="Obs." style="min-width: 14rem">
              <template #body="{ data }">{{ data.note || '-' }}</template>
            </Column>
            <template #empty>
              <div class="p-6 text-center text-sm text-slate-600">Nenhuma entrada registrada.</div>
            </template>
          </DataTable>
        </div>

        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
          <div class="mb-3">
            <div class="text-sm font-semibold text-slate-900">Histórico de saídas</div>
            <div class="text-sm text-slate-600">Últimas retiradas.</div>
          </div>
          <DataTable :value="detail.history.outs" dataKey="occurredAt" paginator :rows="10" :rowsPerPageOptions="[10, 20]" stripedRows showGridlines>
            <Column header="Data/Hora" style="min-width: 12rem">
              <template #body="{ data }">{{ new Date(data.occurredAt).toLocaleString() }}</template>
            </Column>
            <Column header="Qtd" style="min-width: 6rem">
              <template #body="{ data }"><span class="font-semibold text-slate-900">{{ data.quantity }}</span></template>
            </Column>
            <Column header="Valor" style="min-width: 10rem">
              <template #body="{ data }">{{ formatBRL(data.unitPriceCents) }}</template>
            </Column>
            <Column header="Colaborador" style="min-width: 14rem">
              <template #body="{ data }">{{ data.actor.name }} ({{ data.actor.code }})</template>
            </Column>
            <template #empty>
              <div class="p-6 text-center text-sm text-slate-600">Nenhuma saída registrada.</div>
            </template>
          </DataTable>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="mb-3">
          <div class="text-sm font-semibold text-slate-900">Ranking de colaboradores</div>
          <div class="text-sm text-slate-600">Quem mais comprou o produto.</div>
        </div>
        <DataTable :value="detail.ranking" dataKey="userId" stripedRows showGridlines>
          <Column field="name" header="Colaborador" style="min-width: 18rem">
            <template #body="{ data }">{{ data.name }} ({{ data.code }})</template>
          </Column>
          <Column field="quantity" header="Qtd" style="min-width: 8rem" />
          <Column header="Total" style="min-width: 12rem">
            <template #body="{ data }">{{ formatBRL(data.totalCents) }}</template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Sem dados.</div>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>

