import React, { useState } from 'react';
import { CANDIDATE_PATHS } from '../helpers/appConfig';

export const useBackgroundImage = () => {
  const [bgImageSrc, setBgImageSrc] = useState<string>(CANDIDATE_PATHS[0]);
  const [pathIndex, setPathIndex] = useState(0);
  const [bgStatus, setBgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [manualPath, setManualPath] = useState('');

  const handleImgError = () => {
    const nextIndex = pathIndex + 1;
    if (nextIndex < CANDIDATE_PATHS.length) {
      setPathIndex(nextIndex);
      setBgImageSrc(CANDIDATE_PATHS[nextIndex]);
    } else {
      setBgStatus('error');
    }
  };

  const handleImgLoad = () => {
    setBgStatus('loaded');
  };

  const applyManualPath = (e: React.FormEvent) => {
    e.preventDefault();
    if(manualPath.trim()) {
        setBgImageSrc(manualPath);
        setBgStatus('loading');
        setPathIndex(-1); 
    }
  };

  return {
    bgImageSrc,
    bgStatus,
    manualPath,
    setManualPath,
    handleImgError,
    handleImgLoad,
    applyManualPath
  };
};