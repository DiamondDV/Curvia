# GPT Restoration

## Purpose

This stage uses GPT-Image only for structural restoration.

## Allowed Operations

- repair clipped geometry
- reconstruct missing parts
- fix malformed edges
- remove obvious AI artifacts
- center artwork
- upscale 2×–4×
- preserve transparency

## Disallowed Operations

- redesign
- beautify
- stylize
- round corners
- simplify shapes
- change proportions
- change colors
- invent new details
- alter spacing

## Prompt Strategy

A short, strict restoration prompt is better than a long permissive one. The prompt should explicitly state that the input is the source of truth and that geometry must not be changed.

## Input

- original uploaded image or normalized artifact
- optional user prompt enhanced by Gemini
- processing profile

## Output

A restored raster image.

## Failure Handling

If GPT fails, the orchestrator should continue with the previous artifact if safe. GPT should never be a hard dependency for all jobs.

## When to skip GPT

- the image is already clean
- the image has no visible clipping
- the image is high enough resolution for direct cleanup
- the defect score is below the configured threshold
