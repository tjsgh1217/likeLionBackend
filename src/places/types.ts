export interface LocationRequestDto {
  longitude: number;
  latitude: number;
  radius: number;
  members: string;
  place: string[];
}

export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  types: string[];
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: {
    open_now: boolean;
  };
  distance_from_user?: number;
  estimated_time?: number;
  business_status?: string;
}

export interface PlaceRecommendation {
  place_id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  types: string[];
  rating?: number;
  total_ratings?: number;
  price_level?: number;
  is_open?: boolean;
  recommendation_reason: string;
  suitability_score: number;
}
