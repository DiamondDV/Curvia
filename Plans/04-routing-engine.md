# Routing Engine

The Routing Engine converts analysis results into a Processing Profile.

## Purpose

The routing engine is the only stage allowed to make pipeline decisions. Downstream stages must not infer their own behavior independently.

## Inputs

- analysis results
- user quality mode
- upload metadata
- transparency status
- configuration
- job context

## Outputs

A Processing Profile containing:

- pipeline version
- image class
- transparency route
- GPT decision
- OpenCV profile
- VTracer preset
- SVGO preset
- retry policy
- cleanup intensity

## Decision Categories

### GPT Decision

Use GPT restoration when structural defects are significant.

### Transparency Decision

Choose between:

- RGB pipeline
- RGBA pipeline

### Quality Mode

Possible modes:

- fast
- balanced
- maximum quality

### Content Profile

Possible profiles:

- logo
- icon
- sticker
- UI asset
- flat illustration
- complex illustration

## Example Rules

### Prefer GPT when

- geometry is clipped
- artwork is off-center
- edges are malformed
- the image is low resolution and likely to trace poorly
- artifact score is high

### Skip GPT when

- image is already clean
- image is sufficiently high resolution
- the defect score is low
- the input is a simple vector-friendly image

### Prefer RGBA when

- alpha coverage is meaningful
- transparent pixels are present
- edges need transparency preservation

### Prefer RGB when

- no meaningful transparency exists
- alpha is absent or irrelevant

## Design Rule

The routing engine must be deterministic for the same input and configuration version.
