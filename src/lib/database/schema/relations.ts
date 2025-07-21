import { relations } from 'drizzle-orm';
import { audioFiles, speakerLabels, fileLabels } from './audio';
import { transcriptionJobs } from './transcripts';
import { summarizationTemplates, extractionTemplates, aiExtracts } from './extractions';
import {
  dataPointTemplates,
  extractions,
  dataPoints,
  summarizations,
  summarizationPrompts,
  extractionDefinitions,
  extractionResults,
  aiProcessingSessions,
} from './system';
import { psychologicalEvaluations } from './psychology';

// Audio file relations
export const audioFilesRelations = relations(audioFiles, ({ one, many }) => ({
  speakerLabels: one(speakerLabels, {
    fields: [audioFiles.id],
    references: [speakerLabels.fileId],
  }),
  fileLabels: one(fileLabels, {
    fields: [audioFiles.id],
    references: [fileLabels.fileId],
  }),
  transcriptionJobs: many(transcriptionJobs),
  aiExtracts: many(aiExtracts),
  psychologicalEvaluations: many(psychologicalEvaluations),
  extractions: many(extractions),
  dataPoints: many(dataPoints),
  summarizations: many(summarizations),
  extractionResults: many(extractionResults),
  aiProcessingSessions: many(aiProcessingSessions),
}));

export const speakerLabelsRelations = relations(speakerLabels, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [speakerLabels.fileId],
    references: [audioFiles.id],
  }),
}));

export const fileLabelsRelations = relations(fileLabels, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [fileLabels.fileId],
    references: [audioFiles.id],
  }),
}));

// Transcription relations
export const transcriptionJobsRelations = relations(transcriptionJobs, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [transcriptionJobs.fileId],
    references: [audioFiles.id],
  }),
}));

// Extraction template relations
export const extractionTemplatesRelations = relations(extractionTemplates, ({ many }) => ({
  extractions: many(extractions),
  aiExtracts: many(aiExtracts),
}));

export const summarizationTemplatesRelations = relations(summarizationTemplates, ({ many }) => ({
  aiExtracts: many(aiExtracts),
  summarizations: many(summarizations),
}));

// AI extract relations
export const aiExtractsRelations = relations(aiExtracts, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [aiExtracts.fileId],
    references: [audioFiles.id],
  }),
  template: one(extractionTemplates, {
    fields: [aiExtracts.templateId],
    references: [extractionTemplates.id],
  }),
}));

// System relations
export const dataPointTemplatesRelations = relations(dataPointTemplates, ({ many }) => ({
  dataPoints: many(dataPoints),
}));

export const extractionsRelations = relations(extractions, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [extractions.fileId],
    references: [audioFiles.id],
  }),
  template: one(extractionTemplates, {
    fields: [extractions.templateId],
    references: [extractionTemplates.id],
  }),
}));

export const dataPointsRelations = relations(dataPoints, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [dataPoints.fileId],
    references: [audioFiles.id],
  }),
  template: one(dataPointTemplates, {
    fields: [dataPoints.templateId],
    references: [dataPointTemplates.id],
  }),
}));

export const summarizationsRelations = relations(summarizations, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [summarizations.fileId],
    references: [audioFiles.id],
  }),
  template: one(summarizationPrompts, {
    fields: [summarizations.templateId],
    references: [summarizationPrompts.id],
  }),
}));

// Dynamic extraction system relations
export const summarizationPromptsRelations = relations(summarizationPrompts, ({ many }) => ({
  summarizations: many(summarizations),
  aiProcessingSessions: many(aiProcessingSessions),
}));

export const extractionDefinitionsRelations = relations(extractionDefinitions, ({ many }) => ({
  extractionResults: many(extractionResults),
}));

export const extractionResultsRelations = relations(extractionResults, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [extractionResults.fileId],
    references: [audioFiles.id],
  }),
  definition: one(extractionDefinitions, {
    fields: [extractionResults.definitionId],
    references: [extractionDefinitions.id],
  }),
}));

export const aiProcessingSessionsRelations = relations(aiProcessingSessions, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [aiProcessingSessions.fileId],
    references: [audioFiles.id],
  }),
  summarizationPrompt: one(summarizationPrompts, {
    fields: [aiProcessingSessions.summarizationPromptId],
    references: [summarizationPrompts.id],
  }),
}));

// Psychology relations
export const psychologicalEvaluationsRelations = relations(psychologicalEvaluations, ({ one }) => ({
  audioFile: one(audioFiles, {
    fields: [psychologicalEvaluations.fileId],
    references: [audioFiles.id],
  }),
}));
