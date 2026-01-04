import React, { useState, useEffect, useRef } from 'react';
import { MidiProject } from '../types';
import { getProjectList, saveProject, loadProject, deleteProject } from '../helpers/projectStorage';
import { TrashIcon, ArrowDownTrayIcon, FolderOpenIcon, PlusIcon, ArrowPathIcon, ArrowUpOnSquareIcon } from '@heroicons/react/24/outline';

interface Props {
  player: any; // ReturnType<typeof useMidiPlayer>
}

export const ProjectLibrary: React.FC<Props> = ({ player }) => {
  const [projects, setProjects] = useState<{ id: string; name: string; lastModified: number }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshList();
  }, []);

  // Reset Auto Save to true when a new project is loaded
  useEffect(() => {
    if (player.currentProjectId) {
      player.setIsAutoSaveEnabled(true);
    }
  }, [player.currentProjectId]);

  // Auto-Save Logic removed (moved to App.tsx)

  const refreshList = () => {
    setProjects(getProjectList().sort((a, b) => b.lastModified - a.lastModified));
  };

  const handleSave = (asNew: boolean) => {
    const state = player.getProjectState();
    if (!state) return;

    const name = saveName.trim() || player.fileName || 'Untitled Project';
    const id = (asNew || !player.currentProjectId) ? crypto.randomUUID() : player.currentProjectId;

    const project: MidiProject = {
      id,
      name: asNew ? name : (projects.find(p => p.id === id)?.name || name),
      lastModified: Date.now(),
      ...state
    };

    saveProject(project);
    if (asNew) player.loadProject(project); // Switch context to new ID
    
    setIsSaving(false);
    setSaveName('');
    refreshList();
  };

  const handleLoad = (id: string) => {
    const proj = loadProject(id);
    if (proj) {
      player.loadProject(proj);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Delete this project?')) {
      deleteProject(id);
      refreshList();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider border-b pb-2 flex items-center gap-2">
        <FolderOpenIcon className="w-4 h-4"/>
        MIDI Projects
      </h3>

      {/* Import MIDI File */}
      <input
        type="file"
        accept=".mid,.midi"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            player.loadMidiFile(e.target.files[0]);
            e.target.value = ''; // Reset
          }
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="mb-4 w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded hover:bg-gray-200 border border-gray-200"
      >
        <ArrowUpOnSquareIcon className="w-4 h-4" />
        Import MIDI File
      </button>

      {/* Save Controls */}
      {player.fileName && (
        <div className="mb-4 p-3 bg-indigo-50 rounded border border-indigo-100">
          <div className="flex justify-between items-start mb-2">
            <div className="text-xs font-bold text-indigo-800 truncate max-w-[150px]">
              Current: {player.fileName}
            </div>
            {player.currentProjectId && (
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={player.isAutoSaveEnabled}
                  onChange={(e) => player.setIsAutoSaveEnabled(e.target.checked)}
                  className="w-3 h-3 accent-indigo-600 rounded"
                />
                <span className="text-[10px] font-bold text-indigo-600">Auto Save</span>
              </label>
            )}
          </div>
          
          {isSaving ? (
            <div className="flex flex-col gap-2">
              <input 
                type="text" 
                placeholder="Project Name" 
                className="text-xs p-1 border rounded"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => handleSave(true)} className="flex-1 bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-700">
                  Save New
                </button>
                <button onClick={() => setIsSaving(false)} className="px-2 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              {player.currentProjectId && (
                <button 
                  onClick={() => handleSave(false)}
                  className="flex-1 flex items-center justify-center gap-1 bg-indigo-100 text-indigo-700 text-xs py-1.5 rounded hover:bg-indigo-200 border border-indigo-200"
                >
                  <ArrowPathIcon className="w-3 h-3" /> Update
                </button>
              )}
              <button 
                onClick={() => { setSaveName(player.fileName || ''); setIsSaving(true); }}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-gray-700 text-xs py-1.5 rounded hover:bg-gray-50 border border-gray-300"
              >
                <PlusIcon className="w-3 h-3" /> Save As...
              </button>
            </div>
          )}
        </div>
      )}

      {/* Project List */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {projects.length === 0 ? (
          <div className="text-center text-xs text-gray-400 italic mt-4">
            No saved projects.<br/>Load a MIDI file to start.
          </div>
        ) : (
          projects.map(p => (
            <div 
              key={p.id}
              onClick={() => handleLoad(p.id)}
              className={`group p-2 rounded border cursor-pointer transition-all hover:shadow-sm ${
                player.currentProjectId === p.id 
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' 
                  : 'bg-white border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-gray-700 truncate">{p.name}</div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(p.lastModified).toLocaleDateString()} {new Date(p.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
                <button 
                  onClick={(e) => handleDelete(p.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-600 transition-opacity"
                  title="Delete Project"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};