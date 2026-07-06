// Type surface for the untyped .mjs endpoint-recipe helper (endpoint-recipes.mjs).
// applyEndpointRecipe returns the spec, possibly augmented with a generated `endpoints` array.
export function matchRecipe(slug: string, baseUrl: string, sampleEndpoint: string): unknown
export function applyEndpointRecipe<T>(spec: T): T & { endpoints?: unknown[] }
export const RECIPES: unknown[]
