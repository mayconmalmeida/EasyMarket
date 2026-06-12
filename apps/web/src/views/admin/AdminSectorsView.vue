<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import { useSectorsStore, type Sector } from '../../stores/sectors';

const sectors = useSectorsStore();

const search = ref('');
const dialogOpen = ref(false);
const editing = ref<Sector | null>(null);
const saving = ref(false);
const error = ref<string | null>(null);

const form = ref({
  name: '',
  status: 'ACTIVE' as Sector['status'],
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return sectors.items
    .filter((s) => (q ? s.name.toLowerCase().includes(q) : true))
    .sort((a, b) => a.name.localeCompare(b.name));
});

function openCreate() {
  error.value = null;
  editing.value = null;
  form.value = { name: '', status: 'ACTIVE' };
  dialogOpen.value = true;
}

function openEdit(s: Sector) {
  error.value = null;
  editing.value = s;
  form.value = { name: s.name, status: s.status };
  dialogOpen.value = true;
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const name = form.value.name.trim();
    if (!name) {
      error.value = 'Informe o nome do setor';
      return;
    }

    if (!editing.value) {
      await sectors.create({ name, status: form.value.status });
    } else {
      await sectors.update(editing.value.id, { name, status: form.value.status });
    }
    dialogOpen.value = false;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao salvar setor';
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(s: Sector) {
  await sectors.update(s.id, { status: s.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
}

onMounted(() => {
  if (!sectors.items.length) sectors.fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Setores</div>
        <div class="text-sm text-slate-600">Cadastre setores para usar no perfil do colaborador.</div>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button label="Novo Setor" class="w-full sm:w-auto" @click="openCreate" />
      </div>
    </div>

    <div v-if="sectors.error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ sectors.error }}</div>

    <div class="grid grid-cols-1 gap-3 xl:grid-cols-5">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm xl:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Busca</div>
        <div class="mt-1 text-sm text-slate-600">Filtre por nome.</div>
        <div class="mt-3 space-y-1">
          <label class="text-xs font-medium text-slate-600">Nome</label>
          <InputText v-model="search" class="w-full" placeholder="Ex: TI, RH, Comercial" />
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm xl:col-span-4">
        <DataTable :value="filtered" dataKey="id" paginator :rows="10" stripedRows showGridlines tableStyle="min-width: 100%">
          <Column header="Setor" sortable field="name" style="min-width: 14rem">
            <template #body="{ data }">
              <div class="font-semibold text-slate-900">{{ data.name }}</div>
            </template>
          </Column>
          <Column header="Status" sortable field="status" style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.status === 'ACTIVE' ? 'Ativo' : 'Inativo'" :severity="data.status === 'ACTIVE' ? 'success' : 'secondary'" />
            </template>
          </Column>
          <Column header="Ações" style="min-width: 9rem">
            <template #body="{ data }">
              <div class="flex flex-wrap items-center gap-2">
                <Button icon="pi pi-pencil" rounded severity="secondary" size="small" @click="openEdit(data)" />
                <Button :icon="data.status === 'ACTIVE' ? 'pi pi-eye-slash' : 'pi pi-eye'" rounded severity="secondary" size="small" @click="toggleStatus(data)" />
              </div>
            </template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhum setor encontrado.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="dialogOpen" modal :header="editing ? 'Editar Setor' : 'Novo Setor'" :style="{ width: 'min(36rem, 96vw)' }" :draggable="false">
      <div class="space-y-3">
        <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
        <div class="grid grid-cols-1 gap-3">
          <div class="space-y-1">
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
        </div>
      </div>

      <template #footer>
        <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button label="Cancelar" severity="secondary" @click="dialogOpen = false" />
          <Button label="Salvar" :loading="saving" @click="save" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
