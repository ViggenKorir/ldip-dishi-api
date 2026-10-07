/* eslint-disable @typescript-eslint/no-unused-vars */
import { PrismaClient } from 'prisma/generated/client';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

/**Explicitly load .env */
dotenv.config();

/**PRISMA CONFIG VARIABLES */
/**Get the db connection string from .env */
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
/**Instantiate adapter here */
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** MAIN SEED FUNCTION */
async function seed() {
  console.log('Starting the seed process...');

  /** Clear existing data to prevent duplicates*/
  await prisma.$transaction([
    prisma.bookmark.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('Database cleared.');

  /**SEED THE NEW DATA */
  /**Creating Users with nested Bookmarks */
  // const user1 = await prisma.user.create({
  //   data: {
  //     email: 'john.doe@example.com',
  //     hash: '$2b$12$R9h/lIPzIZf.3AnYwzL18eG.I0U4Y3.p0L.n9v6E6bE2L9sZ.7.mG', // Mock hash
  //     firstName: 'John',
  //     lastName: 'Doe',
  //     bookmarks: {
  //       create: [
  //         {
  //           title: 'Prisma Docs',
  //           description: 'Everything you need to know about Prisma ORM',
  //           link: 'https://www.prisma.io/docs',
  //         },
  //         {
  //           title: 'GitHub',
  //           description: 'My code repositories',
  //           link: 'https://github.com/johndoe',
  //         },
  //       ],
  //     },
  //   },
  // });

  /**Seed users */
  const user1 = await prisma.user.create({
    data: {
      email: 'alex@example.com',
      hash: '$2b$12$mockhash123456789',
      firstName: 'Alex',
      lastName: 'Anderson',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'sarah@example.com',
      hash: '$2b$12$mockhash987654321',
      firstName: 'Sarah',
      lastName: 'Jenkins',
    },
  });

  /**Seed bookmarks */
  const bookmark1 = await prisma.bookmark.create({
    data: {
      title: 'Next.js Documentation',
      description: 'The React Framework for the Web',
      link: 'https://nextjs.org/docs',
      user: {
        connect: { id: user1.id },
      },
    },
  });

  const bookmark2 = await prisma.bookmark.create({
    data: {
      title: 'Tailwind CSS',
      description:
        'Rapidly build modern websites without ever leaving your HTML',
      link: 'https://tailwindcss.com',
      user: {
        connect: { id: user1.id },
      },
    },
  });

  const bookmark3 = await prisma.bookmark.create({
    data: {
      title: 'Stack Overflow',
      description: 'For when I get stuck',
      link: 'https://stackoverflow.com',
      user: {
        connect: { id: user2.id },
      },
    },
  });

  const bookmark4 = await prisma.bookmark.create({
    data: {
      title: 'Prisma Twitter',
      description: 'Latest updates from the Prisma team',
      link: 'https://twitter.com/prisma',
      user: {
        connect: { id: user2.id },
      },
    },
  });

  console.log('data seeded successfully!');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
