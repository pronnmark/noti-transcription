'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Brain, TrendingUp, BarChart3, Radar, Calendar, Download } from 'lucide-react';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';
import { MoodTrendChart } from '@/components/charts/MoodTrendChart';
import { EnergyBarChart } from '@/components/charts/EnergyBarChart';
import { EmotionalRadarChart } from '@/components/charts/EmotionalRadarChart';
import { format, subDays } from 'date-fns';

interface PsychologicalMetric {
  id: string;
  date: string;
  averageMood: number;
  averageEnergy: number;
  averageStress: number;
  sessionCount: number;
  dominantEmotion: string;
  insights: string;
}

interface PsychologicalEvaluation {
  id: string;
  fileId: number;
  mood: string; // JSON string
  energy: number;
  stressLevel: number;
  confidence: number;
  engagement: number;
  emotionalState: string; // JSON string
  keyInsights: string;
  createdAt: string;
}

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<PsychologicalMetric[]>([]);
  const [recentEvaluations, setRecentEvaluations] = useState<PsychologicalEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days');
  const [selectedEvaluation, setSelectedEvaluation] = useState<PsychologicalEvaluation | null>(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadData();
  }, [selectedPeriod]);

  async function loadData() {
    setIsLoading(true);
    try {
      // Calculate date range based on selected period
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = (() => {
        switch (selectedPeriod) {
          case '7days': return subDays(new Date(), 7).toISOString().split('T')[0];
          case '30days': return subDays(new Date(), 30).toISOString().split('T')[0];
          case '90days': return subDays(new Date(), 90).toISOString().split('T')[0];
          default: return subDays(new Date(), 7).toISOString().split('T')[0];
        }
      })();

      // Load metrics
      const metricsResponse = await fetch(`/api/psychology/metrics?startDate=${startDate}&endDate=${endDate}`);
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData.metrics || []);
      }

      // Load recent evaluations
      const evaluationsResponse = await fetch('/api/psychology?limit=10');
      if (evaluationsResponse.ok) {
        const evaluationsData = await evaluationsResponse.json();
        setRecentEvaluations(evaluationsData.evaluations || []);
        if (evaluationsData.evaluations && evaluationsData.evaluations.length > 0) {
          setSelectedEvaluation(evaluationsData.evaluations[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setIsLoading(false);
    }
  }

  function getOverallStats() {
    if (metrics.length === 0) return null;

    const totalSessions = metrics.reduce((sum, m) => sum + m.sessionCount, 0);
    const avgMood = metrics.reduce((sum, m) => sum + m.averageMood, 0) / metrics.length;
    const avgEnergy = metrics.reduce((sum, m) => sum + m.averageEnergy, 0) / metrics.length;
    const avgStress = metrics.reduce((sum, m) => sum + m.averageStress, 0) / metrics.length;

    // Calculate mood trend
    const firstHalf = metrics.slice(0, Math.floor(metrics.length / 2));
    const secondHalf = metrics.slice(Math.floor(metrics.length / 2));
    const firstHalfAvg = firstHalf.reduce((sum, m) => sum + m.averageMood, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, m) => sum + m.averageMood, 0) / secondHalf.length;
    const moodTrend = secondHalfAvg - firstHalfAvg;

    return {
      totalSessions,
      avgMood,
      avgEnergy,
      avgStress,
      moodTrend,
      activeDays: metrics.length
    };
  }

  function parseMoodData(moodJson: string) {
    try {
      return JSON.parse(moodJson);
    } catch {
      return {};
    }
  }

  const stats = getOverallStats();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              Psychological Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Insights into your emotional and mental well-being</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">7 Days</SelectItem>
                <SelectItem value="30days">30 Days</SelectItem>
                <SelectItem value="90days">90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="space-y-6">
          {/* Overview Stats */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Mood</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgMood.toFixed(1)}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>Trend:</span>
                    <Badge variant={stats.moodTrend > 0 ? "default" : "secondary"}>
                      {stats.moodTrend > 0 ? '+' : ''}{stats.moodTrend.toFixed(1)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Energy</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgEnergy.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">
                    Out of 10 scale
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Stress Level</CardTitle>
                  <Radar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgStress.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">
                    Lower is better
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Days</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.activeDays}</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.totalSessions} total sessions
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Charts */}
          <Tabs defaultValue="trends" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trends">Mood Trends</TabsTrigger>
              <TabsTrigger value="energy">Energy & Stress</TabsTrigger>
              <TabsTrigger value="emotions">Emotional Profile</TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <MoodTrendChart 
                data={metrics} 
                height={isMobile ? 300 : 400}
              />
            </TabsContent>

            <TabsContent value="energy" className="space-y-6">
              <EnergyBarChart 
                data={metrics} 
                height={isMobile ? 300 : 400}
              />
            </TabsContent>

            <TabsContent value="emotions" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Current Emotional State */}
                {selectedEvaluation && (
                  <EmotionalRadarChart 
                    moodData={parseMoodData(selectedEvaluation.mood)}
                    title="Latest Emotional State"
                    description={`From ${format(new Date(selectedEvaluation.createdAt), 'MMM dd, yyyy')}`}
                    height={isMobile ? 250 : 300}
                  />
                )}

                {/* Recent Sessions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Sessions</CardTitle>
                    <CardDescription>
                      Select a session to view detailed emotional analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {recentEvaluations.map((evaluation) => (
                        <div 
                          key={evaluation.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedEvaluation?.id === evaluation.id 
                              ? 'border-primary bg-primary/5' 
                              : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedEvaluation(evaluation)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium">
                                {format(new Date(evaluation.createdAt), 'MMM dd, HH:mm')}
                              </div>
                              <Badge variant="outline">
                                Mood: {evaluation.energy}/10
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Energy: {evaluation.energy}/10
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {evaluation.keyInsights}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* Insights Summary */}
          {metrics.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>
                  AI-generated insights from your recent psychological evaluations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.slice(0, 3).map((metric) => (
                    <div key={metric.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium">
                          {format(new Date(metric.date), 'MMMM dd, yyyy')}
                        </div>
                        <Badge variant="outline">
                          {metric.dominantEmotion}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {metric.insights}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Data State */}
          {metrics.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No psychological data available</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload and transcribe audio files to start generating psychological insights
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}