<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import { useWithdrawalsStore, type Withdrawal } from '../../stores/withdrawals';
import { formatBRL } from '../../lib/money';

const store = useWithdrawalsStore();

const collaborator = ref<string | 'ALL'>('ALL');
const from = ref<string>('');
const to = ref<string>('');
const error = ref<string | null>(null);

const pending = computed(() => store.items.filter((w) => w.paymentStatus === 'PENDING'));

const totalPending = computed(() => pending.value.reduce((sum, w) => sum + w.totalCents, 0));
const pendingWithdrawalsCount = computed(() => pending.value.length);
const pendingUsersCount = computed(() => new Set(pending.value.map((w) => w.user.id)).size);

const collaborators = computed(() => {
  const unique = Array.from(new Set(pending.value.map((w) => w.user.id))).map((id) => {
    const w = pending.value.find((x) => x.user.id === id)!;
    return { label: `${w.user.name} (${w.user.code})`, value: id };
  });
  unique.sort((a, b) => a.label.localeCompare(b.label));
  return [{ label: 'Todos', value: 'ALL' as const }, ...unique];
});

const filtered = computed(() => {
  const fromTs = from.value ? new Date(`${from.value}T00:00:00`).getTime() : null;
  const toTs = to.value ? new Date(`${to.value}T23:59:59`).getTime() : null;
  return pending.value.filter((w) => {
    const ts = new Date(w.createdAt).getTime();
    const okFrom = fromTs ? ts >= fromTs : true;
    const okTo = toTs ? ts <= toTs : true;
    const okCollab = collaborator.value === 'ALL' ? true : w.user.id === collaborator.value;
    return okFrom && okTo && okCollab;
  });
});

function methodLabel(w: Withdrawal) {
  if (w.paymentMethod === 'CASH') return 'Dinheiro';
  if (w.paymentMethod === 'PIX') return 'Pix';
  return 'Não pago agora';
}

async function markPaid(w: Withdrawal) {
  error.value = null;
  try {
    await store.markPaid(w.id);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao marcar como pago';
  }
}

async function load() {
  error.value = null;
  await store.fetchAllAdmin();
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-900">Pendências</div>
        <div class="text-sm text-slate-600">Controle de pagamentos pendentes.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="store.loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Total pendente</div>
        <div class="mt-1 text-2xl font-bold text-status-pending">{{ formatBRL(totalPending) }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Colaboradores com pendência</div>
        <div class="mt-1 text-2xl font-bold text-[#003B8E]">{{ pendingUsersCount }}</div>
      </div>
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="text-sm text-slate-500">Retiradas pendentes</div>
        <div class="mt-1 text-2xl font-bold text-[#003B8E]">{{ pendingWithdrawalsCount }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Filtros</div>
        <div class="mt-1 text-sm text-slate-600">Refine a listagem.</div>
        <div class="mt-3 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Colaborador</label>
            <Dropdown v-model="collaborator" class="w-full" :options="collaborators" optionLabel="label" optionValue="value" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Período (de)</label>
            <input v-model="from" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Período (até)</label>
            <input v-model="to" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:col-span-3">
        <DataTable :value="filtered" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines tableStyle="min-width: 60rem">
          <Column header="Data/Hora" sortable field="createdAt" style="min-width: 14rem">
            <template #body="{ data }">{{ new Date(data.createdAt).toLocaleString('pt-BR') }}</template>
          </Column>
          <Column header="Colaborador" style="min-width: 16rem">
            <template #body="{ data }">
              <div>
                <div class="font-semibold text-slate-900">{{ data.user.name }}</div>
                <div class="text-xs text-slate-500">{{ data.user.code }}</div>
              </div>
            </template>
          </Column>
          <Column header="Pagamento" style="min-width: 12rem">
            <template #body="{ data }">{{ methodLabel(data) }}</template>
          </Column>
          <Column header="Total" sortable field="totalCents" style="min-width: 10rem">
            <template #body="{ data }">
              <div class="text-right font-semibold text-[#003B8E]">{{ formatBRL(data.totalCents) }}</div>
            </template>
          </Column>
          <Column header="Status" style="min-width: 10rem">
            <template #body>
              <Tag value="Pendente" severity="warning" />
            </template>
          </Column>
          <Column header="Ações" style="min-width: 10rem">
            <template #body="{ data }">
              <Button label="Marcar como pago" @click="markPaid(data)" />
            </template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhuma pendência encontrada.</div>
          </template>
        </DataTable>
      </div>
    </div>
  </div>
</template>
