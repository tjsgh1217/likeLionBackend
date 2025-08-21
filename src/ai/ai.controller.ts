import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { PlacesService } from '../places/places.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly placesService: PlacesService,
  ) {}

  @Post('recommend-places')
  async recommendPlaces(
    @Body()
    request: {
      longitude: number;
      latitude: number;
      radius: number;
      members: string;
      place: string[];
    },
  ) {
    try {
      const filteredPlaces = await this.placesService.searchMultipleTypes(
        request.latitude,
        request.longitude,
        request.radius,
        request.place,
      );

      const recommendations = await this.aiService.recommendFromPlaces(
        filteredPlaces,
        request.members,
        request.place,
        request.latitude,
        request.longitude,
        request.radius,
      );

      return {
        success: true,
        data: {
          recommendations: recommendations,
          userLocation: {
            latitude: request.latitude,
            longitude: request.longitude,
          },
          userPreferences: {
            members: request.members,
            placeTypes: request.place,
          },
          searchRadius: request.radius,
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
