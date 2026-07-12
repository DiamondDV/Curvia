# System Architecture

## High-Level Flow

```text
Upload Image
    │
    ▼
Preprocessing
    │
    ▼
Input Validation
    │
    ▼
Parallel Image Analysis
    │
    ▼
Routing Engine
    │
    ▼
Processing Profile Generation
    │
    ▼
GPT Restoration (Optional)
    │
    ▼
OpenCV Processing
    │
    ▼
Output Validation
    │
    ▼
Adaptive VTracer
    │
    ▼
SVG Validation
    │
    ▼
SVGO Optimization
    │
    ▼
Quality Analysis
    │
    ▼
Final SVG
```

## Architectural Rule

The Routing Engine generates the single source of truth for the pipeline: the Processing Profile. Every downstream stage must be stateless and must read only from that profile plus the current artifact and job context.

## Core Components

### Frontend
Responsible for:

- uploading images
- optional prompt entry
- API key entry for testing
- showing pipeline progress
- showing final SVG and metrics

### API Layer
Responsible for:

- accepting uploads
- creating jobs
- validating input
- storing temporary artifacts
- returning final results
- surfacing errors

### Processing Worker
Responsible for:

- image analysis
- routing
- GPT restoration
- OpenCV processing
- vectorization
- SVG optimization
- metrics generation

### Storage Layer
Responsible for:

- temporary raster artifacts
- generated SVGs
- logs and metrics
- cached results if enabled later

## Data Flow

1. User uploads an image.
2. The system normalizes the image.
3. Validation checks reject unusable files early.
4. Analysis derives measurable properties and defects.
5. The routing engine decides whether GPT is needed and selects the correct pipeline.
6. GPT performs restoration only if required.
7. OpenCV cleans the raster for tracing.
8. VTracer converts the cleaned raster into SVG.
9. SVG validation removes invalid or wasteful vector structures.
10. SVGO optimizes the final SVG.
11. Quality analysis records file size, path count, color count, and timing.
12. The SVG is returned to the user.

## Shared State Model

The worker should use a Job object rather than global variables.

### Job Object Contents

- jobId
- user input metadata
- normalized raster artifact
- analysis results
- processing profile
- stage timings
- intermediate artifacts
- final SVG
- warnings and errors

## State Rules

- Artifacts are immutable once produced.
- Each stage writes a new artifact instead of mutating the old one.
- Stages do not make hidden routing decisions.
- The orchestrator controls retries and fallbacks.

## Processing Modes

### Opaque Pipeline
Used when the image has no meaningful transparency.

### RGBA Pipeline
Used when the image contains transparent or semi-transparent pixels.

The RGBA pipeline preserves alpha during raster cleanup and vectorization.

## Why This Architecture Works

- It isolates AI from deterministic cleanup.
- It makes the pipeline debuggable.
- It allows stage replacement without redesign.
- It supports profile-based tuning for different image types.
- It avoids hardcoding behavior inside vectorization logic.
