# Validation and VTracer

## Output Validation

This happens after raster cleanup and before vectorization.

### Checks

- image readable
- raster not blank
- dimensions valid
- color count sane
- alpha preserved if required
- no corrupted pixels
- output artifact structurally intact

### Behavior

If validation fails, the orchestrator may retry using a safer profile or return a clear error.

## Adaptive VTracer

VTracer should be configured from the Processing Profile.

### Tunable Parameters

- color_difference
- corner_threshold
- filter_speckle
- path_precision

### Adaptive Behavior

Different image types require different presets:

- logos: high precision, low tolerance
- icons: sharp edges, conservative smoothing
- stickers: balanced cleanup
- flat illustrations: moderate clustering
- complex illustrations: conservative clustering to preserve detail

## Output

A raw SVG that will be validated and optimized in later stages.
