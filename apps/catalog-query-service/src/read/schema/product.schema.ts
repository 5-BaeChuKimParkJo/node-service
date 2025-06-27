import { z } from 'zod';
import { httpMemberSchema } from './http-member.schema';
import { mongoCatalogTypeProductSchema } from '../../common/schema/mongo-catalog.schema';

export const productSchema = mongoCatalogTypeProductSchema.merge(
  z.object({
    seller: httpMemberSchema,
  }),
);

export type Product = z.infer<typeof productSchema>;
