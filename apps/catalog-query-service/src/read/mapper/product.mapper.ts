import { Product } from '../schema/product.schema';
import { ProductResponseDto } from '../dto/product-dto';

export class ProductMapper {
  static toResponseDto = (product: Product): ProductResponseDto => {
    return {
      ...product,
      createdAt: product.createdAt.toISOString(),
    };
  };
}
