export type VisualEffectsPreferences = {
  mainBackground: boolean;
  bottomPlayer: boolean;
  lyrics: boolean;
};

export type VisualEffectKey = keyof VisualEffectsPreferences;

export const DEFAULT_VISUAL_EFFECTS: VisualEffectsPreferences = {
  mainBackground: true,
  bottomPlayer: true,
  lyrics: true
};

export const VISUAL_EFFECTS_STORAGE_KEY = "replica-player:visual-effects";

export function readStoredVisualEffects(
  storage: Pick<Storage, "getItem"> | null
): VisualEffectsPreferences {
  if (!storage) {
    return DEFAULT_VISUAL_EFFECTS;
  }

  try {
    const raw = storage.getItem(VISUAL_EFFECTS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_VISUAL_EFFECTS;
    }

    const parsed = JSON.parse(raw) as Partial<VisualEffectsPreferences>;
    return {
      mainBackground: parsed.mainBackground ?? DEFAULT_VISUAL_EFFECTS.mainBackground,
      bottomPlayer: parsed.bottomPlayer ?? DEFAULT_VISUAL_EFFECTS.bottomPlayer,
      lyrics: parsed.lyrics ?? DEFAULT_VISUAL_EFFECTS.lyrics
    };
  } catch {
    return DEFAULT_VISUAL_EFFECTS;
  }
}
