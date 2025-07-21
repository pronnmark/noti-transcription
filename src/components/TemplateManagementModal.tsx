'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Edit, Trash2, Star, StarOff, Save, X } from 'lucide-react';

interface SummarizationTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

interface TemplateManagementModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplatesUpdated: () => void;
}

interface NewTemplate {
  name: string;
  description: string;
  prompt: string;
}

export default function TemplateManagementModal({
  isOpen,
  onOpenChange,
  onTemplatesUpdated,
}: TemplateManagementModalProps) {
  const [activeTab, setActiveTab] = useState('list');
  const [editingTemplate, setEditingTemplate] = useState<SummarizationTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: '',
    description: '',
    prompt: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<SummarizationTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/summarization-prompts');
      if (!response.ok) {
        throw new Error('Failed to load templates');
      }
      const data = await response.json();
      setTemplates(data.prompts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('list');
      setEditingTemplate(null);
      setNewTemplate({ name: '', description: '', prompt: '' });
      setError(null);
    }
  }, [isOpen]);

  const handleCreateTemplate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.prompt.trim()) {
      setError('Name and prompt are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/summarization-prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newTemplate.name.trim(),
          description: newTemplate.description.trim(),
          prompt: newTemplate.prompt.trim(),
          isDefault: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      // Reset form and refresh templates
      setNewTemplate({ name: '', description: '', prompt: '' });
      setActiveTab('list');
      await loadTemplates(); // Refresh internal state
      onTemplatesUpdated();
    } catch (error) {
      setError('Failed to create template. Please try again.');
      console.error('Error creating template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !editingTemplate.name.trim() || !editingTemplate.prompt.trim()) {
      setError('Name and prompt are required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/summarization-prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingTemplate.id,
          name: editingTemplate.name.trim(),
          description: editingTemplate.description.trim(),
          prompt: editingTemplate.prompt.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      // Reset form and refresh templates
      setEditingTemplate(null);
      setActiveTab('list');
      await loadTemplates(); // Refresh internal state
      onTemplatesUpdated();
    } catch (error) {
      setError('Failed to update template. Please try again.');
      console.error('Error updating template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/summarization-prompts?id=${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      await loadTemplates(); // Refresh internal state
      onTemplatesUpdated();
    } catch (error) {
      setError('Failed to delete template. Please try again.');
      console.error('Error deleting template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/summarization-prompts', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          isDefault: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to set default template');
      }

      await loadTemplates(); // Refresh internal state
      onTemplatesUpdated();
    } catch (error) {
      setError('Failed to set default template. Please try again.');
      console.error('Error setting default template:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEditing = (template: SummarizationTemplate) => {
    setEditingTemplate({ ...template });
    setActiveTab('edit');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Summarization Templates</DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="list">Templates</TabsTrigger>
            <TabsTrigger value="create">Create New</TabsTrigger>
            <TabsTrigger value="edit" disabled={!editingTemplate}>Edit Template</TabsTrigger>
          </TabsList>

          {/* Templates List */}
          <TabsContent value="list" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">All Templates</h3>
              <Button onClick={() => setActiveTab('create')} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create New
              </Button>
            </div>

            {templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No templates found</p>
                <Button onClick={() => setActiveTab('create')} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Template
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div key={template.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          {template.isDefault && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              <Star className="w-3 h-3 mr-1" />
                              Default
                            </Badge>
                          )}
                          {!template.isActive && (
                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                        )}
                        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                          {template.prompt}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        {!template.isDefault && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSetDefault(template.id)}
                            disabled={isLoading}
                            title="Set as default"
                          >
                            <StarOff className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(template)}
                          disabled={isLoading}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteTemplate(template.id)}
                          disabled={isLoading || template.isDefault}
                          className="text-red-600 hover:text-red-700"
                          title={template.isDefault ? 'Cannot delete default template' : 'Delete template'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Create New Template */}
          <TabsContent value="create" className="space-y-4">
            <h3 className="text-lg font-medium">Create New Template</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="new-name">Template Name *</Label>
                <Input
                  id="new-name"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Meeting Summary, Personal Reflection"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="new-description">Description</Label>
                <Input
                  id="new-description"
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of when to use this template"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="new-prompt">Prompt *</Label>
                <Textarea
                  id="new-prompt"
                  value={newTemplate.prompt}
                  onChange={(e) => setNewTemplate(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="Enter the AI prompt for this summarization style..."
                  rows={8}
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This prompt will be sent to the AI to generate summaries in your desired style.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-4">
                <Button
                  onClick={handleCreateTemplate}
                  disabled={isLoading || !newTemplate.name.trim() || !newTemplate.prompt.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Create Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab('list')}
                  disabled={isLoading}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Edit Template */}
          <TabsContent value="edit" className="space-y-4">
            {editingTemplate && (
              <>
                <h3 className="text-lg font-medium">Edit Template</h3>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Template Name *</Label>
                    <Input
                      id="edit-name"
                      value={editingTemplate.name}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, name: e.target.value } : null)}
                      placeholder="e.g., Meeting Summary, Personal Reflection"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Input
                      id="edit-description"
                      value={editingTemplate.description}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, description: e.target.value } : null)}
                      placeholder="Brief description of when to use this template"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit-prompt">Prompt *</Label>
                    <Textarea
                      id="edit-prompt"
                      value={editingTemplate.prompt}
                      onChange={(e) => setEditingTemplate(prev => prev ? { ...prev, prompt: e.target.value } : null)}
                      placeholder="Enter the AI prompt for this summarization style..."
                      rows={8}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-4">
                    <Button
                      onClick={handleUpdateTemplate}
                      disabled={isLoading || !editingTemplate.name.trim() || !editingTemplate.prompt.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      Save Changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(null);
                        setActiveTab('list');
                      }}
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
