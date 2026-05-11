<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useSettingsStore } from '../../stores/settings';

const settings = useSettingsStore();
const defaultLogoUrl = new URL('../../assets/logo.png', import.meta.url).toString();

const form = ref({
  marketName: settings.marketName,
  logoUrl: settings.logoUrl ?? '',
  pixKey: settings.pixKey,
  pixQrCodeUrl: settings.pixQrCodeUrl,
  primaryColor: settings.primaryColor,
  minStockDefault: settings.minStockDefault,
  collaboratorPortalEnabled: settings.collaboratorPortalEnabled,
});

const previewLogo = computed(() => form.value.logoUrl.trim() || defaultLogoUrl);

async function syncFromStore() {
  form.value = {
    marketName: settings.marketName,
    logoUrl: settings.logoUrl ?? '',
    pixKey: settings.pixKey,
    pixQrCodeUrl: settings.pixQrCodeUrl,
    primaryColor: settings.primaryColor,
    minStockDefault: settings.minStockDefault,
    collaboratorPortalEnabled: settings.collaboratorPortalEnabled,
  };
}

async function save() {
  await settings.saveAdmin({
    marketName: form.value.marketName.trim() || 'EasyMarket',
    logoUrl: form.value.logoUrl.trim() || null,
    pixKey: form.value.pixKey.trim(),
    pixQrCodeUrl: form.value.pixQrCodeUrl.trim(),
    primaryColor: form.value.primaryColor.trim() || '#0057D9',
    minStockDefault: Number(form.value.minStockDefault) || 0,
    collaboratorPortalEnabled: !!form.value.collaboratorPortalEnabled,
  });
  await syncFromStore();
}

async function reset() {
  await settings.resetAdmin();
  await syncFromStore();
}

onMounted(async () => {
  await settings.loadAdmin();
  await syncFromStore();
});
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="text-sm font-semibold text-slate-900">Configurações</div>
      <div class="mt-1 text-sm text-slate-600">Identidade visual, Pix, estoque e portal do colaborador.</div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Identidade visual</div>
        <div class="mt-1 text-sm text-slate-600">Nome, logo e cor principal do portal.</div>

        <div class="mt-5 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nome do mercadinho</label>
            <InputText v-model="form.marketName" class="w-full" />
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Logo (URL)</label>
            <InputText v-model="form.logoUrl" class="w-full" placeholder="https://..." />
            <div class="mt-2 flex items-center gap-3">
              <img :src="previewLogo" class="h-14 w-auto rounded-xl border border-[#E5E7EB] bg-white p-1" alt="Logo" />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Cor principal</label>
            <input v-model="form.primaryColor" type="color" class="h-10 w-full rounded-xl border border-[#E5E7EB] bg-white p-1" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Pix</div>
        <div class="mt-1 text-sm text-slate-600">Dados para cobrança e QR Code.</div>

        <div class="mt-5 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Chave Pix</label>
            <Textarea v-model="form.pixKey" class="w-full" rows="2" autoResize />
          </div>

          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">QR Code Pix (URL da imagem)</label>
            <InputText v-model="form.pixQrCodeUrl" class="w-full" placeholder="https://..." />
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Estoque</div>
        <div class="mt-1 text-sm text-slate-600">Parâmetros padrão para alertas.</div>

        <div class="mt-5 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Estoque mínimo (padrão)</label>
            <input v-model.number="form.minStockDefault" type="number" min="0" class="w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Portal do colaborador</div>
        <div class="mt-1 text-sm text-slate-600">Ative ou desative o acesso do colaborador.</div>

        <div class="mt-5 space-y-4">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="form.collaboratorPortalEnabled" type="checkbox" class="h-4 w-4 rounded border-[#E5E7EB]" />
            Ativar portal do colaborador
          </label>
        </div>
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="text-sm font-semibold text-slate-900">Ações</div>
          <div class="mt-1 text-sm text-slate-600">Salvar ou restaurar as configurações.</div>
        </div>
        <div class="flex flex-col gap-2 md:flex-row md:justify-end">
          <Button label="Restaurar padrão" severity="secondary" @click="reset" />
          <Button label="Salvar" @click="save" />
        </div>
      </div>
    </div>
  </div>
</template>
