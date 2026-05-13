import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import { createPinia } from 'pinia';
import { router } from './router';
import '@fontsource/inter/latin.css';
import './style.css';
import 'primeicons/primeicons.css';
import App from './App.vue';

const app = createApp(App);

app.use(createPinia());
app.use(router);
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.p-dark',
    },
  },
});

app.component('Button', Button);
app.component('InputText', InputText);
app.component('Password', Password);

app.mount('#app');
