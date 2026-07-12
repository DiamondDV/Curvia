import { optimize } from 'svgo';
import type { OptimizeInput, OptimizeOutput } from '@/types/stages';
import { StageError } from '@/lib/utils/errors';
import { svgoConfig } from '@/lib/config/svgo';

export function optimizeSVG(input: OptimizeInput): OptimizeOutput {
  const { svgRepaired } = input;

  const originalSizeBytes = Buffer.byteLength(svgRepaired, 'utf8');

  const result = optimize(svgRepaired, svgoConfig);

  if ('error' in result) {
    throw new StageError('optimizing', String(result.error));
  }

  const optimizedSizeBytes = Buffer.byteLength(result.data, 'utf8');

  return {
    svgOptimized: result.data,
    originalSizeBytes,
    optimizedSizeBytes,
    reductionPercent: Math.round((1 - optimizedSizeBytes / originalSizeBytes) * 100),
  };
}
