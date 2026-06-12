import { createRouter, createWebHistory } from 'vue-router';
import LoginPage from '../views/LoginPage.vue';
import TabletPage from '../views/TabletPage.vue';
import TabletLoginPage from '../views/TabletLoginPage.vue';
import { useAuthStore } from '../stores/auth';
import { useSettingsStore } from '../stores/settings';
import AdminLayout from '../layouts/AdminLayout.vue';
import CollaboratorWebLayout from '../layouts/CollaboratorWebLayout.vue';
import AdminLoginPage from '../views/admin/AdminLoginPage.vue';
import AdminDashboardView from '../views/admin/AdminDashboardView.vue';
import AdminProductsView from '../views/admin/AdminProductsView.vue';
import AdminProductDetailView from '../views/admin/AdminProductDetailView.vue';
import AdminCategoriesView from '../views/admin/AdminCategoriesView.vue';
import AdminCollaboratorsView from '../views/admin/AdminCollaboratorsView.vue';
import AdminSectorsView from '../views/admin/AdminSectorsView.vue';
import AdminWithdrawalsView from '../views/admin/AdminWithdrawalsView.vue';
import AdminPendenciesView from '../views/admin/AdminPendenciesView.vue';
import AdminMonthlyClosingView from '../views/admin/AdminMonthlyClosingView.vue';
import AdminReportsView from '../views/admin/AdminReportsView.vue';
import AdminSettingsView from '../views/admin/AdminSettingsView.vue';
import AdminStockEntriesView from '../views/admin/AdminStockEntriesView.vue';
import AdminStockMovementsView from '../views/admin/AdminStockMovementsView.vue';
import CollaboratorHomeView from '../views/collaborator/CollaboratorHomeView.vue';
import CollaboratorConsumptionView from '../views/collaborator/CollaboratorConsumptionView.vue';
import CollaboratorPendenciesView from '../views/collaborator/CollaboratorPendenciesView.vue';
import CollaboratorPaymentsView from '../views/collaborator/CollaboratorPaymentsView.vue';
import CollaboratorProfileView from '../views/collaborator/CollaboratorProfileView.vue';
import { Capacitor } from '@capacitor/core';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/colaborador/login' },
    { path: '/admin/login', component: AdminLoginPage, props: { presetCode: '1234' } },
    { path: '/colaborador/login', component: LoginPage, props: { presetCode: '0001', title: 'Entrar (Colaborador)' } },
    { path: '/tablet/login', component: TabletLoginPage },
    { path: '/login', redirect: '/colaborador/login' },
    { path: '/tablet', component: TabletPage, meta: { requiresAuth: true } },
    { path: '/me', redirect: '/colaborador/inicio' },
    {
      path: '/colaborador',
      component: CollaboratorWebLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/colaborador/inicio' },
        { path: 'inicio', component: CollaboratorHomeView },
        { path: 'consumo', component: CollaboratorConsumptionView },
        { path: 'pendencias', component: CollaboratorPendenciesView },
        { path: 'pagamentos', component: CollaboratorPaymentsView },
        { path: 'perfil', component: CollaboratorProfileView },
      ],
    },
    {
      path: '/admin',
      component: AdminLayout,
      meta: { requiresAuth: true, role: 'ADMIN' },
      children: [
        { path: '', redirect: '/admin/dashboard' },
        { path: 'dashboard', component: AdminDashboardView },
        { path: 'colaboradores', component: AdminCollaboratorsView },
        { path: 'setores', component: AdminSectorsView },
        { path: 'entradas-estoque', component: AdminStockEntriesView },
        { path: 'movimentacoes-estoque', component: AdminStockMovementsView },
        { path: 'produtos', component: AdminProductsView },
        { path: 'produtos/:id', component: AdminProductDetailView },
        { path: 'categorias', component: AdminCategoriesView },
        { path: 'retiradas', component: AdminWithdrawalsView },
        { path: 'pendencias', component: AdminPendenciesView },
        { path: 'fechamento-mensal', component: AdminMonthlyClosingView },
        { path: 'relatorios', component: AdminReportsView },
        { path: 'configuracoes', component: AdminSettingsView },
      ],
    },
  ],
});

router.beforeEach(async (to) => {
  const isNative = (() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  })();
  const auth = useAuthStore();
  const settings = useSettingsStore();
  if ((to.path === '/me' || to.path.startsWith('/colaborador') || to.path === '/tablet' || to.path === '/tablet/login') && !settings.loaded && !settings.loading) {
    try {
      await settings.loadPublic();
    } catch {
    }
  }
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    if (to.meta.role === 'ADMIN') return '/admin/login';
    if (to.path === '/tablet') return '/tablet/login';
    const redirect = encodeURIComponent(to.fullPath);
    return `/colaborador/login?redirect=${redirect}`;
  }
  if (isNative && (to.path.startsWith('/admin') || to.path === '/admin/login')) return '/tablet';
  if (to.meta.role === 'ADMIN' && !auth.isAdmin) return isNative ? '/tablet' : '/colaborador/inicio';
  if (to.path.startsWith('/colaborador') && auth.isAdmin) return isNative ? '/tablet' : '/admin';
  if ((to.path === '/login' || to.path === '/admin/login' || to.path === '/colaborador/login' || to.path === '/tablet/login') && auth.isAuthenticated)
    return to.path === '/tablet/login' || isNative ? '/tablet' : auth.isAdmin ? '/admin' : '/colaborador/inicio';
  if (
    !settings.collaboratorPortalEnabled &&
    (to.path === '/me' || (to.path.startsWith('/colaborador') && to.path !== '/colaborador/login'))
  )
    return '/tablet';
  return true;
});
