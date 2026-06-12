<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useCategoriesStore, type Category } from '../../stores/categories';
import { useProductsStore } from '../../stores/products';

const categories = useCategoriesStore();
const products = useProductsStore();

const search = ref('');
const dialogOpen = ref(false);
const editing = ref<Category | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);

const form = ref({
  name: '',
  description: '',
  color: '#0057D9',
  icon: 'pi pi-tag',
  status: 'ACTIVE' as Category['status'],
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return categories.items.filter((c) => (q ? c.name.toLowerCase().includes(q) : true));
});

function openCreate() {
  error.value = null;
  editing.value = null;
  form.value = {
    name: '',
    description: '',
    color: '#0057D9',
    icon: 'pi pi-tag',
    status: 'ACTIVE',
  };
  dialogOpen.value = true;
}

function openEdit(c: Category) {
  error.value = null;
  editing.value = c;
  form.value = {
    name: c.name,
    description: c.description,
    color: c.color,
    icon: c.icon,
    status: c.status,
  };
  dialogOpen.value = true;
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const name = form.value.name.trim();
    if (!name) {
      error.value = 'Informe o nome da categoria';
      return;
    }
    if (!editing.value) {
      await categories.create({
        name,
        description: form.value.description.trim(),
        color: form.value.color.trim() || '#0057D9',
        icon: form.value.icon.trim() || 'pi pi-tag',
        status: form.value.status,
      });
    } else {
      const oldName = editing.value.name;
      const updated = await categories.update(editing.value.id, {
        name,
        description: form.value.description.trim(),
        color: form.value.color.trim() || '#0057D9',
        icon: form.value.icon.trim() || 'pi pi-tag',
        status: form.value.status,
      });
      if (updated && oldName !== name) {
        const toUpdate = products.items.filter((p) => p.category === oldName);
        for (const p of toUpdate) {
          await products.update(p.id, { category: name });
        }
      }
    }
    dialogOpen.value = false;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao salvar categoria';
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(c: Category) {
  await categories.toggleStatus(c.id);
}

onMounted(async () => {
  await categories.fetch();
  await products.fetchAll();
});
</script>

<template>
  <div class="admin-operational space-y-3">
    <div class="flex flex-col gap-2 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Categorias</div>
        <div class="text-sm text-slate-600">Organize produtos e filtros.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Nova Categoria" @click="openCreate" />
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-5">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:col-span-1 xl:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Busca</div>
        <div class="mt-1 text-sm text-slate-600">Filtre por nome.</div>
        <div class="mt-3 space-y-1">
          <label class="text-xs font-medium text-slate-600">Nome</label>
          <InputText v-model="search" class="w-full" placeholder="Ex: Bebidas" />
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-3 shadow-sm lg:col-span-3 xl:col-span-4">
        <DataTable :value="filtered" dataKey="id" paginator :rows="10" stripedRows showGridlines tableStyle="min-width: 100%">
          <Column header="Categoria" sortable field="name" style="min-width: 14rem">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg" :style="{ background: data.color }">
                  <i class="pi pi-tag text-white" />
                </span>
                <div class="min-w-0">
                  <div class="truncate font-semibold text-slate-900">{{ data.name }}</div>
                  <div class="truncate text-xs text-slate-500">{{ data.description || '-' }}</div>
                </div>
              </div>
            </template>
          </Column>
          <Column header="Status" sortable field="status" style="min-width: 8rem">
            <template #body="{ data }">
              <Tag :value="data.status === 'ACTIVE' ? 'Ativo' : 'Inativo'" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Ações" style="min-width: 8rem">
            <template #body="{ data }">
              <div class="flex items-center gap-1.5">
                <Button icon="pi pi-pencil" rounded severity="secondary" size="small" @click="openEdit(data)" />
                <Button :icon="data.status === 'ACTIVE' ? 'pi pi-eye-slash' : 'pi pi-eye'" rounded severity="secondary" size="small" @click="toggleStatus(data)" />
              </div>
            </template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhuma categoria encontrada.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="dialogOpen" modal :header="editing ? 'Editar Categoria' : 'Nova Categoria'" :style="{ width: 'min(46rem, 96vw)' }" :draggable="false">
      <div class="space-y-3">
        <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

        <div class="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          <div class="space-y-1 md:col-span-2">
            <label class="text-sm font-medium text-slate-700">Nome</label>
            <InputText v-model="form.name" class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Status</label>
            <select v-model="form.status" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
              <option value="ACTIVE">Ativo</option>
              <option value="INACTIVE">Inativo</option>
            </select>
          </div>

          <div class="space-y-1 md:col-span-3">
            <label class="text-sm font-medium text-slate-700">Descrição</label>
            <Textarea v-model="form.description" class="w-full" rows="3" autoResize />
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Cor</label>
            <input v-model="form.color" type="color" class="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white p-1" />
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Ícone (PrimeIcons)</label>
            <InputText v-model="form.icon" class="w-full" placeholder="pi pi-tag" />
          </div>

        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Cancelar" severity="secondary" @click="dialogOpen = false" />
          <Button label="Salvar" :loading="saving" @click="save" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
