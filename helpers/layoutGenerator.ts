// file: helpers/layoutGenerator.ts
import { LayoutMap } from '../types';
import defaultLayoutJson from './layout.json';

// Load layout from the JSON file instead of hardcoding
export const generateDefaultLayout = (): LayoutMap => {
  // Cast to LayoutMap to ensure type safety, though JSON import is usually 'any' or inferred
  return defaultLayoutJson as LayoutMap;
};