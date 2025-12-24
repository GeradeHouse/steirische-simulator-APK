import { useState, useEffect } from 'react';
import { SoundSettings } from '../types';
import { audioService } from '../services/audioService';
import { STORAGE_KEY_SOUND, DEFAULT_SOUND_SETTINGS } from '../helpers/appConfig';

export const useSoundSettings = () => {
  const [settings, setSettings] = useState<SoundSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SOUND);
      // Merge saved settings with defaults to ensure new keys (like inputGain) exist
      return saved ? { ...DEFAULT_SOUND_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SOUND_SETTINGS;
    } catch (e) {
      console.error("Failed to load sound settings", e);
      return DEFAULT_SOUND_SETTINGS;
    }
  });

  // Sync with AudioService on mount/change
  useEffect(() => {
    audioService.updateSettings(settings);
  }, [settings]);

  const updateSetting = (key: keyof SoundSettings, value: number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    audioService.updateSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(newSettings));
  };

  const resetSetting = (key: keyof SoundSettings) => {
    updateSetting(key, DEFAULT_SOUND_SETTINGS[key]);
  };

  const resetAllSettings = () => {
    if (confirm("Reset all sound settings to default?")) {
      setSettings(DEFAULT_SOUND_SETTINGS);
      audioService.updateSettings(DEFAULT_SOUND_SETTINGS);
      localStorage.setItem(STORAGE_KEY_SOUND, JSON.stringify(DEFAULT_SOUND_SETTINGS));
    }
  };

  return {
    settings,
    updateSetting,
    resetSetting,
    resetAllSettings
  };
};