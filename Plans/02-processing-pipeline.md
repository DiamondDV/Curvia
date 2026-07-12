# Complete Processing Pipeline

This document defines the full production pipeline in implementation order.

## 1. Upload Image

The user uploads a raster image through the UI.

### Supported Formats

- PNG
- JPG
- JPEG
- WEBP

### Upload Limits

These should be configurable, not hardcoded.

- maximum file size
- minimum resolution
- maximum resolution
- allowed MIME types

## 2. Image Preprocessing

This stage normalizes the raw input before analysis.

### Required operations

- decode the file into an internal raster representation
- auto-orient using EXIF metadata
- convert to sRGB
- normalize bit depth
- strip invalid metadata
- preserve transparency if present

### Output

A normalized raster that is safe for analysis.

## 3. Input Validation

Reject files that are not usable.

### Checks

- file format is supported
- image is readable
- file integrity is intact
- resolution is within bounds
- file size is within bounds
- pixel count is sane
- decode succeeded

### Failure behavior

Return a descriptive error and stop processing.

## 4. Parallel Image Analysis

This stage runs several detectors in parallel.

### Image Properties

- width and height
- aspect ratio
- transparency presence
- alpha coverage
- unique color count
- dominant colors
- color variance

### Geometry Analysis

- clipped geometry detection
- broken edge detection
- shape completeness
- center alignment
- bounding box
- rotation estimate

### Color Analysis

- flat color percentage
- gradient percentage
- palette complexity
- dominant palette clustering

### Defect Detection

- AI artifact estimate
- compression artifact estimate
- blur estimate
- edge sharpness
- noise estimate

### Classification

Classify the image as one of:

- logo
- icon
- sticker
- UI asset
- flat illustration
- complex illustration

## 5. Routing Engine

The routing engine decides how to process the image.

### Decisions

- use GPT restoration or skip it
- route to RGB or RGBA pipeline
- select an image profile
- choose a VTracer preset
- choose an OpenCV cleanup intensity
- choose a quality mode

### GPT Routing Rules

Use GPT if:

- clipped geometry is detected
- missing shapes are detected
- malformed edges are detected
- severe AI artifacts are detected
- image is too low resolution for safe tracing

Skip GPT if:

- image is already clean
- image is sufficiently high resolution
- defects are minor
- restoration would likely change geometry too much

## 6. Processing Profile Generation

The routing engine outputs a Processing Profile object.

### The profile should contain

- pipeline version
- image classification
- transparency mode
- GPT decision
- cleanup intensity
- color threshold values
- morphology strategy
- VTracer preset
- SVGO preset
- quality mode
- retry policy

### Rule

All later stages must read only from the Processing Profile, the current artifact, and the Job Context.

## 7. GPT Restoration

This is optional.

### Purpose

Structural repair only.

### Allowed operations

- repair clipped geometry
- reconstruct missing parts
- fix malformed edges
- remove obvious AI artifacts
- center artwork
- upscale 2×–4×
- preserve transparency when present

### Prohibited operations

- redesign
- stylize
- beautify
- round corners
- change spacing
- change proportions
- alter colors
- invent new details

### Output

A higher-resolution repaired raster.

### Failure behavior

If GPT fails, continue with the original normalized image unless the failure makes the pipeline invalid.

## 8. OpenCV Processing

This is the deterministic cleanup stage.

### RGB Pipeline

- bilateral filter
- median filter if needed
- RGB to LAB conversion
- ΔE-based color clustering
- flatten nearly identical colors
- remove tiny connected components
- morphological opening
- morphological closing
- optional edge-preserving sharpening

### RGBA Pipeline

Process RGB and alpha separately.

#### RGB

- bilateral filter
- median filter if needed
- RGB to LAB conversion
- ΔE-based color clustering
- flatten nearly identical colors
- remove tiny connected components
- morphological opening
- morphological closing
- optional edge-preserving sharpening

#### Alpha

- preserve alpha channel
- remove isolated pixels
- fill tiny holes
- clean alpha edges
- preserve edge shape

#### Merge

Recombine RGB and alpha into a single RGBA raster.

## 9. Output Validation

Verify that preprocessing and cleanup did not break the image.

### Checks

- image is readable
- raster is not blank
- alpha is preserved if required
- dimensions are valid
- color count is sane
- no corrupted pixels are present
- raster integrity is intact

### Failure behavior

- retry if the profile allows it
- otherwise continue with the safest available artifact

## 10. Adaptive VTracer

Vectorize the cleaned raster.

### Adaptive inputs

- image classification
- transparency mode
- color count
- edge sharpness
- defect score
- profile preset

### Tunable parameters

- color_difference
- corner_threshold
- filter_speckle
- path_precision

### Behavior

VTracer should be configured by the profile, not by a hardcoded default.

## 11. SVG Validation

Validate the raw SVG output before optimization.

### Checks

- remove empty paths
- remove tiny paths
- remove zero-area paths
- merge duplicate paths
- remove duplicate objects
- validate XML structure
- validate path commands
- validate geometry
- remove unused definitions

### Failure behavior

If the SVG is invalid, attempt a repair pass if safe. Otherwise return a descriptive error.

## 12. SVGO Optimization

Reduce file size and clean vector structure.

### Operations

- merge paths
- merge groups
- reduce precision
- remove metadata
- remove hidden elements
- optimize path commands
- remove unnecessary IDs
- compress output

### Important rule

SVGO must not change the visible artwork beyond acceptable floating-point simplification.

## 13. Quality Analysis

This is for metrics, not user-facing artistic judgment.

### Metrics

- SVG file size
- number of paths
- number of colors
- optimization ratio
- processing time
- stage timings
- retry count
- complexity score

### Optional later metric

Raster-to-SVG similarity scoring can be added later, but it is not required for v1.

## 14. Final SVG

Return the optimized SVG to the user along with any safe metadata such as file size, path count, and warnings.
