import React, { useState, useEffect, useCallback, RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { LayoutMap } from '../types';
import { STORAGE_KEY_LAYOUT } from '../helpers/appConfig';
import { generateDefaultLayout } from '../helpers/layoutGenerator';

export const useLayoutEditor = (containerRef: RefObject<HTMLDivElement>) => {
  const [isEditing, setIsEditing] = useState(false);
  const [layout, setLayout] = useState<LayoutMap>({});
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);

  // Initialize Layout
  useEffect(() => {
    const initLayout = async () => {
      const saved = localStorage.getItem(STORAGE_KEY_LAYOUT);
      if (saved) {
        try {
          setLayout(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse saved layout, reverting to default.");
          setLayout(await generateDefaultLayout());
        }
      } else {
        setLayout(await generateDefaultLayout());
      }
    };
    initLayout();
  }, []);

  // Drag Handlers
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    if (!isEditing || !containerRef.current) return;
    setSelectedButtonId(id);
    setDragTarget(id);
  };

  const handleDragMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isEditing || !dragTarget || !containerRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    let left = ((clientX - rect.left) / rect.width) * 100;
    let top = ((clientY - rect.top) / rect.height) * 100;

    left = Math.max(0, Math.min(100, left));
    top = Math.max(0, Math.min(100, top));

    setLayout(prev => ({
      ...prev,
      [dragTarget]: { left, top }
    }));
  }, [isEditing, dragTarget, containerRef]);

  const handleDragEnd = useCallback(() => {
    setDragTarget(null);
  }, []);

  // Global Drag Listeners
  useEffect(() => {
    if (isEditing) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isEditing, handleDragMove, handleDragEnd]);

  // Keyboard Nudge Logic
  useEffect(() => {
    if (!isEditing || !selectedButtonId || !containerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        setSelectedButtonId(null);
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        
        const rect = containerRef.current!.getBoundingClientRect();
        const pixelStep = e.shiftKey ? 10 : 1;
        
        const stepX = (pixelStep / rect.width) * 100;
        const stepY = (pixelStep / rect.height) * 100;

        setLayout(prev => {
          const current = prev[selectedButtonId] || { left: 50, top: 50 };
          let newLeft = current.left;
          let newTop = current.top;

          switch (e.key) {
            case 'ArrowLeft': newLeft -= stepX; break;
            case 'ArrowRight': newLeft += stepX; break;
            case 'ArrowUp': newTop -= stepY; break;
            case 'ArrowDown': newTop += stepY; break;
          }

          return {
            ...prev,
            [selectedButtonId]: { left: newLeft, top: newTop }
          };
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, selectedButtonId, containerRef]);

  // Persistence & IO
  const saveLayout = () => {
    localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(layout));
    setIsEditing(false);
    setSelectedButtonId(null);
  };

  const resetLayout = async () => {
    if (confirm("Are you sure you want to reset the layout?")) {
      const def = await generateDefaultLayout();
      setLayout(def);
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(def));
    }
  };

  const handleImportLayout = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (typeof json === 'object' && json !== null) {
          setLayout(json);
          localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(json));
          alert("Layout imported successfully!");
        } else {
          alert("Invalid JSON file.");
        }
      } catch (err) {
        console.error("Import error:", err);
        alert("Error reading file.");
      }
    };
    reader.readAsText(file);
  };

  const handleExportLayout = async () => {
    const isAndroid = Capacitor.getPlatform() === 'android';
    const fileName = isAndroid ? 'layout_apk.json' : 'layout.json';
    const dataStr = JSON.stringify(layout, null, 2);

    if (isAndroid) {
      try {
        const file = new File([dataStr], fileName, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Steirische Layout Export',
            text: 'Layout configuration for Android.'
          });
          return;
        }
      } catch (e) {
        console.error("Share failed", e);
      }
      
      // Fallback to clipboard
      try {
        await navigator.clipboard.writeText(dataStr);
        alert(`Export failed. JSON copied to clipboard instead! Save as ${fileName}.`);
      } catch (e) {
        alert("Export failed. Could not share or copy to clipboard.");
      }
      return;
    }

    // Web Download
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    layout,
    isEditing,
    setIsEditing,
    selectedButtonId,
    setSelectedButtonId,
    dragTarget,
    handleDragStart,
    saveLayout,
    resetLayout,
    handleImportLayout,
    handleExportLayout
  };
};