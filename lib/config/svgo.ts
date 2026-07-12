import type { Config } from 'svgo';

export const svgoConfig: Config = {
  plugins: [
    // Safe optimizations only
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'cleanupAttrs',
    'mergeStyles',
    'inlineStyles',
    'minifyStyles',
    'cleanupIds', // keeps ids but shortens unused ones
    'removeUselessDefs',
    'cleanupNumericValues',
    'convertColors', // #ffffff → #fff
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'mergePaths', // merges adjacent same-fill paths
    'convertPathData', // rounds coordinates, removes redundant commands
    'sortAttrs',

    // DISABLED — these break editability
    // 'removeViewBox',     — must keep viewBox
    // 'collapseGroups',    — destroys semantic grouping from repair stage
    // 'removeHiddenElems', — may remove intentional structure
  ],
  js2svg: {
    indent: 2,
    pretty: true, // human-readable output
  },
};
