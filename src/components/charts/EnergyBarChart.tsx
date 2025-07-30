'use client';

import {
  BarChart,
  Bar,
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

interface EnergyData {
  date: string;
  averageEnergy: number;
  averageStress: number;
  sessionCount: number;
}

interface EnergyBarChartProps {
  data: EnergyData[];
  title?: string;
  description?: string;
  height?: number;
}

export function EnergyBarChart({
  data,
  title = 'Energy & Stress Levels',
  description = 'Daily energy and stress patterns',
  height = 400,
}: EnergyBarChartProps) {
  // Process data for chart
  const chartData = data.map(item => ({
    date: format(new Date(item.date), 'MMM dd'),
    energy: item.averageEnergy?.toFixed(1) || 0,
    stress: item.averageStress?.toFixed(1) || 0,
    sessions: item.sessionCount || 0,
  }));

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className='rounded-lg border bg-white p-3 shadow-lg'>
          <p className='font-medium'>{label}</p>
          <p className='text-sm'>
            <span className='text-green-600'>Energy: </span>
            {data.energy}/10
          </p>
          <p className='text-sm'>
            <span className='text-red-600'>Stress: </span>
            {data.stress}/10
          </p>
          <p className='text-sm'>
            <span className='text-gray-600'>Sessions: </span>
            {data.sessions}
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
          <BarChart data={chartData}>
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
            <Bar
              dataKey='energy'
              fill='#10b981'
              name='Energy Level'
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey='stress'
              fill='#ef4444'
              name='Stress Level'
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary statistics */}
        <div className='mt-4 grid grid-cols-2 gap-4 md:grid-cols-4'>
          <div className='text-center'>
            <div className='text-2xl font-bold text-green-600'>
              {data.length > 0
                ? (
                    data.reduce(
                      (sum, item) => sum + (item.averageEnergy || 0),
                      0
                    ) / data.length
                  ).toFixed(1)
                : '0.0'}
            </div>
            <div className='text-sm text-gray-600'>Avg Energy</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-red-600'>
              {data.length > 0
                ? (
                    data.reduce(
                      (sum, item) => sum + (item.averageStress || 0),
                      0
                    ) / data.length
                  ).toFixed(1)
                : '0.0'}
            </div>
            <div className='text-sm text-gray-600'>Avg Stress</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-blue-600'>
              {Math.max(...data.map(item => item.averageEnergy || 0)).toFixed(
                1
              )}
            </div>
            <div className='text-sm text-gray-600'>Peak Energy</div>
          </div>
          <div className='text-center'>
            <div className='text-2xl font-bold text-orange-600'>
              {Math.min(...data.map(item => item.averageStress || 0)).toFixed(
                1
              )}
            </div>
            <div className='text-sm text-gray-600'>Min Stress</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
