<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  Users2,
  WalletCards,
} from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { normalizeAuthErrorMessage } from '../../lib/auth-errors';

type Props = {
  presetCode?: string;
};

const props = defineProps<Props>();

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

const code = ref(props.presetCode ?? '');
const pin = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const remember = ref(true);
const showPassword = ref(false);
const logoError = ref(false);

const logo = computed(() => settings.logoUrl || new URL('../../assets/logo.png', import.meta.url).toString());
const marketName = computed(() => settings.marketName || 'EasyMarket');

const benefitCards = [
  { title: 'Controle de Estoque', description: 'Entradas, saídas e saldo em tempo real.', icon: Boxes, tint: 'bg-[#EAF3FF] text-[#0057D9]' },
  { title: 'Gestão de Colaboradores', description: 'Controle de usuários, acessos e consumo.', icon: Users2, tint: 'bg-white text-[#003B8E]' },
  { title: 'Fechamento Mensal', description: 'Consolidação automática das pendências.', icon: WalletCards, tint: 'bg-white text-[#003B8E]' },
  { title: 'Relatórios Inteligentes', description: 'Indicadores e histórico para tomada de decisão.', icon: BarChart3, tint: 'bg-[#EAF3FF] text-[#0057D9]' },
] as const;

const previousBodyOverflow = ref<string | null>(null);

onMounted(async () => {
  await settings.loadPublic();
  if (props.presetCode) code.value = props.presetCode;
  previousBodyOverflow.value = document.body.style.overflow || null;
  document.body.style.overflow = 'hidden';
});

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow.value ?? '';
});

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    if (!code.value.trim()) {
      error.value = 'Informe o código';
      return;
    }
    if (!pin.value.trim()) {
      error.value = 'Informe o PIN';
      return;
    }
    await auth.login(code.value.trim(), pin.value.trim(), remember.value);
    await router.push('/admin');
  } catch (e: any) {
    error.value = normalizeAuthErrorMessage(e?.response?.data?.message);
  } finally {
    loading.value = false;
  }
}

function forgotPassword() {
  error.value = 'Solicite a redefinição do PIN ao administrador principal do EasyMarket.';
}

function handleLogoError() {
  logoError.value = true;
}
</script>

<template>
  <div class="login-page relative h-screen overflow-hidden bg-[#F5F7FB]">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[-8rem] top-[-8rem] h-72 w-72 rounded-full bg-[#EAF3FF] blur-3xl" />
      <div class="absolute bottom-[-10rem] right-[-6rem] h-80 w-80 rounded-full bg-[#DCEBFF] blur-3xl" />
      <div class="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(234,243,255,0.45))]" />
    </div>

    <div class="relative mx-auto flex h-full max-w-[1440px] flex-col">
      <header class="fade-up flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8">
        <div class="flex items-center gap-3 sm:gap-4">
          <div class="flex items-center">
            <img
              v-if="!logoError"
              :src="logo"
              class="h-auto w-[185px] max-w-[220px] object-contain sm:w-[210px] lg:w-[220px]"
              :alt="marketName"
              @error="handleLogoError"
            />
            <div v-else class="text-xl font-semibold tracking-[-0.04em] text-[#003B8E] sm:text-2xl">EasyMarket</div>
          </div>
          <div
            class="whitespace-nowrap rounded-full border border-[#D7E6FF] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0057D9] sm:px-4 sm:py-2 sm:text-xs"
          >
            Plataforma SaaS
          </div>
        </div>

        <div
          class="hidden items-center gap-2 rounded-full border border-[#D7E6FF] bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm lg:inline-flex"
        >
          <ShieldCheck class="h-4 w-4 text-[#16A34A]" />
          99,9% uptime
        </div>
      </header>

      <div class="grid flex-1 grid-cols-1 items-stretch lg:grid-cols-12">
        <section class="fade-up hidden h-full flex-col justify-between px-10 pb-8 pt-6 lg:col-span-7 lg:flex">
        <div class="space-y-6">
          <div>
            <h1 class="text-4xl font-semibold leading-tight tracking-[-0.04em] text-[#0F172A]">
              Gestão Inteligente para Mercadinhos Corporativos
            </h1>
            <p class="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Estoque, retiradas, colaboradores, pendências e fechamento mensal em uma única plataforma.
            </p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div
              v-for="(benefit, index) in benefitCards"
              :key="benefit.title"
              class="benefit-card rounded-[22px] border border-white/70 bg-white/80 p-3 shadow-[0_12px_35px_rgba(15,23,42,0.05)] backdrop-blur"
              :style="{ animationDelay: `${index * 60}ms` }"
            >
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 items-center justify-center rounded-2xl" :class="benefit.tint">
                  <component :is="benefit.icon" class="h-5 w-5" />
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
                  <div class="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8FB7FF]">EasyMarket</div>
                  <div class="mt-1 text-sm font-semibold">Retiradas do dia</div>
                </div>
                <div class="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-[#9EC1FF]">100% digital</div>
              </div>
              <div class="mt-4 space-y-3 rounded-[18px] bg-white/5 px-4 py-4">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-medium text-white/90">Produtos cadastrados</div>
                  <div class="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full w-[68%] rounded-full bg-[linear-gradient(90deg,#8AB5FF,#2E73F6)]" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-medium text-white/90">Pendências abertas</div>
                  <div class="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full w-[44%] rounded-full bg-[linear-gradient(90deg,#B9D1FF,#5C92FF)]" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-medium text-white/90">Estoque baixo</div>
                  <div class="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full w-[30%] rounded-full bg-[linear-gradient(90deg,#8AB5FF,#2E73F6)]" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-medium text-white/90">Retiradas do dia</div>
                  <div class="h-2 w-24 overflow-hidden rounded-full bg-white/10">
                    <div class="h-full w-[76%] rounded-full bg-[linear-gradient(90deg,#8AB5FF,#2E73F6)]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <div class="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
            Controle em tempo real
          </div>
          <div class="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
            Fechamento automático
          </div>
          <div class="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
            Operação auditável
          </div>
          <div class="inline-flex items-center rounded-full border border-white/70 bg-white/70 px-3 py-1.5 font-medium text-slate-700 shadow-sm">
            100% digital
          </div>
        </div>
      </section>

      <section class="fade-up flex h-full items-center justify-center px-6 py-6 lg:col-span-5 lg:px-12 lg:py-0">
        <div class="w-full max-w-[480px]">
          <div class="w-full rounded-[34px] border border-white/80 bg-white/90 p-6 shadow-[0_26px_70px_rgba(15,23,42,0.10)] backdrop-blur md:p-7">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-semibold uppercase tracking-[0.18em] text-[#0057D9]">Portal Administrativo</div>
                <h2 class="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-900">Bem-vindo de volta</h2>
                <p class="mt-2 text-sm leading-6 text-slate-500">Acesse sua conta para continuar.</p>
              </div>
              <div class="hidden h-14 w-14 items-center justify-center rounded-2xl bg-[#EAF3FF] text-[#0057D9] md:flex">
                <ShieldCheck class="h-7 w-7" />
              </div>
            </div>

            <form class="mt-6 space-y-4" @submit.prevent="submit">
              <div class="space-y-2">
                <label class="text-sm font-medium text-slate-700">Código ou E-mail</label>
                <div class="group flex items-center rounded-2xl border border-[#D8E1EE] bg-[#FBFDFF] px-4 transition duration-200 focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]">
                  <i class="pi pi-user mr-3 text-slate-400 transition group-focus-within:text-[#0057D9]" />
                  <InputText
                    v-model="code"
                    class="saas-input w-full border-0 bg-transparent px-0 py-4 shadow-none"
                    autocomplete="username"
                    placeholder="Digite seu código ou e-mail"
                  />
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between gap-3">
                  <label class="text-sm font-medium text-slate-700">PIN</label>
                  <button type="button" class="text-xs font-semibold text-[#0057D9] transition hover:text-[#003B8E]" @click="forgotPassword">
                    Esqueci meu PIN
                  </button>
                </div>
                <div class="group flex items-center rounded-2xl border border-[#D8E1EE] bg-[#FBFDFF] px-4 transition duration-200 focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]">
                  <i class="pi pi-lock mr-3 text-slate-400 transition group-focus-within:text-[#0057D9]" />
                  <InputText
                    v-model="pin"
                    :type="showPassword ? 'text' : 'password'"
                    class="saas-input w-full border-0 bg-transparent px-0 py-4 shadow-none"
                    autocomplete="current-password"
                    placeholder="Digite seu PIN"
                  />
                  <button
                    type="button"
                    class="ml-3 rounded-xl p-2 text-slate-400 transition hover:bg-[#EAF3FF] hover:text-[#0057D9]"
                    :aria-label="showPassword ? 'Ocultar PIN' : 'Mostrar PIN'"
                    @click="showPassword = !showPassword"
                  >
                    <Eye v-if="!showPassword" class="h-5 w-5" />
                    <EyeOff v-else class="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <label class="inline-flex cursor-pointer items-center gap-3">
                  <input v-model="remember" type="checkbox" class="h-4 w-4 rounded border-[#CBD5E1] text-[#0057D9] focus:ring-[#0057D9]" />
                  <span>Manter conectado</span>
                </label>
                <div class="inline-flex items-center gap-2 rounded-full bg-[#F5F7FB] px-3 py-1.5 text-xs font-medium text-slate-600">
                  <CheckCircle2 class="h-4 w-4 text-[#16A34A]" />
                  Ambiente seguro
                </div>
              </div>

              <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                {{ error }}
              </div>

              <button
                type="submit"
                class="flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] px-5 text-base font-semibold text-white shadow-[0_16px_30px_rgba(0,87,217,0.26)] transition duration-200 hover:translate-y-[-1px] hover:shadow-[0_18px_32px_rgba(0,87,217,0.30)] disabled:cursor-not-allowed disabled:opacity-80"
                :disabled="loading"
              >
                <span v-if="loading" class="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>{{ loading ? 'Entrando...' : 'Entrar' }}</span>
                <ArrowRight class="h-5 w-5" />
              </button>
            </form>

            <div class="mt-5 flex items-center justify-between text-xs text-slate-500">
              <div>EasyMarket © 2026</div>
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

.chart-bar {
  box-shadow: 0 8px 30px rgba(46, 115, 246, 0.22);
}

:deep(.saas-input.p-inputtext:enabled:focus) {
  box-shadow: none;
}

:deep(.saas-input.p-inputtext) {
  font-size: 0.98rem;
  color: #1f2937;
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
