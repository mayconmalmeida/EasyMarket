<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Dialog from 'primevue/dialog';
import Tag from 'primevue/tag';
import { useMyWithdrawalsStore, type Withdrawal } from '../../stores/my-withdrawals';
import { formatBRL } from '../../lib/money';
import { FileText, Wallet } from 'lucide-vue-next';

const my = useMyWithdrawalsStore();
const receiptOpen = ref(false);
const selected = ref<Withdrawal | null>(null);

const payments = computed(() => my.mine.filter((w) => w.paymentStatus !== 'PENDING'));
const timeline = computed(() =>
  [...payments.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8),
);

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function statusLabel(s: Withdrawal['paymentStatus']) {
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function methodLabel(m: Withdrawal['paymentMethod']) {
  if (m === 'CASH') return 'Dinheiro';
  if (m === 'PIX') return 'Pix';
  return 'Não pago agora';
}

function openReceipt(w: Withdrawal) {
  selected.value = w;
  receiptOpen.value = true;
}

onMounted(() => {
  if (!my.mine.length) my.fetchAll();
});
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Pagamentos</div>
          <div class="mt-1 text-sm text-slate-600">Histórico de pagamentos e comprovantes internos.</div>
        </div>
        <Button label="Atualizar" severity="secondary" :loading="my.loading" @click="my.fetchAll()" />
      </div>
      <div v-if="my.error" class="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{{ my.error }}</div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-900">Timeline</div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <Wallet class="h-5 w-5" />
          </div>
        </div>
        <div v-if="timeline.length === 0" class="mt-4 text-sm text-slate-600">Nenhum pagamento registrado.</div>
        <div v-else class="mt-4 space-y-3 border-l border-[#E5E7EB] pl-4">
          <div v-for="p in timeline" :key="p.id" class="relative rounded-2xl border border-[#E5E7EB] bg-white p-4">
            <div class="absolute -left-[22px] top-6 h-3 w-3 rounded-full bg-[#0057D9]" />
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-sm font-semibold text-slate-900">{{ fmtDateTime(p.createdAt) }}</div>
                <div class="mt-1 text-xs text-slate-600">{{ methodLabel(p.paymentMethod) }}</div>
              </div>
              <div class="text-right">
                <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(p.totalCents) }}</div>
                <Tag :value="statusLabel(p.paymentStatus)" severity="success" class="mt-2" />
              </div>
            </div>
            <div class="mt-3">
              <Button label="Ver comprovante" severity="secondary" @click="openReceipt(p)" />
            </div>
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between px-1 pb-3">
          <div class="text-sm font-semibold text-slate-900">Histórico</div>
          <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
            <FileText class="h-5 w-5" />
          </div>
        </div>
        <DataTable :value="payments" dataKey="id" paginator :rows="10" :rowsPerPageOptions="[10, 20, 50]" stripedRows showGridlines>
          <Column header="Data" style="min-width: 12rem">
            <template #body="{ data }">
              <span class="text-sm text-slate-900">{{ fmtDateTime(data.createdAt) }}</span>
            </template>
          </Column>
          <Column header="Valor" sortField="totalCents" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <span class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(data.totalCents) }}</span>
            </template>
          </Column>
          <Column header="Forma" style="min-width: 10rem">
            <template #body="{ data }">
              <span class="text-sm text-slate-700">{{ methodLabel(data.paymentMethod) }}</span>
            </template>
          </Column>
          <Column header="Status" style="min-width: 12rem">
            <template #body="{ data }">
              <Tag :value="statusLabel(data.paymentStatus)" severity="success" />
            </template>
          </Column>
          <Column header="Comprovante" style="min-width: 12rem">
            <template #body="{ data }">
              <Button label="Ver" severity="secondary" @click="openReceipt(data)" />
            </template>
          </Column>
          <template #empty>
            <div class="p-6 text-center text-sm text-slate-600">Nenhum pagamento registrado.</div>
          </template>
        </DataTable>
      </div>
    </div>

    <Dialog v-model:visible="receiptOpen" modal header="Comprovante interno" :style="{ width: '42rem' }" :draggable="false">
      <div v-if="selected" class="space-y-4">
        <div class="rounded-xl bg-[#EAF3FF] p-4">
          <div class="text-xs font-medium text-slate-600">ID</div>
          <div class="mt-1 break-all text-sm font-semibold text-[#003B8E]">{{ selected.id }}</div>
          <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div class="rounded-xl bg-white p-3">
              <div class="text-xs font-medium text-slate-600">Data</div>
              <div class="mt-1 text-sm text-slate-900">{{ fmtDateTime(selected.createdAt) }}</div>
            </div>
            <div class="rounded-xl bg-white p-3">
              <div class="text-xs font-medium text-slate-600">Valor</div>
              <div class="mt-1 text-sm font-semibold text-[#003B8E]">{{ formatBRL(selected.totalCents) }}</div>
            </div>
          </div>
        </div>

        <div class="rounded-xl bg-white">
          <div class="text-sm font-semibold text-[#003B8E]">Itens</div>
          <div class="mt-3 space-y-2">
            <div v-for="i in selected.items" :key="i.id" class="flex items-center justify-between rounded-xl border border-slate-100 p-3">
              <div class="min-w-0">
                <div class="truncate text-sm font-medium text-slate-900">{{ i.product.name }}</div>
                <div class="mt-1 text-xs text-slate-600">x{{ i.quantity }}</div>
              </div>
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(i.quantity * i.unitPriceCents) }}</div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end">
          <Button label="Fechar" severity="secondary" @click="receiptOpen = false" />
        </div>
      </template>
    </Dialog>
  </div>
</template>
