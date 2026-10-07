import { Prisma } from 'prisma/generated/client';

/**Default select object for model */
const modelSelect = {
  id: true,
  firstName: true,
  secondName: true,
  email: true,
  phoneNumber: true,
  county: true,
  constituency: true,
  ward: true,
  // createdAt: true,
  // updatedAt: true,
};

/**Select object for bookmark */
const bookmarkSelect: Prisma.BookmarkSelect = {
  id: true,
  title: true,
  description: true,
  link: true,
  userId: true,

  /**ADDITIONAL MODELS */
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },

  // createdAt: true,
  // updatedAt: true,
};

export { modelSelect, bookmarkSelect };
