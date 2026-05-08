<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import { useUsersStore, type User } from '../../stores/users';
import { useSectorsStore } from '../../stores/sectors';
import { useWithdrawalsStore } from '../../stores/withdrawals';
import { formatBRL } from '../../lib/money';

type RoleFilter = 'ALL' | User['role'];
type StatusFilter = 'ALL' | User['status'];

const usersStore = useUsersStore();
const sectorsStore = useSectorsStore();
const withdrawalsStore = useWithdrawalsStore();

const search = ref('');
const sector = ref<string | 'ALL'>('ALL');
const role = ref<RoleFilter>('ALL');
const status = ref<StatusFilter>('ALL');

const dialogOpen = ref(false);
const consumptionOpen = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

const editing = ref<User | null>(null);
const selected = ref<User | null>(null);

const form = ref({
  name: '',
  code: '',
  pin: '',
  sectorId: null as string | null,
  role: 'COLLABORATOR' as User['role'],
  status: 'ACTIVE' as User['status'],
});

const sectorOptions = computed(() => {
  const active = sectorsStore.items
    .filter((s) => s.status === 'ACTIVE')
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ label: s.name, value: s.id }));
  return [{ label: 'Todos', value: 'ALL' as const }, ...active];
});

const sectorNameById = computed(() => {
  const map = new Map<string, string>();
  for (const s of sectorsStore.items) map.set(s.id, s.name);
  return map;
});

function userSectorLabel(u: User) {
  const id = u.sectorId ?? undefined;
  if (id && sectorNameById.value.has(id)) return sectorNameById.value.get(id) as string;
  return u.sector || '-';
}

const roleOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Admin', value: 'ADMIN' as const },
  { label: 'Colaborador', value: 'COLLABORATOR' as const },
];

const statusOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Ativo', value: 'ACTIVE' as const },
  { label: 'Bloqueado', value: 'BLOCKED' as const },
];

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return usersStore.items.filter((u) => {
    const okQ = q ? u.name.toLowerCase().includes(q) || u.code.toLowerCase().includes(q) : true;
    const okSector = sector.value === 'ALL' ? true : (u.sectorId ?? '') === sector.value;
    const okRole = role.value === 'ALL' ? true : u.role === role.value;
    const okStatus = status.value === 'ALL' ? true : u.status === status.value;
    return okQ && okSector && okRole && okStatus;
  });
});

function openCreate() {
  error.value = null;
  editing.value = null;
  form.value = { name: '', code: '', pin: '', sectorId: null, role: 'COLLABORATOR', status: 'ACTIVE' };
  dialogOpen.value = true;
}

function openEdit(u: User) {
  error.value = null;
  editing.value = u;
  form.value = {
    name: u.name,
    code: u.code,
    pin: '',
    sectorId: u.sectorId ?? null,
    role: u.role,
    status: u.status,
  };
  dialogOpen.value = true;
}

async function save() {
  saving.value = true;
  error.value = null;
  try {
    const payload = {
      name: form.value.name.trim(),
      code: form.value.code.trim(),
      pin: form.value.pin.trim(),
      sectorId: form.value.sectorId || undefined,
      role: form.value.role,
      status: form.value.status,
    };
    if (!payload.name) {
      error.value = 'Informe o nome';
      return;
    }
    if (!payload.code) {
      error.value = 'Informe o código';
      return;
    }
    if (!editing.value && !payload.pin) {
      error.value = 'Informe o PIN';
      return;
    }
    if (!editing.value) {
      await usersStore.create({
        name: payload.name,
        code: payload.code,
        pin: payload.pin,
        sectorId: payload.sectorId,
        role: payload.role,
      });
    } else {
      const patch: any = {
        name: payload.name,
        code: payload.code,
        sectorId: payload.sectorId ?? null,
        role: payload.role,
        status: payload.status,
      };
      if (payload.pin) patch.pin = payload.pin;
      await usersStore.update(editing.value.id, patch);
    }
    dialogOpen.value = false;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao salvar colaborador';
  } finally {
    saving.value = false;
  }
}

async function toggleStatus(u: User) {
  error.value = null;
  try {
    await usersStore.update(u.id, { status: u.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE' });
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao alterar status';
  }
}

async function resetPin(u: User) {
  const ok = window.confirm(`Resetar PIN de ${u.name} (${u.code}) para 1234?`);
  if (!ok) return;
  error.value = null;
  try {
    await usersStore.update(u.id, { pin: '1234' });
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao resetar PIN';
  }
}

const consumption = computed(() => {
  if (!selected.value) return null;
  const list = withdrawalsStore.items.filter((w) => w.user.id === selected.value!.id);
  const total = list.reduce((sum, w) => sum + w.totalCents, 0);
  const pending = list.filter((w) => w.paymentStatus === 'PENDING').reduce((sum, w) => sum + w.totalCents, 0);
  const topProducts = new Map<string, { name: string; qty: number; cents: number }>();
  for (const w of list) {
    for (const it of w.items) {
      const key = it.product.id;
      const prev = topProducts.get(key) ?? { name: it.product.name, qty: 0, cents: 0 };
      topProducts.set(key, { name: prev.name, qty: prev.qty + it.quantity, cents: prev.cents + it.quantity * it.unitPriceCents });
    }
  }
  const top = [...topProducts.values()].sort((a, b) => b.cents - a.cents).slice(0, 8);
  return { count: list.length, total, pending, top };
});

function openConsumption(u: User) {
  selected.value = u;
  consumptionOpen.value = true;
}

async function load() {
  error.value = null;
  await Promise.all([sectorsStore.fetchAll(), usersStore.fetchAll(), withdrawalsStore.fetchAllAdmin()]);
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-text text-lg font-semibold">Colaboradores</div>
        <div class="text-sm text-slate-600">Cadastro, perfis e controle de acesso.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="usersStore.loading || withdrawalsStore.loading" @click="load" />
        <Button label="Novo Colaborador" @click="openCreate" />
      </div>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div class="rounded-xl bg-white p-4 shadow lg:col-span-1">
        <div class="text-sm font-semibold text-text">Filtros</div>
        <div class="mt-3 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Buscar (nome ou código)</label>
            <InputText v-model="search" class="w-full" placeholder="Ex: João ou 0001" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Setor</label>
            <Dropdown v-model="sector" class="w-full" :options="sectorOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Perfil</label>
            <Dropdown v-model="role" class="w-full" :options="roleOptions" optionLabel="label" optionValue="value" />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Status</label>
            <Dropdown v-model="status" class="w-full" :options="statusOptions" optionLabel="label" optionValue="value" />
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-white p-4 shadow lg:col-span-3">
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
          <Column header="Colaborador" sortable field="name" style="min-width: 18rem">
            <template #body="{ data }">
              <div>
                <div class="font-semibold text-text">{{ data.name }}</div>
                <div class="text-xs text-slate-500">Código: {{ data.code }} • Setor: {{ userSectorLabel(data) }}</div>
              </div>
            </template>
          </Column>
          <Column header="Perfil" sortable field="role" style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.role === 'ADMIN' ? 'Admin' : 'Colaborador'" :severity="data.role === 'ADMIN' ? 'info' : 'secondary'" />
            </template>
          </Column>
          <Column header="Status" sortable field="status" style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.status === 'ACTIVE' ? 'Ativo' : 'Bloqueado'" :severity="data.status === 'ACTIVE' ? 'success' : 'danger'" />
            </template>
          </Column>
          <Column header="Ações" style="min-width: 18rem">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <Button icon="pi pi-pencil" rounded severity="secondary" @click="openEdit(data)" />
                <Button icon="pi pi-key" rounded severity="secondary" @click="resetPin(data)" />
                <Button
                  :icon="data.status === 'ACTIVE' ? 'pi pi-user-minus' : 'pi pi-user-plus'"
                  rounded
                  severity="secondary"
                  @click="toggleStatus(data)"
                />
                <Button icon="pi pi-chart-line" rounded severity="secondary" @click="openConsumption(data)" />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhum colaborador encontrado.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="dialogOpen" modal :header="editing ? 'Editar Colaborador' : 'Novo Colaborador'" :style="{ width: '42rem' }" :draggable="false">
      <div class="space-y-3">
        <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="space-y-1 md:col-span-2">
            <label class="text-sm font-medium text-slate-700">Nome</label>
            <InputText v-model="form.name" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Código de acesso</label>
            <InputText v-model="form.code" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">PIN (4 ou 6 dígitos)</label>
            <Password v-model="form.pin" class="w-full" :feedback="false" toggleMask />
          </div>
          <div class="space-y-1 md:col-span-2">
            <label class="text-sm font-medium text-slate-700">Setor</label>
            <Dropdown
              v-model="form.sectorId"
              class="w-full"
              :options="sectorsStore.items.filter((s) => s.status === 'ACTIVE').map((s) => ({ label: s.name, value: s.id }))"
              optionLabel="label"
              optionValue="value"
              placeholder="Selecione"
              showClear
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Perfil</label>
            <select v-model="form.role" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="COLLABORATOR">Colaborador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Status</label>
            <select v-model="form.status" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              <option value="ACTIVE">Ativo</option>
              <option value="BLOCKED">Bloqueado</option>
            </select>
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

    <Dialog v-model:visible="consumptionOpen" modal header="Consumo do colaborador" :style="{ width: '46rem' }" :draggable="false">
      <div v-if="selected && consumption" class="space-y-4">
        <div class="rounded-lg bg-slate-50 p-4">
          <div class="text-sm font-semibold text-text">{{ selected.name }} ({{ selected.code }})</div>
          <div class="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div class="rounded-md bg-white p-3">
              <div class="text-xs text-slate-500">Retiradas</div>
              <div class="text-lg font-bold text-primary-dark">{{ consumption.count }}</div>
            </div>
            <div class="rounded-md bg-white p-3">
              <div class="text-xs text-slate-500">Total</div>
              <div class="text-lg font-bold text-primary-dark">{{ formatBRL(consumption.total) }}</div>
            </div>
            <div class="rounded-md bg-white p-3">
              <div class="text-xs text-slate-500">Pendente</div>
              <div class="text-lg font-bold text-status-pending">{{ formatBRL(consumption.pending) }}</div>
            </div>
          </div>
        </div>

        <div>
          <div class="text-sm font-semibold text-text">Top produtos</div>
          <div class="mt-2 space-y-2">
            <div v-for="p in consumption.top" :key="p.name" class="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-text">{{ p.name }}</div>
                <div class="text-xs text-slate-500">Quantidade: {{ p.qty }}</div>
              </div>
              <div class="text-sm font-semibold text-primary-dark">{{ formatBRL(p.cents) }}</div>
            </div>
            <div v-if="consumption.top.length === 0" class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Sem dados.</div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <Button label="Fechar" severity="secondary" @click="consumptionOpen = false" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
