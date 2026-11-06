/** New publications select immutable files with an atomic database reference.
 * Old photo-only servers explicitly lack this RPC and retain their old path. */
export default async function galleryPublishedFile(
  author: string,
  scene: string,
  file: 'scene.json' | 'picture.webp',
  read: (body: Record<string, unknown>) => Promise<Response>,
): Promise<string | undefined> {
  try {
    const legacy = `${author}/${scene}/${file}`;
    const response = await read({
      p_author: author,
      p_scene: scene,
      p_file: file,
    });
    if (response.status === 404) {
      return legacy;
    }
    if (!response.ok) {
      return undefined;
    }
    const value: unknown = await response.json();
    if (typeof value !== 'string') {
      return undefined;
    }
    if (value === legacy) {
      return value;
    }
    const prefix = `${author}/${scene}/preview/`;
    const name = value.slice(prefix.length);
    return value.startsWith(prefix) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:webm|mp4)\.[0-9a-f]{64}\.(?:scene\.json|picture\.webp)$/.test(
        name,
      ) &&
      name.endsWith(`.${file}`)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
