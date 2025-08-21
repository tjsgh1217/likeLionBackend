import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AiCourseService {
  private readonly openaiApiKey: string;
  private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';

  constructor(private configService: ConfigService) {
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.openaiApiKey = openaiKey;
  }

  private readonly courseRecommendationPrompt = `당신은 사용자에게 여행 코스 이름과 한 줄 소개를 제안하는 역할을 합니다.  
사용자가 제공한 장소 이름 배열을 참고하여, 기억에 남는 독창적인 코스 이름과 한 줄 소개를 만들어 주세요.

장소 리스트:  
{places_list}

출력 형식은 JSON 객체이며, 반드시 아래 형식으로만 출력하세요:

{  
  "course_name": "코스 이름",  
  "course_summary": "코스 한 줄 소개"  
}

기타 부가 설명이나 텍스트는 넣지 마세요.`;

  async recommendCourse(placesName: string[]): Promise<string> {
    try {
      const placesListString = placesName.join(', ');

      const prompt = this.courseRecommendationPrompt.replace(
        '{places_list}',
        placesListString,
      );

      const response = await axios.post(
        this.openaiApiUrl,
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: prompt }],
          max_tokens: 300,
          temperature: 0.6,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            Authorization: `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      throw new HttpException(
        'AI 코스 추천 서비스에 실패했습니다.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
