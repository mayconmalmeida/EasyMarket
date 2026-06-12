<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/money';
import { useCategoriesStore } from '../../stores/categories';
import { useProductsStore, type Product } from '../../stores/products';
import { useStockEntriesStore } from '../../stores/stock-entries';

function toCents(value: number) {
  return Math.round((value ?? 0) * 100);
}

function toBRLValue(cents: number | null | undefined) {
  return (cents ?? 0) / 100;
}

function toDatetimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const categoriesStore = useCategoriesStore();
const productsStore = useProductsStore();
const entriesStore = useStockEntriesStore();

const barcodeRef = ref<any>(null);

const loadingLookup = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const foundProduct = ref<Product | null>(null);

const form = ref({
  barcode: '',
  productName: '',
  category: '',
  quantity: 1,
  cost: 0,
  price: 0,
  occurredAt: toDatetimeLocalValue(new Date()),
  note: '',
});

const categoryOptions = computed(() => categoriesStore.items.map((c) => ({ label: c.name, value: c.name })));

function resetForm() {
  foundProduct.value = null;
  form.value = {
    barcode: '',
    productName: '',
    category: categoriesStore.items[0]?.name ?? '',
    quantity: 1,
    cost: 0,
    price: 0,
    occurredAt: toDatetimeLocalValue(new Date()),
    note: '',
  };
}

async function lookupBarcode() {
  const barcode = form.value.barcode.trim();
  if (!barcode) return;
  loadingLookup.value = true;
  error.value = null;
  try {
    const { data } = await api.get<Product | null>(`/admin/products/by-barcode/${encodeURIComponent(barcode)}`);
    foundProduct.value = data;
    if (data) {
      form.value.productName = data.name;
      form.value.category = data.category;
      form.value.price = toBRLValue(data.priceCents);
      form.value.cost = toBRLValue(data.costCents ?? 0);
    } else {
      form.value.productName = '';
      form.value.category = categoriesStore.items[0]?.name ?? '';
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao buscar código de barras';
  } finally {
    loadingLookup.value = false;
  }
}

async function save() {
  const barcode = form.value.barcode.trim();
  if (!barcode) {
    error.value = 'Informe o código de barras';
    return;
  }
  if (!form.value.quantity || form.value.quantity < 1) {
    error.value = 'Quantidade inválida';
    return;
  }
  if (!form.value.price || form.value.price < 0) {
    error.value = 'Preço de venda inválido';
    return;
  }
  if (!foundProduct.value && (!form.value.productName.trim() || !form.value.category.trim())) {
    error.value = 'Informe produto e categoria';
    return;
  }

  saving.value = true;
  error.value = null;
  try {
    const occurredAt = new Date(form.value.occurredAt);
    const input = {
      barcode,
      ...(foundProduct.value ? { productId: foundProduct.value.id } : { product: { name: form.value.productName.trim(), category: form.value.category.trim() } }),
      quantity: Number(form.value.quantity),
      ...(form.value.cost ? { costCents: toCents(Number(form.value.cost)) } : {}),
      priceCents: toCents(Number(form.value.price)),
      occurredAt: occurredAt.toISOString(),
      ...(form.value.note.trim() ? { note: form.value.note.trim() } : {}),
    };

    await entriesStore.create(input);
    await productsStore.fetchAll();
    resetForm();
    await entriesStore.fetchAll();
    barcodeRef.value?.$el?.querySelector?.('input')?.focus?.();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao salvar entrada';
  } finally {
    saving.value = false;
  }
}

async function load() {
  await Promise.all([categoriesStore.fetch(), productsStore.fetchAll(), entriesStore.fetchAll()]);
  if (!form.value.category.trim()) form.value.category = categoriesStore.items[0]?.name ?? '';
}

onMounted(async () => {
  await load();
  barcodeRef.value?.$el?.querySelector?.('input')?.focus?.();
});
</script>

<template>
  <div class="admin-operational space-y-3">
    <div class="flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Entradas de Estoque</div>
        <div class="text-sm text-slate-600">Registro simples de entrada e atualização do estoque atual.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="entriesStore.loading" @click="load" />
        <Button label="Salvar entrada" :loading="saving" @click="save" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <div class="space-y-1 md:col-span-1">
          <label class="text-sm font-medium text-slate-700">Código de barras</label>
          <InputText
            ref="barcodeRef"
            v-model="form.barcode"
            class="w-full"
            inputmode="numeric"
            autocomplete="off"
            placeholder="Leia no scanner e pressione Enter"
            :disabled="saving"
            @keydown.enter.prevent="lookupBarcode"
            @blur="lookupBarcode"
          />
          <div class="text-xs text-slate-500">{{ loadingLookup ? 'Buscando produto…' : foundProduct ? 'Produto encontrado' : 'Produto não cadastrado' }}</div>
        </div>

        <div class="space-y-1 md:col-span-1 xl:col-span-3">
          <label class="text-sm font-medium text-slate-700">Produto</label>
          <InputText v-model="form.productName" class="w-full" :disabled="!!foundProduct || saving" placeholder="Nome do produto" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Categoria</label>
          <Dropdown v-model="form.category" class="w-full" :options="categoryOptions" optionLabel="label" optionValue="value" :disabled="!!foundProduct || saving" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Quantidade</label>
          <input v-model.number="form.quantity" type="number" min="1" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" :disabled="saving" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço de custo (R$) opcional</label>
          <input v-model.number="form.cost" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" :disabled="saving" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço de venda (R$)</label>
          <input v-model.number="form.price" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" :disabled="saving" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Data/Hora da entrada</label>
          <input v-model="form.occurredAt" type="datetime-local" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" :disabled="saving" />
        </div>

        <div class="space-y-1 md:col-span-2 xl:col-span-2">
          <label class="text-sm font-medium text-slate-700">Observação (opcional)</label>
          <InputText v-model="form.note" class="w-full" :disabled="saving" placeholder="Ex: lote, fornecedor, conferência…" />
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm">
      <div class="mb-3 flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Últimas entradas</div>
          <div class="text-sm text-slate-600">Histórico recente.</div>
        </div>
      </div>

      <DataTable :value="entriesStore.items" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines tableStyle="min-width: 100%">
        <Column header="Data/Hora" style="min-width: 10rem">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">{{ new Date(data.occurredAt).toLocaleString() }}</span>
          </template>
        </Column>
        <Column field="product.name" header="Produto" style="min-width: 12rem" />
        <Column field="product.category" header="Categoria" style="min-width: 8rem" headerClass="hidden lg:table-cell" class="hidden lg:table-cell" />
        <Column header="Qtd" style="min-width: 6rem">
          <template #body="{ data }">
            <span class="font-semibold text-slate-900">{{ data.quantity }}</span>
          </template>
        </Column>
        <Column header="Custo" style="min-width: 8rem" headerClass="hidden md:table-cell" class="hidden md:table-cell">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">{{ data.unitCostCents ? formatBRL(data.unitCostCents) : '-' }}</span>
          </template>
        </Column>
        <Column header="Venda" style="min-width: 8rem" headerClass="hidden xl:table-cell" class="hidden xl:table-cell">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">{{ data.unitPriceCents ? formatBRL(data.unitPriceCents) : '-' }}</span>
          </template>
        </Column>
        <Column header="Usuário" style="min-width: 9rem" headerClass="hidden lg:table-cell" class="hidden lg:table-cell">
          <template #body="{ data }">
            <span class="text-sm text-slate-700">{{ data.actor.name }} ({{ data.actor.code }})</span>
          </template>
        </Column>
        <Column field="note" header="Obs." style="min-width: 10rem" headerClass="hidden xl:table-cell" class="hidden xl:table-cell" />
        <template #empty>
          <div class="p-6 text-center text-sm text-slate-600">Nenhuma entrada registrada.</div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

