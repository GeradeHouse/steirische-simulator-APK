import { MidiProject } from '../types';

const STORAGE_PREFIX = 'steirische_proj_';
const INDEX_KEY = 'steirische_proj_index';

export const getProjectList = (): { id: string; name: string; lastModified: number }[] => {
  try {
    const index = localStorage.getItem(INDEX_KEY);
    return index ? JSON.parse(index) : [];
  } catch (e) {
    console.error("Failed to load project index", e);
    return [];
  }
};

export const loadProject = (id: string): MidiProject | null => {
  try {
    const data = localStorage.getItem(STORAGE_PREFIX + id);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.error("Failed to load project", id, e);
    return null;
  }
};

export const saveProject = (project: MidiProject): void => {
  try {
    // 1. Save Project Data
    localStorage.setItem(STORAGE_PREFIX + project.id, JSON.stringify(project));

    // 2. Update Index
    const list = getProjectList();
    const existingIdx = list.findIndex(p => p.id === project.id);
    const meta = { id: project.id, name: project.name, lastModified: project.lastModified };
    
    if (existingIdx >= 0) {
      list[existingIdx] = meta;
    } else {
      list.push(meta);
    }
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save project", e);
    alert("Storage full or error saving project.");
  }
};

export const deleteProject = (id: string): void => {
  try {
    localStorage.removeItem(STORAGE_PREFIX + id);
    const list = getProjectList().filter(p => p.id !== id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to delete project", e);
  }
};