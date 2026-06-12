<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useMyWithdrawalsStore } from '../../stores/my-withdrawals';
import { formatBRL } from '../../lib/money';
import Tag from 'primevue/tag';
import { ArrowRight, Wallet, CreditCard, AlertCircle, ShoppingBag } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuthStore();
const my = useMyWithdrawalsStore();

const firstName = computed(() => {
  const name = (auth.user?.name ?? '').trim();
  return name ? name.split(/\s+/)[0] : 'Colaborador';
});

const totalConsumed = computed(() => my.mine.reduce((sum, w) => sum + w.totalCents, 0));
const totalPaid = computed(() => my.mine.filter((w) => w.paymentStatus !== 'PENDING').reduce((sum, w) => sum + w.totalCents, 0));
const totalPending = computed(() => my.pending.reduce((sum, w) => sum + w.totalCents, 0));
const totalPurchases = computed(() => my.mine.length);

function statusLabel(s: string) {
  if (s === 'PENDING') return 'Pendente';
  if (s === 'PAYROLL_DEDUCTION') return 'Desconto em folha';
  return 'Pago';
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function statusSeverity(s: string) {
  return s === 'PENDING' ? 'warning' : 'success';
}

onMounted(() => {
  my.fetchAll();
});
</script>

<template>
  <div class="space-y-5">
    <div class="rounded-[28px] bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] p-5 text-white shadow-[0_18px_40px_rgba(0,59,142,0.25)]">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-white/90">Olá, {{ firstName }} 👋</div>
          <div class="mt-1 text-2xl font-semibold tracking-[-0.04em]">Resumo do seu consumo</div>
          <div class="mt-2 text-sm text-white/80">Acompanhe compras, pagamentos e pendências.</div>
        </div>
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 transition hover:bg-white/20"
          @click="router.push('/colaborador/consumo')"
        >
          <ArrowRight class="h-5 w-5" />
        </button>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl bg-white/12 p-3 ring-1 ring-white/15">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold text-white/80">Total Consumido</div>
            <Wallet class="h-4 w-4 text-white/80" />
          </div>
          <div class="mt-2 text-lg font-semibold">{{ formatBRL(totalConsumed) }}</div>
        </div>
        <div class="rounded-2xl bg-white/12 p-3 ring-1 ring-white/15">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold text-white/80">Total Pago</div>
            <CreditCard class="h-4 w-4 text-white/80" />
          </div>
          <div class="mt-2 text-lg font-semibold">{{ formatBRL(totalPaid) }}</div>
        </div>
        <div class="rounded-2xl bg-white/12 p-3 ring-1 ring-white/15">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold text-white/80">Total Pendente</div>
            <AlertCircle class="h-4 w-4 text-white/80" />
          </div>
          <div class="mt-2 text-lg font-semibold">{{ formatBRL(totalPending) }}</div>
        </div>
        <div class="rounded-2xl bg-white/12 p-3 ring-1 ring-white/15">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-semibold text-white/80">Total de Compras</div>
            <ShoppingBag class="h-4 w-4 text-white/80" />
          </div>
          <div class="mt-2 text-lg font-semibold">{{ totalPurchases }}</div>
        </div>
      </div>
    </div>

    <div v-if="my.error" class="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ my.error }}</div>

    <div v-if="totalPending > 0" class="rounded-[24px] border border-amber-100 bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Pendências</div>
          <div class="mt-1 text-2xl font-semibold text-[#F59E0B]">{{ formatBRL(totalPending) }}</div>
          <div class="mt-1 text-sm text-slate-600">Você pode quitar via Pix quando quiser.</div>
        </div>
        <Button label="Ver detalhes" class="w-full sm:w-auto" @click="router.push('/colaborador/pendencias?pay=1')" />
      </div>
    </div>

    <div class="rounded-[24px] border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-slate-900">Histórico recente</div>
          <div class="mt-1 text-sm text-slate-600">Suas últimas compras registradas.</div>
        </div>
        <Button label="Ver tudo" severity="secondary" size="small" class="shrink-0" @click="router.push('/colaborador/consumo')" />
      </div>

      <div v-if="my.mine.length === 0" class="mt-4 text-sm text-slate-600">Nenhuma compra registrada ainda.</div>
      <div v-else class="mt-4 space-y-3">
        <div v-for="w in my.mine.slice(0, 8)" :key="w.id" class="rounded-2xl border border-[#E5E7EB] bg-white p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-900">
                {{ w.items.map((i) => i.product.name).slice(0, 2).join(', ') }}<span v-if="w.items.length > 2">…</span>
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span>{{ fmtDateTime(w.createdAt) }}</span>
                <span class="text-slate-300">•</span>
                <span class="font-medium text-slate-700">{{ w.paymentMethod === 'PIX' ? 'Pix' : w.paymentMethod === 'CASH' ? 'Dinheiro' : 'Não pago agora' }}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(w.totalCents) }}</div>
              <Tag class="mt-2" :value="statusLabel(w.paymentStatus)" :severity="statusSeverity(w.paymentStatus)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
