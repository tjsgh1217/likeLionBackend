import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GooglePlace } from './types';

@Injectable()
export class PlacesService {
  private readonly googleApiKey: string;
  private readonly googlePlacesApiUrl =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
    }
    this.googleApiKey = apiKey;
  }

  async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number,
    type: string = 'restaurant',
  ): Promise<GooglePlace[]> {
    try {
      const response = await axios.get(this.googlePlacesApiUrl, {
        params: {
          location: `${latitude},${longitude}`,
          radius: radius,
          type: type,
          key: this.googleApiKey,
          language: 'ko',
        },
      });

      if (response.data.status === 'OK') {
        return response.data.results.map((place: any) => ({
          place_id: place.place_id,
          name: place.name,
          formatted_address: place.vicinity || place.formatted_address,
          geometry: {
            location: {
              lat: place.geometry.location.lat,
              lng: place.geometry.location.lng,
            },
          },
          types: place.types,
          rating: place.rating,
          user_ratings_total: place.user_ratings_total,
          price_level: place.price_level,
          opening_hours: place.opening_hours
            ? {
                open_now: place.opening_hours.open_now,
              }
            : undefined,
          business_status: place.business_status,
          photos: place.photos
            ? place.photos.map((photo: any) => ({
                photo_reference: photo.photo_reference,
                width: photo.width,
                height: photo.height,
              }))
            : [],
        }));
      } else {
        throw new Error(`Google Places API Error: ${response.data.status}`);
      }
    } catch (error) {
      console.error('Google Places API Error:', error.message);
      throw new HttpException(
        '주변 장소 검색에 실패했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPlaceDetails(placeId: string): Promise<any> {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${this.googleApiKey}&language=ko&fields=reviews,formatted_phone_number,website,opening_hours`,
      );

      if (response.data.status === 'OK') {
        return response.data.result;
      } else {
        throw new Error(
          `Google Places Details API Error: ${response.data.status}`,
        );
      }
    } catch (error) {
      console.error('Google Places Details API Error:', error.message);
      return null;
    }
  }

  async getPlaceReviews(placeId: string): Promise<string[]> {
    try {
      const details = await this.getPlaceDetails(placeId);
      if (details && details.reviews) {
        return details.reviews.map((review: any) => review.text).slice(0, 5);
      }
      return [];
    } catch (error) {
      console.error('Place Reviews Error:', error.message);
      return [];
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculateWalkingTime(distance: number): number {
    const walkingSpeed = 1.4;
    return Math.round(distance / walkingSpeed / 60);
  }

  private enrichPlacesWithDistance(
    places: GooglePlace[],
    userLat: number,
    userLon: number,
  ): GooglePlace[] {
    return places.map((place) => {
      const distance = this.calculateDistance(
        userLat,
        userLon,
        place.geometry.location.lat,
        place.geometry.location.lng,
      );
      const walkingTime = this.calculateWalkingTime(distance);

      return {
        ...place,
        distance_from_user: Math.round(distance),
        estimated_time: walkingTime,
      };
    });
  }

  async searchMultipleTypes(
    latitude: number,
    longitude: number,
    radius: number,
    placeTypes: string[] = [],
  ): Promise<GooglePlace[]> {
    const typeMapping: { [key: string]: string } = {
      식당: 'restaurant',
      카페: 'cafe',
      서점: 'book_store',
      백화점: 'department_store',
    };

    const types =
      placeTypes.length > 0
        ? placeTypes.map((type) => typeMapping[type] || 'restaurant')
        : ['restaurant', 'cafe', 'department_store'];

    let allPlacesByType: { [key: string]: GooglePlace[] } = {};

    for (const type of types) {
      try {
        const places = await this.searchNearbyPlaces(
          latitude,
          longitude,
          radius,
          type,
        );

        const filtered = places.filter(
          (place) =>
            place.business_status === 'OPERATIONAL' &&
            (place.user_ratings_total || 0) >= 50,
        );

        allPlacesByType[type] = filtered
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, 3);
      } catch (error) {
        console.error(`Error searching for ${type}:`, error.message);
        allPlacesByType[type] = [];
      }
    }

    const mergedPlaces = Object.values(allPlacesByType).flat();

    const uniquePlaces = mergedPlaces.filter(
      (place, index, self) =>
        index === self.findIndex((p) => p.place_id === place.place_id),
    );

    const enrichedPlaces = this.enrichPlacesWithDistance(
      uniquePlaces,
      latitude,
      longitude,
    );

    return enrichedPlaces;
  }
}
