import { Product } from '../schema/product.schema';
import { ProductResponse } from '../dto/product-dto';

export class ProductMapper {
  static toResponseDto = (product: Product): ProductResponse => {
    return {
      ...product,
      createdAt: product.createdAt.toISOString(),
    };
  };
}
