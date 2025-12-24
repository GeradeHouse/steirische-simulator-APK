// file: components/TopBar.tsx
import React from 'react';
import { 
  PencilSquareIcon, 
  CheckCircleIcon, 
  ArrowPathIcon, 
  SparklesIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';

interface TopBarProps {
  chordName: string;
  chordDesc: string;
  isAiEnabled: boolean;
  setIsAiEnabled: (val: boolean) => void;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  resetLayout: () => void;
  saveLayout: () => void;
  onExportLayout: () => void;
  onImportLayout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  chordName,
  chordDesc,
  isAiEnabled,
  setIsAiEnabled,
  isEditing,
  setIsEditing,
  resetLayout,
  saveLayout,
  onExportLayout,
  onImportLayout
}) => {
  return (
    <div className="flex-none bg-white border-b border-gray-200 p-3 shadow-sm flex items-center justify-between z-20">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800 hidden md:block">Steirische Simulator</h1>
      </div>

      <div className="flex-1 mx-4 bg-gray-50 rounded border border-gray-200 px-3 py-1 text-center hidden sm:block flex items-center justify-center gap-4">
         <div className="flex flex-col items-center">
           <span className="font-bold text-gray-700 min-h-[1.5rem]">{chordName}</span>
           <span className="text-gray-500 text-xs">{chordDesc}</span>
         </div>
      </div>

      <div className="flex items-center gap-2">
         {/* AI Toggle Button */}
         <button 
           onClick={() => setIsAiEnabled(!isAiEnabled)}
           className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
             isAiEnabled 
               ? 'bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200' 
               : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
           }`}
           title={isAiEnabled ? "Disable AI" : "Enable AI"}
         >
           <SparklesIcon className={`w-5 h-5 ${isAiEnabled ? 'animate-pulse' : ''}`} />
           <span className="hidden md:inline text-sm font-medium">{isAiEnabled ? 'AI On' : 'AI Off'}</span>
         </button>

         <div className="w-px h-6 bg-gray-300 mx-1"></div>

         {isEditing ? (
           <>
              {/* Import/Export Buttons (Only visible in Edit mode) */}
              <button onClick={onImportLayout} className="p-2 text-gray-600 hover:bg-gray-100 rounded" title="Import Layout (JSON)">
                <ArrowUpTrayIcon className="w-6 h-6" />
              </button>
              <button onClick={onExportLayout} className="p-2 text-gray-600 hover:bg-gray-100 rounded" title="Export Layout (JSON)">
                <ArrowDownTrayIcon className="w-6 h-6" />
              </button>

              <div className="w-px h-6 bg-gray-300 mx-1"></div>

              <button onClick={resetLayout} className="p-2 text-red-600 hover:bg-red-50 rounded" title="Reset to Default">
                <ArrowPathIcon className="w-6 h-6" />
              </button>
              <button onClick={saveLayout} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                <CheckCircleIcon className="w-5 h-5" />
                <span>Done</span>
              </button>
           </>
         ) : (
           <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded">
             <PencilSquareIcon className="w-5 h-5" />
             <span className="hidden md:inline">Layout</span>
           </button>
         )}
      </div>
    </div>
  );
};