# OpenCV Processing

## Purpose

OpenCV performs deterministic cleanup before tracing.

## RGB Pipeline

1. bilateral filter
2. median filter if needed
3. RGB to LAB conversion
4. ΔE-based color clustering
5. flatten nearly identical colors
6. remove tiny connected components
7. morphological opening
8. morphological closing
9. optional edge-preserving sharpening

## RGBA Pipeline

The RGBA pipeline must preserve alpha.

### RGB Channel Processing

- bilateral filter
- median filter if needed
- RGB to LAB conversion
- ΔE-based color clustering
- flatten nearly identical colors
- remove tiny connected components
- morphological opening
- morphological closing
- optional edge-preserving sharpening

### Alpha Channel Processing

- preserve alpha channel
- remove isolated pixels
- fill tiny holes
- clean alpha edges
- preserve edge geometry

### Merge Step

Recombine processed RGB and alpha into a single RGBA raster.

## Key Rules

- Do not process alpha the same way as color channels.
- Do not destroy semi-transparent edges.
- Do not aggressively blur boundaries.
- Do not over-reduce colors if gradients are intentional.

## Output

A cleaned raster optimized for vector tracing.
