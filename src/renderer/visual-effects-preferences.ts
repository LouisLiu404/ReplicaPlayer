export type VisualEffectsPreferences = {
  mainBackground: boolean;
  playerGlow: boolean;
};

export type VisualEffectKey = keyof VisualEffectsPreferences;

export const DEFAULT_VISUAL_EFFECTS: VisualEffectsPreferences = {
  mainBackground: false,
  playerGlow: false
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

    const parsed = JSON.parse(raw) as Partial<VisualEffectsPreferences> & {
      lyrics?: boolean;
    };
    return {
      mainBackground: parsed.mainBackground ?? DEFAULT_VISUAL_EFFECTS.mainBackground,
      playerGlow: parsed.playerGlow ?? parsed.lyrics ?? DEFAULT_VISUAL_EFFECTS.playerGlow
    };
  } catch {
    return DEFAULT_VISUAL_EFFECTS;
  }
}
