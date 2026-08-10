/**
 * Stage sequence constants — kept in a separate file so StageTimeline.tsx
 * exports only React components, enabling Vite Fast Refresh without warnings.
 */
import type { StageName } from '../../types';

export const STAGE_SEQUENCE: StageName[] = [
  'fabric_allocation',
  'cutting',
  'printing',
  'embroidery',
  'stitching',
  'quality_check',
  'ironing',
  'packing',
  'dispatch',
];

export const STAGE_LABELS: Record<StageName, string> = {
  fabric_allocation: 'Fabric Allocation',
  cutting:           'Cutting',
  printing:          'Printing',
  embroidery:        'Embroidery',
  stitching:         'Stitching',
  quality_check:     'Quality Check',
  ironing:           'Ironing',
  packing:           'Packing',
  dispatch:          'Dispatch',
};
