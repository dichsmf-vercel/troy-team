/**
 * `.in("col", ids)` puts every id in the request URL; with a few hundred UUIDs the URL gets too long
 * and PostgREST/Cloudflare reject it. Run the query per chunk and concatenate the rows instead.
 */
export async function selectInChunks<Row>(
  ids: readonly string[],
  query: (chunk: string[]) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
  chunkSize = 150,
): Promise<{ data: Row[]; error: string | null }> {
  const unique = [...new Set(ids.filter(Boolean))]
  const chunks: string[][] = []
  for (let index = 0; index < unique.length; index += chunkSize) chunks.push(unique.slice(index, index + chunkSize))
  const results = await Promise.all(chunks.map((chunk) => query(chunk)))
  const error = results.find((result) => result.error)?.error?.message ?? null
  return { data: results.flatMap((result) => result.data ?? []), error }
}
