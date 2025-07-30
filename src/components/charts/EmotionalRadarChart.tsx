'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface EmotionalRadarChartProps {
  moodData: {
    happy?: number;
    sad?: number;
    anxious?: number;
    stressed?: number;
    calm?: number;
    excited?: number;
    frustrated?: number;
    confident?: number;
  };
  title?: string;
  description?: string;
  height?: number;
}

export function EmotionalRadarChart({
  moodData,
  title = 'Emotional Profile',
  description = 'Multi-dimensional emotional state analysis',
  height = 400,
}: EmotionalRadarChartProps) {
  // Transform mood data for radar chart
  const radarData = [
    { emotion: 'Happy', value: moodData.happy || 0, fullMark: 10 },
    { emotion: 'Confident', value: moodData.confident || 0, fullMark: 10 },
    { emotion: 'Excited', value: moodData.excited || 0, fullMark: 10 },
    { emotion: 'Calm', value: moodData.calm || 0, fullMark: 10 },
    { emotion: 'Frustrated', value: moodData.frustrated || 0, fullMark: 10 },
    { emotion: 'Stressed', value: moodData.stressed || 0, fullMark: 10 },
    { emotion: 'Anxious', value: moodData.anxious || 0, fullMark: 10 },
    { emotion: 'Sad', value: moodData.sad || 0, fullMark: 10 },
  ];

  // Calculate dominant emotions
  const sortedEmotions = Object.entries(moodData)
    .sort(([, a], [, b]) => (b || 0) - (a || 0))
    .slice(0, 3);

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      happy: '#10b981',
      confident: '#3b82f6',
      excited: '#f59e0b',
      calm: '#06b6d4',
      frustrated: '#ef4444',
      stressed: '#dc2626',
      anxious: '#f97316',
      sad: '#6b7280',
    };
    return colors[emotion] || '#8b5cf6';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={height}>
          <RadarChart data={radarData}>
            <PolarGrid />
            <PolarAngleAxis dataKey='emotion' tick={{ fontSize: 12 }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 10]}
              tick={{ fontSize: 10 }}
              tickCount={6}
            />
            <Radar
              name='Emotional Intensity'
              dataKey='value'
              stroke='#3b82f6'
              fill='#3b82f6'
              fillOpacity={0.1}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* Dominant emotions summary */}
        <div className='mt-4'>
          <h4 className='mb-3 font-medium'>Dominant Emotions</h4>
          <div className='space-y-2'>
            {sortedEmotions.map(([emotion, value], index) => (
              <div key={emotion} className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <div
                    className='h-3 w-3 rounded-full'
                    style={{ backgroundColor: getEmotionColor(emotion) }}
                  />
                  <span className='text-sm font-medium capitalize'>
                    {emotion}
                  </span>
                </div>
                <div className='flex items-center gap-2'>
                  <div className='h-2 w-20 rounded-full bg-gray-200'>
                    <div
                      className='h-2 rounded-full transition-all duration-300'
                      style={{
                        width: `${((value || 0) / 10) * 100}%`,
                        backgroundColor: getEmotionColor(emotion),
                      }}
                    />
                  </div>
                  <span className='w-8 text-sm text-gray-600'>
                    {value?.toFixed(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Emotional insights */}
        <div className='mt-4 rounded-lg bg-gray-50 p-3'>
          <h4 className='mb-2 font-medium'>Emotional Insights</h4>
          <div className='text-sm text-gray-600'>
            {sortedEmotions.length > 0 && (
              <p>
                Primary emotion:{' '}
                <span className='font-medium'>{sortedEmotions[0][0]}</span>
                {sortedEmotions[0][1] &&
                  ` (${sortedEmotions[0][1].toFixed(1)}/10)`}
              </p>
            )}
            {sortedEmotions.length > 1 && (
              <p>
                Secondary emotion:{' '}
                <span className='font-medium'>{sortedEmotions[1][0]}</span>
                {sortedEmotions[1][1] &&
                  ` (${sortedEmotions[1][1].toFixed(1)}/10)`}
              </p>
            )}
            {/* Emotional balance assessment */}
            <p className='mt-2'>
              {(() => {
                const positiveEmotions =
                  (moodData.happy || 0) +
                  (moodData.confident || 0) +
                  (moodData.excited || 0) +
                  (moodData.calm || 0);
                const negativeEmotions =
                  (moodData.frustrated || 0) +
                  (moodData.stressed || 0) +
                  (moodData.anxious || 0) +
                  (moodData.sad || 0);
                const ratio = positiveEmotions / Math.max(negativeEmotions, 1);

                if (ratio > 2) return 'Strong positive emotional balance';
                if (ratio > 1.5) return 'Good emotional balance';
                if (ratio > 1) return 'Balanced emotional state';
                if (ratio > 0.7) return 'Slightly challenging emotional state';
                return 'Consider emotional wellness support';
              })()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
