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

  const products = [
    { name: 'Água 500ml', category: 'Bebidas', priceCents: 300, stock: 30, minStock: 5 },
    { name: 'Refrigerante Lata', category: 'Bebidas', priceCents: 550, stock: 24, minStock: 6 },
    { name: 'Suco Caixa', category: 'Bebidas', priceCents: 650, stock: 12, minStock: 4 },
    { name: 'Salgadinho', category: 'Snacks', priceCents: 450, stock: 20, minStock: 5 },
    { name: 'Chocolate', category: 'Doces', priceCents: 600, stock: 15, minStock: 5 },
    { name: 'Biscoito', category: 'Snacks', priceCents: 400, stock: 18, minStock: 6 },
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
