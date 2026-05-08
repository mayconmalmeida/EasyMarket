<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { formatBRL } from '../lib/money';

const auth = useAuthStore();
const router = useRouter();

const canAccess = computed(() => auth.isAdmin);
if (!canAccess.value) router.replace('/tablet');

type UserRole = 'ADMIN' | 'COLLABORATOR';
type UserStatus = 'ACTIVE' | 'BLOCKED';

type User = {
  id: string;
  name: string;
  code: string;
  sector?: string | null;
  role: UserRole;
  status: UserStatus;
};

type Product = {
  id: string;
  name: string;
  category: string;
  photoUrl?: string | null;
  priceCents: number;
  stock: number;
  minStock: number;
  status: 'ACTIVE' | 'INACTIVE';
};

type Withdrawal = {
  id: string;
  totalCents: number;
  paymentMethod: 'CASH' | 'PIX' | 'NONE';
  paymentStatus: 'PAID' | 'PENDING';
  createdAt: string;
  user: User;
};

const loading = ref(false);
const error = ref<string | null>(null);

const users = ref<User[]>([]);
const products = ref<Product[]>([]);
const withdrawals = ref<Withdrawal[]>([]);

const creatingUser = ref(false);
const creatingProduct = ref(false);

const newUser = ref<{ name: string; code: string; pin: string; sector: string; role: UserRole }>({
  name: '',
  code: '',
  pin: '',
  sector: '',
  role: 'COLLABORATOR',
});

const newProduct = ref<{
  name: string;
  category: string;
  priceCents: number;
  stock: number;
  minStock: number;
}>({
  name: '',
  category: '',
  priceCents: 0,
  stock: 0,
  minStock: 0,
});

const pendingWithdrawals = computed(() => withdrawals.value.filter((w) => w.paymentStatus === 'PENDING'));

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [u, p, w] = await Promise.all([
      api.get<User[]>('/users'),
      api.get<Product[]>('/products'),
      api.get<Withdrawal[]>('/admin/withdrawals'),
    ]);
    users.value = u.data;
    products.value = p.data;
    withdrawals.value = w.data;
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao carregar';
  } finally {
    loading.value = false;
  }
}

async function createUser() {
  creatingUser.value = true;
  error.value = null;
  try {
    await api.post('/users', {
      name: newUser.value.name,
      code: newUser.value.code,
      pin: newUser.value.pin,
      sector: newUser.value.sector || undefined,
      role: newUser.value.role,
    });
    newUser.value = { name: '', code: '', pin: '', sector: '', role: 'COLLABORATOR' };
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao criar usuário';
  } finally {
    creatingUser.value = false;
  }
}

async function createProduct() {
  creatingProduct.value = true;
  error.value = null;
  try {
    await api.post('/products', {
      name: newProduct.value.name,
      category: newProduct.value.category,
      priceCents: Number(newProduct.value.priceCents),
      stock: Number(newProduct.value.stock),
      minStock: Number(newProduct.value.minStock),
    });
    newProduct.value = { name: '', category: '', priceCents: 0, stock: 0, minStock: 0 };
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao criar produto';
  } finally {
    creatingProduct.value = false;
  }
}

async function markPaid(withdrawalId: string) {
  error.value = null;
  try {
    await api.patch(`/admin/withdrawals/${withdrawalId}/mark-paid`);
    await load();
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? 'Falha ao marcar como pago';
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between rounded-xl bg-white p-4 shadow">
      <div>
        <div class="text-sm text-slate-500">Portal Administrativo</div>
        <div class="text-text font-semibold">Dashboard</div>
      </div>
      <div class="flex items-center gap-2">
        <Button label="Tablet" severity="secondary" @click="$router.push('/tablet')" />
        <Button label="Atualizar" severity="secondary" :loading="loading" @click="load" />
      </div>
    </div>

    <div v-if="error" class="rounded-md bg-red-50 p-3 text-sm text-red-700">
      {{ error }}
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="rounded-xl bg-white p-6 shadow">
        <div class="text-sm text-slate-500">Pendências</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ pendingWithdrawals.length }}</div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <div class="text-sm text-slate-500">Produtos</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ products.length }}</div>
      </div>
      <div class="rounded-xl bg-white p-6 shadow">
        <div class="text-sm text-slate-500">Colaboradores</div>
        <div class="mt-1 text-2xl font-bold text-primary-dark">{{ users.length }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div class="rounded-xl bg-white p-6 shadow">
        <div class="text-text text-lg font-semibold">Criar colaborador</div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nome</label>
            <InputText v-model="newUser.name" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Código</label>
            <InputText v-model="newUser.code" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">PIN</label>
            <Password v-model="newUser.pin" class="w-full" :feedback="false" toggleMask />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Setor</label>
            <InputText v-model="newUser.sector" class="w-full" />
          </div>
          <div class="space-y-1 md:col-span-2">
            <label class="text-sm font-medium text-slate-700">Perfil</label>
            <select
              v-model="newUser.role"
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="COLLABORATOR">Colaborador</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
        </div>
        <div class="mt-4">
          <Button label="Criar" :loading="creatingUser" @click="createUser" />
        </div>
      </div>

      <div class="rounded-xl bg-white p-6 shadow">
        <div class="text-text text-lg font-semibold">Criar produto</div>
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Nome</label>
            <InputText v-model="newProduct.name" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Categoria</label>
            <InputText v-model="newProduct.category" class="w-full" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Preço (centavos)</label>
            <input
              v-model.number="newProduct.priceCents"
              type="number"
              min="0"
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Estoque</label>
            <input
              v-model.number="newProduct.stock"
              type="number"
              min="0"
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium text-slate-700">Estoque mínimo</label>
            <input
              v-model.number="newProduct.minStock"
              type="number"
              min="0"
              class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div class="mt-4">
          <Button label="Criar" :loading="creatingProduct" @click="createProduct" />
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-white p-6 shadow">
      <div class="text-text text-lg font-semibold">Pendências (retiradas)</div>
      <div v-if="pendingWithdrawals.length === 0" class="mt-3 text-sm text-slate-600">Sem pendências.</div>
      <div v-else class="mt-4 space-y-3">
        <div v-for="w in pendingWithdrawals" :key="w.id" class="rounded-lg border border-slate-100 p-4">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="min-w-0">
              <div class="truncate text-sm font-semibold text-text">{{ w.id }}</div>
              <div class="text-xs text-slate-500">
                {{ w.user.name }} ({{ w.user.code }}) • {{ new Date(w.createdAt).toLocaleString('pt-BR') }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <div class="text-sm font-semibold text-primary-dark">{{ formatBRL(w.totalCents) }}</div>
              <Button label="Marcar como pago" @click="markPaid(w.id)" />
            </div>
          </div>
          <div class="mt-2 text-sm text-slate-600">Pagamento: {{ w.paymentMethod }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
