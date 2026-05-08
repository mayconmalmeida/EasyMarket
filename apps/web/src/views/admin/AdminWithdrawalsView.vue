<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import Tag from 'primevue/tag';
import { useWithdrawalsStore, type Withdrawal } from '../../stores/withdrawals';
import { api } from '../../lib/api';
import { formatBRL } from '../../lib/money';

type StatusFilter = 'ALL' | Withdrawal['paymentStatus'];
type MethodFilter = 'ALL' | Withdrawal['paymentMethod'];

const store = useWithdrawalsStore();

const from = ref<string>('');
const to = ref<string>('');
const collaborator = ref<string | 'ALL'>('ALL');
const status = ref<StatusFilter>('ALL');
const method = ref<MethodFilter>('ALL');

const detailsOpen = ref(false);
const selected = ref<Withdrawal | null>(null);
const error = ref<string | null>(null);
const savingStatus = ref(false);
const paymentStatusEdit = ref<Withdrawal['paymentStatus']>('PAID');

const collaborators = computed(() => {
  const unique = Array.from(new Set(store.items.map((w) => w.user.id))).map((id) => {
    const w = store.items.find((x) => x.user.id === id)!;
    return { label: `${w.user.name} (${w.user.code})`, value: id };
  });
  unique.sort((a, b) => a.label.localeCompare(b.label));
  return [{ label: 'Todos', value: 'ALL' as const }, ...unique];
});

const statusOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Pago', value: 'PAID' as const },
  { label: 'Desconto em folha', value: 'PAYROLL_DEDUCTION' as const },
  { label: 'Pendente', value: 'PENDING' as const },
];

const methodOptions = [
  { label: 'Todos', value: 'ALL' as const },
  { label: 'Dinheiro', value: 'CASH' as const },
  { label: 'Pix', value: 'PIX' as const },
  { label: 'Não pago agora', value: 'NONE' as const },
];

const filtered = computed(() => {
  const fromTs = from.value ? new Date(`${from.value}T00:00:00`).getTime() : null;
  const toTs = to.value ? new Date(`${to.value}T23:59:59`).getTime() : null;
  return store.items.filter((w) => {
    const ts = new Date(w.createdAt).getTime();
    const okFrom = fromTs ? ts >= fromTs : true;
    const okTo = toTs ? ts <= toTs : true;
    const okCollab = collaborator.value === 'ALL' ? true : w.user.id === collaborator.value;
    const okStatus = status.value === 'ALL' ? true : w.paymentStatus === status.value;
    const okMethod = method.value === 'ALL' ? true : w.paymentMethod === method.value;
    return okFrom && okTo && okCollab && okStatus && okMethod;
  });
});

function statusLabel(w: Withdrawal) {
  if (w.paymentStatus === 'PENDING') return 'Pendente';
  if (w.paymentStatus === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function statusSeverity(w: Withdrawal) {
  if (w.paymentStatus === 'PENDING') return 'warning';
  if (w.paymentStatus === 'PAYROLL_DEDUCTION') return 'info';
  return 'success';
}

function methodLabel(w: Withdrawal) {
  if (w.paymentMethod === 'CASH') return 'Dinheiro';
  if (w.paymentMethod === 'PIX') return 'Pix';
  return 'Não pago agora';
}

function openDetails(w: Withdrawal) {
  selected.value = w;
  detailsOpen.value = true;
  paymentStatusEdit.value = w.paymentStatus;
}

function itemsPreview(w: Withdrawal) {
  const names = w.items.map((it) => it.product.name);
  return names.slice(0, 3).join(', ');
}

async function markPaid(w: Withdrawal) {
  error.value = null;
  try {
    await store.markPaid(w.id);
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao marcar como pago';
  }
}

async function savePaymentStatus() {
  if (!selected.value) return;
  savingStatus.value = true;
  error.value = null;
  try {
    await api.patch(`/admin/withdrawals/${selected.value.id}/payment-status`, {
      status: paymentStatusEdit.value,
    });
    await store.fetchAllAdmin();
    selected.value = store.items.find((x) => x.id === selected.value!.id) ?? null;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao corrigir pagamento';
  } finally {
    savingStatus.value = false;
  }
}

function printReceipt(w: Withdrawal) {
  const lines = [
    `<h2 style="margin:0 0 8px;font-family:system-ui">EasyMarket</h2>`,
    `<div style="font-family:system-ui;font-size:14px;color:#1F2937">`,
    `<div><b>Retirada:</b> ${w.id}</div>`,
    `<div><b>Data/Hora:</b> ${new Date(w.createdAt).toLocaleString('pt-BR')}</div>`,
    `<div><b>Colaborador:</b> ${w.user.name} (${w.user.code})</div>`,
    `<div><b>Pagamento:</b> ${methodLabel(w)} • ${statusLabel(w)}</div>`,
    `</div>`,
    `<hr/>`,
    `<table style="width:100%;font-family:system-ui;font-size:14px;border-collapse:collapse">`,
    `<thead><tr><th style="text-align:left;border-bottom:1px solid #eee;padding:6px">Produto</th><th style="text-align:right;border-bottom:1px solid #eee;padding:6px">Qtd</th><th style="text-align:right;border-bottom:1px solid #eee;padding:6px">Unit</th></tr></thead>`,
    `<tbody>`,
    ...w.items.map(
      (i) =>
        `<tr><td style="padding:6px;border-bottom:1px solid #f5f5f5">${i.product.name}</td><td style="padding:6px;text-align:right;border-bottom:1px solid #f5f5f5">${i.quantity}</td><td style="padding:6px;text-align:right;border-bottom:1px solid #f5f5f5">${formatBRL(i.unitPriceCents)}</td></tr>`,
    ),
    `</tbody>`,
    `</table>`,
    `<div style="display:flex;justify-content:space-between;margin-top:10px;font-family:system-ui;font-size:16px"><b>Total</b><b>${formatBRL(
      w.totalCents,
    )}</b></div>`,
  ];

  const win = window.open('', '_blank', 'width=600,height=700');
  if (!win) return;
  win.document.write(`<html><head><title>Comprovante</title></head><body>${lines.join('')}</body></html>`);
  win.document.close();
  win.focus();
  win.print();
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
        <div class="text-sm font-semibold text-slate-900">Retiradas</div>
        <div class="text-sm text-slate-600">Histórico de compras e auditoria.</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Atualizar" severity="secondary" :loading="store.loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm lg:col-span-1">
        <div class="text-sm font-semibold text-slate-900">Filtros</div>
        <div class="mt-1 text-sm text-slate-600">Refine o histórico.</div>
        <div class="mt-3 space-y-3">
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Período (de)</label>
            <input v-model="from" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Período (até)</label>
            <input v-model="to" type="date" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Colaborador</label>
            <Dropdown v-model="collaborator" class="w-full" :options="collaborators" optionLabel="label" optionValue="value" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Status</label>
            <Dropdown v-model="status" class="w-full" :options="statusOptions" optionLabel="label" optionValue="value" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-medium text-slate-600">Forma de pagamento</label>
            <Dropdown v-model="method" class="w-full" :options="methodOptions" optionLabel="label" optionValue="value" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm lg:col-span-3">
        <DataTable :value="filtered" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines tableStyle="min-width: 70rem">
          <Column header="Data/Hora" sortable field="createdAt" style="min-width: 14rem">
            <template #body="{ data }">{{ new Date(data.createdAt).toLocaleString('pt-BR') }}</template>
          </Column>
          <Column header="Colaborador" style="min-width: 16rem">
            <template #body="{ data }">
              <div>
                <div class="font-semibold text-text">{{ data.user.name }}</div>
                <div class="text-xs text-slate-500">{{ data.user.code }}</div>
              </div>
            </template>
          </Column>
          <Column header="Produtos" style="min-width: 16rem">
            <template #body="{ data }">
              <div class="text-sm text-slate-700">{{ data.items.length }} itens</div>
              <div class="text-xs text-slate-500 truncate">
                {{ itemsPreview(data) }}
                <span v-if="data.items.length > 3">…</span>
              </div>
            </template>
          </Column>
          <Column header="Pagamento" sortable field="paymentMethod" style="min-width: 12rem">
            <template #body="{ data }">{{ methodLabel(data) }}</template>
          </Column>
          <Column header="Status" sortable field="paymentStatus" style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="statusLabel(data)" :severity="statusSeverity(data)" />
            </template>
          </Column>
          <Column header="Total" sortable field="totalCents" style="min-width: 10rem">
            <template #body="{ data }">
              <div class="text-right font-semibold text-[#003B8E]">{{ formatBRL(data.totalCents) }}</div>
            </template>
          </Column>
          <Column header="Ações" style="min-width: 14rem">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <Button icon="pi pi-search" rounded severity="secondary" @click="openDetails(data)" />
                <Button icon="pi pi-print" rounded severity="secondary" @click="printReceipt(data)" />
                <Button
                  v-if="data.paymentStatus === 'PENDING'"
                  icon="pi pi-check"
                  rounded
                  @click="markPaid(data)"
                />
              </div>
            </template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhuma retirada encontrada.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="detailsOpen" modal header="Detalhes da retirada" :style="{ width: '46rem' }" :draggable="false">
      <div v-if="selected" class="space-y-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="rounded-2xl bg-[#F5F7FB] p-4">
            <div class="text-xs text-slate-500">ID</div>
            <div class="break-all text-sm font-semibold text-slate-900">{{ selected.id }}</div>
          </div>
          <div class="rounded-2xl bg-[#F5F7FB] p-4">
            <div class="text-xs text-slate-500">Data/Hora</div>
            <div class="text-sm font-semibold text-slate-900">{{ new Date(selected.createdAt).toLocaleString('pt-BR') }}</div>
          </div>
          <div class="rounded-2xl bg-[#F5F7FB] p-4">
            <div class="text-xs text-slate-500">Colaborador</div>
            <div class="text-sm font-semibold text-slate-900">{{ selected.user.name }} ({{ selected.user.code }})</div>
          </div>
          <div class="rounded-2xl bg-[#F5F7FB] p-4">
            <div class="text-xs text-slate-500">Pagamento</div>
            <div class="text-sm font-semibold text-slate-900">{{ methodLabel(selected) }} • {{ statusLabel(selected) }}</div>
          </div>
        </div>

        <div class="overflow-hidden rounded-2xl border border-[#E5E7EB]">
          <table class="w-full text-left text-sm">
            <thead class="bg-[#F5F7FB] text-xs text-slate-600">
              <tr>
                <th class="px-3 py-2">Produto</th>
                <th class="px-3 py-2 text-right">Qtd</th>
                <th class="px-3 py-2 text-right">Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in selected.items" :key="i.id" class="border-t border-[#E5E7EB]">
                <td class="px-3 py-2 text-slate-700">{{ i.product.name }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ i.quantity }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatBRL(i.unitPriceCents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5">
          <div class="text-sm font-semibold text-slate-900">Corrigir pagamento</div>
          <div class="mt-1 text-sm text-slate-600">Ajuste manual do status para auditoria.</div>
          <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-end">
            <div class="flex-1 space-y-1">
              <label class="text-xs font-medium text-slate-600">Status</label>
              <select v-model="paymentStatusEdit" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
                <option value="PAID">Pago</option>
                <option value="PAYROLL_DEDUCTION">Desconto em folha</option>
                <option value="PENDING">Pendente</option>
              </select>
            </div>
            <div class="md:w-44">
              <Button class="w-full" label="Salvar status" :loading="savingStatus" @click="savePaymentStatus" />
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between rounded-2xl bg-[#F5F7FB] p-5">
          <div class="text-sm text-slate-600">Total</div>
          <div class="text-lg font-bold text-[#003B8E]">{{ formatBRL(selected.totalCents) }}</div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button label="Fechar" severity="secondary" @click="detailsOpen = false" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
