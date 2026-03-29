"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import TextareaAutosize from 'react-textarea-autosize';
import { Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export type SlideData = {
  id: string;
  text: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
  elements: {
    id: string;
    type: 'text' | 'logo';
    content?: string;
    url?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: 'left' | 'center' | 'right';
    color?: string;
    backgroundColor?: string;
    borderRadius?: number;
    padding?: number;
  }[];
};

interface SlideEditorProps {
  slide: SlideData;
  zoom?: number;
  onChange: (updatedSlide: SlideData) => void;
}

export default function SlideEditor({ slide, zoom = 0.5, onChange }: SlideEditorProps) {
  const [guides, setGuides] = useState<{ x: number | null, y: number | null }>({ x: null, y: null });
  const [editingId, setEditingId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (editorRef.current && !editorRef.current.contains(event.target as Node)) {
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const removeElement = (id: string) => {
    onChange({ ...slide, elements: slide.elements.filter(el => el.id !== id) });
  };

  const updateElement = (id: string, newProps: Partial<SlideData['elements'][0]>) => {
    let updated = slide.elements.map(el => el.id === id ? { ...el, ...newProps } : el);
    
    if (newProps.height !== undefined) {
      const originalElement = slide.elements.find(el => el.id === id);
      if (originalElement && originalElement.type === 'text' && originalElement.height !== newProps.height) {
        const delta = newProps.height - originalElement.height;
        
        updated = updated.map(el => {
          if (el.id !== id && 
              el.y >= originalElement.y + originalElement.height - 10 &&
              el.x < originalElement.x + originalElement.width &&
              el.x + el.width > originalElement.x &&
              el.y < 850
          ) {
            return { ...el, y: el.y + delta };
          }
          return el;
        });
      }
    }

    onChange({ ...slide, elements: updated });
  };

  return (
    <div 
      ref={editorRef}
      className="absolute top-0 left-0 w-[1080px] h-[1080px] overflow-hidden origin-top-left" 
      style={{ backgroundColor: slide.bgColor, transform: `scale(${zoom})` }} id={`slide-${slide.id}`}>
      
      {guides.x !== null && (
        <div className="absolute top-0 bottom-0 border-l-2 border-purple-500 border-dashed pointer-events-none z-50" style={{ left: guides.x }} />
      )}
      {guides.y !== null && (
        <div className="absolute left-0 right-0 border-t-2 border-purple-500 border-dashed pointer-events-none z-50" style={{ top: guides.y }} />
      )}

      {slide.elements.map(el => (
        <Rnd
          key={el.id}
          scale={zoom}
          position={{ x: el.x, y: el.y }}
          size={{ width: el.width, height: el.type === 'text' ? 'auto' : el.height }}
          enableResizing={
            el.type === 'text'
              ? { top: false, right: true, bottom: false, left: true, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false }
              : true
          }
          onDrag={(e, d) => {
            const SNAP_THRESHOLD = 20;
            const centerX = 540;
            const centerY = 540;

            let newX = d.x;
            let newY = d.y;
            let newGuideX = null;
            let newGuideY = null;

            if (Math.abs(d.x + el.width / 2 - centerX) < SNAP_THRESHOLD) {
              newX = centerX - el.width / 2;
              newGuideX = centerX;
            }
            if (Math.abs(d.y + el.height / 2 - centerY) < SNAP_THRESHOLD) {
              newY = centerY - el.height / 2;
              newGuideY = centerY;
            }

            setGuides({ x: newGuideX, y: newGuideY });
            
            // By updating position dynamically on drag, react-rnd adheres to the controller position
            updateElement(el.id, { x: newX, y: newY });
          }}
          onDragStop={(e, d) => {
            setGuides({ x: null, y: null });
            
            const SNAP_THRESHOLD = 20;
            const centerX = 540;
            const centerY = 540;

            let finalX = d.x;
            let finalY = d.y;

            if (Math.abs(d.x + el.width / 2 - centerX) < SNAP_THRESHOLD) {
              finalX = centerX - el.width / 2;
            }
            if (Math.abs(d.y + el.height / 2 - centerY) < SNAP_THRESHOLD) {
              finalY = centerY - el.height / 2;
            }
            
            updateElement(el.id, { x: finalX, y: finalY });
          }}
          onResizeStop={(e, direction, ref, delta, position) => {
            const newHeight = el.type === 'text' ? el.height : parseInt(ref.style.height, 10);
            updateElement(el.id, {
              width: parseInt(ref.style.width, 10),
              height: newHeight,
              ...position,
            });
          }}
          bounds="parent"
        >
          {el.type === 'text' && (
            <div 
              className="w-full h-full relative group cursor-text"
              onClick={() => setEditingId(el.id)}
            >
              {editingId === el.id ? (
                <TextareaAutosize
                  className="w-full h-full bg-transparent resize-none outline-none border-2 border-transparent group-hover:border-blue-500 focus:border-blue-500 p-2 font-sans leading-tight block"
                  style={{ 
                    color: el.color || slide.textColor, 
                    backgroundColor: el.backgroundColor || 'transparent',
                    borderRadius: el.borderRadius ? el.borderRadius + 'px' : undefined,
                    padding: el.padding ? el.padding + 'px' : '8px',
                    fontSize: el.fontSize ? el.fontSize + 'px' : '48px',
                    fontWeight: el.fontWeight || 'bold',
                    textAlign: el.textAlign || 'center',
                    overflow: 'hidden'
                  }}
                  autoFocus
                  value={el.content || ""}
                  onChange={e => updateElement(el.id, { content: e.target.value })}
                  onHeightChange={(height) => {
                    if (height !== el.height) {
                      updateElement(el.id, { height });
                    }
                  }}
                />
              ) : (
                <div 
                  className="w-full h-full p-2 font-sans leading-tight overflow-hidden border-2 border-transparent group-hover:border-blue-500"
                  style={{ 
                    color: el.color || slide.textColor, 
                    backgroundColor: el.backgroundColor || 'transparent',
                    borderRadius: el.borderRadius ? el.borderRadius + 'px' : undefined,
                    padding: el.padding ? el.padding + 'px' : '8px',
                    fontSize: el.fontSize ? el.fontSize + 'px' : '48px',
                    fontWeight: el.fontWeight || 'bold',
                    textAlign: el.textAlign || 'center',
                  }}
                >
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ ...props }) => <p style={{ margin: 0 }} {...props} />,
                      ul: ({ ...props }) => <ul style={{ listStyleType: 'disc', paddingLeft: '1.5em', textAlign: 'left' }} {...props} />,
                      ol: ({ ...props }) => <ol style={{ listStyleType: 'decimal', paddingLeft: '1.5em', textAlign: 'left' }} {...props} />,
                      li: ({ ...props }) => <li style={{ marginBottom: '0.2em' }} {...props} />,
                      h1: ({ ...props }) => <h1 style={{ fontSize: '1.5em', margin: '0.5em 0' }} {...props} />,
                      h2: ({ ...props }) => <h2 style={{ fontSize: '1.3em', margin: '0.4em 0' }} {...props} />,
                      h3: ({ ...props }) => <h3 style={{ fontSize: '1.1em', margin: '0.3em 0' }} {...props} />,
                    }}
                  >
                    {el.content || ""}
                  </ReactMarkdown>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeElement(el.id);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50 hover:bg-red-600 shadow-md"
                title="Delete element"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
          {el.type === 'logo' && el.url && (
            <div className="w-full h-full border-2 border-transparent group-hover:border-blue-500 relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={el.url} alt="Logo" className="w-full h-full object-contain pointer-events-none" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeElement(el.id);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-50 hover:bg-red-600 shadow-md"
                title="Delete element"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </Rnd>
      ))}
    </div>
  );
}
