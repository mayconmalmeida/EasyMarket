<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/money';

type PaymentStatus = 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';

type SummaryRow = {
  userId: string;
  name: string;
  code: string;
  sector: string | null;
  consumedCents: number;
  paidCents: number;
  pendingCents: number;
  status: PaymentStatus;
};

type SummaryResponse = {
  year: number;
  month: number;
  closed: boolean;
  closedAt: string | null;
  totals: {
    totalConsumedCents: number;
    totalPaidCents: number;
    totalPendingCents: number;
    usersWithDebt: number;
  };
  rows: SummaryRow[];
};

type StatementResponse = {
  year: number;
  month: number;
  totals: { consumedCents: number; paidCents: number; pendingCents: number };
  withdrawals: Array<{
    id: string;
    totalCents: number;
    paymentMethod: 'CASH' | 'PIX' | 'NONE';
    paymentStatus: PaymentStatus;
    createdAt: string;
    items: Array<{ id: string; quantity: number; unitPriceCents: number; product: { id: string; name: string } }>;
  }>;
};

const now = new Date();
const year = ref(now.getFullYear());
const month = ref(now.getMonth() + 1);
const sector = ref<string | 'ALL'>('ALL');

const loading = ref(false);
const error = ref<string | null>(null);
const summary = ref<SummaryResponse | null>(null);

const detailsOpen = ref(false);
const selected = ref<SummaryRow | null>(null);
const statement = ref<StatementResponse | null>(null);
const statementLoading = ref(false);
const marking = ref(false);

const sectorOptions = computed(() => {
  const unique = Array.from(new Set((summary.value?.rows ?? []).map((r) => (r.sector ?? '').trim()).filter(Boolean))).sort();
  return [{ label: 'Todos', value: 'ALL' as const }, ...unique.map((s) => ({ label: s, value: s }))];
});

const monthOptions = [
  { label: 'Janeiro', value: 1 },
  { label: 'Fevereiro', value: 2 },
  { label: 'Março', value: 3 },
  { label: 'Abril', value: 4 },
  { label: 'Maio', value: 5 },
  { label: 'Junho', value: 6 },
  { label: 'Julho', value: 7 },
  { label: 'Agosto', value: 8 },
  { label: 'Setembro', value: 9 },
  { label: 'Outubro', value: 10 },
  { label: 'Novembro', value: 11 },
  { label: 'Dezembro', value: 12 },
];

const statusLabel = (s: PaymentStatus) => {
  if (s === 'PENDING') return 'Pendente';
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
};

const statusSeverity = (s: PaymentStatus) => {
  if (s === 'PENDING') return 'warning';
  if (s === 'PAYROLL_DEDUCTION') return 'info';
  return 'success';
};

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params: any = { year: year.value, month: month.value };
    if (sector.value !== 'ALL') params.sector = sector.value;
    const { data } = await api.get<SummaryResponse>('/admin/monthly-closings/summary', { params });
    summary.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar fechamento mensal';
  } finally {
    loading.value = false;
  }
}

async function closeCompetence() {
  marking.value = true;
  error.value = null;
  try {
    await api.post('/admin/monthly-closings/close', { year: year.value, month: month.value });
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao fechar competência';
  } finally {
    marking.value = false;
  }
}

async function openDetails(row: SummaryRow) {
  selected.value = row;
  detailsOpen.value = true;
  statement.value = null;
  statementLoading.value = true;
  error.value = null;
  try {
    const { data } = await api.get<StatementResponse>('/admin/monthly-closings/statement', {
      params: { year: year.value, month: month.value, userId: row.userId },
    });
    statement.value = data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar extrato';
  } finally {
    statementLoading.value = false;
  }
}

async function markUser(status: PaymentStatus) {
  if (!selected.value) return;
  if (status === 'PENDING') return;
  marking.value = true;
  error.value = null;
  try {
    await api.patch('/admin/monthly-closings/mark-user', {
      year: year.value,
      month: month.value,
      userId: selected.value.userId,
      status,
    });
    await openDetails(selected.value);
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao marcar pagamento';
  } finally {
    marking.value = false;
  }
}

function exportCsv() {
  const rows = summary.value?.rows ?? [];
  const header = ['Colaborador', 'Código', 'Setor', 'Consumiu (centavos)', 'Pago (centavos)', 'Pendente (centavos)', 'Status'];
  const lines = [header, ...rows.map((r) => [r.name, r.code, r.sector ?? '', String(r.consumedCents), String(r.paidCents), String(r.pendingCents), statusLabel(r.status)])];
  const csv = lines.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fechamento-${year.value}-${String(month.value).padStart(2, '0')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 rounded-xl bg-white p-4 shadow md:flex-row md:items-center md:justify-between">
      <div class="min-w-0">
        <div class="text-text text-lg font-semibold">Fechamento Mensal</div>
        <div class="text-sm text-slate-600">Consolidação por colaborador e cobrança.</div>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Dropdown v-model="month" :options="monthOptions" optionLabel="label" optionValue="value" class="w-44" />
        <input v-model.number="year" type="number" min="2000" class="h-10 w-28 rounded-md border border-slate-200 px-3 text-sm" />
        <Dropdown v-model="sector" :options="sectorOptions" optionLabel="label" optionValue="value" class="w-44" />
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
        <Button label="Exportar Excel (CSV)" severity="secondary" :disabled="!summary" @click="exportCsv" />
        <Button label="Fechar competência" :loading="marking" @click="closeCompetence" />
      </div>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div v-if="summary" class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <div class="rounded-xl bg-white p-5 shadow">
        <div class="text-sm text-slate-500">Total consumido</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ formatBRL(summary.totals.totalConsumedCents) }}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow">
        <div class="text-sm text-slate-500">Total pago</div>
        <div class="mt-1 text-2xl font-bold text-status-paid">{{ formatBRL(summary.totals.totalPaidCents) }}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow">
        <div class="text-sm text-slate-500">Total pendente</div>
        <div class="mt-1 text-2xl font-bold text-status-pending">{{ formatBRL(summary.totals.totalPendingCents) }}</div>
      </div>
      <div class="rounded-xl bg-white p-5 shadow">
        <div class="text-sm text-slate-500">Colaboradores com débito</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ summary.totals.usersWithDebt }}</div>
      </div>
    </div>

    <div v-if="summary" class="rounded-xl bg-white p-4 shadow">
      <DataTable :value="summary.rows" dataKey="userId" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines tableStyle="min-width: 70rem">
        <Column header="Colaborador" field="name" sortable style="min-width: 18rem">
          <template #body="{ data }">
            <div>
              <div class="font-semibold text-text">{{ data.name }}</div>
              <div class="text-xs text-slate-500">Código: {{ data.code }} • Setor: {{ data.sector || '-' }}</div>
            </div>
          </template>
        </Column>
        <Column header="Consumiu" field="consumedCents" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <div class="font-semibold text-primary-dark">{{ formatBRL(data.consumedCents) }}</div>
          </template>
        </Column>
        <Column header="Pago" field="paidCents" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <div class="font-semibold text-status-paid">{{ formatBRL(data.paidCents) }}</div>
          </template>
        </Column>
        <Column header="Pendente" field="pendingCents" sortable style="min-width: 10rem">
          <template #body="{ data }">
            <div class="font-semibold text-status-pending">{{ formatBRL(data.pendingCents) }}</div>
          </template>
        </Column>
        <Column header="Status" field="status" sortable style="min-width: 12rem">
          <template #body="{ data }">
            <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column header="Ações" style="min-width: 12rem">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <Button icon="pi pi-search" rounded severity="secondary" @click="openDetails(data)" />
              <Button v-if="data.pendingCents > 0" icon="pi pi-check" rounded @click="openDetails(data)" />
            </div>
          </template>
        </Column>
        <template #empty>
          <div class="p-6 text-center text-sm text-slate-600">Sem dados para a competência.</div>
        </template>
      </DataTable>
    </div>

    <Dialog v-model:visible="detailsOpen" modal header="Extrato do colaborador" position="right" :style="{ width: '34rem' }" :draggable="false">
      <div v-if="selected" class="space-y-4">
        <div class="rounded-lg bg-slate-50 p-4">
          <div class="text-sm font-semibold text-text">{{ selected.name }} ({{ selected.code }})</div>
          <div class="mt-1 text-xs text-slate-500">Setor: {{ selected.sector || '-' }}</div>
          <div class="mt-3 grid grid-cols-1 gap-3">
            <div class="flex items-center justify-between rounded-md bg-white p-3">
              <div class="text-sm text-slate-600">Total consumido</div>
              <div class="text-sm font-bold text-primary-dark">{{ formatBRL(statement?.totals.consumedCents ?? 0) }}</div>
            </div>
            <div class="flex items-center justify-between rounded-md bg-white p-3">
              <div class="text-sm text-slate-600">Total pago</div>
              <div class="text-sm font-bold text-status-paid">{{ formatBRL(statement?.totals.paidCents ?? 0) }}</div>
            </div>
            <div class="flex items-center justify-between rounded-md bg-white p-3">
              <div class="text-sm text-slate-600">Total pendente</div>
              <div class="text-sm font-bold text-status-pending">{{ formatBRL(statement?.totals.pendingCents ?? 0) }}</div>
            </div>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-2">
            <Button label="Marcar como Pago" :loading="marking" @click="markUser('PAID')" />
            <Button label="Desconto em folha" severity="secondary" :loading="marking" @click="markUser('PAYROLL_DEDUCTION')" />
          </div>
        </div>

        <div v-if="statementLoading" class="rounded-lg bg-white p-4 text-sm text-slate-600">Carregando extrato…</div>

        <div v-else-if="statement" class="space-y-3">
          <div v-for="w in statement.withdrawals" :key="w.id" class="rounded-lg border border-slate-100 bg-white p-3">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-semibold text-text">{{ new Date(w.createdAt).toLocaleString('pt-BR') }}</div>
                <div class="text-xs text-slate-500">{{ w.items.map((i) => i.product.name).slice(0, 2).join(', ') }}<span v-if="w.items.length > 2">…</span></div>
              </div>
              <div class="text-right">
                <div class="text-sm font-bold text-primary-dark">{{ formatBRL(w.totalCents) }}</div>
                <div class="mt-1">
                  <Tag :value="statusLabel(w.paymentStatus)" :severity="statusSeverity(w.paymentStatus)" />
                </div>
              </div>
            </div>
          </div>
          <div v-if="statement.withdrawals.length === 0" class="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Sem retiradas.</div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <Button label="Fechar" severity="secondary" @click="detailsOpen = false" />
        </div>
      </template>
    </Dialog>
  </div>
</template>

