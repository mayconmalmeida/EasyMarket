<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import OverlayPanel from 'primevue/overlaypanel';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { useMyWithdrawalsStore } from '../stores/my-withdrawals';
import { useNotificationsStore } from '../stores/notifications';
import {
  LayoutDashboard,
  List,
  AlertCircle,
  Wallet,
  User,
  Bell,
  ChevronRight,
  LogOut,
  Search,
} from 'lucide-vue-next';
import { formatBRL } from '../lib/money';

type NavItem = { label: string; to: string; icon: any };

const auth = useAuthStore();
const settings = useSettingsStore();
const my = useMyWithdrawalsStore();
const notifications = useNotificationsStore();
const route = useRoute();
const router = useRouter();

const mobileOpen = ref(false);
const query = ref('');

const logoSrc = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());

const items: NavItem[] = [
  { label: 'Dashboard', to: '/colaborador/inicio', icon: LayoutDashboard },
  { label: 'Meu Consumo', to: '/colaborador/consumo', icon: List },
  { label: 'Pendências', to: '/colaborador/pendencias', icon: AlertCircle },
  { label: 'Pagamentos', to: '/colaborador/pagamentos', icon: Wallet },
  { label: 'Meu Perfil', to: '/colaborador/perfil', icon: User },
];

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`);
}

const title = computed(() => {
  const found = items.find((i) => route.path.startsWith(i.to));
  return found?.label ?? 'Portal do Colaborador';
});

const breadcrumb = computed(() => [{ label: 'Colaborador' }, { label: title.value }]);

const nowLabel = computed(() => new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }));

const avatarInitials = computed(() => {
  const name = (auth.user?.name ?? '').trim();
  if (!name) return 'C';
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'C';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
});

const pendingTotal = computed(() => my.pending.reduce((sum, w) => sum + w.totalCents, 0));
const pendingCount = computed(() => my.pending.length);
const notificationCount = computed(() => notifications.unreadCount);
const bellCount = computed(() => (notificationCount.value > 0 ? notificationCount.value : pendingCount.value));
const bellCountLabel = computed(() => (bellCount.value > 99 ? '99+' : String(bellCount.value)));

const filteredModules = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];
  return items.filter((i) => i.label.toLowerCase().includes(q)).slice(0, 6);
});

function go(to: string) {
  query.value = '';
  mobileOpen.value = false;
  router.push(to);
}

async function logout() {
  await auth.logout();
  await router.push('/colaborador/login');
}

const notifPanel = ref();

function openNotifications(e: Event) {
  notifPanel.value?.toggle?.(e);
}

function notificationTarget(n: any) {
  const targetPath = n?.meta?.targetPath;
  if (typeof targetPath === 'string' && targetPath) return targetPath;
  return '/colaborador/pagamentos';
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
  await settings.loadPublic();
  my.fetchAll().catch(() => null);
  notifications.startPolling(10000);
});

onBeforeUnmount(() => {
  notifications.stopPolling();
});
</script>

<template>
  <div class="admin-saas min-h-full bg-[#F5F7FB] text-[#1F2937]">
    <div v-if="mobileOpen" class="fixed inset-0 z-40 lg:hidden">
      <div class="absolute inset-0 bg-black/30" @click="mobileOpen = false" />
      <aside class="absolute left-0 top-0 h-full w-80 border-r border-[#E5E7EB] bg-white shadow-xl">
        <div class="flex items-center gap-3 border-b border-[#E5E7EB] px-6 py-5">
          <img :src="logoSrc" class="h-8 w-auto" :alt="settings.marketName" />
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-slate-900">{{ settings.marketName }}</div>
            <div class="text-xs text-slate-600">Portal do Colaborador</div>
          </div>
        </div>

        <nav class="p-4">
          <div class="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</div>
          <div class="mt-2 space-y-1">
            <RouterLink
              v-for="i in items"
              :key="i.to"
              :to="i.to"
              class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
              :class="isActive(i.to) ? 'bg-[#EAF3FF] text-[#003B8E]' : 'text-slate-700 hover:bg-slate-50'"
              @click="mobileOpen = false"
            >
              <component :is="i.icon" class="h-4 w-4" />
              <span class="truncate">{{ i.label }}</span>
            </RouterLink>
          </div>
        </nav>

        <div class="mt-auto border-t border-[#E5E7EB] p-4">
          <div class="rounded-2xl bg-[#F5F7FB] p-4">
            <div class="text-xs font-medium text-slate-600">Saldo pendente</div>
            <div class="mt-1 text-lg font-semibold text-[#F59E0B]">{{ formatBRL(pendingTotal) }}</div>
            <Button class="mt-3 w-full" label="Pagar agora" :disabled="pendingTotal <= 0" @click="go('/colaborador/pendencias?pay=1')" />
          </div>
          <div class="mt-3 flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF3FF] text-xs font-semibold text-[#003B8E]">
              {{ avatarInitials }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</div>
              <div class="truncate text-xs text-slate-600">{{ auth.user?.sector || '-' }}</div>
            </div>
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50"
              @click="logout"
            >
              <LogOut class="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </div>

    <div class="flex">
      <aside class="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-80 lg:flex-col">
        <div class="flex h-full flex-col border-r border-[#E5E7EB] bg-white">
          <div class="flex items-center gap-3 border-b border-[#E5E7EB] px-6 py-5">
            <img :src="logoSrc" class="h-8 w-auto" :alt="settings.marketName" />
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-slate-900">{{ settings.marketName }}</div>
              <div class="text-xs text-slate-600">Portal do Colaborador</div>
            </div>
          </div>

          <nav class="flex-1 overflow-auto p-4">
            <div class="px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Menu</div>
            <div class="mt-2 space-y-1">
              <RouterLink
                v-for="i in items"
                :key="i.to"
                :to="i.to"
                class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
                :class="isActive(i.to) ? 'bg-[#EAF3FF] text-[#003B8E]' : 'text-slate-700 hover:bg-slate-50'"
              >
                <component :is="i.icon" class="h-4 w-4" />
                <span class="truncate">{{ i.label }}</span>
              </RouterLink>
            </div>
          </nav>

          <div class="border-t border-[#E5E7EB] p-4">
            <div class="rounded-2xl bg-[#F5F7FB] p-4">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-xs font-medium text-slate-600">Saldo pendente</div>
                  <div class="mt-1 text-lg font-semibold text-[#F59E0B]">{{ formatBRL(pendingTotal) }}</div>
                </div>
                <div class="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  <span class="h-2 w-2 rounded-full bg-[#F59E0B]" />
                  {{ pendingCount }}
                </div>
              </div>
              <Button class="mt-3 w-full" label="Pagar Agora" :disabled="pendingTotal <= 0" @click="go('/colaborador/pendencias?pay=1')" />
            </div>

            <div class="mt-3 flex items-center gap-3 rounded-2xl border border-[#E5E7EB] bg-white p-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF3FF] text-xs font-semibold text-[#003B8E]">
                {{ avatarInitials }}
              </div>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</div>
                <div class="truncate text-xs text-slate-600">{{ auth.user?.sector || '-' }}</div>
              </div>
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50"
                @click="logout"
              >
                <LogOut class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div class="flex-1 lg:pl-80">
        <header class="sticky top-0 z-30 border-b border-[#E5E7EB] bg-white/90 backdrop-blur">
          <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div class="flex min-w-0 items-center gap-3">
              <button
                type="button"
                class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
                @click="mobileOpen = true"
              >
                <i class="pi pi-bars" />
              </button>

              <div class="flex min-w-0 items-center gap-2 text-sm text-slate-600">
                <span class="truncate font-medium">{{ breadcrumb[0].label }}</span>
                <ChevronRight class="h-4 w-4 text-slate-400" />
                <span class="truncate font-semibold text-slate-900">{{ breadcrumb[1].label }}</span>
              </div>
            </div>

            <div class="hidden w-full max-w-xl lg:block">
              <div class="relative">
                <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <InputText v-model="query" class="w-full pl-10" placeholder="Buscar módulos..." />
                <div
                  v-if="filteredModules.length"
                  class="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
                >
                  <button
                    v-for="m in filteredModules"
                    :key="m.to"
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                    @click="go(m.to)"
                  >
                    <component :is="m.icon" class="h-4 w-4 text-slate-500" />
                    <span class="font-medium">{{ m.label }}</span>
                  </button>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="hidden items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-white px-3 py-2 lg:flex">
                <div class="flex h-8 w-8 items-center justify-center rounded-full bg-[#EAF3FF] text-xs font-semibold text-[#003B8E]">
                  {{ avatarInitials }}
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-900">{{ auth.user?.name }}</div>
                  <div class="truncate text-xs text-slate-600">{{ auth.user?.sector || '-' }}</div>
                </div>
              </div>

              <button
                type="button"
                class="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-slate-700 hover:bg-slate-50"
                @click="openNotifications"
              >
                <Bell class="h-4 w-4" />
                <span
                  v-if="bellCount > 0"
                  class="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#DC2626] px-1 text-[11px] font-semibold text-white"
                >
                  {{ bellCountLabel }}
                </span>
              </button>

              <OverlayPanel ref="notifPanel" :dismissable="true" class="w-[24rem]">
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
                      <Button label="Pendências" size="small" severity="secondary" @click="go('/colaborador/pendencias')" />
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
                      class="w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-left hover:bg-slate-50"
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

              <div class="hidden rounded-2xl bg-[#EAF3FF] px-3 py-2 text-xs font-semibold text-[#003B8E] lg:block">
                {{ nowLabel }}
              </div>
            </div>
          </div>

          <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 pb-4 lg:hidden">
            <div class="relative w-full">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <InputText v-model="query" class="w-full pl-10" placeholder="Buscar módulos..." />
              <div
                v-if="filteredModules.length"
                class="absolute left-0 right-0 top-[calc(100%+0.5rem)] overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
              >
                <button
                  v-for="m in filteredModules"
                  :key="m.to"
                  type="button"
                  class="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
                  @click="go(m.to)"
                >
                  <component :is="m.icon" class="h-4 w-4 text-slate-500" />
                  <span class="font-medium">{{ m.label }}</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main class="mx-auto max-w-7xl px-6 py-6">
          <div class="mb-6">
            <div class="text-2xl font-semibold tracking-tight text-slate-900">{{ title }}</div>
            <div class="mt-1 text-sm text-slate-600">Acompanhe consumo, pendências e pagamentos do EasyMarket.</div>
          </div>
          <RouterView />
        </main>
      </div>
    </div>
  </div>
</template>
