'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { format } from 'date-fns';

interface MoodData {
  date: string;
  averageMood: number;
  dominantEmotion: string;
  sessionCount: number;
}

interface MoodTrendChartProps {
  data: MoodData[];
  title?: string;
  description?: string;
  height?: number;
}

export function MoodTrendChart({
  data,
  title = 'Mood Trends',
  description = 'Daily mood patterns over time',
  height = 400,
}: MoodTrendChartProps) {
  // Process data for chart
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    mood: item.averageMood?.toFixed(1) || 0,
    sessions: item.sessionCount || 0,
    emotion: item.dominantEmotion || 'neutral',
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='rounded-lg border bg-white p-3 shadow-lg'>
          <p className='font-medium'>{label}</p>
          <p className='text-sm'>
            <span className='text-blue-600'>Mood: </span>
            {data.mood}/10
          </p>
          <p className='text-sm'>
            <span className='text-gray-600'>Sessions: </span>
            {data.sessions}
          </p>
          <p className='text-sm'>
            <span className='text-purple-600'>Emotion: </span>
            {data.emotion}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width='100%' height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis
              dataKey='date'
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              domain={[0, 10]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type='monotone'
              dataKey='mood'
              stroke='#3b82f6'
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
              name='Mood Score'
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Summary statistics */}
        <div className='mt-4 grid grid-cols-2 gap-4 md:grid-cols-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {data.length > 0
                ? (
                    data.reduce(
                      (sum, item) => sum + (item.averageMood || 0),
                      0
                    ) / data.length
                  ).toFixed(1)
                : '0.0'}
            </div>
            <div className='text-sm text-gray-600'>Average Mood</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {Math.max(...data.map(item => item.averageMood || 0)).toFixed(1)}
            </div>
            <div className='text-sm text-gray-600'>Best Day</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-orange-600'>
              {Math.min(...data.map(item => item.averageMood || 0)).toFixed(1)}
            </div>
            <div className='text-sm text-gray-600'>Lowest Day</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-purple-600'>
              {data.reduce((sum, item) => sum + (item.sessionCount || 0), 0)}
            </div>
            <div className='text-sm text-gray-600'>Total Sessions</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
