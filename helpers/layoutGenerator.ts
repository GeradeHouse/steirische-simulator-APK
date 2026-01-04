// file: helpers/layoutGenerator.ts
import { Capacitor } from '@capacitor/core';
import { LayoutMap } from '../types';
import defaultLayoutJson from './layout.json';

// Load layout from the JSON file, with Android override support
export const generateDefaultLayout = async (): Promise<LayoutMap> => {
  const isAndroid = Capacitor.getPlatform() === 'android';

  if (isAndroid) {
    // Use Vite's glob import to safely check for the file without build errors if missing
    const modules = import.meta.glob('./layout_apk.json', { eager: true });
    const apkModule = modules['./layout_apk.json'] as any;

    if (apkModule && apkModule.default) {
      console.log("Loaded Android-specific layout (layout_apk.json)");
      return apkModule.default as LayoutMap;
    }
  }

  return defaultLayoutJson as LayoutMap;
};
