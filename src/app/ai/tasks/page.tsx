'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  CheckCircle,
  Clock,
  ListTodo,
  FileText,
  BarChart3,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';
import { TaskItem } from '@/components/tasks/task-item';

// Client-side debug logging (can be disabled in production)
const DEBUG_CLIENT = process.env.NODE_ENV === 'development';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_CLIENT) {
    console.log(...args);
  }
};

interface TaskWithFile {
  id: string;
  fileId: number;
  noteType: 'task' | 'question' | 'decision' | 'followup' | 'mention';
  content: string;
  context?: string;
  speaker?: string;
  timestamp?: number;
  priority: 'high' | 'medium' | 'low';
  status: 'active' | 'completed' | 'archived';
  metadata?: Record<string, unknown>;
  comments?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  fileName?: string;
}

interface GlobalStats {
  total: number;
  byType: {
    task: number;
    question: number;
    decision: number;
    followup: number;
    mention: number;
  };
  byStatus: {
    active: number;
    completed: number;
    archived: number;
  };
  tasks: {
    total: number;
    active: number;
    completed: number;
  };
}

export default function GlobalTasksPage() {
  const [tasks, setTasks] = useState<TaskWithFile[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const isMobile = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    loadTasks();
    loadStats();
  }, []);

  async function loadTasks() {
    try {
      const response = await fetch('/api/tasks?withFileInfo=true');
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
      }
    } catch (error) {
      debugLog('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStats() {
    try {
      const response = await fetch('/api/tasks/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      debugLog('Failed to load stats:', error);
    }
  }

  async function updateTaskStatus(taskId: string, completed: boolean) {
    try {
      const response = await fetch(`/api/notes/${taskId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: completed ? 'completed' : 'active' }),
      });

      if (!response.ok) throw new Error('Failed to update task status');

      // Update local state
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId
            ? {
              ...task,
              status: completed ? 'completed' : 'active',
              completedAt: completed ? new Date().toISOString() : undefined,
            }
            : task,
        ),
      );

      // Reload stats
      loadStats();

      toast.success(completed ? 'Task completed' : 'Task reopened');
    } catch (error) {
      toast.error('Failed to update task status');
      debugLog('Update task error:', error);
    }
  }

  async function updateTaskComment(taskId: string, comment: string) {
    try {
      const response = await fetch(`/api/notes/${taskId}/comment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) throw new Error('Failed to update comment');

      // Update local state
      setTasks(prev =>
        prev.map(task =>
          task.id === taskId ? { ...task, comments: comment } : task,
        ),
      );

      toast.success('Comment updated');
    } catch (error) {
      toast.error('Failed to update comment');
      debugLog('Update comment error:', error);
    }
  }

  function getFilteredTasks() {
    switch (activeTab) {
      case 'active':
        return tasks.filter(task => task.status === 'active');
      case 'completed':
        return tasks.filter(task => task.status === 'completed');
      case 'archived':
        return tasks.filter(task => task.status === 'archived');
      default:
        return tasks;
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const filteredTasks = getFilteredTasks();

  return (
    <div className="flex h-full flex-col">
      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <ListTodo className="h-6 w-6 text-primary sm:h-8 sm:w-8" />
              Global Tasks
            </h1>
            <p className="mt-1 text-muted-foreground">
              All tasks across all audio files
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4 sm:p-6">
        <div className="space-y-6">
          {/* Stats */}
          {stats && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Tasks
                  </CardTitle>
                  <ListTodo className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.tasks.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Tasks
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.tasks.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completed Tasks
                  </CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.tasks.completed}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Completion Rate
                  </CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stats.tasks.total > 0
                      ? Math.round(
                        (stats.tasks.completed / stats.tasks.total) * 100,
                      )
                      : 0}
                    %
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tasks */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                All Tasks
              </CardTitle>
              <CardDescription>
                Tasks automatically detected from your transcripts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
                  <TabsTrigger value="active">
                    Active ({tasks.filter(t => t.status === 'active').length})
                  </TabsTrigger>
                  <TabsTrigger value="completed">
                    Completed (
                    {tasks.filter(t => t.status === 'completed').length})
                  </TabsTrigger>
                  <TabsTrigger value="archived">
                    Archived (
                    {tasks.filter(t => t.status === 'archived').length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-4 space-y-4">
                  {filteredTasks.length === 0 ? (
                    <div className="py-12 text-center">
                      <ListTodo className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        {activeTab === 'all'
                          ? 'No tasks found'
                          : `No ${activeTab} tasks`}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Tasks will appear here automatically when transcripts
                        are processed
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredTasks.map((task, index) => (
                        <div key={task.id} className="rounded-lg border p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="mr-1 h-3 w-3" />
                                  {task.fileName || 'Unknown File'}
                                </Badge>
                                {task.speaker && (
                                  <Badge
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    <User className="mr-1 h-3 w-3" />
                                    {task.speaker}
                                  </Badge>
                                )}
                                <Badge
                                  variant={
                                    task.priority === 'high'
                                      ? 'destructive'
                                      : task.priority === 'medium'
                                        ? 'default'
                                        : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {task.priority}
                                </Badge>
                              </div>
                              <TaskItem
                                note={task}
                                index={index}
                                onToggleStatus={updateTaskStatus}
                                onUpdateComment={updateTaskComment}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  (window.location.href = `/transcript/${task.fileId}`)
                                }
                              >
                                View Transcript
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
