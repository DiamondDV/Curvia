# Processing Profile

The Processing Profile is the single source of truth for execution.

## Responsibilities

It stores every decision made by the routing engine so that all later stages remain stateless.

## Example Schema

```json
{
  "pipelineVersion": "1.0.0",
  "profileVersion": "1.0",
  "imageType": "logo",
  "qualityMode": "balanced",
  "gptRestore": true,
  "pipeline": "rgba",
  "openCVProfile": "lightCleanup",
  "vtracerPreset": "logo-v2",
  "svgoPreset": "default-v1",
  "colorThreshold": 3,
  "denoise": "bilateral",
  "morphology": "light",
  "edgeSharpen": true,
  "retryPolicy": {
    "gpt": 0,
    "opencv": 0,
    "vtracer": 1,
    "svgo": 0
  }
}
```

## Recommended Fields

### Versioning

- pipelineVersion
- profileVersion
- component versions if needed later

### Routing

- imageType
- qualityMode
- gptRestore
- pipeline

### OpenCV

- openCVProfile
- colorThreshold
- denoise
- morphology
- edgeSharpen

### VTracer

- vtracerPreset
- colorDifference
- cornerThreshold
- filterSpeckle
- pathPrecision

### SVGO

- svgoPreset

### Retry Policy

- retry counts per stage
- fallback artifact per stage

## Design Rules

- The profile must be immutable after generation.
- The profile must be versioned.
- The profile must not contain transient runtime state.
- The profile must be serializable for logging and replay.
