<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import { ArrowRight, Eye, EyeOff } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import { api } from '../lib/api';
import { normalizeAuthErrorMessage } from '../lib/auth-errors';

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();

const code = ref('');
const pin = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const showPin = ref(false);
const logoError = ref(false);
const activeField = ref<'code' | 'pin'>('code');

const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['backspace', '0', 'submit'],
] as const;

const logo = computed(() => settings.logoUrl || new URL('../assets/logo.png', import.meta.url).toString());
const marketName = computed(() => settings.marketName || 'EasyMarket');

onMounted(async () => {
  await settings.loadPublic();
  await nextTick();
  focusField('code', true);
});

function handleLogoError() {
  logoError.value = true;
}

function isValidPin(value: string) {
  const v = value.trim();
  if (!/^\d+$/.test(v)) return false;
  return v.length === 4 || v.length === 6;
}

function getInput(field: 'code' | 'pin') {
  return document.getElementById(field === 'code' ? 'tablet-login-code' : 'tablet-login-pin') as HTMLInputElement | null;
}

function focusField(field: 'code' | 'pin', select = false) {
  activeField.value = field;
  nextTick(() => {
    const input = getInput(field);
    input?.focus();
    if (select) input?.select();
  });
}

function appendToActiveField(value: string) {
  if (loading.value) return;
  error.value = null;
  if (activeField.value === 'code') {
    code.value = `${code.value}${value}`.replace(/\D/g, '').slice(0, 12);
    focusField('code');
    return;
  }
  pin.value = `${pin.value}${value}`.replace(/\D/g, '').slice(0, 6);
  focusField('pin');
}

function backspaceActiveField() {
  if (loading.value) return;
  error.value = null;
  if (activeField.value === 'code') {
    code.value = code.value.slice(0, -1);
    focusField('code');
    return;
  }
  pin.value = pin.value.slice(0, -1);
  focusField('pin');
}

function keypadAction(key: string) {
  if (key === 'backspace') {
    backspaceActiveField();
    return;
  }
  if (key === 'submit') {
    if (activeField.value === 'code' && code.value.trim() && !pin.value.trim()) {
      focusField('pin');
      return;
    }
    void submit();
    return;
  }
  appendToActiveField(key);
}

function handleCodeEnter() {
  if (code.value.trim()) focusField('pin');
  else void submit();
}

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    if (!code.value.trim()) {
      error.value = 'Informe o código do colaborador';
      return;
    }
    if (!isValidPin(pin.value)) {
      error.value = 'Informe um PIN de 4 ou 6 dígitos';
      return;
    }
    await auth.login(code.value.trim(), pin.value.trim(), false);
    await router.push('/tablet');
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
  <div class="tablet-shell relative flex h-app min-h-app items-center justify-center overflow-hidden bg-[#EAF3FF] px-3 py-3 sm:px-4 sm:py-4">
    <div class="pointer-events-none absolute inset-0">
      <div class="absolute left-[-6rem] top-[-6rem] h-64 w-64 rounded-full bg-white/70 blur-3xl" />
      <div class="absolute bottom-[-8rem] right-[-6rem] h-72 w-72 rounded-full bg-[#CFE1FF] blur-3xl" />
      <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(234,243,255,0.98))]" />
    </div>

    <div class="relative z-10 flex w-full flex-col items-center">
      <div class="w-full max-w-[650px]">
        <div class="tablet-login-hero mb-3 flex flex-col items-center text-center sm:mb-4">
          <img
            v-if="!logoError"
            :src="logo"
            :alt="marketName"
            class="tablet-login-logo h-auto w-[140px] max-w-full object-contain sm:w-[170px] md:w-[200px]"
            @error="handleLogoError"
          />
          <div v-else class="text-2xl font-semibold tracking-[-0.04em] text-[#003B8E] sm:text-3xl">EasyMarket</div>
          <div class="mt-1" />
          <h1 class="tablet-login-title mt-3 text-[1.8rem] font-semibold tracking-[-0.04em] text-[#1F2937] sm:text-[2.1rem] md:text-[2.45rem]">Iniciar Compra</h1>
          <p class="tablet-login-subtitle mt-2 max-w-[480px] text-[15px] leading-6 text-slate-600 sm:text-base sm:leading-7">
            Digite seu código e PIN para acessar o mercadinho.
          </p>
        </div>

        <div class="tablet-login-card rounded-[20px] border border-white/80 bg-white/95 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] sm:p-5 md:p-6">
          <div class="tablet-login-body">
            <form class="tablet-login-form space-y-3.5 sm:space-y-4" @submit.prevent="submit">
              <div class="space-y-1.5 sm:space-y-2">
              <label class="text-base font-medium text-slate-700">Código do colaborador</label>
              <div
                class="group flex h-14 items-center rounded-2xl border bg-[#FBFDFF] px-4 transition duration-200 sm:h-[58px] sm:px-5"
                :class="
                  activeField === 'code'
                    ? 'border-[#0057D9] bg-white shadow-[0_0_0_4px_rgba(0,87,217,0.10)]'
                    : 'border-[#D8E1EE] focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]'
                "
              >
                <i class="pi pi-user mr-3 text-base text-slate-400 transition group-focus-within:text-[#0057D9] sm:mr-4 sm:text-lg" />
                <InputText
                  id="tablet-login-code"
                  v-model="code"
                  class="tablet-input w-full border-0 bg-transparent px-0 py-0 shadow-none"
                  inputmode="numeric"
                  autocomplete="username"
                  placeholder="0001"
                  enterkeyhint="next"
                  @focus="focusField('code')"
                  @click="focusField('code')"
                  @keydown.enter.prevent="handleCodeEnter"
                />
              </div>
              </div>

              <div class="space-y-1.5 sm:space-y-2">
                <label class="text-base font-medium text-slate-700">PIN (4 ou 6 dígitos)</label>
                <div
                  class="group flex h-14 items-center rounded-2xl border bg-[#FBFDFF] px-4 transition duration-200 sm:h-[58px] sm:px-5"
                  :class="
                    activeField === 'pin'
                      ? 'border-[#0057D9] bg-white shadow-[0_0_0_4px_rgba(0,87,217,0.10)]'
                      : 'border-[#D8E1EE] focus-within:border-[#0057D9] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(0,87,217,0.10)]'
                  "
                >
                  <i class="pi pi-lock mr-3 text-base text-slate-400 transition group-focus-within:text-[#0057D9] sm:mr-4 sm:text-lg" />
                  <InputText
                    id="tablet-login-pin"
                    v-model="pin"
                    :type="showPin ? 'text' : 'password'"
                    class="tablet-input w-full border-0 bg-transparent px-0 py-0 shadow-none"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    maxlength="6"
                    autocomplete="one-time-code"
                    placeholder="••••"
                    enterkeyhint="done"
                    @focus="focusField('pin')"
                    @click="focusField('pin')"
                    @keydown.enter.prevent="submit"
                  />
                  <button
                    type="button"
                    class="ml-2 rounded-xl p-2.5 text-slate-400 transition hover:bg-[#EAF3FF] hover:text-[#0057D9] sm:ml-3 sm:p-3"
                    :aria-label="showPin ? 'Ocultar PIN' : 'Mostrar PIN'"
                    @click="showPin = !showPin"
                  >
                    <Eye v-if="!showPin" class="h-5 w-5 sm:h-6 sm:w-6" />
                    <EyeOff v-else class="h-5 w-5 sm:h-6 sm:w-6" />
                  </button>
                </div>
              </div>

              <div v-if="error" class="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-base text-red-700">
                {{ error }}
              </div>

              <button
                type="submit"
                class="flex h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,#0057D9_0%,#003B8E_100%)] px-6 text-lg font-semibold text-white shadow-[0_16px_30px_rgba(0,87,217,0.26)] transition duration-200 hover:translate-y-[-1px] hover:shadow-[0_18px_32px_rgba(0,87,217,0.30)] disabled:cursor-not-allowed disabled:opacity-80 sm:text-xl"
                :disabled="loading"
              >
                <span v-if="loading" class="h-6 w-6 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>{{ loading ? 'Entrando...' : 'Entrar' }}</span>
                <ArrowRight class="h-6 w-6" />
              </button>
            </form>

            <div class="tablet-keypad mt-4 rounded-[18px] border border-[#D7E6FF] bg-[#F8FBFF] p-3 sm:p-4">
              <div class="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Teclado numérico</div>
              <div class="space-y-2.5 sm:space-y-3">
                <div v-for="row in keypadRows" :key="row.join('-')" class="grid grid-cols-3 gap-2.5 sm:gap-3">
                  <button
                    v-for="key in row"
                    :key="key"
                    type="button"
                    class="keypad-key flex h-12 select-none items-center justify-center rounded-2xl border border-[#D7E6FF] bg-white text-lg font-semibold text-[#003B8E] shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-all duration-150 hover:-translate-y-[1px] hover:bg-[#F4F8FF] active:scale-[0.98] sm:h-14 sm:text-xl"
                    :class="
                      key === 'submit'
                        ? 'bg-[#EAF3FF] text-[#0057D9]'
                        : key === 'backspace'
                          ? 'bg-slate-50 text-slate-600'
                          : ''
                    "
                    @click="keypadAction(key)"
                  >
                    {{ key === 'backspace' ? '←' : key === 'submit' ? '✓' : key }}
                  </button>
                </div>
              </div>
            </div>

            <div class="tablet-login-note mt-3 text-center text-xs leading-5 text-slate-500 sm:text-sm">
              Após finalizar sua compra o sistema realizará logout automaticamente.
            </div>
          </div>
        </div>

        <div class="tablet-login-footer mt-3 text-center text-xs text-slate-500 sm:mt-4 sm:text-sm">EasyMarket © 2026</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:deep(.tablet-input.p-inputtext:enabled:focus) {
  box-shadow: none;
}

:deep(.tablet-input.p-inputtext) {
  font-size: 1.05rem;
  color: #1f2937;
}

@media (min-width: 640px) {
  :deep(.tablet-input.p-inputtext) {
    font-size: 1.2rem;
  }
}

@media (max-height: 820px) {
  .tablet-shell {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .tablet-login-hero {
    margin-bottom: 0.7rem;
  }

  .tablet-login-logo {
    width: 9.5rem;
  }

  .tablet-login-title {
    margin-top: 0.5rem;
    font-size: 1.8rem;
  }

  .tablet-login-subtitle {
    margin-top: 0.35rem;
    font-size: 0.95rem;
    line-height: 1.45;
  }

  .tablet-login-card {
    padding: 1rem;
  }

  .tablet-keypad {
    margin-top: 0.85rem;
    padding: 0.85rem;
  }

  .tablet-login-note,
  .tablet-login-footer {
    margin-top: 0.75rem;
  }

  .keypad-key {
    height: 2.75rem;
    font-size: 1rem;
  }
}

@media (max-height: 760px) {
  .tablet-login-logo {
    width: 8.75rem;
  }

  .tablet-login-title {
    font-size: 1.55rem;
  }

  .tablet-login-subtitle {
    font-size: 0.9rem;
  }

  .tablet-login-form {
    gap: 0.65rem;
  }

  .tablet-keypad {
    margin-top: 0.75rem;
    padding: 0.75rem;
  }

  .tablet-login-note,
  .tablet-login-footer {
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .keypad-key {
    height: 2.6rem;
  }
}

@media (max-height: 760px) and (orientation: landscape) and (min-width: 900px) {
  .tablet-login-hero {
    margin-bottom: 0.55rem;
  }

  .tablet-login-logo {
    width: 8rem;
  }

  .tablet-login-title {
    margin-top: 0.35rem;
    font-size: 1.45rem;
  }

  .tablet-login-subtitle {
    margin-top: 0.2rem;
    max-width: 32rem;
    font-size: 0.82rem;
    line-height: 1.3;
  }

  .tablet-login-card {
    padding: 0.85rem;
  }

  .tablet-login-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 13.5rem;
    gap: 0.85rem;
    align-items: start;
  }

  .tablet-login-form {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .tablet-keypad {
    margin-top: 0;
    padding: 0.7rem;
  }

  .tablet-keypad > div:first-child {
    margin-bottom: 0.5rem;
  }

  .keypad-key {
    height: 2.45rem;
    border-radius: 1rem;
    font-size: 0.95rem;
  }

  .tablet-login-note {
    grid-column: 1 / -1;
    margin-top: 0.15rem;
    text-align: left;
  }

  .tablet-login-footer {
    margin-top: 0.55rem;
  }
}
</style>
