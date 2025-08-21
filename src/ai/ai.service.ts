import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiService {
  private readonly openaiApiKey: string;
  private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly googleApiKey: string;
  private readonly googlePlacesApiUrl =
    'https://maps.googleapis.com/maps/api/place/nearbysearch/json';

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    const googleKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');

    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    if (!googleKey) {
      throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
    }

    this.openaiApiKey = openaiKey;
    this.googleApiKey = googleKey;
  }

  private readonly placeRecommendationPrompt = `당신은 사용자가 제공한 장소 리뷰 데이터를 분석하는 역할을 합니다.  
각 장소는 place_id,place_reviews,kr_lo,name,geometry 배열로 구성되어 있으며, 리뷰는 한국어로 되어 있습니다.  

다음 두 가지 기준으로 각 장소를 분류하세요:  

1. **구성원 유형 (하나 선택)**  
   - 가족  
   - 개인  
   - 커플  
   - 친구  

2. **혼잡도 (하나 선택)**  
   - 매우혼잡  
   - 혼잡  
   - 보통  
   - 한적  
   - 매우한적  

---

### 분석 규칙
- 리뷰에서 "가족, 단체, 모임" 같은 키워드가 많으면 → **가족**  
- 리뷰에서 "데이트, 둘이, 오붓, 아늑" 같은 키워드가 많으면 → **커플**  
- 리뷰에서 "혼자, 개인, 점심, 빠르게" 같은 키워드가 많으면 → **개인**  
- 리뷰에서 "친구, 술자리, 모여서, 시끌벅적" 같은 키워드가 많으면 → **친구**  

- 리뷰에서 "대기, 줄, 웨이팅, 북적, 시끄럽다" 같은 키워드가 많으면 → **혼잡 ↑**  
- 리뷰에서 "조용, 한적, 여유, 편안하다" 같은 키워드가 많으면 → **혼잡 ↓**  

- places.service에서 추출된 장소를 기반으로 분석하세요

---

### 출력 형식(JSON)
"~~추천 장소 리스트를 반드시 JSON 형식({ ... })으로만, 다른 텍스트 없이 반환하세요.."
[
  {
    "place_id": "장소ID",
    "구성원": "가족 | 개인 | 커플 | 친구",
    "혼잡도": "매우혼잡 | 혼잡 | 보통 | 한적 | 매우한적",
    "kr_lo": "한국주소",
    "latitude": "geometry 배열안의 lat",
    "longitude": "geometry 배열안의 lng",
    "name": "장소이름",
    "type": "카페 | 식당 | 백화점 | 서점",
    "info": "장소의 유형(type)과 이름(name)을 기준으로, 네이버 검색 결과를 참고해  
  해당 장소의 위치 정보와 주된 특징이나 매력을 자연스럽고 이해하기 쉽게  
  약 3줄 내외 분량으로 간결하게 설명하세요.",

  예시)  
"카페, 스타벅스 둔산은하수점은 서구 둔산2동 중심에 위치하며, 편안한 좌석과 다양한 시즌 음료로 인기 있는 카페입니다.  
도심 속 휴식처로 사랑받으며, 무료 와이파이와 넓은 공간이 특징입니다."

    "distance_from_user": "사용자로부터의 거리 (미터)",
    "estimated_time": "도보 예상 시간 (분)"
  }
]`;

  private async searchNearbyPlaces(
    latitude: number,
    longitude: number,
    radius: number,
    type: string = 'restaurant',
  ): Promise<any[]> {
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

  private async searchMultipleTypes(
    latitude: number,
    longitude: number,
    radius: number,
    placeTypes: string[],
  ): Promise<any[]> {
    const typeMapping: { [key: string]: string } = {
      식당: 'restaurant',
      카페: 'cafe',
      서점: 'book_store',
      백화점: 'department_store',
    };

    const types =
      placeTypes.length > 0
        ? placeTypes.map((type) => typeMapping[type] || 'restaurant')
        : ['restaurant', 'cafe'];

    let allPlaces: any[] = [];

    for (const type of types) {
      try {
        const places = await this.searchNearbyPlaces(
          latitude,
          longitude,
          radius,
          type,
        );
        allPlaces = [...allPlaces, ...places];
      } catch (error) {
        console.error(`Error searching for ${type}:`, error.message);
      }
    }

    const uniquePlaces = allPlaces.filter(
      (place, index, self) =>
        index === self.findIndex((p) => p.place_id === place.place_id),
    );

    return uniquePlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  async recommendPlacesFromLocation(
    longitude: number,
    latitude: number,
    radius: number,
    members: string,
    placeTypes: string[],
  ): Promise<any[]> {
    try {
      const places = await this.searchMultipleTypes(
        latitude,
        longitude,
        radius,
        placeTypes,
      );

      if (places.length === 0) {
        return [];
      }

      const prompt = this.placeRecommendationPrompt
        .replace('{members}', members || '개인')
        .replace('{placeTypes}', placeTypes.join(', ') || '음식점')
        .replace('{latitude}', latitude.toString())
        .replace('{longitude}', longitude.toString())
        .replace('{radius}', radius.toString());

      const response = await axios.post(
        this.openaiApiUrl,
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(places) },
          ],
          max_tokens: 2000,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data.choices[0].message.content;
      let recommendations: any[] = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch);
        } else {
          recommendations = [{ error: 'JSON 파싱 실패', raw: content }];
        }
      } catch {
        recommendations = [{ error: 'JSON 파싱 실패', raw: content }];
      }

      return recommendations;
    } catch (error) {
      console.error('AI Recommendation Error:', error.message);
      throw new HttpException(
        'AI 추천 서비스에 문제가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async recommendFromPlaces(
    places: any[],
    members: string,
    placeTypes: string[],
    latitude: number,
    longitude: number,
    radius: number,
  ): Promise<any[]> {
    try {
      if (!places || places.length === 0) {
        return [];
      }

      const prompt = this.placeRecommendationPrompt
        .replace('{members}', members || '개인')
        .replace('{placeTypes}', placeTypes.join(', ') || '음식점')
        .replace('{latitude}', latitude.toString())
        .replace('{longitude}', longitude.toString())
        .replace('{radius}', radius.toString());

      const response = await axios.post(
        this.openaiApiUrl,
        {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(places) },
          ],
          max_tokens: 2000,
          temperature: 0.4,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data.choices[0].message.content;
      let recommendations: any[] = [];
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          recommendations = JSON.parse(jsonMatch);
        } else {
          recommendations = [{ error: 'JSON 파싱 실패', raw: content }];
        }
      } catch {
        recommendations = [{ error: 'JSON 파싱 실패', raw: content }];
      }

      return recommendations;
    } catch (error) {
      console.error('AI Recommendation Error:', error.message);
      throw new HttpException(
        'AI 추천 서비스에 문제가 발생했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
