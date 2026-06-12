<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import { formatBRL } from '../../lib/money';
import { useProductsStore } from '../../stores/products';
import {
  useStockMovementsStore,
  type ListStockMovementsQuery,
  type StockMovementItem,
  type StockMovementSource,
  type StockMovementType,
} from '../../stores/stock-movements';

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const productsStore = useProductsStore();
const movementsStore = useStockMovementsStore();

const error = ref<string | null>(null);

const filters = ref({
  productId: 'ALL' as string | 'ALL',
  type: 'ALL' as StockMovementType | 'ALL',
  source: 'ALL' as StockMovementSource | 'ALL',
  from: '',
  to: '',
});

const productOptions = computed(() => [
  { label: 'Todos', value: 'ALL' as const },
  ...productsStore.items.map((p) => ({
    label: `${p.name} • ${p.category}`,
    value: p.id,
  })),
]);

const typeOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Entrada', value: 'IN' as const },
  { label: 'Saída', value: 'OUT' as const },
  { label: 'Ajuste', value: 'ADJUST' as const },
];

const sourceOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Entradas', value: 'STOCK_ENTRY' as const },
  { label: 'Retiradas', value: 'WITHDRAWAL' as const },
  { label: 'Ajustes manuais', value: 'MANUAL_ADJUSTMENT' as const },
];

function typeLabel(t: StockMovementType) {
  if (t === 'IN') return 'Entrada';
  if (t === 'OUT') return 'Saída';
  return 'Ajuste';
}

function typeSeverity(t: StockMovementType) {
  if (t === 'IN') return 'success';
  if (t === 'OUT') return 'danger';
  return 'warning';
}

function sourceLabel(s: StockMovementSource) {
  if (s === 'STOCK_ENTRY') return 'Entrada';
  if (s === 'WITHDRAWAL') return 'Retirada';
  return 'Ajuste manual';
}

function buildQuery(): ListStockMovementsQuery {
  const q: ListStockMovementsQuery = { take: 200 };
  if (filters.value.productId !== 'ALL') q.productId = filters.value.productId;
  if (filters.value.type !== 'ALL') q.type = filters.value.type;
  if (filters.value.source !== 'ALL') q.source = filters.value.source;
  if (filters.value.from) q.from = new Date(filters.value.from).toISOString();
  if (filters.value.to) q.to = new Date(filters.value.to).toISOString();
  return q;
}

async function load() {
  error.value = null;
  try {
    await Promise.all([productsStore.fetchAll(), movementsStore.fetchAll(buildQuery())]);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar movimentações';
  }
}

function clearDates() {
  filters.value.from = '';
  filters.value.to = '';
}

function moneyOrDash(v: number | null) {
  return v === null ? '-' : formatBRL(v);
}

function qtyLabel(m: StockMovementItem) {
  if (m.type === 'ADJUST') return m.quantity > 0 ? `+${m.quantity}` : String(m.quantity);
  return String(m.quantity);
}

onMounted(async () => {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  filters.value.from = toDatetimeLocalValue(from);
  filters.value.to = toDatetimeLocalValue(now);
  await load();
});
</script>

<template>
  <div class="admin-operational space-y-3">
    <div class="flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Movimentações de Estoque</div>
        <div class="text-sm text-slate-600">Entradas, saídas por retirada e ajustes manuais.</div>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button label="Atualizar" severity="secondary" class="w-full sm:w-auto" :loading="movementsStore.loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm xl:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Filtros</div>
        <div class="mt-1 text-sm text-slate-600">Refine a listagem.</div>
        <div class="mt-3 grid grid-cols-1 gap-2.5">
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Produto</label>
            <Dropdown v-model="filters.productId" class="w-full" :options="productOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Tipo</label>
            <Dropdown v-model="filters.type" class="w-full" :options="typeOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Origem</label>
            <Dropdown v-model="filters.source" class="w-full" :options="sourceOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">De</label>
            <input v-model="filters.from" type="datetime-local" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Até</label>
            <input v-model="filters.to" type="datetime-local" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>

          <div class="flex items-center gap-2">
            <Button label="Aplicar" class="flex-1" @click="load" />
            <Button label="Limpar" severity="secondary" size="small" @click="clearDates" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm xl:col-span-4">
        <DataTable
          :value="movementsStore.items"
          dataKey="id"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
          stripedRows
          showGridlines
          tableStyle="min-width: 100%"
        >
          <Column header="Data/Hora" style="min-width: 10rem">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ new Date(data.occurredAt).toLocaleString() }}</span>
            </template>
          </Column>
          <Column field="product.name" header="Produto" style="min-width: 12rem" />
          <Column field="product.category" header="Categoria" style="min-width: 8rem" headerClass="hidden lg:table-cell" class="hidden lg:table-cell" />
          <Column header="Qtd" style="min-width: 6rem">
            <template #body="{ data }">
              <span class="font-semibold text-slate-900">{{ qtyLabel(data) }}</span>
            </template>
          </Column>
          <Column header="Tipo" style="min-width: 7rem">
            <template #body="{ data }">
              <Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" />
            </template>
          </Column>
          <Column header="Origem" style="min-width: 8rem" headerClass="hidden md:table-cell" class="hidden md:table-cell">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ sourceLabel(data.source) }}</span>
            </template>
          </Column>
          <Column header="Valor" style="min-width: 8rem" headerClass="hidden xl:table-cell" class="hidden xl:table-cell">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ moneyOrDash(data.unitPriceCents) }}</span>
            </template>
          </Column>
          <Column header="Usuário" style="min-width: 9rem" headerClass="hidden lg:table-cell" class="hidden lg:table-cell">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ data.actor.name }} ({{ data.actor.code }})</span>
            </template>
          </Column>
          <Column header="Obs." style="min-width: 9rem" headerClass="hidden xl:table-cell" class="hidden xl:table-cell">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ data.note || '-' }}</span>
            </template>
          </Column>

          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhuma movimentação encontrada.</div>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>

