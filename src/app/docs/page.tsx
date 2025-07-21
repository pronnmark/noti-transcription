'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { BookOpen, Mic, Brain, FileText, ListTodo, HelpCircle, Gavel, CalendarDays, Settings, Zap, Code } from 'lucide-react';

export default function DocsPage() {
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className="h-full flex flex-col">
      {/* Header - Hidden on mobile */}
      {!isMobile && (
        <div className="border-b p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Documentation</h1>
              <p className="text-muted-foreground mt-1">Learn how Noti's AI-powered transcription and note extraction works</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-hidden">
        <Tabs defaultValue="overview" className="h-full">
          <TabsList className={cn(
            'grid w-full',
            isMobile ? 'grid-cols-2 mb-4' : 'grid-cols-5 mb-6',
          )}>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="notes">Notes AI</TabsTrigger>
            <TabsTrigger value="prompts">Prompts</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="api">API</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-full">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    How Noti Works
                  </CardTitle>
                  <CardDescription>
                    Understanding the complete audio-to-insights pipeline
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Mic className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">1. Audio Input</h4>
                        <p className="text-sm text-muted-foreground">
                          Upload audio files or record directly in your browser. Supports MP3, WAV, M4A, and more formats.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">2. AI Transcription</h4>
                        <p className="text-sm text-muted-foreground">
                          WhisperX with Large-v3 model transcribes audio with speaker diarization, automatically identifying who said what.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Brain className="h-4 w-4 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">3. Smart Note Extraction</h4>
                        <p className="text-sm text-muted-foreground">
                          Advanced AI analyzes transcripts to extract actionable tasks, unanswered questions, decisions, and follow-ups.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <ListTodo className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <h4 className="font-medium">4. Task Management</h4>
                        <p className="text-sm text-muted-foreground">
                          Organize extracted items into actionable lists with checkboxes, comments, and direct links to audio timestamps.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Badge variant="secondary">Speaker Diarization</Badge>
                      <p className="text-sm text-muted-foreground">
                        Automatically identifies different speakers in your audio
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Badge variant="secondary">Multi-language Support</Badge>
                      <p className="text-sm text-muted-foreground">
                        Works with Swedish, English, and other languages
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Badge variant="secondary">Real-time Processing</Badge>
                      <p className="text-sm text-muted-foreground">
                        GPU-accelerated transcription for faster results
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Badge variant="secondary">Timestamp Linking</Badge>
                      <p className="text-sm text-muted-foreground">
                        Every note links back to the exact moment in audio
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Note Recognition
                  </CardTitle>
                  <CardDescription>
                    How our AI identifies and extracts actionable items from conversations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6">
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ListTodo className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium">Tasks</h3>
                        <Badge variant="outline">Actionable Items</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        The AI looks for concrete, actionable commitments with clear responsibility.
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Examples:</strong>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"I'll send the report by Friday"</li>
                            <li>"We need to call the client tomorrow"</li>
                            <li>"Can you schedule the meeting?"</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <HelpCircle className="h-5 w-5 text-orange-600" />
                        <h3 className="font-medium">Questions</h3>
                        <Badge variant="outline">Unanswered</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Identifies genuine questions that need follow-up, not rhetorical or answered questions.
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Examples:</strong>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"What's the budget for this project?" (no clear answer)</li>
                            <li>"When is the deadline?" (answered vaguely)</li>
                            <li>"Who will handle client communication?"</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Gavel className="h-5 w-5 text-green-600" />
                        <h3 className="font-medium">Decisions</h3>
                        <Badge variant="outline">Agreed Upon</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Captures concrete decisions and agreements made during conversations.
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Examples:</strong>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"We've decided to go with vendor A"</li>
                            <li>"Let's proceed with the new pricing model"</li>
                            <li>"We agreed to postpone the launch"</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <CalendarDays className="h-5 w-5 text-purple-600" />
                        <h3 className="font-medium">Follow-ups</h3>
                        <Badge variant="outline">Future Actions</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Items that explicitly need future attention or discussion.
                      </p>
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Examples:</strong>
                          <ul className="list-disc list-inside text-muted-foreground mt-1 space-y-1">
                            <li>"Let's revisit this in next week's meeting"</li>
                            <li>"I need to get back to you on that"</li>
                            <li>"This needs more research before we decide"</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>AI Model Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Default Model</h4>
                        <Badge variant="outline">Claude Sonnet 4</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          High-accuracy language model for precise note extraction
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Processing</h4>
                        <Badge variant="outline">Sequential Analysis</Badge>
                        <p className="text-sm text-muted-foreground mt-1">
                          Each note type is analyzed separately for best results
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Customization</h4>
                      <p className="text-sm text-muted-foreground">
                        You can customize the AI prompts for each note type in the{' '}
                        <Button variant="link" className="p-0 h-auto" onClick={() => window.location.href = '/settings'}>
                          Settings
                        </Button>{' '}
                        page to better match your specific use cases.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="prompts" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>AI Extraction Prompts</CardTitle>
                  <CardDescription>
                    The exact prompts used to extract different types of notes from your transcripts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4 bg-blue-50">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <ListTodo className="h-4 w-4" />
                        Tasks Extraction Prompt
                      </h3>
                      <div className="bg-white rounded p-3 text-sm font-mono text-muted-foreground">
                        <pre className="whitespace-pre-wrap">{`Extract ONLY concrete, actionable tasks and commitments from this transcript.

STRICT CRITERIA - Only include if it meets ALL of these:
- Specific action to be taken by someone
- Clear responsibility (who will do it)
- Not vague statements or general discussion
- Represents actual work or commitment

INCLUDE examples:
- "I'll send the report by Friday"
- "We need to call the client tomorrow"
- "Can you schedule the meeting?"

Format as JSON array with: content, speaker, context, priority, metadata`}</pre>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-orange-50">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Questions Extraction Prompt
                      </h3>
                      <div className="bg-white rounded p-3 text-sm font-mono text-muted-foreground">
                        <pre className="whitespace-pre-wrap">{`Extract ONLY genuine unanswered questions that require follow-up.

STRICT CRITERIA - Only include if it meets ALL of these:
- Direct question with clear intent
- No complete answer was provided
- Important enough to need follow-up
- Not rhetorical or casual questions

EXCLUDE examples:
- Questions that were answered clearly
- Rhetorical questions ("How about that?")
- Questions answered later in the conversation`}</pre>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-green-50">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <Gavel className="h-4 w-4" />
                        Decisions Extraction Prompt
                      </h3>
                      <div className="bg-white rounded p-3 text-sm font-mono text-muted-foreground">
                        <pre className="whitespace-pre-wrap">{`Extract ONLY concrete decisions that were actually made and agreed upon.

STRICT CRITERIA - Only include if it meets ALL of these:
- Clear decision or choice was made
- Specific outcome or direction chosen
- Not just suggestions or considerations
- Represents actual agreement or commitment

INCLUDE examples:
- "We've decided to go with vendor A"
- "Let's proceed with the new pricing model"
- "We agreed to postpone the launch until next month"`}</pre>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-purple-50">
                      <h3 className="font-medium mb-3 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Follow-ups Extraction Prompt
                      </h3>
                      <div className="bg-white rounded p-3 text-sm font-mono text-muted-foreground">
                        <pre className="whitespace-pre-wrap">{`Extract ONLY items that explicitly need future action or discussion.

STRICT CRITERIA - Only include if it meets ALL of these:
- Specific item requiring future attention
- Clear indication it needs follow-up
- Not just general discussion topics
- Represents actual work or communication needed

INCLUDE examples:
- "Let's revisit this in next week's meeting"
- "I need to get back to you on that"
- "This needs more research before we decide"`}</pre>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customizing Prompts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      You can customize these prompts to better match your specific needs:
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          1
                        </div>
                        <div>
                          <p className="text-sm">Go to Settings → AI Configuration</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          2
                        </div>
                        <div>
                          <p className="text-sm">Edit the prompts for each note type</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-sm font-medium">
                          3
                        </div>
                        <div>
                          <p className="text-sm">Test with your transcripts to optimize results</p>
                        </div>
                      </div>
                    </div>
                    <Button onClick={() => window.location.href = '/settings'} className="w-full sm:w-auto">
                      <Settings className="h-4 w-4 mr-2" />
                      Open Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Task Management</CardTitle>
                  <CardDescription>
                    How to work with extracted tasks, questions, and decisions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-3">✅ Mark as Complete</h3>
                        <p className="text-sm text-muted-foreground">
                          Click the checkbox next to any task or question to mark it as complete.
                          Completed items will be visually distinguished but remain accessible.
                        </p>
                      </div>

                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-3">💬 Add Comments</h3>
                        <p className="text-sm text-muted-foreground">
                          Add notes, observations, or updates to any extracted item.
                          Comments help track progress and provide context for future reference.
                        </p>
                      </div>

                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-3">🔗 Transcript Links</h3>
                        <p className="text-sm text-muted-foreground">
                          Each note is automatically linked to the exact moment in the audio where it was mentioned.
                          Click the timestamp to jump directly to that point in the transcript.
                        </p>
                      </div>

                      <div className="border rounded-lg p-4">
                        <h3 className="font-medium mb-3">📊 Progress Tracking</h3>
                        <p className="text-sm text-muted-foreground">
                          Monitor completion rates for different types of items.
                          Visual progress indicators help you stay on top of action items.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mobile Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 text-sm">📱</span>
                        </div>
                        <div>
                          <h4 className="font-medium">Touch-Optimized</h4>
                          <p className="text-sm text-muted-foreground">
                            Large touch targets and gesture support for easy mobile interaction
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 text-sm">👆</span>
                        </div>
                        <div>
                          <h4 className="font-medium">Swipe Actions</h4>
                          <p className="text-sm text-muted-foreground">
                            Swipe to quickly mark tasks as complete or access additional options
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <span className="text-purple-600 text-sm">🎯</span>
                        </div>
                        <div>
                          <h4 className="font-medium">Quick Access</h4>
                          <p className="text-sm text-muted-foreground">
                            Bottom navigation and contextual actions for efficient mobile workflows
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="mt-0 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    API Reference
                  </CardTitle>
                  <CardDescription>
                    Technical details for developers integrating with Noti
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-3">Note Extraction</h3>
                      <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                        <div className="text-blue-600">POST</div>
                        <div className="text-gray-600">/api/notes/extract</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Triggers AI extraction of notes from a transcript
                      </p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-3">Get Notes</h3>
                      <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                        <div className="text-green-600">GET</div>
                        <div className="text-gray-600">/api/notes?fileId={`{fileId}`}</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Retrieves all notes for a specific file
                      </p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-3">Update Note Status</h3>
                      <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                        <div className="text-orange-600">PATCH</div>
                        <div className="text-gray-600">/api/notes/{`{noteId}`}</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Updates note status (active, completed, archived)
                      </p>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-3">Note Comments</h3>
                      <div className="bg-gray-50 rounded p-3 text-sm font-mono">
                        <div className="text-purple-600">POST</div>
                        <div className="text-gray-600">/api/notes/{`{noteId}`}/comment</div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        Adds a comment to a specific note
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Data Schema</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-50 rounded p-4">
                      <h4 className="font-medium mb-2">Note Object</h4>
                      <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{`{
  "id": "string",
  "fileId": "number",
  "noteType": "task | question | decision | followup",
  "content": "string",
  "context": "string",
  "speaker": "string",
  "timestamp": "number",
  "priority": "high | medium | low",
  "status": "active | completed | archived",
  "metadata": "object",
  "createdAt": "string",
  "updatedAt": "string"
}`}</pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}
