# EasyMarket

Sistema interno de mercadinho com:
- Tablet (compra/retirada)
- Portal Administrativo (Admin)
- Portal do Colaborador (web no navegador)

Este repositório é um monorepo (npm workspaces).

## Estrutura

- `apps/api`: API (NestJS + Prisma + PostgreSQL)
- `apps/web`: Frontend (Vue 3 + Vite + Pinia + Vue Router + PrimeVue + Tailwind)

## Estoque (interno)

O controle de estoque é simples e focado em uso interno:
- Entradas de Estoque (admin): registra entradas e soma automaticamente no estoque atual
- Movimentações de Estoque (admin): entradas, saídas por retirada e ajustes manuais
- Detalhe do produto (admin): relatórios, histórico e consumo por período

## Requisitos

- Node.js (recomendado LTS)
- PostgreSQL

## Configuração

### 1) Instalar dependências

```bash
npm install
```

### 2) Variáveis de ambiente

- API: copie `apps/api/.env.example` para `apps/api/.env` e ajuste `DATABASE_URL`
- Web: copie `apps/web/.env.example` para `apps/web/.env` (opcional se usar os defaults)

### 3) Banco e seed

```bash
npm run db:setup
```

Por padrão, o seed cria:
- Admin: código `1234`, PIN `1234`
- Colaborador: código `0001`, PIN `1234`

Você pode alterar esses valores via variáveis `SEED_*` no `.env` da API.

## Rodar em desenvolvimento

```bash
npm run dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:3000`

## Acessos rápidos

- Portal do Colaborador (web): `http://localhost:5173/colaborador/login`
- Portal Administrativo: `http://localhost:5173/admin/login`
- Tablet (compra): `http://localhost:5173/tablet`

## Scripts úteis

```bash
npm run build
npm run db:migrate
npm run db:seed
npm run db:check
```
