<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { Product } from '../stores/products';
import { useAuthStore } from '../stores/auth';
import { useCartStore } from '../stores/cart';
import { useProductsStore } from '../stores/products';
import { useSettingsStore } from '../stores/settings';
import { api } from '../lib/api';
import { formatBRL } from '../lib/money';

const auth = useAuthStore();
const cart = useCartStore();
const productsStore = useProductsStore();
const settings = useSettingsStore();
const router = useRouter();

type PaymentMethod = 'CASH' | 'PIX' | 'NONE';
type PaymentStatus = 'PAID' | 'PENDING' | 'PAYROLL_DEDUCTION';

type Withdrawal = {
  id: string;
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
};

type Step = 'products' | 'payment' | 'done';

type MineWithdrawal = {
  id: string;
  createdAt: string;
  items: Array<{ product: { id: string; name: string }; quantity: number }>;
};

const step = ref<Step>('products');
const search = ref('');
const selectedCategory = ref('Todos');
const error = ref<string | null>(null);
const submitting = ref(false);
const lastWithdrawal = ref<Withdrawal | null>(null);
const cartOpen = ref(false);
const paymentChoice = ref<'PIX' | 'NONE' | null>(null);
const loadingMostBought = ref(false);
const mostBoughtIds = ref<string[]>([]);
const imageFailed = ref<Record<string, boolean>>({});
const logoutSeconds = ref<number | null>(null);

let logoutTimer: ReturnType<typeof setTimeout> | null = null;
let logoutInterval: ReturnType<typeof setInterval> | null = null;

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase();
  const curatedCats = new Set(['Bebidas', 'Salgados', 'Doces', 'Chocolates']);
  return productsStore.activeItems.filter((p) => {
    const cat = selectedCategory.value;
    const okCat =
      cat === 'Todos' ? true : cat === 'Outros' ? !curatedCats.has(p.category) : p.category === cat;
    const okQ = q ? p.name.toLowerCase().includes(q) : true;
    return okCat && okQ;
  });
});

const categories = computed(() => {
  const curated = ['Todos', 'Bebidas', 'Salgados', 'Doces', 'Chocolates', 'Outros'];
  const existing = new Set(curated);
  const extra = productsStore.categories.filter((c) => !existing.has(c));
  return [...curated, ...extra];
});

const pixKey = computed(() => settings.pixKey || import.meta.env.VITE_PIX_KEY || '');
const pixQrUrl = computed(() => settings.pixQrCodeUrl || import.meta.env.VITE_PIX_QR_CODE_URL || '');
const logoSrc = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());

function qtyInCart(product: Product) {
  return cart.items.find((i) => i.product.id === product.id)?.quantity ?? 0;
}

function canAdd(product: Product) {
  return product.stock > qtyInCart(product);
}

function inc(product: Product) {
  cart.add(product);
}

function dec(product: Product) {
  const q = qtyInCart(product);
  if (q <= 1) cart.remove(product.id);
  else cart.setQty(product.id, q - 1);
}

function hasPhoto(p: Product) {
  const url = (p.photoUrl ?? '').trim();
  if (!url) return false;
  return !imageFailed.value[p.id];
}

function onPhotoError(id: string) {
  imageFailed.value = { ...imageFailed.value, [id]: true };
}

const mostBoughtProducts = computed(() => {
  const byId = new Map(productsStore.activeItems.map((p) => [p.id, p]));
  return mostBoughtIds.value.map((id) => byId.get(id)).filter(Boolean) as Product[];
});

async function load() {
  error.value = null;
  await productsStore.fetchAll();
}

async function loadMostBought() {
  if (loadingMostBought.value) return;
  loadingMostBought.value = true;
  try {
    const { data } = await api.get<MineWithdrawal[]>('/withdrawals/mine');
    const counts = new Map<string, number>();
    for (const w of data) {
      for (const i of w.items) {
        counts.set(i.product.id, (counts.get(i.product.id) ?? 0) + i.quantity);
      }
    }
    const ids = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id);
    mostBoughtIds.value = ids;
  } catch {
    mostBoughtIds.value = [];
  } finally {
    loadingMostBought.value = false;
  }
}

async function doLogout() {
  await auth.logout();
  await router.push(`/colaborador/login?redirect=${encodeURIComponent('/tablet')}`);
}

async function finalize(method: PaymentMethod, pixConfirmed?: boolean) {
  submitting.value = true;
  error.value = null;
  try {
    const payload = {
      items: cart.items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
      paymentMethod: method,
      pixConfirmed: !!pixConfirmed,
    };
    const { data } = await api.post<Withdrawal>('/withdrawals', payload);
    lastWithdrawal.value = data;
    cart.clear();
    await productsStore.fetchAll();
    paymentChoice.value = null;
    step.value = 'done';
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao finalizar';
  } finally {
    submitting.value = false;
  }
}

function startAutoLogout() {
  if (logoutTimer) clearTimeout(logoutTimer);
  if (logoutInterval) clearInterval(logoutInterval);
  logoutSeconds.value = 15;
  logoutInterval = setInterval(() => {
    if (logoutSeconds.value === null) return;
    logoutSeconds.value = Math.max(0, logoutSeconds.value - 1);
  }, 1000);
  logoutTimer = setTimeout(() => {
    doLogout();
  }, 15000);
}

function stopAutoLogout() {
  if (logoutTimer) clearTimeout(logoutTimer);
  if (logoutInterval) clearInterval(logoutInterval);
  logoutTimer = null;
  logoutInterval = null;
  logoutSeconds.value = null;
}

watch(
  () => step.value,
  (s) => {
    if (s === 'done') startAutoLogout();
    else stopAutoLogout();
  },
);

onBeforeUnmount(stopAutoLogout);

onMounted(async () => {
  await load();
  loadMostBought();
});
</script>

<template>
  <div class="min-h-[100vh] bg-[#EAF3FF]">
    <header class="sticky top-0 z-20 border-b border-[#EAF3FF] bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4">
        <div class="flex min-w-0 items-center gap-3">
          <img :src="logoSrc" class="h-16 w-16 object-cover" :alt="settings.marketName" />
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-[#003B8E]">{{ settings.marketName }}</div>
            <div class="truncate text-xs text-slate-600">{{ auth.user?.name }} ({{ auth.user?.code }})</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="hidden items-center gap-2 rounded-2xl bg-[#EAF3FF] px-4 py-2 md:flex">
            <div class="text-xs font-medium text-slate-600">Itens</div>
            <div class="text-sm font-semibold text-[#003B8E]">{{ cart.totalQty }}</div>
            <div class="mx-2 h-4 w-px bg-slate-200" />
            <div class="text-xs font-medium text-slate-600">Total</div>
            <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
          </div>

          <Button
            icon="pi pi-shopping-cart"
            rounded
            class="h-12 w-12"
            :disabled="cart.totalQty === 0"
            @click="cartOpen = true"
          />
          <Button icon="pi pi-sign-out" rounded severity="secondary" class="h-12 w-12" @click="doLogout" />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-5">
      <div v-if="error" class="mb-4 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{{ error }}</div>

      <Transition name="fade" mode="out-in">
        <div v-if="step === 'products'" key="products" class="space-y-5">
          <div class="flex flex-col gap-4 rounded-3xl bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div class="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
              <button
                v-for="c in categories"
                :key="c"
                type="button"
                class="whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition"
                :class="selectedCategory === c ? 'bg-[#003B8E] text-white' : 'bg-[#EAF3FF] text-[#003B8E] hover:bg-slate-100'"
                @click="selectedCategory = c"
              >
                {{ c }}
              </button>
            </div>

            <div class="w-full md:w-[28rem]">
              <span class="p-input-icon-left w-full">
                <i class="pi pi-search" />
                <InputText v-model="search" class="w-full text-lg" placeholder="Buscar produto..." />
              </span>
            </div>
          </div>

          <div v-if="mostBoughtProducts.length" class="rounded-3xl bg-white p-4 shadow-sm">
            <div class="flex items-center justify-between">
              <div class="text-sm font-semibold text-[#003B8E]">Mais comprados</div>
              <div v-if="loadingMostBought" class="text-xs text-slate-500">Carregando...</div>
            </div>
            <div class="mt-3 flex gap-3 overflow-x-auto pb-2">
              <button
                v-for="p in mostBoughtProducts"
                :key="p.id"
                type="button"
                class="min-w-[260px] rounded-3xl border border-slate-100 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
                @click="inc(p)"
              >
                <div class="flex items-start gap-3">
                  <div class="h-16 w-16 overflow-hidden rounded-2xl bg-[#EAF3FF]">
                    <img
                      v-if="hasPhoto(p)"
                      :src="p.photoUrl ?? ''"
                      class="h-full w-full object-cover"
                      alt=""
                      @error="onPhotoError(p.id)"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm font-semibold text-slate-900">{{ p.name }}</div>
                    <div class="mt-1 text-xs text-slate-600">{{ p.category }}</div>
                    <div class="mt-2 text-sm font-semibold text-[#003B8E]">{{ formatBRL(p.priceCents) }}</div>
                  </div>
                  <div class="text-xs font-semibold text-slate-600">+1</div>
                </div>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            <div
              v-for="p in filteredProducts"
              :key="p.id"
              class="relative overflow-hidden rounded-3xl bg-white p-4 shadow-sm transition active:scale-[0.99]"
              :class="p.stock <= 0 ? 'opacity-60' : ''"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="rounded-full bg-[#EAF3FF] px-3 py-1 text-xs font-semibold text-[#003B8E]">
                  {{ p.category }}
                </div>
                <div class="text-xs font-semibold" :class="p.stock <= 0 ? 'text-slate-500' : 'text-slate-600'">
                  Estoque: {{ p.stock }}
                </div>
              </div>

              <div class="mt-3 overflow-hidden rounded-2xl bg-[#EAF3FF]" style="aspect-ratio: 1 / 1">
                <img
                  v-if="hasPhoto(p)"
                  :src="p.photoUrl ?? ''"
                  class="h-full w-full object-cover"
                  alt=""
                  @error="onPhotoError(p.id)"
                />
                <div v-else class="h-full w-full" />
              </div>

              <div class="mt-3 min-h-[3.25rem]">
                <div class="line-clamp-2 text-base font-semibold text-slate-900">{{ p.name }}</div>
              </div>

              <div class="mt-2 text-lg font-bold text-[#003B8E]">{{ formatBRL(p.priceCents) }}</div>

              <div class="mt-4 grid grid-cols-3 gap-2">
                <Button
                  icon="pi pi-minus"
                  rounded
                  severity="secondary"
                  class="h-12 w-full"
                  :disabled="qtyInCart(p) === 0 || p.stock <= 0"
                  @click="dec(p)"
                />
                <div class="flex h-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-lg font-bold text-[#003B8E]">
                  {{ qtyInCart(p) }}
                </div>
                <Button
                  icon="pi pi-plus"
                  rounded
                  class="h-12 w-full"
                  :disabled="!canAdd(p)"
                  @click="inc(p)"
                />
              </div>

              <div v-if="p.stock <= 0" class="absolute inset-0 flex items-start justify-end p-4">
                <div class="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">Indisponível</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="step === 'payment'" key="payment" class="space-y-5">
          <div class="rounded-3xl bg-white p-5 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-medium text-slate-600">Pagamento</div>
                <div class="mt-1 text-xl font-semibold text-[#003B8E]">Escolha como pagar</div>
              </div>
              <Button label="Voltar" severity="secondary" class="h-12" @click="step = 'products'" />
            </div>

            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <button
                type="button"
                class="rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-sm transition active:scale-[0.99]"
                :class="paymentChoice === 'PIX' ? 'ring-2 ring-[#0057D9]' : ''"
                @click="paymentChoice = 'PIX'"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">Pix</div>
                    <div class="mt-1 text-sm text-slate-600">Pague agora via QR Code</div>
                  </div>
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
                    <i class="pi pi-qrcode text-xl" />
                  </div>
                </div>
              </button>

              <button
                type="button"
                class="rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-sm transition active:scale-[0.99]"
                :class="paymentChoice === 'NONE' ? 'ring-2 ring-[#0057D9]' : ''"
                @click="paymentChoice = 'NONE'"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">Pagar depois</div>
                    <div class="mt-1 text-sm text-slate-600">Registrar e pagar mais tarde</div>
                  </div>
                  <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#003B8E]">
                    <i class="pi pi-clock text-xl" />
                  </div>
                </div>
              </button>
            </div>

            <div class="mt-4 rounded-3xl bg-[#EAF3FF] p-5">
              <div class="text-xs font-medium text-slate-600">Total</div>
              <div class="mt-1 text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
            </div>
          </div>

          <div v-if="paymentChoice === 'PIX'" class="rounded-3xl bg-white p-5 shadow-sm">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div class="rounded-3xl bg-[#EAF3FF] p-5">
                <div class="text-sm font-semibold text-[#003B8E]">Valor</div>
                <div class="mt-1 text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
                <div class="mt-4 text-xs font-medium text-slate-600">Chave Pix</div>
                <div class="mt-2 break-all rounded-2xl bg-white p-4 text-sm font-semibold text-slate-900">
                  {{ pixKey || 'Chave Pix não configurada' }}
                </div>
              </div>

              <div class="flex flex-col items-center justify-center rounded-3xl border border-slate-100 p-5">
                <div v-if="pixQrUrl" class="flex flex-col items-center">
                  <img :src="pixQrUrl" class="h-64 w-64 rounded-3xl border border-slate-200 object-contain" alt="QR Code Pix" />
                </div>
                <div v-else class="flex h-64 w-full items-center justify-center rounded-3xl border border-dashed border-slate-300">
                  <div class="text-center text-sm text-slate-600">QR Code não configurado</div>
                </div>
              </div>
            </div>

            <div class="mt-5">
              <Button class="h-14 w-full text-lg" label="Confirmo que paguei" :loading="submitting" @click="finalize('PIX', true)" />
            </div>
          </div>

          <div v-else-if="paymentChoice === 'NONE'" class="rounded-3xl bg-white p-5 shadow-sm">
            <div class="rounded-2xl bg-amber-50 p-4 text-sm text-amber-800">
              Esta retirada ficará como pendente. Você pode pagar depois e confirmar no portal.
            </div>
            <div class="mt-5">
              <Button class="h-14 w-full text-lg" label="Finalizar e pagar depois" :loading="submitting" @click="finalize('NONE')" />
            </div>
          </div>
        </div>

        <div v-else key="done" class="space-y-5">
          <div class="rounded-3xl bg-white p-6 shadow-sm">
            <div class="flex flex-col items-center text-center">
              <div class="success-pop flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-[#16A34A]">
                <i class="pi pi-check-circle text-5xl" />
              </div>
              <div class="mt-4 text-2xl font-semibold text-[#003B8E]">Retirada registrada</div>
              <div class="mt-2 text-sm text-slate-600">Tudo certo! Você já pode retirar seus itens.</div>
            </div>

            <div v-if="lastWithdrawal" class="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div class="rounded-2xl bg-[#EAF3FF] p-4">
                <div class="text-xs font-medium text-slate-600">Total</div>
                <div class="mt-1 text-xl font-bold text-[#003B8E]">{{ formatBRL(lastWithdrawal.totalCents) }}</div>
              </div>
              <div class="rounded-2xl bg-[#EAF3FF] p-4">
                <div class="text-xs font-medium text-slate-600">Pagamento</div>
                <div class="mt-1 text-sm font-semibold text-slate-900">
                  {{ lastWithdrawal.paymentMethod === 'PIX' ? 'Pix' : lastWithdrawal.paymentMethod === 'NONE' ? 'Pagar depois' : 'Dinheiro' }}
                </div>
                <div class="mt-1 text-xs text-slate-600">
                  {{ lastWithdrawal.paymentStatus === 'PENDING' ? 'Pendente' : 'Pago' }}
                </div>
              </div>
              <div class="rounded-2xl bg-[#EAF3FF] p-4">
                <div class="text-xs font-medium text-slate-600">Número da retirada</div>
                <div class="mt-1 break-all text-sm font-semibold text-slate-900">{{ lastWithdrawal.id }}</div>
              </div>
            </div>

            <div class="mt-6 flex flex-col gap-2 md:flex-row md:justify-center">
              <Button class="h-14 w-full text-lg md:w-72" label="Nova retirada" @click="doLogout" />
              <Button class="h-14 w-full text-lg md:w-72" label="Meu consumo" severity="secondary" @click="$router.push('/colaborador/inicio')" />
            </div>

            <div v-if="logoutSeconds !== null" class="mt-4 text-center text-sm text-slate-600">
              Saindo automaticamente em <span class="font-semibold text-[#003B8E]">{{ logoutSeconds }}s</span>
            </div>
          </div>
        </div>
      </Transition>
    </main>

    <Transition name="fade">
      <div v-if="cartOpen" class="fixed inset-0 z-30 bg-black/30" @click="cartOpen = false" />
    </Transition>
    <Transition name="slide-right">
      <aside
        v-if="cartOpen"
        class="fixed right-0 top-0 z-40 h-full w-[92vw] max-w-md bg-white shadow-2xl"
        @click.stop
      >
        <div class="flex h-full flex-col">
          <div class="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <div class="text-xs font-medium text-slate-600">Carrinho</div>
              <div class="mt-1 text-lg font-semibold text-[#003B8E]">{{ cart.totalQty }} itens</div>
            </div>
            <Button icon="pi pi-times" rounded severity="secondary" class="h-12 w-12" @click="cartOpen = false" />
          </div>

          <div class="flex-1 overflow-auto p-5">
            <div v-if="cart.items.length === 0" class="text-sm text-slate-600">Carrinho vazio.</div>
            <div v-else class="space-y-3">
              <div v-for="item in cart.items" :key="item.product.id" class="rounded-3xl border border-slate-100 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-slate-900">{{ item.product.name }}</div>
                    <div class="mt-1 text-xs text-slate-600">{{ formatBRL(item.product.priceCents) }}</div>
                  </div>
                  <Button icon="pi pi-trash" rounded severity="secondary" class="h-10 w-10" @click="cart.remove(item.product.id)" />
                </div>

                <div class="mt-4 flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <Button
                      icon="pi pi-minus"
                      rounded
                      severity="secondary"
                      class="h-12 w-12"
                      :disabled="item.quantity <= 1"
                      @click="cart.setQty(item.product.id, item.quantity - 1)"
                    />
                    <div class="flex h-12 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-lg font-bold text-[#003B8E]">
                      {{ item.quantity }}
                    </div>
                    <Button
                      icon="pi pi-plus"
                      rounded
                      class="h-12 w-12"
                      :disabled="item.quantity >= item.product.stock"
                      @click="cart.setQty(item.product.id, item.quantity + 1)"
                    />
                  </div>
                  <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(item.quantity * item.product.priceCents) }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="border-t border-slate-100 p-5">
            <div class="flex items-center justify-between">
              <div class="text-sm text-slate-600">Total</div>
              <div class="text-2xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
            </div>
            <div class="mt-4">
              <Button
                class="h-14 w-full text-lg"
                label="Finalizar"
                :disabled="cart.totalQty === 0"
                @click="
                  cartOpen = false;
                  step = 'payment';
                "
              />
            </div>
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 220ms ease;
}
.slide-right-enter-from,
.slide-right-leave-to {
  transform: translateX(100%);
}
.success-pop {
  animation: pop 280ms ease-out;
}
@keyframes pop {
  from {
    transform: scale(0.92);
    opacity: 0.6;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
