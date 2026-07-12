# Quality, Configuration, and Operations

## Quality Analysis

This stage records metrics after SVG generation.

### Metrics

- SVG size
- path count
- color count
- optimization ratio
- processing time
- stage timings
- retry count
- warnings

## Configuration Layer

Do not hardcode operational values in the pipeline.

### Example configuration areas

- upload limits
- max and min resolutions
- timeout values
- retry counts
- default thresholds
- file retention policy
- temporary storage path

### Example configuration object

```json
{
  "upload": {
    "maxFileSizeMB": 20,
    "minResolution": 128,
    "maxResolution": 8192
  },
  "timing": {
    "gptTimeoutMs": 30000,
    "opencvTimeoutMs": 15000,
    "vtracerTimeoutMs": 20000
  },
  "retry": {
    "gpt": 0,
    "opencv": 0,
    "vtracer": 1,
    "svgo": 0
  }
}
```

## Retry Policy

Retries should be explicit and stage-specific.

### Recommended defaults

- GPT: no retry unless the provider recommends it
- OpenCV: no retry unless the pipeline has deterministic fallback logic
- VTracer: one retry with a safer preset
- SVGO: no retry; return the raw SVG if optimization fails

## Observability

Log structured events for:

- stage start
- stage end
- warnings
- retries
- fallback activation
- final status

## Debug Artifacts

In development, save intermediate artifacts:

- original raster
- normalized raster
- restored raster
- cleaned raster
- raw SVG
- optimized SVG

## Failure Handling

Prefer graceful degradation over job failure where a valid output is still possible.
