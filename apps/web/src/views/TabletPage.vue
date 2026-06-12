<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import QRCode from 'qrcode';
import type { Product } from '../stores/products';
import { useAuthStore } from '../stores/auth';
import { useCartStore } from '../stores/cart';
import { useProductsStore } from '../stores/products';
import { useSettingsStore } from '../stores/settings';
import { api } from '../lib/api';
import { formatBRL } from '../lib/money';
import type { Category } from '../stores/categories';

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
const paymentChoice = ref<PaymentMethod | null>(null);
const loadingMostBought = ref(false);
const mostBoughtIds = ref<string[]>([]);
const imageFailed = ref<Record<string, boolean>>({});
const logoutSeconds = ref<number | null>(null);
const availableCategories = ref<Category[]>([]);
const pixQrGeneratedUrl = ref<string>('');
const pixProofFile = ref<File | null>(null);

let logoutTimer: ReturnType<typeof setTimeout> | null = null;
let logoutInterval: ReturnType<typeof setInterval> | null = null;

function isBlockedCategory(name: string) {
  const n = name.trim().toLowerCase();
  return n === 'outros' || n === 'snacks';
}

function categoryKey(name: string) {
  return name.trim().toLowerCase();
}

const availableCategoryMap = computed(() => {
  const map = new Map<string, string>();
  for (const c of availableCategories.value) {
    const name = (c.name ?? '').trim();
    if (!name) continue;
    if (isBlockedCategory(name)) continue;
    const key = categoryKey(name);
    if (!map.has(key)) map.set(key, name);
  }
  return map;
});

const filteredProducts = computed(() => {
  const q = search.value.trim().toLowerCase();
  const allowed = availableCategoryMap.value;
  const shouldRestrictByCategory = allowed.size > 0;
  return productsStore.activeItems.filter((p) => {
    if (p.hideOnTablet) return false;
    if (shouldRestrictByCategory && !allowed.has(categoryKey(p.category))) return false;
    const cat = selectedCategory.value;
    const okCat = cat === 'Todos' ? true : categoryKey(p.category) === categoryKey(cat);
    const okQ = q ? p.name.toLowerCase().includes(q) : true;
    return okCat && okQ;
  });
});

const categories = computed(() => {
  const names = Array.from(availableCategoryMap.value.values()).sort((a, b) => a.localeCompare(b));
  return ['Todos', ...names];
});

const pixKey = computed(() => settings.pixKey || import.meta.env.VITE_PIX_KEY || '');
const pixQrUrl = computed(() => settings.pixQrCodeUrl || import.meta.env.VITE_PIX_QR_CODE_URL || '/QRCodePix.jpg');
const effectivePixQrUrl = computed(() => pixQrUrl.value || pixQrGeneratedUrl.value || '');
const logoSrc = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());
const greetingName = computed(() => {
  const name = auth.user?.name?.trim() || '';
  return name ? name.split(/\s+/)[0] : 'Colaborador';
});
const selectedPaymentLabel = computed(() => {
  if (paymentChoice.value === 'PIX') return 'Pix';
  if (paymentChoice.value === 'CASH') return 'Dinheiro';
  if (paymentChoice.value === 'NONE') return 'Nao pagar agora';
  return 'Selecione uma opcao';
});

function paymentMethodLabel(method: PaymentMethod) {
  if (method === 'PIX') return 'Pix';
  if (method === 'NONE') return 'Nao pagar agora';
  return 'Dinheiro';
}

async function refreshPixQr() {
  pixQrGeneratedUrl.value = '';
  if (pixQrUrl.value) return;
  const key = pixKey.value.trim();
  if (!key) return;
  try {
    pixQrGeneratedUrl.value = await QRCode.toDataURL(key, { width: 320, margin: 1 });
  } catch {
    pixQrGeneratedUrl.value = '';
  }
}

function onPixProofChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  if (!file) {
    pixProofFile.value = null;
    return;
  }
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    pixProofFile.value = null;
    error.value = 'Arquivo muito grande (máx. 5MB)';
    if (input) input.value = '';
    return;
  }
  pixProofFile.value = file;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read error'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

async function uploadPixProof(withdrawalId: string, file: File) {
  const base64 = await fileToDataUrl(file);
  await api.post(`/withdrawals/${withdrawalId}/pix-proof`, {
    fileName: file.name || 'comprovante',
    mimeType: file.type || 'application/octet-stream',
    base64,
  });
}

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
  const byId = new Map(productsStore.activeItems.filter((p) => !p.hideOnTablet).map((p) => [p.id, p]));
  return mostBoughtIds.value.map((id) => byId.get(id)).filter(Boolean) as Product[];
});

async function load() {
  error.value = null;
  const [products] = await Promise.all([
    productsStore.fetchAll(),
    api
      .get<Category[]>('/categories')
      .then((r) => {
        availableCategories.value = (r.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
      })
      .catch(() => {
        availableCategories.value = [];
      }),
  ]);
  void products;
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
  await router.push('/tablet/login');
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
    if (method === 'PIX' && pixProofFile.value) {
      try {
        await uploadPixProof(data.id, pixProofFile.value);
      } catch {
        error.value = 'Retirada registrada, mas não foi possível anexar o comprovante';
      }
    }
    lastWithdrawal.value = data;
    cart.clear();
    await productsStore.fetchAll();
    paymentChoice.value = null;
    pixProofFile.value = null;
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

watch(
  () => categories.value,
  (c) => {
    if (!c.includes(selectedCategory.value)) selectedCategory.value = 'Todos';
  },
  { immediate: true },
);

watch(
  () => [pixKey.value, pixQrUrl.value],
  () => {
    refreshPixQr();
  },
  { immediate: true },
);

onBeforeUnmount(stopAutoLogout);

onMounted(async () => {
  await load();
  loadMostBought();
  refreshPixQr();
});
</script>

<template>
  <div class="tablet-flow min-h-app bg-[radial-gradient(circle_at_top,#ffffff_0%,#f7fbff_30%,#eaf3ff_100%)]">
    <header class="tablet-header sticky top-0 z-20 border-b border-white/70 bg-white/88 backdrop-blur-xl">
      <div class="mx-auto flex max-w-[1520px] flex-col gap-4 px-4 py-4 sm:px-5 xl:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3 sm:gap-4">
            <div class="tablet-header-logo flex h-16 w-16 items-center justify-center rounded-[1.75rem] bg-[linear-gradient(145deg,#ffffff_0%,#EAF3FF_100%)] shadow-[0_20px_45px_rgba(0,87,217,0.14)] ring-1 ring-white/80 sm:h-20 sm:w-20">
              <img :src="logoSrc" class="h-12 w-12 object-contain sm:h-14 sm:w-14" :alt="settings.marketName" />
            </div>
            <div class="min-w-0">
              <div class="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#0057D9]/80">EasyMarket</div>
              <h1 class="mt-1 truncate text-2xl font-semibold text-[#0F172A] sm:text-[2rem]">Olá, {{ greetingName }} 👋</h1>
              <p class="mt-1 text-sm text-slate-600 sm:text-base">Retirada rápida de produtos</p>
            </div>
          </div>

          <div class="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              class="tablet-cart-trigger flex min-w-[10.5rem] items-center gap-3 rounded-[1.6rem] border border-[#D7E6FF] bg-[linear-gradient(135deg,#FFFFFF_0%,#F4F8FF_100%)] px-4 py-3 text-left shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-70 sm:min-w-[13rem]"
              :disabled="cart.totalQty === 0"
              @click="cartOpen = true"
            >
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] text-white shadow-[0_14px_24px_rgba(0,87,217,0.24)]">
                <i class="pi pi-shopping-cart text-lg" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Carrinho</div>
                <div class="mt-1 flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                  <span>{{ cart.totalQty }} itens</span>
                  <span class="h-1 w-1 rounded-full bg-slate-300" />
                  <span class="truncate text-[#0057D9]">{{ formatBRL(cart.totalCents) }}</span>
                </div>
              </div>
              <i class="pi pi-angle-right text-sm text-slate-400" />
            </button>

            <button
              type="button"
              class="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              @click="doLogout"
            >
              <i class="pi pi-sign-out text-sm" />
              <span class="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div class="tablet-category-strip flex items-center gap-3 overflow-x-auto rounded-[1.9rem] border border-white/70 bg-white/85 px-3 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
            <button
              v-for="c in categories"
              :key="c"
              type="button"
              class="tablet-category-pill whitespace-nowrap rounded-full px-5 py-3 text-sm font-semibold transition"
              :class="
                selectedCategory === c
                  ? 'bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] text-white shadow-[0_14px_26px_rgba(0,87,217,0.24)]'
                  : 'bg-[#F4F8FF] text-[#003B8E] hover:bg-[#E0ECFF]'
              "
              @click="selectedCategory = c"
            >
              {{ c }}
            </button>
          </div>

          <label class="tablet-search flex items-center gap-3 rounded-[1.9rem] border border-white/70 bg-white/85 px-4 py-3 shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9]">
              <i class="pi pi-search text-base" />
            </div>
            <InputText v-model="search" class="tablet-search-input w-full border-0 bg-transparent px-0 text-base shadow-none" placeholder="Buscar produto..." />
          </label>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-[1520px] px-4 py-4 sm:px-5 xl:px-6">
      <div v-if="error" class="mb-4 rounded-[1.75rem] border border-red-100 bg-red-50/90 px-4 py-3 text-sm font-medium text-red-700 shadow-sm">
        {{ error }}
      </div>

      <Transition name="fade" mode="out-in">
        <div v-if="step === 'products'" key="products" class="space-y-4">
          <section v-if="mostBoughtProducts.length" class="rounded-[2rem] border border-white/80 bg-white/92 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0057D9]/80">Destaques</div>
                <div class="mt-1 text-lg font-semibold text-[#0F172A]">Mais comprados</div>
              </div>
              <div v-if="loadingMostBought" class="text-xs font-medium text-slate-500">Carregando...</div>
            </div>

            <div class="tablet-most-bought mt-4 flex gap-3 overflow-x-auto pb-1">
              <article
                v-for="p in mostBoughtProducts"
                :key="p.id"
                class="tablet-most-card flex min-w-[15rem] max-w-[15rem] items-center gap-3 rounded-[1.6rem] border border-[#E8EEF8] bg-[linear-gradient(145deg,#FFFFFF_0%,#F8FBFF_100%)] p-3.5 shadow-[0_14px_32px_rgba(15,23,42,0.06)]"
              >
                <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[1.35rem] bg-[#EAF3FF]">
                  <img
                    v-if="hasPhoto(p)"
                    :src="p.photoUrl ?? ''"
                    class="h-16 w-16 object-contain"
                    alt=""
                    @error="onPhotoError(p.id)"
                  />
                  <div v-else class="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#0057D9]">
                    <i class="pi pi-box text-xl" />
                  </div>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{{ p.category }}</div>
                  <div class="mt-1 line-clamp-2 text-sm font-semibold text-[#0F172A]">{{ p.name }}</div>
                  <div class="mt-2 text-base font-bold text-[#0057D9]">{{ formatBRL(p.priceCents) }}</div>
                </div>
                <button
                  type="button"
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] text-white shadow-[0_12px_22px_rgba(0,87,217,0.22)] transition active:scale-[0.98]"
                  :disabled="!canAdd(p)"
                  @click="inc(p)"
                >
                  <i class="pi pi-plus text-base" />
                </button>
              </article>
            </div>
          </section>

          <section class="tablet-products-grid grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            <article
              v-for="p in filteredProducts"
              :key="p.id"
              class="tablet-product-card relative flex min-h-[16rem] flex-col overflow-hidden rounded-[1.7rem] border border-white/80 bg-[linear-gradient(160deg,#FFFFFF_0%,#F8FBFF_100%)] p-3.5 shadow-[0_16px_36px_rgba(15,23,42,0.07)] transition duration-200 active:scale-[0.99]"
              :class="p.stock <= 0 ? 'opacity-70' : 'hover:-translate-y-[2px] hover:shadow-[0_22px_58px_rgba(15,23,42,0.12)]'"
            >
              <div class="flex items-center justify-between gap-2">
                <div class="truncate rounded-full bg-[#EAF3FF] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0057D9]">
                  {{ p.category }}
                </div>
                <div
                  class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  :class="p.stock <= 0 ? 'bg-slate-200 text-slate-600' : 'bg-emerald-50 text-emerald-700'"
                >
                  {{ p.stock }} un.
                </div>
              </div>

              <div class="mt-3 flex flex-1 flex-col">
                <div class="flex h-[8.5rem] items-center justify-center rounded-[1.35rem] bg-[radial-gradient(circle_at_top,#FFFFFF_0%,#F4F8FF_55%,#EAF3FF_100%)] px-3 py-2">
                  <img
                    v-if="hasPhoto(p)"
                    :src="p.photoUrl ?? ''"
                    class="h-[7rem] w-full object-contain"
                    alt=""
                    @error="onPhotoError(p.id)"
                  />
                  <div v-else class="flex h-16 w-16 items-center justify-center rounded-[1.1rem] bg-white text-[#0057D9] shadow-inner">
                    <i class="pi pi-box text-2xl" />
                  </div>
                </div>

                <div class="mt-3 flex flex-1 flex-col">
                  <div class="line-clamp-2 min-h-[2.7rem] text-[0.95rem] font-semibold leading-5 text-[#0F172A]">{{ p.name }}</div>
                  <div class="mt-1.5 text-[1.35rem] font-bold tracking-tight text-[#0057D9]">{{ formatBRL(p.priceCents) }}</div>
                  <div class="mt-3 grid grid-cols-[3rem_minmax(0,1fr)_3rem] gap-2">
                    <Button
                      icon="pi pi-minus"
                      rounded
                      severity="secondary"
                      class="tablet-qty-btn h-[2.9rem] w-full"
                      :disabled="qtyInCart(p) === 0 || p.stock <= 0"
                      @click="dec(p)"
                    />
                    <div class="flex h-[2.9rem] items-center justify-center rounded-[1.1rem] bg-[#EAF3FF] text-xl font-bold text-[#003B8E] shadow-inner">
                      {{ qtyInCart(p) }}
                    </div>
                    <Button
                      icon="pi pi-plus"
                      rounded
                      class="tablet-qty-btn h-[2.9rem] w-full"
                      :disabled="!canAdd(p)"
                      @click="inc(p)"
                    />
                  </div>
                </div>
              </div>

              <div v-if="p.stock <= 0" class="absolute inset-0 flex items-start justify-end p-3.5">
                <div class="rounded-full bg-slate-900/75 px-2.5 py-1 text-[10px] font-semibold text-white">Indisponível</div>
              </div>
            </article>
          </section>
        </div>

        <div v-else-if="step === 'payment'" key="payment" class="space-y-4">
          <section class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(23rem,0.8fr)]">
            <div class="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0057D9]/80">Checkout</div>
                  <div class="mt-1 text-2xl font-semibold text-[#0F172A]">Finalizar retirada</div>
                </div>
                <Button label="Voltar" severity="secondary" class="h-12 px-5" @click="step = 'products'" />
              </div>

              <div class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
                <button
                  type="button"
                  class="rounded-[1.75rem] border p-5 text-left shadow-sm transition"
                  :class="
                    paymentChoice === 'CASH'
                      ? 'border-[#0057D9] bg-[#EEF5FF] shadow-[0_16px_34px_rgba(0,87,217,0.12)]'
                      : 'border-[#E8EEF8] bg-white hover:border-[#C9DBFF]'
                  "
                  @click="paymentChoice = 'CASH'"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-base font-semibold text-[#0F172A]">Dinheiro</div>
                      <div class="mt-1 text-sm text-slate-600">Pagamento no balcão</div>
                    </div>
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9]">
                      <i class="pi pi-wallet text-xl" />
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  class="rounded-[1.75rem] border p-5 text-left shadow-sm transition"
                  :class="
                    paymentChoice === 'PIX'
                      ? 'border-[#0057D9] bg-[#EEF5FF] shadow-[0_16px_34px_rgba(0,87,217,0.12)]'
                      : 'border-[#E8EEF8] bg-white hover:border-[#C9DBFF]'
                  "
                  @click="paymentChoice = 'PIX'"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-base font-semibold text-[#0F172A]">Pix</div>
                      <div class="mt-1 text-sm text-slate-600">Pague agora via QR Code</div>
                    </div>
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9]">
                      <i class="pi pi-qrcode text-xl" />
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  class="rounded-[1.75rem] border p-5 text-left shadow-sm transition"
                  :class="
                    paymentChoice === 'NONE'
                      ? 'border-[#0057D9] bg-[#EEF5FF] shadow-[0_16px_34px_rgba(0,87,217,0.12)]'
                      : 'border-[#E8EEF8] bg-white hover:border-[#C9DBFF]'
                  "
                  @click="paymentChoice = 'NONE'"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <div class="text-base font-semibold text-[#0F172A]">Não pagar agora</div>
                      <div class="mt-1 text-sm text-slate-600">Registrar como pendente</div>
                    </div>
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9]">
                      <i class="pi pi-clock text-xl" />
                    </div>
                  </div>
                </button>
              </div>

              <div v-if="paymentChoice === 'PIX'" class="mt-5 rounded-[1.9rem] border border-[#D7E6FF] bg-[linear-gradient(160deg,#FFFFFF_0%,#F6FAFF_100%)] p-5">
                <div class="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(18rem,1.1fr)]">
                  <div class="space-y-4">
                    <div>
                      <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0057D9]/80">Pix</div>
                      <div class="mt-1 text-2xl font-semibold text-[#0F172A]">Pague via Pix</div>
                    </div>
                    <div class="rounded-[1.6rem] bg-[#EAF3FF] p-4">
                      <div class="text-xs font-medium text-slate-600">Valor</div>
                      <div class="mt-1 text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
                    </div>
                    <div class="rounded-[1.6rem] border border-[#E8EEF8] bg-white p-4">
                      <div class="text-xs font-medium text-slate-600">Chave Pix</div>
                      <div class="mt-2 break-all text-sm font-semibold text-slate-900">{{ pixKey || 'Chave Pix não configurada' }}</div>
                    </div>
                    <div class="rounded-[1.6rem] bg-slate-50 p-4">
                      <div class="text-sm font-semibold text-slate-900">Anexar comprovante</div>
                      <div class="mt-1 text-xs text-slate-600">Imagem ou PDF (máx. 5MB).</div>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        class="mt-3 block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#003B8E]"
                        @change="onPixProofChange"
                      />
                      <div v-if="pixProofFile" class="mt-2 text-xs font-semibold text-slate-700">{{ pixProofFile.name }}</div>
                    </div>
                  </div>

                  <div class="flex flex-col items-center justify-center rounded-[1.8rem] border border-[#E8EEF8] bg-white p-5 text-center">
                    <div v-if="effectivePixQrUrl" class="flex flex-col items-center">
                      <img :src="effectivePixQrUrl" class="tablet-pix-qr h-64 w-64 rounded-[1.9rem] border border-slate-200 bg-white p-3 object-contain shadow-sm" alt="QR Code Pix" />
                    </div>
                    <div v-else class="flex h-64 w-full items-center justify-center rounded-[1.9rem] border border-dashed border-slate-300 bg-slate-50">
                      <div class="text-center text-sm text-slate-600">QR Code não configurado</div>
                    </div>
                    <Button class="mt-5 h-14 w-full text-lg" label="Já realizei o pagamento" :loading="submitting" @click="finalize('PIX', true)" />
                  </div>
                </div>
              </div>

              <div v-else-if="paymentChoice === 'CASH'" class="mt-5 rounded-[1.9rem] border border-[#D7E6FF] bg-[linear-gradient(160deg,#FFFFFF_0%,#F6FAFF_100%)] p-5">
                <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0057D9]/80">Dinheiro</div>
                    <div class="mt-1 text-2xl font-semibold text-[#0F172A]">Pagamento no caixa</div>
                    <div class="mt-2 max-w-xl text-sm text-slate-600">Confirme a retirada para registrar o pedido com pagamento em dinheiro.</div>
                  </div>
                  <div class="rounded-[1.6rem] bg-[#EAF3FF] px-5 py-4">
                    <div class="text-xs font-medium text-slate-600">Total</div>
                    <div class="mt-1 text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
                  </div>
                </div>
                <Button class="mt-5 h-14 w-full text-lg" label="Finalizar retirada em dinheiro" :loading="submitting" @click="finalize('CASH')" />
              </div>

              <div v-else-if="paymentChoice === 'NONE'" class="mt-5 rounded-[1.9rem] border border-amber-200 bg-amber-50/90 p-5">
                <div class="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Pendente</div>
                <div class="mt-1 text-2xl font-semibold text-slate-900">Registrar sem pagamento imediato</div>
                <div class="mt-2 text-sm text-amber-900/80">A retirada ficará em aberto para pagamento posterior no portal.</div>
                <Button class="mt-5 h-14 w-full text-lg" label="Finalizar e deixar pendente" :loading="submitting" @click="finalize('NONE')" />
              </div>
            </div>

            <aside class="rounded-[2rem] border border-white/80 bg-white/92 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.08)] sm:p-6">
              <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#0057D9]/80">Resumo</div>
              <div class="mt-1 text-2xl font-semibold text-[#0F172A]">Seu pedido</div>

              <div class="mt-5 space-y-3">
                <div
                  v-for="item in cart.items"
                  :key="item.product.id"
                  class="flex items-center justify-between gap-3 rounded-[1.5rem] border border-[#E8EEF8] bg-[#FAFCFF] px-4 py-3"
                >
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-slate-900">{{ item.product.name }}</div>
                    <div class="mt-1 text-xs text-slate-500">{{ item.quantity }} x {{ formatBRL(item.product.priceCents) }}</div>
                  </div>
                  <div class="text-sm font-semibold text-[#003B8E]">{{ formatBRL(item.quantity * item.product.priceCents) }}</div>
                </div>
              </div>

              <div class="mt-5 rounded-[1.75rem] bg-[#EAF3FF] p-5">
                <div class="flex items-center justify-between text-sm text-slate-600">
                  <span>Subtotal</span>
                  <span>{{ formatBRL(cart.totalCents) }}</span>
                </div>
                <div class="mt-3 flex items-center justify-between">
                  <span class="text-base font-semibold text-slate-900">Total</span>
                  <span class="text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</span>
                </div>
                <div class="mt-3 text-xs font-medium text-slate-600">Pagamento selecionado: {{ selectedPaymentLabel }}</div>
              </div>
            </aside>
          </section>
        </div>

        <div v-else key="done" class="space-y-4">
          <section class="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-[0_30px_70px_rgba(15,23,42,0.10)] sm:p-8">
            <div class="flex flex-col items-center text-center">
              <div class="success-pop flex h-24 w-24 items-center justify-center rounded-full bg-green-50 text-[#16A34A] shadow-[0_18px_36px_rgba(22,163,74,0.16)]">
                <i class="pi pi-check-circle text-6xl" />
              </div>
              <div class="mt-5 text-3xl font-semibold text-[#0F172A]">Retirada registrada</div>
              <div class="mt-2 max-w-xl text-sm text-slate-600 sm:text-base">Pedido confirmado com sucesso. Você já pode retirar seus produtos no mercadinho.</div>
            </div>

            <div v-if="lastWithdrawal" class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div class="rounded-[1.7rem] bg-[#EAF3FF] p-5">
                <div class="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Total</div>
                <div class="mt-2 text-3xl font-bold text-[#003B8E]">{{ formatBRL(lastWithdrawal.totalCents) }}</div>
              </div>
              <div class="rounded-[1.7rem] bg-[#EAF3FF] p-5">
                <div class="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Forma de pagamento</div>
                <div class="mt-2 text-lg font-semibold text-slate-900">{{ paymentMethodLabel(lastWithdrawal.paymentMethod) }}</div>
                <div class="mt-1 text-sm text-slate-600">{{ lastWithdrawal.paymentStatus === 'PENDING' ? 'Pendente' : 'Pago' }}</div>
              </div>
              <div class="rounded-[1.7rem] bg-[#EAF3FF] p-5">
                <div class="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Código da retirada</div>
                <div class="mt-2 break-all text-sm font-semibold text-slate-900">{{ lastWithdrawal.id }}</div>
              </div>
            </div>

            <div class="mt-8 flex flex-col gap-3 lg:flex-row lg:justify-center">
              <Button class="h-14 w-full text-lg lg:w-80" label="Nova retirada" @click="doLogout" />
              <Button class="h-14 w-full text-lg lg:w-80" label="Meu consumo" severity="secondary" @click="$router.push('/colaborador/inicio')" />
            </div>

            <div v-if="logoutSeconds !== null" class="mt-5 text-center text-sm text-slate-600">
              Saindo automaticamente em <span class="font-semibold text-[#003B8E]">{{ logoutSeconds }}s</span>
            </div>
          </section>
        </div>
      </Transition>
    </main>

    <Transition name="fade">
      <div v-if="cartOpen" class="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-[2px]" @click="cartOpen = false" />
    </Transition>
    <Transition name="slide-right">
      <aside v-if="cartOpen" class="tablet-cart-drawer fixed right-0 top-0 z-40 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.22)]" @click.stop>
        <div class="flex h-full flex-col">
          <div class="border-b border-slate-100 px-5 pb-4 pt-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0057D9]/80">Carrinho</div>
                <div class="mt-1 text-2xl font-semibold text-[#0F172A]">Seu pedido</div>
                <div class="mt-1 text-sm text-slate-600">{{ cart.totalQty }} itens selecionados</div>
              </div>
              <Button icon="pi pi-times" rounded severity="secondary" class="h-12 w-12" @click="cartOpen = false" />
            </div>
          </div>

          <div class="flex-1 overflow-auto px-5 py-4">
            <div v-if="cart.items.length === 0" class="rounded-[1.75rem] bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">Carrinho vazio.</div>
            <div v-else class="space-y-3">
              <article
                v-for="item in cart.items"
                :key="item.product.id"
                class="rounded-[1.7rem] border border-[#E8EEF8] bg-[#FAFCFF] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="truncate text-base font-semibold text-slate-900">{{ item.product.name }}</div>
                    <div class="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{{ item.product.category }}</div>
                    <div class="mt-2 text-sm font-semibold text-[#003B8E]">{{ formatBRL(item.product.priceCents) }}</div>
                  </div>
                  <Button icon="pi pi-trash" rounded severity="secondary" class="h-10 w-10" @click="cart.remove(item.product.id)" />
                </div>

                <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <Button
                      icon="pi pi-minus"
                      rounded
                      severity="secondary"
                      class="h-12 w-12"
                      :disabled="item.quantity <= 1"
                      @click="cart.setQty(item.product.id, item.quantity - 1)"
                    />
                    <div class="flex h-12 min-w-[3.75rem] items-center justify-center rounded-2xl bg-[#EAF3FF] px-3 text-lg font-bold text-[#003B8E]">
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
                  <div class="text-base font-semibold text-[#003B8E]">{{ formatBRL(item.quantity * item.product.priceCents) }}</div>
                </div>
              </article>
            </div>
          </div>

          <div class="safe-bottom border-t border-slate-100 px-5 pb-5 pt-4">
            <div class="rounded-[1.8rem] bg-[#EAF3FF] p-4">
              <div class="flex items-center justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>{{ formatBRL(cart.totalCents) }}</span>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <div class="text-base font-semibold text-slate-900">Total</div>
                <div class="text-3xl font-bold text-[#003B8E]">{{ formatBRL(cart.totalCents) }}</div>
              </div>
            </div>
            <Button
              class="mt-4 h-14 w-full text-lg"
              label="Finalizar retirada"
              :disabled="cart.totalQty === 0"
              @click="
                cartOpen = false;
                step = 'payment';
              "
            />
          </div>
        </div>
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.tablet-flow {
  overflow-x: hidden;
}

.tablet-category-strip,
.tablet-most-bought {
  scrollbar-width: none;
}

.tablet-category-strip::-webkit-scrollbar,
.tablet-most-bought::-webkit-scrollbar {
  display: none;
}

.tablet-search :deep(.p-inputtext),
.tablet-search-input:deep(.p-inputtext) {
  border: 0;
  background: transparent;
  box-shadow: none;
}

.tablet-search :deep(.p-inputtext:enabled:focus),
.tablet-search-input:deep(.p-inputtext:enabled:focus) {
  box-shadow: none;
}

.tablet-qty-btn:deep(.p-button) {
  border-radius: 1.4rem;
}

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
.tablet-cart-drawer {
  inset: 0 0 0 auto;
  height: 100%;
  width: min(92vw, 30rem);
}

.tablet-cart-trigger:disabled {
  box-shadow: none;
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

@media (max-width: 900px) {
  .tablet-product-card {
    min-height: 15.25rem;
  }

  .tablet-pix-qr {
    height: 15rem;
    width: 15rem;
  }
}

@media (orientation: portrait) and (max-width: 1024px) {
  .slide-right-enter-from,
  .slide-right-leave-to {
    transform: translateY(100%);
  }

  .tablet-cart-drawer {
    inset: auto 0 0 0;
    height: min(76dvh, 44rem);
    width: 100%;
    border-top-left-radius: 1.5rem;
    border-top-right-radius: 1.5rem;
  }
}

@media (max-width: 640px) {
  .tablet-header-logo {
    height: 4rem;
    width: 4rem;
    border-radius: 1.4rem;
  }

  .tablet-cart-trigger {
    min-width: 0;
    padding-left: 0.9rem;
    padding-right: 0.9rem;
  }

  .tablet-product-card {
    min-height: 14.5rem;
    border-radius: 1.45rem;
  }

  .tablet-product-card :deep(.p-button) {
    min-height: 2.75rem;
  }

  .tablet-products-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tablet-most-card {
    min-width: 13.75rem;
    max-width: 13.75rem;
  }

  .tablet-pix-qr {
    height: 13.5rem;
    width: 13.5rem;
  }
}

@media (max-width: 420px) {
  .tablet-products-grid {
    grid-template-columns: 1fr;
  }
}
</style>
