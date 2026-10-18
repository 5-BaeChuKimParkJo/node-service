import { Controller, Get, Version } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { TaxonomyUseCase } from '../../../application/port/in/taxonomy.use-case';

@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyUseCase) {}

  @Version('1')
  @Get('categories')
  @ApiOkResponse({ description: 'Auction categories in stable display order' })
  categories() {
    return this.taxonomyService.listCategories();
  }

  @Version('1')
  @Get('tags')
  @ApiOkResponse({ description: 'Auction tags in stable display order' })
  tags() {
    return this.taxonomyService.listTags();
  }
}
