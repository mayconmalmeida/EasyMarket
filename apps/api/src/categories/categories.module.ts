import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller';
import { CategoriesPublicController } from './categories.public.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CategoriesController, CategoriesPublicController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
