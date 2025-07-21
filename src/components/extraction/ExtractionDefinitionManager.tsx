'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Save, X, Brain, FileText, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

interface ExtractionDefinition {
  id: string;
  name: string;
  description: string;
  jsonKey: string;
  jsonSchema: string;
  aiInstructions: string;
  outputType: 'array' | 'object' | 'value';
  category: 'extraction' | 'datapoint';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ExtractionDefinitionManagerProps {
  className?: string;
}

export default function ExtractionDefinitionManager({ className }: ExtractionDefinitionManagerProps) {
  const [definitions, setDefinitions] = useState<ExtractionDefinition[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<ExtractionDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    jsonKey: '',
    jsonSchema: '',
    aiInstructions: '',
    outputType: 'array' as 'array' | 'object' | 'value',
    category: 'extraction' as 'extraction' | 'datapoint',
  });

  useEffect(() => {
    loadDefinitions();
  }, []);

  const loadDefinitions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/extraction-definitions');
      const data = await response.json();
      setDefinitions(data.definitions || []);
    } catch (error) {
      toast.error('Failed to load extraction definitions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/extraction-definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Extraction definition created successfully');
        setIsCreateOpen(false);
        resetForm();
        loadDefinitions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create extraction definition');
      }
    } catch (error) {
      toast.error('Failed to create extraction definition');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedDefinition) return;

    try {
      setLoading(true);
      const response = await fetch('/api/extraction-definitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedDefinition.id, ...formData }),
      });

      if (response.ok) {
        toast.success('Extraction definition updated successfully');
        setIsEditOpen(false);
        setSelectedDefinition(null);
        resetForm();
        loadDefinitions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update extraction definition');
      }
    } catch (error) {
      toast.error('Failed to update extraction definition');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this extraction definition?')) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/extraction-definitions?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Extraction definition deleted successfully');
        loadDefinitions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete extraction definition');
      }
    } catch (error) {
      toast.error('Failed to delete extraction definition');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/extraction-definitions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });

      if (response.ok) {
        toast.success(`Extraction definition ${isActive ? 'activated' : 'deactivated'}`);
        loadDefinitions();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update extraction definition');
      }
    } catch (error) {
      toast.error('Failed to update extraction definition');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      jsonKey: '',
      jsonSchema: '',
      aiInstructions: '',
      outputType: 'array',
      category: 'extraction',
    });
  };

  const openEditDialog = (definition: ExtractionDefinition) => {
    setSelectedDefinition(definition);
    setFormData({
      name: definition.name,
      description: definition.description,
      jsonKey: definition.jsonKey,
      jsonSchema: definition.jsonSchema,
      aiInstructions: definition.aiInstructions,
      outputType: definition.outputType,
      category: definition.category,
    });
    setIsEditOpen(true);
  };

  const generateJsonKey = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
  };

  const getExampleSchema = (outputType: string, category: string) => {
    if (category === 'extraction') {
      return outputType === 'array' ?
        `{"type": "array", "items": {"type": "object", "properties": {"content": {"type": "string"}, "priority": {"type": "string"}}, "required": ["content"]}}` :
        `{"type": "object", "properties": {"content": {"type": "string"}, "metadata": {"type": "object"}}, "required": ["content"]}`;
    } else {
      return `{"type": "object", "properties": {"score": {"type": "number"}, "analysis": {"type": "string"}}, "required": ["score"]}`;
    }
  };

  const extractionDefinitions = definitions.filter(d => d.category === 'extraction');
  const dataPointDefinitions = definitions.filter(d => d.category === 'datapoint');

  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Extraction Definitions</h2>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Definition
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Extraction Definition</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData(prev => ({
                        ...prev,
                        name: e.target.value,
                        jsonKey: generateJsonKey(e.target.value),
                      }));
                    }}
                    placeholder="Tasks, Ideas, Questions, etc."
                  />
                </div>
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      category: value as 'extraction' | 'datapoint',
                      jsonSchema: getExampleSchema(formData.outputType, value),
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="extraction">Extraction</SelectItem>
                      <SelectItem value="datapoint">Data Point</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of what this extracts"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="jsonKey">JSON Key</Label>
                  <Input
                    id="jsonKey"
                    value={formData.jsonKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, jsonKey: e.target.value }))}
                    placeholder="tasks, ideas, questions_answered"
                  />
                </div>
                <div>
                  <Label htmlFor="outputType">Output Type</Label>
                  <Select
                    value={formData.outputType}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      outputType: value as 'array' | 'object' | 'value',
                      jsonSchema: getExampleSchema(value, formData.category),
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="array">Array</SelectItem>
                      <SelectItem value="object">Object</SelectItem>
                      <SelectItem value="value">Value</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="jsonSchema">JSON Schema</Label>
                <Textarea
                  id="jsonSchema"
                  value={formData.jsonSchema}
                  onChange={(e) => setFormData(prev => ({ ...prev, jsonSchema: e.target.value }))}
                  placeholder="JSON schema definition"
                  className="min-h-[100px]"
                />
              </div>

              <div>
                <Label htmlFor="aiInstructions">AI Instructions</Label>
                <Textarea
                  id="aiInstructions"
                  value={formData.aiInstructions}
                  onChange={(e) => setFormData(prev => ({ ...prev, aiInstructions: e.target.value }))}
                  placeholder="Clear instructions for the AI on what to extract"
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Definition'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {/* Extraction Definitions */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extraction Definitions ({extractionDefinitions.length})
          </h3>
          <div className="grid gap-4">
            {extractionDefinitions.map((definition) => (
              <Card key={definition.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{definition.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{definition.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={definition.isActive}
                        onCheckedChange={(checked) => handleToggleActive(definition.id, checked)}
                      />
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(definition)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(definition.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{definition.jsonKey}</Badge>
                      <Badge variant="outline">{definition.outputType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{definition.aiInstructions}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Data Point Definitions */}
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Point Definitions ({dataPointDefinitions.length})
          </h3>
          <div className="grid gap-4">
            {dataPointDefinitions.map((definition) => (
              <Card key={definition.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-base">{definition.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{definition.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={definition.isActive}
                        onCheckedChange={(checked) => handleToggleActive(definition.id, checked)}
                      />
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(definition)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(definition.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Badge variant="secondary">{definition.jsonKey}</Badge>
                      <Badge variant="outline">{definition.outputType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{definition.aiInstructions}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Extraction Definition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Tasks, Ideas, Questions, etc."
                />
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value as 'extraction' | 'datapoint' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extraction">Extraction</SelectItem>
                    <SelectItem value="datapoint">Data Point</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of what this extracts"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-jsonKey">JSON Key</Label>
                <Input
                  id="edit-jsonKey"
                  value={formData.jsonKey}
                  onChange={(e) => setFormData(prev => ({ ...prev, jsonKey: e.target.value }))}
                  placeholder="tasks, ideas, questions_answered"
                />
              </div>
              <div>
                <Label htmlFor="edit-outputType">Output Type</Label>
                <Select
                  value={formData.outputType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, outputType: value as 'array' | 'object' | 'value' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="array">Array</SelectItem>
                    <SelectItem value="object">Object</SelectItem>
                    <SelectItem value="value">Value</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-jsonSchema">JSON Schema</Label>
              <Textarea
                id="edit-jsonSchema"
                value={formData.jsonSchema}
                onChange={(e) => setFormData(prev => ({ ...prev, jsonSchema: e.target.value }))}
                placeholder="JSON schema definition"
                className="min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="edit-aiInstructions">AI Instructions</Label>
              <Textarea
                id="edit-aiInstructions"
                value={formData.aiInstructions}
                onChange={(e) => setFormData(prev => ({ ...prev, aiInstructions: e.target.value }))}
                placeholder="Clear instructions for the AI on what to extract"
                className="min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={loading}>
                {loading ? 'Updating...' : 'Update Definition'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
