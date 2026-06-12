<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { useWithdrawalsStore } from '../stores/withdrawals';
import { useNotificationsStore } from '../stores/notifications';
import InputText from 'primevue/inputtext';
import OverlayPanel from 'primevue/overlaypanel';
import {
  Bell,
  ChevronRight,
  LayoutDashboard,
  ShoppingCart,
  AlertCircle,
  Wallet,
  Package,
  PackagePlus,
  Tags,
  Users,
  Building2,
  BarChart3,
  Settings as SettingsIcon,
  Search,
  LogOut,
  ArrowLeftRight,
  Sparkles,
} from 'lucide-vue-next';

type NavItem = {
  label: string;
  to: string;
  icon: any;
};

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const withdrawals = useWithdrawalsStore();
const notifications = useNotificationsStore();

const mobileOpen = ref(false);
const defaultLogoUrl = new URL('../assets/logo.png', import.meta.url).toString();
const logoSrc = computed(() => settings.logoUrl || defaultLogoUrl);

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: 'Operacional',
    items: [
      { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Retiradas', to: '/admin/retiradas', icon: ShoppingCart },
      { label: 'Pendências', to: '/admin/pendencias', icon: AlertCircle },
      { label: 'Fechamento Mensal', to: '/admin/fechamento-mensal', icon: Wallet },
    ],
  },
  {
    label: 'Estoque',
    items: [
      { label: 'Entradas de Estoque', to: '/admin/entradas-estoque', icon: PackagePlus },
      { label: 'Movimentações de Estoque', to: '/admin/movimentacoes-estoque', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Cadastros',
    items: [
      { label: 'Produtos', to: '/admin/produtos', icon: Package },
      { label: 'Categorias', to: '/admin/categorias', icon: Tags },
      { label: 'Setores', to: '/admin/setores', icon: Building2 },
      { label: 'Colaboradores', to: '/admin/colaboradores', icon: Users },
    ],
  },
  {
    label: 'Gestão',
    items: [
      { label: 'Relatórios', to: '/admin/relatorios', icon: BarChart3 },
      { label: 'Configurações', to: '/admin/configuracoes', icon: SettingsIcon },
    ],
  },
];

const flatItems = computed(() => navGroups.flatMap((g) => g.items));

const title = computed(() => {
  const found = flatItems.value.find((i) => route.path.startsWith(i.to));
  return found?.label ?? 'Portal Administrativo';
});

const breadcrumb = computed(() => {
  const item = flatItems.value.find((i) => route.path.startsWith(i.to));
  if (!item) return [{ label: 'Admin' }, { label: 'Dashboard' }];
  const group = navGroups.find((g) => g.items.some((x) => x.to === item.to));
  return [{ label: group?.label ?? 'Admin' }, { label: item.label }];
});

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}

const globalQuery = ref('');

const globalResults = computed(() => {
  const q = globalQuery.value.trim().toLowerCase();
  if (!q) return [];
  return flatItems.value.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 8);
});

function go(to: string) {
  globalQuery.value = '';
  mobileOpen.value = false;
  router.push(to);
}

const pendingCount = computed(() => withdrawals.items.filter((w) => w.paymentStatus === 'PENDING').length);
const notificationCount = computed(() => notifications.unreadCount);
const bellCount = computed(() => (notificationCount.value > 0 ? notificationCount.value : pendingCount.value));
const bellCountLabel = computed(() => (bellCount.value > 99 ? '99+' : String(bellCount.value)));

const avatarInitials = computed(() => {
  const name = (auth.user?.name ?? '').trim();
  if (!name) return 'A';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'A';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
});

const firstName = computed(() => {
  const name = (auth.user?.name ?? '').trim();
  return name ? name.split(/\s+/)[0] : 'Admin';
});

const welcomeMessage = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${firstName.value} 👋`;
  if (hour < 18) return `Boa tarde, ${firstName.value} 👋`;
  return `Boa noite, ${firstName.value} 👋`;
});

async function logout() {
  await auth.logout();
  await router.push('/admin/login');
}

const notifPanel = ref();

function openNotifications(e: Event) {
  notifPanel.value?.toggle?.(e);
}

function notificationTarget(n: any) {
  const targetPath = n?.meta?.targetPath;
  if (typeof targetPath === 'string' && targetPath) return targetPath;
  return '/admin/pendencias';
}

async function goNotification(n: any) {
  try {
    if (!n.readAt) await notifications.markRead(n.id);
  } finally {
    notifPanel.value?.hide?.();
    router.push(notificationTarget(n));
  }
}

onMounted(async () => {
  await settings.loadAdmin();
  withdrawals.fetchAllAdmin().catch(() => null);
  notifications.startPolling(10000);
});

onBeforeUnmount(() => {
  notifications.stopPolling();
});
</script>

<template>
  <div class="admin-saas min-h-full bg-[#F5F7FB] text-[#1F2937]">
    <div v-if="mobileOpen" class="fixed inset-0 z-40 xl:hidden">
      <div class="absolute inset-0 bg-black/30" @click="mobileOpen = false" />
      <aside class="absolute left-0 top-0 flex h-full w-[min(19rem,88vw)] flex-col border-r border-[#E5E7EB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
        <div class="flex items-center gap-3 border-b border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-5 py-4">
          <img :src="logoSrc" class="h-20 w-20 object-contain sm:h-24 sm:w-24" :alt="settings.marketName" />
        </div>

        <nav class="flex-1 space-y-6 overflow-y-auto p-4">
          <div v-for="g in navGroups" :key="g.label" class="space-y-2.5">
            <div class="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{{ g.label }}</div>
            <RouterLink
              v-for="item in g.items"
              :key="item.to"
              :to="item.to"
              class="group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200"
              :class="
                isActive(item.to)
                  ? 'bg-[linear-gradient(135deg,#EAF3FF_0%,#F8FBFF_100%)] text-[#003B8E] shadow-[0_12px_28px_rgba(0,87,217,0.10)] ring-1 ring-[#D7E6FF]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              "
              @click="mobileOpen = false"
            >
              <span
                class="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#0057D9] transition-opacity duration-200"
                :class="isActive(item.to) ? 'opacity-100' : 'opacity-0'"
              />
              <span
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
                :class="isActive(item.to) ? 'bg-white text-[#0057D9] shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#0057D9]'"
              >
                <component :is="item.icon" class="h-4 w-4" />
              </span>
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </div>
        </nav>
      </aside>
    </div>

    <div class="flex">
      <aside class="hidden xl:fixed xl:inset-y-0 xl:flex xl:w-72 2xl:w-80 xl:flex-col">
        <div class="flex h-full flex-col border-r border-[#E5E7EB] bg-white shadow-[20px_0_50px_rgba(15,23,42,0.04)]">
          <div class="flex items-center gap-3 border-b border-[#E5E7EB] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] px-6 py-4">
            <img :src="logoSrc" class="h-20 w-20 object-contain 2xl:h-24 2xl:w-24" :alt="settings.marketName" />
          </div>

          <nav class="flex-1 space-y-7 overflow-auto p-4">
            <div v-for="g in navGroups" :key="g.label" class="space-y-2.5">
              <div class="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{{ g.label }}</div>
              <RouterLink
                v-for="item in g.items"
                :key="item.to"
                :to="item.to"
                class="group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200"
                :class="
                  isActive(item.to)
                    ? 'bg-[linear-gradient(135deg,#EAF3FF_0%,#F8FBFF_100%)] text-[#003B8E] shadow-[0_12px_28px_rgba(0,87,217,0.10)] ring-1 ring-[#D7E6FF]'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                "
              >
                <span
                  class="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full bg-[#0057D9] transition-opacity duration-200"
                  :class="isActive(item.to) ? 'opacity-100' : 'opacity-0'"
                />
                <span
                  class="inline-flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
                  :class="isActive(item.to) ? 'bg-white text-[#0057D9] shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#0057D9]'"
                >
                  <component :is="item.icon" class="h-4 w-4" />
                </span>
                <span class="truncate">{{ item.label }}</span>
              </RouterLink>
            </div>
          </nav>

          <div class="border-t border-[#E5E7EB] p-4">
            <div class="flex items-center gap-3 rounded-[24px] border border-[#E5E7EB] bg-[linear-gradient(135deg,#F8FBFF_0%,#FFFFFF_100%)] p-4 shadow-sm">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-[#003B8E] shadow-sm ring-1 ring-[#EAF3FF]">
                {{ avatarInitials }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</div>
                <div class="truncate text-xs text-slate-600">Código {{ auth.user?.code }} • Admin</div>
              </div>
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50 hover:text-[#003B8E]"
                @click="logout"
              >
                <LogOut class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div class="flex-1 xl:pl-72 2xl:pl-80">
        <header class="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white/90 backdrop-blur">
          <div class="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 py-3 sm:px-5 xl:px-6">
            <div class="flex min-w-0 items-center gap-3">
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50 xl:hidden"
                @click="mobileOpen = true"
              >
                <i class="pi pi-bars" />
              </button>

              <img :src="logoSrc" class="h-10 w-10 object-contain xl:hidden" :alt="settings.marketName" />

              <div class="min-w-0">
                <div class="flex items-center gap-2 text-sm text-slate-600">
                  <span class="truncate font-medium">{{ breadcrumb[0].label }}</span>
                  <ChevronRight class="h-4 w-4 text-slate-400" />
                  <span class="truncate font-semibold text-slate-900">{{ breadcrumb[1].label }}</span>
                </div>
                <div class="mt-1 hidden items-center gap-2 text-sm text-slate-500 md:flex">
                  <Sparkles class="h-4 w-4 text-[#0057D9]" />
                  <span class="truncate font-medium">{{ welcomeMessage }}</span>
                </div>
              </div>
            </div>

            <div class="hidden w-full max-w-lg xl:block">
              <div class="relative">
                <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <InputText
                  v-model="globalQuery"
                  class="w-full pl-10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
                  placeholder="Buscar módulos..."
                />
                <div
                  v-if="globalResults.length"
                  class="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
                >
                  <button
                    v-for="r in globalResults"
                    :key="r.to"
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50"
                    @click="go(r.to)"
                  >
                    <component :is="r.icon" class="h-4 w-4 text-slate-500" />
                    <span class="font-medium">{{ r.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <button
                type="button"
                class="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50 hover:text-[#003B8E]"
                @click="openNotifications"
              >
                <Bell class="h-4 w-4" />
                <span
                  v-if="bellCount > 0"
                    class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[11px] font-semibold text-white shadow-sm"
                >
                  {{ bellCountLabel }}
                </span>
              </button>

              <OverlayPanel ref="notifPanel" :dismissable="true" class="w-[min(24rem,calc(100vw-1rem))]">
                <div class="space-y-3">
                  <div class="flex items-center justify-between gap-3">
                    <div class="min-w-0">
                      <div class="text-sm font-semibold text-slate-900">Notificações</div>
                      <div class="text-xs text-slate-600">
                        {{ notificationCount > 0 ? `${notificationCount} não lida(s)` : 'Sem não lidas' }}
                        <span v-if="pendingCount > 0"> • {{ pendingCount }} pendência(s)</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Button
                        v-if="notificationCount > 0"
                        label="Marcar todas"
                        size="small"
                        severity="secondary"
                        @click="notifications.markAllRead()"
                      />
                      <Button label="Pendências" size="small" severity="secondary" @click="go('/admin/pendencias')" />
                    </div>
                  </div>

                  <div v-if="notifications.loading" class="text-sm text-slate-600">Carregando...</div>
                  <div v-else-if="notifications.error" class="rounded-xl bg-red-50 p-2 text-sm text-red-700">{{ notifications.error }}</div>
                  <div v-else-if="notifications.items.length === 0" class="text-sm text-slate-600">Nenhuma notificação.</div>
                  <div v-else class="max-h-[22rem] space-y-2 overflow-auto pr-1">
                    <button
                      v-for="n in notifications.items"
                      :key="n.id"
                      type="button"
                      class="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-left transition-colors duration-200 hover:bg-slate-50"
                      @click="goNotification(n)"
                    >
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="truncate text-sm font-semibold text-slate-900">{{ n.title }}</div>
                          <div class="mt-1 text-xs text-slate-600">{{ n.message }}</div>
                        </div>
                        <span v-if="!n.readAt" class="mt-1 inline-flex h-2 w-2 shrink-0 rounded-full bg-[#0057D9]" />
                      </div>
                    </button>
                  </div>
                </div>
              </OverlayPanel>

              <div class="hidden items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.04)] xl:flex">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF3FF] text-xs font-semibold text-[#003B8E]">
                  {{ avatarInitials }}
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</div>
                  <div class="truncate text-xs text-slate-600">{{ auth.user?.code }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 pb-3 sm:px-5 xl:hidden">
            <div class="relative w-full">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <InputText v-model="globalQuery" class="w-full pl-10 shadow-[0_8px_24px_rgba(15,23,42,0.04)]" placeholder="Buscar módulos..." />
              <div
                v-if="globalResults.length"
                class="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
              >
                <button
                  v-for="r in globalResults"
                  :key="r.to"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 transition-colors duration-200 hover:bg-slate-50"
                  @click="go(r.to)"
                >
                  <component :is="r.icon" class="h-4 w-4 text-slate-500" />
                  <span class="font-medium">{{ r.label }}</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
              @click="logout"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
        </header>

        <main class="mx-auto max-w-[1520px] px-4 py-4 sm:px-5 xl:px-6 xl:py-5">
          <div class="mb-6">
            <div class="text-2xl font-semibold tracking-tight text-slate-900">{{ title }}</div>
            <div class="mt-1 text-sm text-slate-600">Gestão e acompanhamento com visão centralizada da operação.</div>
          </div>
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
