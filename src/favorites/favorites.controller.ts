import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CreateFavoriteListDto } from './dto/create-favorite-list.dto';
import { UpdateFavoriteListDto } from './dto/update-favorite-list.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserData } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('favorites')
@ApiTags('Favorites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Roles(UserRole.CUSTOMER)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Add salon or package to favorites' })
  @ApiResponse({ status: 201, description: 'Favorite added successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'Salon or package not found' })
  createFavorite(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() createDto: CreateFavoriteDto,
  ) {
    return this.favoritesService.createFavorite(
      currentUser.profileId!,
      createDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  @ApiResponse({ status: 200, description: 'Favorites retrieved successfully' })
  getUserFavorites(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('listId') listId?: string,
  ) {
    return this.favoritesService.getUserFavorites(
      currentUser.profileId!,
      listId ? parseInt(listId, 10) : undefined,
    );
  }

  @Get('check')
  @ApiOperation({ summary: 'Check if salon or package is favorite' })
  @ApiResponse({ status: 200, description: 'Check result' })
  async checkFavorite(
    @CurrentUser() currentUser: CurrentUserData,
    @Query('salonId') salonId?: string,
    @Query('packageId') packageId?: string,
  ) {
    const isFavorite = await this.favoritesService.isFavorite(
      currentUser.profileId!,
      salonId ? parseInt(salonId, 10) : undefined,
      packageId ? parseInt(packageId, 10) : undefined,
    );
    return { isFavorite };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove favorite' })
  @ApiResponse({ status: 200, description: 'Favorite removed successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  removeFavorite(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id', ParseIntPipe) favoriteId: number,
  ) {
    return this.favoritesService.removeFavorite(
      currentUser.profileId!,
      favoriteId,
    );
  }

  @Post('lists')
  @ApiOperation({ summary: 'Create favorite list' })
  @ApiResponse({ status: 201, description: 'List created successfully' })
  createFavoriteList(
    @CurrentUser() currentUser: CurrentUserData,
    @Body() createDto: CreateFavoriteListDto,
  ) {
    return this.favoritesService.createFavoriteList(
      currentUser.profileId!,
      createDto,
    );
  }

  @Get('lists')
  @ApiOperation({ summary: 'Get user favorite lists' })
  @ApiResponse({ status: 200, description: 'Lists retrieved successfully' })
  getUserFavoriteLists(@CurrentUser() currentUser: CurrentUserData) {
    return this.favoritesService.getUserFavoriteLists(currentUser.profileId!);
  }

  @Patch('lists/:id')
  @ApiOperation({ summary: 'Update favorite list' })
  @ApiResponse({ status: 200, description: 'List updated successfully' })
  @ApiResponse({ status: 404, description: 'List not found' })
  updateFavoriteList(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id', ParseIntPipe) listId: number,
    @Body() updateDto: UpdateFavoriteListDto,
  ) {
    return this.favoritesService.updateFavoriteList(
      currentUser.profileId!,
      listId,
      updateDto,
    );
  }

  @Delete('lists/:id')
  @ApiOperation({ summary: 'Delete favorite list' })
  @ApiResponse({ status: 200, description: 'List deleted successfully' })
  @ApiResponse({ status: 404, description: 'List not found' })
  deleteFavoriteList(
    @CurrentUser() currentUser: CurrentUserData,
    @Param('id', ParseIntPipe) listId: number,
  ) {
    return this.favoritesService.deleteFavoriteList(
      currentUser.profileId!,
      listId,
    );
  }
}

