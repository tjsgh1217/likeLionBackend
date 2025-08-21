import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { PlacesService } from '../places/places.service';
import { AiCourseService } from './aiCourse';

@Controller('ai')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly placesService: PlacesService,
    private readonly aiCourseService: AiCourseService,
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
  @Post('recommend-course')
  async recommendCourse(@Body() body: { places_name: string[] }) {
    try {
      if (!body.places_name || body.places_name.length === 0) {
        return {
          success: false,
          error: 'places_name 배열이 필요합니다.',
        };
      }

      const courseResult = await this.aiCourseService.recommendCourse(
        body.places_name,
      );

      return {
        success: true,
        data: JSON.parse(courseResult),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
