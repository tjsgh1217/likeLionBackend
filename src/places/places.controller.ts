import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { PlacesService } from './places.service';
import type { LocationRequestDto } from './types';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Post('search')
  async searchNearbyPlaces(@Body() request: LocationRequestDto) {
    try {
      const places = await this.placesService.searchMultipleTypes(
        request.latitude,
        request.longitude,
        request.radius,
        request.place,
      );

      return {
        success: true,
        data: {
          places: places,
          totalPlaces: places.length,
          searchRadius: request.radius,
          userLocation: {
            latitude: request.latitude,
            longitude: request.longitude,
          },
          userPreferences: {
            members: request.members,
            placeTypes: request.place,
          },
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
