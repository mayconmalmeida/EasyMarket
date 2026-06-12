<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useWithdrawalsStore } from '../../stores/withdrawals';
import { useProductsStore } from '../../stores/products';
import { useUsersStore } from '../../stores/users';
import { formatBRL } from '../../lib/money';

const withdrawals = useWithdrawalsStore();
const products = useProductsStore();
const users = useUsersStore();

const loading = ref(false);
const error = ref<string | null>(null);

const totalSold = computed(() => withdrawals.items.reduce((sum, w) => sum + w.totalCents, 0));
const totalPaid = computed(() => withdrawals.items.filter((w) => w.paymentStatus === 'PAID').reduce((sum, w) => sum + w.totalCents, 0));
const totalPending = computed(() => withdrawals.items.filter((w) => w.paymentStatus === 'PENDING').reduce((sum, w) => sum + w.totalCents, 0));

const lowStock = computed(() => products.lowStockItems.slice().sort((a, b) => a.stock - b.stock).slice(0, 10));

const productsConsumption = computed(() => {
  const map = new Map<string, { name: string; qty: number; cents: number }>();
  for (const w of withdrawals.items) {
    for (const it of w.items) {
      const prev = map.get(it.product.id) ?? { name: it.product.name, qty: 0, cents: 0 };
      map.set(it.product.id, {
        name: prev.name,
        qty: prev.qty + it.quantity,
        cents: prev.cents + it.quantity * it.unitPriceCents,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents).slice(0, 10);
});

const collaboratorsConsumption = computed(() => {
  const map = new Map<string, { name: string; code: string; cents: number }>();
  for (const w of withdrawals.items) {
    const prev = map.get(w.user.id) ?? { name: w.user.name, code: w.user.code, cents: 0 };
    map.set(w.user.id, { ...prev, cents: prev.cents + w.totalCents });
  }
  return [...map.values()].sort((a, b) => b.cents - a.cents).slice(0, 10);
});

const maxProductCents = computed(() => Math.max(1, ...productsConsumption.value.map((p) => p.cents)));
const maxUserCents = computed(() => Math.max(1, ...collaboratorsConsumption.value.map((u) => u.cents)));

function exportCsv() {
  const rows: string[][] = [
    ['Tipo', 'Nome', 'Quantidade', 'Valor (centavos)'],
    ...productsConsumption.value.map((p) => ['Produto', p.name, String(p.qty), String(p.cents)]),
  ];
  const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relatorio-easymarket.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function printPdf() {
  window.print();
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    await Promise.all([withdrawals.fetchAllAdmin(), products.fetchAll(), users.fetchAll()]);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar relatórios';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="admin-operational space-y-3">
    <div class="flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Relatórios</div>
        <div class="text-sm text-slate-600">Visão financeira, consumo e alertas.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
        <Button label="Exportar Excel (CSV)" severity="secondary" @click="exportCsv" />
        <Button label="Exportar PDF" @click="printPdf" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Total vendido</div>
        <div class="mt-1 text-2xl font-bold text-[#003B8E]">{{ formatBRL(totalSold) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Total pago</div>
        <div class="mt-1 text-2xl font-bold text-status-paid">{{ formatBRL(totalPaid) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="text-sm text-slate-500">Total pendente</div>
        <div class="mt-1 text-2xl font-bold text-status-pending">{{ formatBRL(totalPending) }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">Produtos mais consumidos</div>
          <div class="text-sm text-slate-600">Top 10</div>
        </div>
        <div class="mt-3 space-y-2.5">
          <div v-for="p in productsConsumption" :key="p.name" class="rounded-2xl border border-[#E5E7EB] p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-900">{{ p.name }}</div>
                <div class="text-xs text-slate-500">Qtd: {{ p.qty }}</div>
              </div>
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(p.cents) }}</div>
            </div>
            <div class="mt-2 h-2 rounded-full bg-slate-100">
              <div class="h-2 rounded-full bg-[#0057D9]" :style="{ width: `${Math.round((p.cents / maxProductCents) * 100)}%` }" />
            </div>
          </div>
          <div v-if="productsConsumption.length === 0" class="rounded-2xl bg-[#F5F7FB] p-4 text-sm text-slate-600">Sem dados.</div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">Colaboradores com maior consumo</div>
          <div class="text-sm text-slate-600">Top 10</div>
        </div>
        <div class="mt-3 space-y-2.5">
          <div v-for="u in collaboratorsConsumption" :key="u.code" class="rounded-2xl border border-[#E5E7EB] p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-slate-900">{{ u.name }}</div>
                <div class="text-xs text-slate-500">{{ u.code }}</div>
              </div>
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(u.cents) }}</div>
            </div>
            <div class="mt-2 h-2 rounded-full bg-slate-100">
              <div class="h-2 rounded-full bg-[#0057D9]" :style="{ width: `${Math.round((u.cents / maxUserCents) * 100)}%` }" />
            </div>
          </div>
          <div v-if="collaboratorsConsumption.length === 0" class="rounded-2xl bg-[#F5F7FB] p-4 text-sm text-slate-600">Sem dados.</div>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div class="text-sm font-semibold text-slate-900">Estoque baixo</div>
        <div class="text-sm text-slate-600">Top 10</div>
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="p in lowStock" :key="p.id" class="flex items-center justify-between rounded-2xl border border-[#E5E7EB] p-3">
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900">{{ p.name }}</div>
            <div class="text-xs text-slate-500">{{ p.category }}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-bold text-status-low">{{ p.stock }}</div>
            <div class="text-xs text-slate-500">mín. {{ p.minStock }}</div>
          </div>
        </div>
        <div v-if="lowStock.length === 0" class="rounded-2xl bg-[#F5F7FB] p-4 text-sm text-slate-600">Sem alertas.</div>
      </div>
    </div>
  </div>
</template>
