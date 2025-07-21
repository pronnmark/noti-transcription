'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Settings, Play, AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  analysisPrompt?: string;
  expectedOutputFormat?: string;
  outputSchema?: string;
  visualizationType?: 'chart' | 'gauge' | 'text' | 'mixed';
  defaultPriority?: 'high' | 'medium' | 'low';
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TemplateManagerProps {
  type: 'extraction' | 'datapoint';
  templates: Template[];
  onTemplateChange: () => void;
}

export default function TemplateManager({ type, templates, onTemplateChange }: TemplateManagerProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    analysisPrompt: '',
    expectedOutputFormat: '',
    outputSchema: '',
    visualizationType: 'chart' as 'chart' | 'gauge' | 'text' | 'mixed',
    defaultPriority: 'medium' as 'high' | 'medium' | 'low',
    isActive: true,
    isDefault: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const apiEndpoint = type === 'extraction' ? '/api/extractions/templates' : '/api/data-points/templates';

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      prompt: '',
      analysisPrompt: '',
      expectedOutputFormat: '',
      outputSchema: '',
      visualizationType: 'chart',
      defaultPriority: 'medium',
      isActive: true,
      isDefault: false,
    });
    setError('');
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    const promptField = type === 'extraction' ? 'prompt' : 'analysisPrompt';
    if (!formData[promptField].trim()) {
      setError(`${type === 'extraction' ? 'Prompt' : 'Analysis prompt'} is required`);
      return;
    }

    setLoading(true);
    try {
      const payload = type === 'extraction' ? {
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        expectedOutputFormat: formData.expectedOutputFormat,
        defaultPriority: formData.defaultPriority,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      } : {
        name: formData.name,
        description: formData.description,
        analysisPrompt: formData.analysisPrompt,
        outputSchema: formData.outputSchema,
        visualizationType: formData.visualizationType,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create template');
      }

      resetForm();
      setIsCreateOpen(false);
      onTemplateChange();
    } catch (err) {
      setError('Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      prompt: template.prompt || '',
      analysisPrompt: template.analysisPrompt || '',
      expectedOutputFormat: template.expectedOutputFormat || '',
      outputSchema: template.outputSchema || '',
      visualizationType: template.visualizationType || 'chart',
      defaultPriority: template.defaultPriority || 'medium',
      isActive: template.isActive,
      isDefault: template.isDefault,
    });
    setIsEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedTemplate) return;

    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    const promptField = type === 'extraction' ? 'prompt' : 'analysisPrompt';
    if (!formData[promptField].trim()) {
      setError(`${type === 'extraction' ? 'Prompt' : 'Analysis prompt'} is required`);
      return;
    }

    setLoading(true);
    try {
      const payload = type === 'extraction' ? {
        id: selectedTemplate.id,
        name: formData.name,
        description: formData.description,
        prompt: formData.prompt,
        expectedOutputFormat: formData.expectedOutputFormat,
        defaultPriority: formData.defaultPriority,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      } : {
        id: selectedTemplate.id,
        name: formData.name,
        description: formData.description,
        analysisPrompt: formData.analysisPrompt,
        outputSchema: formData.outputSchema,
        visualizationType: formData.visualizationType,
        isActive: formData.isActive,
        isDefault: formData.isDefault,
      };

      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      resetForm();
      setIsEditOpen(false);
      setSelectedTemplate(null);
      onTemplateChange();
    } catch (err) {
      setError('Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    setLoading(true);
    try {
      const response = await fetch(`${apiEndpoint}?id=${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      onTemplateChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (templateId: string, currentState: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: templateId,
          isActive: !currentState,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      onTemplateChange();
    } catch (err) {
      setError('Failed to update template');
    } finally {
      setLoading(false);
    }
  };

  const TemplateForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">Template Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter template name"
          />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description"
          />
        </div>
      </div>

      <div>
        <Label htmlFor={type === 'extraction' ? 'prompt' : 'analysisPrompt'}>
          {type === 'extraction' ? 'Extraction Prompt' : 'Analysis Prompt'}
        </Label>
        <Textarea
          id={type === 'extraction' ? 'prompt' : 'analysisPrompt'}
          value={type === 'extraction' ? formData.prompt : formData.analysisPrompt}
          onChange={(e) => setFormData({ 
            ...formData, 
            [type === 'extraction' ? 'prompt' : 'analysisPrompt']: e.target.value 
          })}
          placeholder={type === 'extraction' 
            ? 'Enter the prompt for extracting information...' 
            : 'Enter the prompt for analyzing data...'
          }
          rows={6}
        />
      </div>

      {type === 'extraction' ? (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="expectedOutputFormat">Expected Output Format</Label>
            <Textarea
              id="expectedOutputFormat"
              value={formData.expectedOutputFormat}
              onChange={(e) => setFormData({ ...formData, expectedOutputFormat: e.target.value })}
              placeholder="Describe the expected output format..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="defaultPriority">Default Priority</Label>
            <Select value={formData.defaultPriority} onValueChange={(value) => setFormData({ ...formData, defaultPriority: value as 'high' | 'medium' | 'low' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="outputSchema">Output Schema</Label>
            <Textarea
              id="outputSchema"
              value={formData.outputSchema}
              onChange={(e) => setFormData({ ...formData, outputSchema: e.target.value })}
              placeholder="JSON schema or format description..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="visualizationType">Visualization Type</Label>
            <Select value={formData.visualizationType} onValueChange={(value) => setFormData({ ...formData, visualizationType: value as 'chart' | 'gauge' | 'text' | 'mixed' })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chart">Chart</SelectItem>
                <SelectItem value="gauge">Gauge</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
          />
          <Label htmlFor="isActive">Active</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="isDefault"
            checked={formData.isDefault}
            onCheckedChange={(checked) => setFormData({ ...formData, isDefault: checked as boolean })}
          />
          <Label htmlFor="isDefault">Default Template</Label>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={() => {
          resetForm();
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setSelectedTemplate(null);
        }}>
          Cancel
        </Button>
        <Button onClick={isEdit ? handleUpdate : handleCreate} disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Template Management</h3>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New {type === 'extraction' ? 'Extraction' : 'Data Point'} Template</DialogTitle>
            </DialogHeader>
            <TemplateForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {template.isActive && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Active
                      </Badge>
                    )}
                    {template.isDefault && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        Default
                      </Badge>
                    )}
                    {type === 'datapoint' && template.visualizationType && (
                      <Badge variant="outline" className="text-xs">
                        {template.visualizationType}
                      </Badge>
                    )}
                    {type === 'extraction' && template.defaultPriority && (
                      <Badge variant="outline" className="text-xs">
                        {template.defaultPriority} priority
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(template.id, template.isActive)}
                    disabled={loading}
                  >
                    {template.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                    disabled={loading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-gray-600 mb-3">{template.description}</p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <strong>
                  {type === 'extraction' ? 'Expected Output:' : 'Output Schema:'}
                </strong>
                <div className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
                  {type === 'extraction' ? template.expectedOutputFormat : template.outputSchema}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {type === 'extraction' ? 'Extraction' : 'Data Point'} Template</DialogTitle>
          </DialogHeader>
          <TemplateForm isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}