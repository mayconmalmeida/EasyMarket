<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import { useProductsStore, type Product } from '../../stores/products';
import { useCategoriesStore } from '../../stores/categories';
import { formatBRL } from '../../lib/money';
import { useSettingsStore } from '../../stores/settings';

type StatusOption = { label: string; value: 'ALL' | 'ACTIVE' | 'INACTIVE' };

const productsStore = useProductsStore();
const categoriesStore = useCategoriesStore();
const settings = useSettingsStore();
const router = useRouter();

const search = ref('');
const category = ref<string | 'ALL'>('ALL');
const status = ref<StatusOption['value']>('ALL');
const lowStockOnly = ref(false);

const createOpen = ref(false);
const editOpen = ref(false);
const stockOpen = ref(false);

const saving = ref(false);
const error = ref<string | null>(null);

const selected = ref<Product | null>(null);

const form = ref({
  barcode: '',
  name: '',
  category: '',
  cost: 0,
  price: 0,
  stock: 0,
  minStock: settings.minStockDefault,
  photoUrl: '',
  status: 'ACTIVE' as Product['status'],
});

const stockForm = ref({ stock: 0 });
const photoMeta = ref<{ w: number; h: number } | null>(null);

const statusOptions: StatusOption[] = [
  { label: 'Todos', value: 'ALL' },
  { label: 'Ativo', value: 'ACTIVE' },
  { label: 'Inativo', value: 'INACTIVE' },
];

const categoryOptions = computed(() => [
  { label: 'Todas', value: 'ALL' as const },
  ...categoriesStore.items.map((c) => ({ label: c.name, value: c.name })),
]);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return productsStore.items.filter((p) => {
    const okName = q ? p.name.toLowerCase().includes(q) : true;
    const okCat = category.value === 'ALL' ? true : p.category === category.value;
    const okStatus = status.value === 'ALL' ? true : p.status === status.value;
    const okLow = lowStockOnly.value ? p.stock <= p.minStock : true;
    return okName && okCat && okStatus && okLow;
  });
});

function toBRLValue(cents: number) {
  return (cents ?? 0) / 100;
}

function toCents(value: number) {
  return Math.round((value ?? 0) * 100);
}

function openCreate() {
  error.value = null;
  selected.value = null;
  photoMeta.value = null;
  form.value = {
    barcode: '',
    name: '',
    category: category.value !== 'ALL' ? category.value : categoriesStore.items[0]?.name ?? '',
    cost: 0,
    price: 0,
    stock: 0,
    minStock: settings.minStockDefault,
    photoUrl: '',
    status: 'ACTIVE',
  };
  createOpen.value = true;
}

function openEdit(p: Product) {
  error.value = null;
  selected.value = p;
  photoMeta.value = null;
  form.value = {
    barcode: p.barcode ?? '',
    name: p.name,
    category: p.category,
    cost: toBRLValue(p.costCents ?? 0),
    price: toBRLValue(p.priceCents),
    stock: p.stock,
    minStock: p.minStock,
    photoUrl: p.photoUrl ?? '',
    status: p.status,
  };
  editOpen.value = true;
}

function openStock(p: Product) {
  error.value = null;
  selected.value = p;
  stockForm.value = { stock: p.stock };
  stockOpen.value = true;
}

function onPreviewLoad(e: Event) {
  const img = e.target as HTMLImageElement | null;
  if (!img) return;
  const w = img.naturalWidth || 0;
  const h = img.naturalHeight || 0;
  photoMeta.value = w > 0 && h > 0 ? { w, h } : null;
}

const photoHint = computed(() => {
  if (!form.value.photoUrl?.trim()) return null;
  const meta = photoMeta.value;
  if (!meta) return 'Recomendado: imagem quadrada (1:1), ex.: 512×512 ou 800×800.';
  const isSquare = Math.abs(meta.w - meta.h) <= 2;
  if (isSquare) return `Imagem 1:1 detectada (${meta.w}×${meta.h}).`;
  return `Imagem não é 1:1 (${meta.w}×${meta.h}). No Tablet ela será recortada para quadrado.`;
});

async function saveCreate() {
  saving.value = true;
  error.value = null;
  try {
    await productsStore.create({
      barcode: form.value.barcode.trim() || null,
      name: form.value.name.trim(),
      category: form.value.category.trim(),
      photoUrl: form.value.photoUrl.trim() || null,
      costCents: form.value.cost ? toCents(Number(form.value.cost)) : null,
      priceCents: toCents(Number(form.value.price)),
      stock: Number(form.value.stock),
      minStock: Number(form.value.minStock),
      status: form.value.status,
    });
    categoriesStore.bootstrapFromNames(productsStore.categories);
    createOpen.value = false;
    photoMeta.value = null;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao criar produto';
  } finally {
    saving.value = false;
  }
}

async function saveEdit() {
  if (!selected.value) return;
  saving.value = true;
  error.value = null;
  try {
    await productsStore.update(selected.value.id, {
      barcode: form.value.barcode.trim() || null,
      name: form.value.name.trim(),
      category: form.value.category.trim(),
      photoUrl: form.value.photoUrl.trim() || null,
      costCents: form.value.cost ? toCents(Number(form.value.cost)) : null,
      priceCents: toCents(Number(form.value.price)),
      stock: Number(form.value.stock),
      minStock: Number(form.value.minStock),
      status: form.value.status,
    });
    categoriesStore.bootstrapFromNames(productsStore.categories);
    editOpen.value = false;
    photoMeta.value = null;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao salvar produto';
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(p: Product) {
  error.value = null;
  try {
    await productsStore.update(p.id, { status: p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao alterar status';
  }
}

async function saveStock() {
  if (!selected.value) return;
  saving.value = true;
  error.value = null;
  try {
    await productsStore.update(selected.value.id, { stock: Number(stockForm.value.stock) });
    stockOpen.value = false;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao ajustar estoque';
  } finally {
    saving.value = false;
  }
}

function statusSeverity(p: Product) {
  return p.status === 'ACTIVE' ? 'success' : 'secondary';
}

function stockSeverity(p: Product) {
  if (p.stock <= 0) return 'danger';
  if (p.stock <= p.minStock) return 'warning';
  return 'success';
}

function goDetail(p: Product) {
  router.push(`/admin/produtos/${p.id}`);
}

async function load() {
  error.value = null;
  await productsStore.fetchAll();
  await categoriesStore.fetch();
  const existing = new Set(categoriesStore.items.map((c) => c.name));
  const missing = productsStore.categories.filter((c) => !existing.has(c));
  if (missing.length) await categoriesStore.bootstrapFromNames(missing);
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Produtos</div>
        <div class="text-sm text-slate-600">Catálogo, estoque e status.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="productsStore.loading" @click="load" />
        <Button label="Novo Produto" @click="openCreate" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Filtros</div>
        <div class="mt-1 text-sm text-slate-600">Refine a listagem.</div>
        <div class="mt-3 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Buscar por nome</label>
            <InputText v-model="search" class="w-full" placeholder="Ex: Água" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Categoria</label>
            <Dropdown v-model="category" class="w-full" :options="categoryOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Status</label>
            <Dropdown v-model="status" class="w-full" :options="statusOptions" optionLabel="label" optionValue="value" />
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="lowStockOnly" type="checkbox" class="h-4 w-4 rounded border-[#E5E7EB]" />
            Apenas estoque baixo
          </label>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:col-span-3">
        <DataTable
          :value="filtered"
          dataKey="id"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
          stripedRows
          showGridlines
          tableStyle="min-width: 60rem"
        >
          <Column field="name" header="Produto" sortable style="min-width: 18rem" />
          <Column field="barcode" header="Código de barras" sortable style="min-width: 12rem" />
          <Column field="category" header="Categoria" sortable style="min-width: 12rem" />
          <Column header="Preço" sortable sortField="priceCents" style="min-width: 10rem">
            <template #body="{ data }">
              <span class="font-semibold text-[#003B8E]">{{ formatBRL(data.priceCents) }}</span>
            </template>
          </Column>
          <Column header="Estoque" sortable sortField="stock" style="min-width: 10rem">
            <template #body="{ data }">
              <Tag
                :value="`${data.stock} (mín. ${data.minStock})`"
                :severity="stockSeverity(data)"
              />
            </template>
          </Column>
          <Column header="Status" sortable sortField="status" style="min-width: 8rem">
            <template #body="{ data }">
              <Tag :value="data.status === 'ACTIVE' ? 'Ativo' : 'Inativo'" :severity="statusSeverity(data)" />
            </template>
          </Column>
          <Column header="Ações" style="min-width: 14rem">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <Button icon="pi pi-info-circle" rounded severity="secondary" @click="goDetail(data)" />
                <Button icon="pi pi-pencil" rounded severity="secondary" @click="openEdit(data)" />
                <Button icon="pi pi-sliders-h" rounded severity="secondary" @click="openStock(data)" />
                <Button
                  :icon="data.status === 'ACTIVE' ? 'pi pi-eye-slash' : 'pi pi-eye'"
                  rounded
                  severity="secondary"
                  @click="toggleStatus(data)"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhum produto encontrado.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="createOpen" modal header="Novo Produto" :style="{ width: '42rem' }" :draggable="false">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Nome</label>
          <InputText v-model="form.name" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Código de barras (opcional)</label>
          <InputText v-model="form.barcode" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Categoria</label>
          <InputText v-model="form.category" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço de custo (R$)</label>
          <input v-model.number="form.cost" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço (R$)</label>
          <input v-model.number="form.price" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estoque atual</label>
          <input v-model.number="form.stock" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estoque mínimo</label>
          <input v-model.number="form.minStock" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Imagem (URL opcional)</label>
          <InputText v-model="form.photoUrl" class="w-full" placeholder="https://..." />
          <div v-if="form.photoUrl?.trim()" class="mt-2">
            <img :src="form.photoUrl" class="h-20 w-20 rounded-xl border border-slate-200 object-cover" alt="Prévia" @load="onPreviewLoad" />
            <div v-if="photoHint" class="mt-2 text-xs" :class="photoMeta && Math.abs(photoMeta.w - photoMeta.h) > 2 ? 'text-amber-700' : 'text-slate-600'">
              {{ photoHint }}
            </div>
          </div>
        </div>

        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Status</label>
          <select v-model="form.status" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" @click="createOpen = false" />
          <Button label="Salvar" :loading="saving" @click="saveCreate" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="editOpen" modal header="Editar Produto" :style="{ width: '42rem' }" :draggable="false">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Nome</label>
          <InputText v-model="form.name" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Código de barras (opcional)</label>
          <InputText v-model="form.barcode" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Categoria</label>
          <InputText v-model="form.category" class="w-full" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço de custo (R$)</label>
          <input v-model.number="form.cost" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Preço (R$)</label>
          <input v-model.number="form.price" type="number" step="0.01" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estoque atual</label>
          <input v-model.number="form.stock" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estoque mínimo</label>
          <input v-model.number="form.minStock" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>

        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Imagem (URL opcional)</label>
          <InputText v-model="form.photoUrl" class="w-full" placeholder="https://..." />
          <div v-if="form.photoUrl?.trim()" class="mt-2">
            <img :src="form.photoUrl" class="h-20 w-20 rounded-xl border border-slate-200 object-cover" alt="Prévia" @load="onPreviewLoad" />
            <div v-if="photoHint" class="mt-2 text-xs" :class="photoMeta && Math.abs(photoMeta.w - photoMeta.h) > 2 ? 'text-amber-700' : 'text-slate-600'">
              {{ photoHint }}
            </div>
          </div>
        </div>

        <div class="space-y-1 md:col-span-2">
          <label class="text-sm font-medium text-slate-700">Status</label>
          <select v-model="form.status" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" @click="editOpen = false" />
          <Button label="Salvar" :loading="saving" @click="saveEdit" />
        </div>
      </template>
    </Dialog>

    <Dialog v-model:visible="stockOpen" modal header="Ajustar Estoque" :style="{ width: '26rem' }" :draggable="false">
      <div class="space-y-3">
        <div class="text-sm text-slate-600">
          {{ selected?.name }}
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-slate-700">Estoque atual</label>
          <input v-model.number="stockForm.stock" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" @click="stockOpen = false" />
          <Button label="Salvar" :loading="saving" @click="saveStock" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
