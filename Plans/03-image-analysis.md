# Image Analysis

This stage extracts measurable signals used by the routing engine.

## Purpose

The analysis stage does not transform the image. It only inspects the image and records properties, defects, and classification results.

## Subsystems

### 1. Image Properties

Measures basic characteristics of the input.

#### Fields

- width
- height
- aspect ratio
- resolution category
- file format
- transparency presence
- alpha coverage percentage
- unique color count
- dominant colors
- color variance

### 2. Geometry Analysis

Measures structural integrity.

#### Fields

- clipped geometry score
- broken edge score
- shape completeness score
- center alignment score
- bounding box
- estimated rotation

### 3. Color Analysis

Measures how suitable the image is for vector cleanup.

#### Fields

- flat color percentage
- gradient percentage
- palette complexity
- color clustering density
- near-duplicate color groups

### 4. Defect Detection

Identifies issues that affect restoration or tracing.

#### Fields

- blur estimate
- noise estimate
- compression artifact score
- AI artifact score
- edge sharpness
- artifact localization map if available

### 5. Classification

Determines the image type.

#### Classes

- logo
- icon
- sticker
- UI asset
- flat illustration
- complex illustration

## Implementation Notes

- The detectors should be modular and independently testable.
- Each detector should return a score or confidence value where possible.
- The routing engine should use confidence values, not just labels.
- Analysis should be parallelized when possible.

## Why this stage matters

Bad routing decisions create bad outputs. If the system misclassifies a logo as a complex illustration, it may over-smooth the image. If it misses clipping, GPT restoration may be skipped when it is actually needed.
