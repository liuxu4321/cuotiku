import { z } from 'zod'

export const themePreferenceSchema = z.enum(['light', 'dark', 'system'])
export const releaseChannelSchema = z.enum(['stable', 'beta'])
export const paperSizeSchema = z.enum(['A4', 'B5'])
export const layoutSettingsSchema = z.object({
  paper: paperSizeSchema.default('A4'),
  mode: z.enum(['auto', 'single', 'double']),
  gapMm: z.number().min(2).max(20),
  marginMm: z.number().min(5).max(25),
})
export const processingSettingsSchema = z.object({
  enhance: z.boolean(),
  enhanceStrength: z.number().min(0).max(100),
})
export const selectionRegionSchema = z.object({
  id: z.string().min(1),
  imageId: z.string().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().positive().max(1),
  height: z.number().positive().max(1),
})
export const imageEditSpecSchema = z.object({
  imageId: z.string().min(1),
  quarterTurns: z.number().int(),
  fineAngle: z.number().min(-45).max(45),
  selections: z.array(selectionRegionSchema),
})
export const cropRequestSchema = z.object({
  revision: z.number().int().nonnegative(),
  images: z.array(imageEditSpecSchema),
  processing: processingSettingsSchema,
})
export const handwritingEraseRequestSchema = cropRequestSchema.extend({
  secretId: z.string(),
  secretKey: z.string(),
})
export const subjectSchema = z.enum(['语文', '数学', '英语'])
export const errorTypeSchema = z.enum(['马虎', '不会', '概念不清', '其他'])
export const bookAddRequestSchema = z.object({
  resultSetId: z.string().min(1),
  grade: z.number().int().min(1).max(9),
  subject: subjectSchema,
  items: z.array(z.object({ errorType: errorTypeSchema })).min(1),
})
export const collectionEntrySchema = z.object({
  id: z.string().min(1),
  grade: z.number().int().min(1).max(9),
  subject: subjectSchema,
  errorType: errorTypeSchema,
  createdAt: z.number(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  thumbDataUrl: z.string(),
})
export const bookEntryIdSchema = z.string().min(1)
export const bookPageRequestSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1),
  paper: paperSizeSchema,
})
export const analogyGenerateRequestSchema = z.object({
  entryIds: z.array(z.string().min(1)).min(1),
})
export const analogyDocumentSchema = z.object({
  title: z.string().min(1),
  createdAt: z.number(),
  items: z
    .array(
      z.object({
        entryId: z.string().min(1),
        thumbDataUrl: z.string(),
        subject: subjectSchema,
        grade: z.number().int().min(1).max(9),
        errorType: errorTypeSchema,
        questions: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
})
export const pagePreviewRequestSchema = z.object({
  resultSetId: z.string().min(1),
  layout: layoutSettingsSchema,
})
export const appConfigSchema = z.object({
  theme: themePreferenceSchema.default('system'),
  releaseChannel: releaseChannelSchema.default('stable'),
  layout: layoutSettingsSchema.default({ paper: 'A4', mode: 'auto', gapMm: 8, marginMm: 10 }),
  processing: processingSettingsSchema.default({ enhance: true, enhanceStrength: 55 }),
  tencentSecretId: z.string().default(''),
  rememberTencentSecretKey: z.boolean().default(false),
  tencentSecretKey: z.string().default(''),
  grade: z.number().int().min(1).max(9).default(1),
  subject: subjectSchema.default('语文'),
  bookDir: z.string().default(''),
})
export const externalUrlSchema = z
  .string()
  .url()
  .refine((value) => ['https:', 'mailto:'].includes(new URL(value).protocol), {
    message: 'Only https and mailto URLs can be opened externally.',
  })
export const updateStatusSchema = z.enum([
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error',
])
export const updateProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  transferred: z.number().nonnegative(),
  total: z.number().nonnegative(),
  bytesPerSecond: z.number().nonnegative(),
})
export const updateStateSchema = z.object({
  status: updateStatusSchema,
  channel: releaseChannelSchema,
  message: z.string().min(1),
  version: z.string().optional(),
  progress: updateProgressSchema.optional(),
  error: z.string().optional(),
})
export const windowBoundsSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().int().min(640),
  height: z.number().int().min(480),
})
