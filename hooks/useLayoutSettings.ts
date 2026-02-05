import { useState } from 'react';
import { LayoutSettings } from '../types';
import { STORAGE_KEY_LAYOUT_SETTINGS, DEFAULT_LAYOUT_SETTINGS } from '../helpers/appConfig';

export const useLayoutSettings = () => {
  const [layoutSettings, setLayoutSettings] = useState<LayoutSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUT_SETTINGS);
      return saved ? { ...DEFAULT_LAYOUT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_LAYOUT_SETTINGS;
    } catch (e) {
      console.error("Failed to load layout settings", e);
      return DEFAULT_LAYOUT_SETTINGS;
    }
  });

  const updateLayoutSetting = (key: keyof LayoutSettings, value: number) => {
    const newSettings = { ...layoutSettings, [key]: value };
    setLayoutSettings(newSettings);
    localStorage.setItem(STORAGE_KEY_LAYOUT_SETTINGS, JSON.stringify(newSettings));
  };

  const resetLayoutSettings = () => {
    if (confirm("Reset all layout settings to default?")) {
      setLayoutSettings(DEFAULT_LAYOUT_SETTINGS);
      localStorage.setItem(STORAGE_KEY_LAYOUT_SETTINGS, JSON.stringify(DEFAULT_LAYOUT_SETTINGS));
    }
  };

  return {
    layoutSettings,
    updateLayoutSetting,
    resetLayoutSettings
  };
};