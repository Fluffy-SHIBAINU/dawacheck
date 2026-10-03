export type Rotation = 0 | 90 | 180 | 270;

/** Upright first, then the two sideways turns (the common case for phone photos), then upside down. */
export const ROTATIONS: readonly Rotation[] = [0, 90, 270, 180];

/**
 * Runs `recognize` at each rotation until `hasNrn` accepts the text.
 * Returns the upright text (rotation 0) when no angle finds a NAFDAC number.
 */
export async function recognizeWithRotation(
  recognize: (deg: Rotation) => Promise<string>,
  hasNrn: (text: string) => boolean,
): Promise<{ text: string; rotation: Rotation }> {
  let upright = '';
  for (const deg of ROTATIONS) {
    const text = await recognize(deg);
    if (deg === 0) upright = text;
    if (hasNrn(text)) return { text, rotation: deg };
  }
  return { text: upright, rotation: 0 };
}
