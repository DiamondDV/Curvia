# Curvia

Curvia is a web application that converts uploaded raster images into clean, optimized SVGs. The core use case is AI-generated or AI-assisted artwork such as logos, icons, stickers, UI assets, and illustrations. The application uses AI only where deterministic processing is weak: restoration, repair, and prompt enhancement. Everything else is handled by explicit image-processing and vectorization stages.

## Product Goal

Turn messy image inputs into usable SVG output with minimal manual cleanup.

## Primary Outcome

The user uploads an image, optionally adds a text instruction, and receives a downloadable SVG that preserves the original composition as closely as possible while improving geometry, color uniformity, and traceability.

## What Curvia is for

- Cleaning AI-generated raster images before vectorization
- Repairing clipped or broken shapes
- Preserving transparency when present
- Converting flat art into editable vector paths
- Removing AI artifacts and patchy flat-color noise
- Producing efficient SVGs suitable for design tools and web use

## What Curvia is not for

- Freeform image generation
- Redesigning logos or icons
- Stylizing artwork beyond the uploaded source
- General-purpose photo editing
- Photorealistic restoration as a primary goal

## Target Users

- Designers working with logos and icons
- Founders creating brand assets
- Developers needing SVG-ready assets
- Students building design tools
- Users converting AI outputs into editable vectors

## Supported Input Types

- PNG
- JPG
- JPEG
- WEBP

Optional support can be added later for:

- BMP
- TIFF
- HEIC

## Design Principles

1. AI should only repair what deterministic tools cannot reliably repair.
2. The pipeline should be stable and reproducible.
3. The system should treat transparent and opaque images differently.
4. Every stage should be measurable.
5. Validation should happen at multiple points.
6. Failures should degrade gracefully whenever possible.

## System Boundaries

Curvia is split into three layers:

- Frontend: upload, settings, progress display, results
- Backend: orchestration, validation, AI calls, file management
- Processing pipeline: analysis, restoration, cleanup, vectorization, optimization

## Success Criteria

A Curvia conversion is successful when:

- the final SVG opens correctly in standard viewers
- the shape structure still matches the original image
- transparency is preserved when required
- the output contains fewer artifacts than the input
- the user can download a clean SVG without manual fixing
