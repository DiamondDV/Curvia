# SVG Validation and SVGO

## SVG Validation

Validate the raw SVG before optimization.

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

### Goal

Catch broken or wasteful vector output before optimization.

## SVGO Optimization

SVGO cleans the validated SVG.

### Operations

- merge paths
- merge groups
- reduce precision
- remove metadata
- remove hidden elements
- optimize path commands
- remove unnecessary IDs
- compress output

### Rule

SVGO must not materially alter the visible artwork.

## Output

An optimized SVG ready for download and preview.
