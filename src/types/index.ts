import { z } from 'zod';

// ---------------------------------------------------------------------------
// RecordingStep - a single step in a recording
// ---------------------------------------------------------------------------

export const RecordingStepAction = z.enum([
  'navigate',
  'click',
  'fill',
  'type',
  'pressKey',
  'waitForSelector',
  'waitForTimeout',
  'hover',
  'select',
]);

export type RecordingStepAction = z.infer<typeof RecordingStepAction>;

export const RecordingStepSchema = z.object({
  action: RecordingStepAction,
  selector: z.string().optional(),
  url: z.string().optional(),
  value: z.string().optional(),
  key: z.string().optional(),
  timeout: z.number().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});

export type RecordingStep = z.infer<typeof RecordingStepSchema>;

// ---------------------------------------------------------------------------
// CollectorConfig - collector configuration
// ---------------------------------------------------------------------------

export const CollectorConfigSchema = z.object({
  network: z.boolean(),
  console: z.boolean(),
  analytics: z.object({
    domains: z.array(z.string()),
    events: z.array(z.string()),
  }),
});

export type CollectorConfig = z.infer<typeof CollectorConfigSchema>;

// ---------------------------------------------------------------------------
// RecordingScript - a complete recording
// ---------------------------------------------------------------------------

export const RecordingScriptSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  steps: z.array(RecordingStepSchema),
  collectors: CollectorConfigSchema,
});

export type RecordingScript = z.infer<typeof RecordingScriptSchema>;

// ---------------------------------------------------------------------------
// StepResult - result of a single step replay
// ---------------------------------------------------------------------------

export const StepResultSchema = z.object({
  index: z.number(),
  action: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  duration: z.number(),
  error: z.string().optional(),
  screenshot: z.string(),
});

export type StepResult = z.infer<typeof StepResultSchema>;

// ---------------------------------------------------------------------------
// CollectedData - collected network / console / analytics data
// ---------------------------------------------------------------------------

export const NetworkEntrySchema = z.object({
  url: z.string(),
  method: z.string(),
  status: z.number(),
  requestBody: z.string().optional(),
  responseBody: z.string().optional(),
  timing: z
    .object({
      dns: z.number().optional(),
      tcp: z.number().optional(),
      ssl: z.number().optional(),
      ttfb: z.number().optional(),
      download: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

export type NetworkEntry = z.infer<typeof NetworkEntrySchema>;

export const ConsoleEntrySchema = z.object({
  type: z.string(),
  text: z.string(),
  location: z.string().optional(),
  timestamp: z.number().optional(),
});

export type ConsoleEntry = z.infer<typeof ConsoleEntrySchema>;

export const AnalyticsEntrySchema = z.object({
  url: z.string(),
  params: z.record(z.string(), z.string()),
  timestamp: z.number(),
});

export type AnalyticsEntry = z.infer<typeof AnalyticsEntrySchema>;

export const CollectedDataSchema = z.object({
  network: z.array(NetworkEntrySchema),
  console: z.array(ConsoleEntrySchema),
  analytics: z.array(AnalyticsEntrySchema),
});

export type CollectedData = z.infer<typeof CollectedDataSchema>;

// ---------------------------------------------------------------------------
// ReplayReport - complete replay report
// ---------------------------------------------------------------------------

export const ReplayReportSchema = z.object({
  scriptName: z.string(),
  status: z.enum(['passed', 'failed', 'error']),
  duration: z.number(),
  timestamp: z.string(),
  steps: z.array(StepResultSchema),
  collected: CollectedDataSchema,
});

export type ReplayReport = z.infer<typeof ReplayReportSchema>;
