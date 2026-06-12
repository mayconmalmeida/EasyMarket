<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import InputText from 'primevue/inputtext';
import { ArrowRight, CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { api } from '../lib/api';
import { normalizeAuthErrorMessage } from '../lib/auth-errors';

type Props = {
  presetCode?: string;
  title?: string;
};

const props = defineProps<Props>();

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const settings = useSettingsStore();

const code = ref(props.presetCode ?? '');
const pin = ref('');
const rememberDevice = ref(true);
const showPin = ref(false);
const loading = ref(false);
const error = ref<string | null>(null);
const logoError = ref(false);

const logo = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());
const marketName = computed(() => settings.marketName || 'EasyMarket');

const benefitCards = [
  { title: 'Histórico de Compras', description: 'Visualize tudo que retirou.', emoji: '🛒', tint: 'bg-[#EAF3FF] text-[#0057D9]' },
  { title: 'Controle de Pendências', description: 'Acompanhe valores em aberto.', emoji: '💰', tint: 'bg-white text-[#003B8E]' },
  { title: 'Consumo Mensal', description: 'Veja seu histórico de consumo.', emoji: '📊', tint: 'bg-white text-[#003B8E]' },
  { title: 'Pagamento Facilitado', description: 'Consulte QR Code Pix e pagamentos.', emoji: '📱', tint: 'bg-[#EAF3FF] text-[#0057D9]' },
] as const;

const isNative = (() => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
})();

onMounted(async () => {
  await settings.loadPublic();
  if (props.presetCode) code.value = props.presetCode;
});

function isValidPin(value: string) {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return false;
  return v.length === 4 || v.length === 6;
}

function handleLogoError() {
  logoError.value = true;
}

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    if (!code.value.trim()) {
      error.value = 'Informe o código';
      return;
    }
    if (!isValidPin(pin.value)) {
      error.value = 'Informe um PIN de 4 ou 6 dígitos';
      return;
    }
    await auth.login(code.value.trim(), pin.value.trim(), rememberDevice.value);
    if (isNative) {
      await router.push('/tablet');
    } else if (auth.isAdmin) await router.push('/admin');
    else {
      const raw = route.query.redirect;
      const redirect = typeof raw === 'string' ? raw : '';
      const defaultAfterLogin = '/colaborador/inicio';
      const safe = redirect && redirect.startsWith('/') && !redirect.startsWith('/admin') ? redirect : defaultAfterLogin;
      await router.push(safe);
    }
  } catch (e: any) {
    if (!e?.response) {
      const base = api.defaults.baseURL ?? '';
      let displayBase = base.trim();
      if (displayBase) {
        displayBase = displayBase.replace(/\\/g, '/').replace(/::+/g, ':');
        try {
          displayBase = new URL(displayBase).origin;
        } catch {}
      }
      if (displayBase.startsWith('/')) displayBase = window.location.origin;
      const extra = e?.message ? ` (${String(e.message)})` : '';
      error.value = displayBase
        ? `Sem conexão com o servidor. Verifique se a API está acessível em ${displayBase}.${extra}`
        : 'Sem conexão com o servidor.';
    } else {
      error.value = normalizeAuthErrorMessage(e?.response?.data?.message);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page relative h-app min-h-app overflow-hidden bg-[#F5F7FB]">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#EAF3FF] blur-3xl" />
      <div class="absolute bottom-[-10rem] right-[-6rem] h-80 w-80 rounded-full bg-[#DCEBFF] blur-3xl" />
      <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(234,243,255,0.45))]" />
    </div>

    <div class="relative mx-auto flex h-full min-h-app max-w-[1440px] flex-col">
      <header class="login-page-header fade-up flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-6 lg:px-10 lg:pt-8">
        <div class="flex min-w-0 flex-wrap items-center gap-3 sm:gap-4">
          <div class="flex items-center">
            <img
              v-if="!logoError"
              :src="logo"
              class="login-page-logo h-auto w-[160px] max-w-[200px] object-contain sm:w-[185px] lg:w-[210px]"
              :alt="marketName"
              @error="handleLogoError"
            />
            <div v-else class="text-xl font-semibold tracking-[-0.04em] text-[#003B8E] sm:text-2xl">EasyMarket</div>
          </div>
          <div
            class="login-page-badge whitespace-nowrap rounded-full border border-[#D7E6FF] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0057D9] sm:px-4 sm:py-2 sm:text-xs"
          >
            Portal do Colaborador
          </div>
        </div>

        <div
          class="login-page-header-pill hidden items-center gap-2 rounded-full border border-[#D7E6FF] bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm lg:inline-flex"
        >
          <ShieldCheck class="h-4 w-4 text-[#16A34A]" />
          Ambiente seguro
        </div>
      </header>

      <div class="grid flex-1 grid-cols-1 items-stretch lg:grid-cols-12">
        <section class="login-page-showcase fade-up hidden h-full flex-col justify-between px-8 pb-8 pt-4 lg:flex lg:col-span-7 xl:px-10">
          <div class="login-page-showcase-body space-y-6">
            <div>
              <h1 class="text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#0F172A]">Seu consumo na palma da mão</h1>
              <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Acompanhe compras, pagamentos e pendências do mercadinho corporativo em um único lugar.
              </p>
            </div>

            <div class="login-page-benefits grid grid-cols-2 gap-3">
              <div
                v-for="(benefit, index) in benefitCards"
                :key="benefit.title"
                class="benefit-card rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-[0_12px_35px_rgba(15,23,42,0.05)] backdrop-blur"
                :style="{ animationDelay: `${index * 60}ms` }"
              >
                <div class="flex items-center gap-3">
                  <div class="flex h-10 w-10 items-center justify-center rounded-2xl" :class="benefit.tint">
                    <span class="text-lg leading-none">{{ benefit.emoji }}</span>
                  </div>
                  <div class="min-w-0">
                    <div class="truncate text-sm font-semibold text-slate-900">{{ benefit.title }}</div>
                    <div class="text-xs leading-5 text-slate-500">{{ benefit.description }}</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="dashboard-shell overflow-hidden rounded-[26px] border border-white/70 bg-[#0B172A] p-3 shadow-[0_24px_70px_rgba(0,59,142,0.18)]">
              <div class="rounded-[22px] bg-[linear-gradient(180deg,#0F1F38_0%,#13284B_100%)] p-4 text-white">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8FB7FF]">Meu consumo</div>
                    <div class="mt-1 text-sm font-semibold">Resumo pessoal</div>
                  </div>
                  <div class="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-[#9EC1FF]">Controle pessoal</div>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div class="rounded-[18px] border border-white/10 bg-white/5 p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8FB7FF]">Total consumido</div>
                    <div class="mt-2 text-lg font-semibold">R$ 84,50</div>
                  </div>
                  <div class="rounded-[18px] border border-white/10 bg-white/5 p-4">
                    <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8FB7FF]">Pendências</div>
                    <div class="mt-2 text-lg font-semibold">R$ 12,00</div>
                  </div>
                  <div class="col-span-2 rounded-[18px] border border-white/10 bg-white/5 p-4">
                    <div class="flex items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8FB7FF]">Última compra</div>
                        <div class="mt-2 truncate text-sm font-semibold text-white/90">Refrigerante 350ml</div>
                      </div>
                      <div class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                        <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
                        Em dia
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="login-page-pills flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <div class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
              <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
              Histórico completo
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
              <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
              Consulta rápida
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
              <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
              Pagamentos registrados
            </div>
            <div class="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
              <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
              Transparência total
            </div>
          </div>
        </section>

        <section class="login-page-auth fade-up flex h-full items-start justify-center px-4 py-4 sm:px-6 sm:py-6 lg:col-span-5 lg:items-center lg:px-10 lg:py-8 xl:px-12">
          <div class="w-full max-w-[480px]">
            <div class="login-page-card w-full rounded-[28px] border border-white/80 bg-white/90 p-5 shadow-[0_26px_70px_rgba(15,23,42,0.10)] backdrop-blur sm:p-6 md:p-7">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-semibold uppercase tracking-[0.18em] text-[#0057D9]">Portal do Colaborador</div>
                  <h2 class="mt-2 text-[2rem] font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">Bem-vindo</h2>
                  <p class="mt-2 text-sm leading-6 text-slate-500">Acesse sua área utilizando seu código e PIN.</p>
                </div>
                <div class="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9] md:flex">
                  <ShieldCheck class="h-7 w-7" />
                </div>
              </div>

              <form class="mt-6 space-y-4" @submit.prevent="submit">
                <div class="space-y-2">
                  <label class="text-sm font-medium text-slate-700">Código do colaborador</label>
                  <div
                    class="group flex items-center rounded-2xl border border-[#D8E1EE] bg-[#FBFDFF] px-4 transition duration-200 focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]"
                  >
                    <i class="pi pi-user mr-3 text-slate-400 transition group-focus-within:text-[#0057D9]" />
                    <InputText
                      v-model="code"
                      class="saas-input w-full border-0 bg-transparent px-0 py-4 shadow-none"
                      inputmode="numeric"
                      autocomplete="username"
                      placeholder="Digite seu código"
                    />
                  </div>
                </div>

                <div class="space-y-2">
                  <label class="text-sm font-medium text-slate-700">PIN (4 ou 6 dígitos)</label>
                  <div
                    class="group flex items-center rounded-2xl border border-[#D8E1EE] bg-[#FBFDFF] px-4 transition duration-200 focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]"
                  >
                    <i class="pi pi-lock mr-3 text-slate-400 transition group-focus-within:text-[#0057D9]" />
                    <InputText
                      v-model="pin"
                      :type="showPin ? 'text' : 'password'"
                      class="saas-input w-full border-0 bg-transparent px-0 py-4 shadow-none"
                      inputmode="numeric"
                      pattern="[0-9]*"
                      maxlength="6"
                      autocomplete="one-time-code"
                      enterkeyhint="done"
                      placeholder="Digite seu PIN"
                    />
                    <button
                      type="button"
                      class="ml-3 rounded-xl p-2 text-slate-400 transition hover:bg-[#EAF3FF] hover:text-[#0057D9]"
                      :aria-label="showPin ? 'Ocultar PIN' : 'Mostrar PIN'"
                      @click="showPin = !showPin"
                    >
                      <Eye v-if="!showPin" class="h-5 w-5" />
                      <EyeOff v-else class="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div class="space-y-2 text-sm text-slate-500">
                  <label class="inline-flex cursor-pointer items-start gap-3">
                    <input
                      v-model="rememberDevice"
                      type="checkbox"
                      class="mt-0.5 h-4 w-4 rounded border-[#CBD5E1] text-[#0057D9] focus:ring-[#0057D9]"
                    />
                    <span>
                      Lembrar este dispositivo por 30 dias
                      <div class="mt-1 text-xs leading-5 text-slate-500">Utilize apenas em dispositivos pessoais e seguros.</div>
                    </span>
                  </label>

                  <div class="inline-flex items-center gap-2 rounded-full bg-[#F5F7FB] px-3 py-1.5 text-xs font-medium text-slate-600">
                    <ShieldCheck class="h-4 w-4 text-[#16A34A]" />
                    Ambiente seguro
                  </div>
                </div>

                <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {{ error }}
                </div>

                <button
                  type="submit"
                  class="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] px-5 text-base font-semibold text-white shadow-[0_16px_30px_rgba(0,87,217,0.26)] transition duration-200 hover:translate-y-[-1px] hover:shadow-[0_18px_32px_rgba(0,87,217,0.30)] disabled:cursor-not-allowed disabled:opacity-80 sm:h-[56px]"
                  :disabled="loading"
                >
                  <span v-if="loading" class="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>{{ loading ? 'Entrando...' : 'Entrar' }}</span>
                  <ArrowRight class="h-5 w-5" />
                </button>
              </form>

              <div class="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <div>EasyMarket © 2026</div>
                <div class="hidden sm:block">Portal do Colaborador</div>
                <div>Versão 1.0.0</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-up {
  animation: fade-up 0.8s ease-out both;
}

.benefit-card {
  animation: fade-up 0.7s ease-out both;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease;
}

.benefit-card:hover {
  transform: translateY(-4px);
  border-color: rgba(0, 87, 217, 0.18);
  box-shadow: 0 20px 45px rgba(15, 23, 42, 0.09);
}

.dashboard-shell {
  animation: fade-up 0.9s ease-out both;
}

:deep(.saas-input.p-inputtext:enabled:focus) {
  box-shadow: none;
}

:deep(.saas-input.p-inputtext) {
  font-size: 0.98rem;
  color: #1f2937;
}

@media (max-height: 760px) and (min-width: 1024px) {
  .login-page-header {
    flex-wrap: nowrap;
    padding-top: 0.85rem;
    padding-bottom: 0.1rem;
  }

  .login-page-logo {
    width: 7.25rem;
    max-width: 7.25rem;
  }

  .login-page-badge {
    padding: 0.45rem 0.8rem;
    font-size: 0.65rem;
  }

  .login-page-header-pill {
    display: none;
  }

  .login-page-showcase,
  .login-page-auth {
    padding-top: 0.5rem;
    padding-bottom: 0.85rem;
  }

  .login-page-showcase-body {
    gap: 1rem;
  }

  .login-page-showcase h1 {
    font-size: 2rem;
    line-height: 1.08;
  }

  .login-page-showcase p {
    margin-top: 0.6rem;
    line-height: 1.55;
  }

  .login-page-benefits {
    gap: 0.65rem;
  }

  .benefit-card {
    padding: 0.75rem;
  }

  .benefit-card .h-10.w-10 {
    height: 2.2rem;
    width: 2.2rem;
  }

  .benefit-card .text-lg {
    font-size: 1rem;
  }

  .dashboard-shell {
    max-width: 36rem;
  }

  .dashboard-shell > div {
    padding: 0.9rem;
  }

  .dashboard-shell .mt-4 {
    margin-top: 0.75rem;
  }

  .dashboard-shell .rounded-\[18px\] {
    padding: 0.85rem;
  }

  .login-page-card {
    padding: 1.1rem;
    border-radius: 1.5rem;
  }

  .login-page-card h2 {
    font-size: 1.75rem;
    line-height: 1.05;
  }

  .login-page-card form {
    margin-top: 1rem;
    gap: 0.85rem;
  }

  .login-page-card .py-4 {
    padding-top: 0.8rem;
    padding-bottom: 0.8rem;
  }

  .login-page-card .h-\[52px\],
  .login-page-card .sm\:h-\[56px\] {
    height: 3rem;
  }

  .login-page-card .mt-5 {
    margin-top: 0.85rem;
  }

  .login-page-pills {
    gap: 0.45rem;
  }

  .login-page-pills > div {
    padding: 0.35rem 0.7rem;
  }
}

@media (max-height: 700px) and (min-width: 1024px) {
  .login-page-pills {
    display: none;
  }

  .login-page-showcase-body {
    gap: 0.75rem;
  }

  .login-page-showcase h1 {
    font-size: 1.8rem;
  }

  .dashboard-shell {
    display: none;
  }

  .login-page-card {
    padding: 0.9rem;
  }

  .login-page-card form {
    margin-top: 0.75rem;
    gap: 0.7rem;
  }

  .login-page-card .space-y-2 {
    gap: 0.35rem;
  }

  .login-page-card .py-4 {
    padding-top: 0.65rem;
    padding-bottom: 0.65rem;
  }

  .login-page-card .mt-2 {
    margin-top: 0.35rem;
  }

  .login-page-card .text-sm.leading-6 {
    line-height: 1.45;
  }
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(18px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
