import 'dotenv/config';
import { PrismaClient, UserRole, UserStatus, ProductStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/easymarket?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminCode = process.env.SEED_ADMIN_CODE ?? '1234';
  const adminPin = process.env.SEED_ADMIN_PIN ?? '1234';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Admin';

  const adminPinHash = await bcrypt.hash(adminPin, 10);
  const collaboratorCode = process.env.SEED_COLLAB_CODE ?? '0001';
  const collaboratorPin = process.env.SEED_COLLAB_PIN ?? '1234';
  const collaboratorName = process.env.SEED_COLLAB_NAME ?? 'Colaborador';
  const collaboratorPinHash = await bcrypt.hash(collaboratorPin, 10);

  await prisma.user.upsert({
    where: { code: adminCode },
    create: {
      name: adminName,
      code: adminCode,
      pinHash: adminPinHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      sector: 'Administração',
    },
    update: {
      name: adminName,
      pinHash: adminPinHash,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      sector: 'Administração',
    },
  });

  await prisma.user.upsert({
    where: { code: collaboratorCode },
    create: {
      name: collaboratorName,
      code: collaboratorCode,
      pinHash: collaboratorPinHash,
      role: UserRole.COLLABORATOR,
      status: UserStatus.ACTIVE,
      sector: 'Geral',
    },
    update: {
      name: collaboratorName,
      pinHash: collaboratorPinHash,
      role: UserRole.COLLABORATOR,
      status: UserStatus.ACTIVE,
      sector: 'Geral',
    },
  });

  const categoryNames = ['Bebidas', 'Salgados', 'Doces', 'Chocolates'];
  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      create: { name },
      update: { name },
    });
  }

  const products = [
    { name: 'Halls', category: 'Doces', priceCents: 249, stock: 10, minStock: 5 },
    { name: 'Trident', category: 'Doces', priceCents: 348, stock: 10, minStock: 5 },
    { name: 'Barra de Cereal', category: 'Doces', priceCents: 199, stock: 10, minStock: 5 },
    { name: 'Fandangos', category: 'Salgados', priceCents: 345, stock: 10, minStock: 5 },
    { name: 'Cheetos', category: 'Salgados', priceCents: 679, stock: 10, minStock: 5 },
    { name: 'Doritos', category: 'Salgados', priceCents: 415, stock: 10, minStock: 5 },
    { name: 'Ruffles', category: 'Salgados', priceCents: 899, stock: 10, minStock: 5 },
    { name: 'Torcida', category: 'Salgados', priceCents: 189, stock: 10, minStock: 5 },
    { name: 'Biscoito Flay', category: 'Doces', priceCents: 345, stock: 10, minStock: 5 },
    { name: 'Snickers', category: 'Chocolates', priceCents: 445, stock: 10, minStock: 5 },
    { name: 'Bis Extra', category: 'Chocolates', priceCents: 499, stock: 10, minStock: 5 },
    { name: 'Kit Kat', category: 'Chocolates', priceCents: 399, stock: 10, minStock: 5 },
    { name: 'Talento', category: 'Chocolates', priceCents: 938, stock: 10, minStock: 5 },
    { name: 'Chocolate Lacta', category: 'Chocolates', priceCents: 395, stock: 10, minStock: 5 },
    { name: 'Cookies', category: 'Doces', priceCents: 380, stock: 10, minStock: 5 },
    { name: 'Waffer Bauducco', category: 'Doces', priceCents: 359, stock: 10, minStock: 5 },
    { name: 'Bolinho Bauducco 40g', category: 'Doces', priceCents: 319, stock: 10, minStock: 5 },
    { name: 'Bolinho Rollcake 34g', category: 'Doces', priceCents: 319, stock: 10, minStock: 5 },
    { name: 'Chocolate Suflair', category: 'Chocolates', priceCents: 825, stock: 10, minStock: 5 },
    { name: 'Chocolate 5Stars', category: 'Chocolates', priceCents: 497, stock: 10, minStock: 5 },
    { name: 'Coca Cola', category: 'Bebidas', priceCents: 379, stock: 10, minStock: 5 },
    { name: 'Sprite', category: 'Bebidas', priceCents: 369, stock: 10, minStock: 5 },
    { name: 'H2OH Limonetto', category: 'Bebidas', priceCents: 479, stock: 10, minStock: 5 },
    { name: 'Suco Prats', category: 'Bebidas', priceCents: 699, stock: 10, minStock: 5 },
    { name: 'Redbull 250 ml', category: 'Bebidas', priceCents: 949, stock: 10, minStock: 5 },
    { name: 'Monster 473 ml', category: 'Bebidas', priceCents: 949, stock: 10, minStock: 5 },
    { name: 'Heineken', category: 'Bebidas', priceCents: 679, stock: 10, minStock: 5 },
    { name: 'Água tônica', category: 'Bebidas', priceCents: 339, stock: 10, minStock: 5 },
  ];

  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          category: p.category,
          priceCents: p.priceCents,
          stock: p.stock,
          minStock: p.minStock,
          status: ProductStatus.ACTIVE,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          category: p.category,
          priceCents: p.priceCents,
          stock: p.stock,
          minStock: p.minStock,
          status: ProductStatus.ACTIVE,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    await prisma.$disconnect();
    throw e;
  });
