import React, { useState, useRef, useCallback } from "react";
import { ipcRenderer } from "electron";
import "./cropOverlay.css";

type CropZone = {
  left: number;
  top: number;
  width: number;
  height: number;
} | null;

type DragState = {
  startX: number;
  startY: number;
  isSelecting: boolean;
};

const Overlay: React.FC = () => {
  const [cropZone, setCropZone] = useState<CropZone>(null);
  const dragState = useRef<DragState>({ startX: 0, startY: 0, isSelecting: false });
  const selectionRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, isSelecting: true };
    if (selectionRef.current) {
      selectionRef.current.style.left = `${e.clientX}px`;
      selectionRef.current.style.top = `${e.clientY}px`;
      selectionRef.current.style.width = "0px";
      selectionRef.current.style.height = "0px";
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isSelecting || !selectionRef.current) return;
    const width = e.clientX - dragState.current.startX;
    const height = e.clientY - dragState.current.startY;
    selectionRef.current.style.width = `${Math.abs(width)}px`;
    selectionRef.current.style.height = `${Math.abs(height)}px`;
    selectionRef.current.style.left = `${width < 0 ? e.clientX : dragState.current.startX}px`;
    selectionRef.current.style.top = `${height < 0 ? e.clientY : dragState.current.startY}px`;
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragState.current.isSelecting) return;
    const width = Math.abs(e.clientX - dragState.current.startX);
    const height = Math.abs(e.clientY - dragState.current.startY);
    const left = Math.min(e.clientX, dragState.current.startX);
    const top = Math.min(e.clientY, dragState.current.startY);
    const selectedZone = { left, top, width, height };
    setCropZone(selectedZone);
    dragState.current.isSelecting = false;

    // Send the crop zone back to the main process
    ipcRenderer.send("crop-selection-complete", selectedZone);
  }, []);

  return (
    <div
      className="overlay-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="overlay-instructions">Drag to select OCR crop zone</div>
      <div ref={selectionRef} className="crop-selection" />
    </div>
  );
};

export default Overlay;
