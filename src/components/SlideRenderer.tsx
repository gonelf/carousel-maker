"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SlideData } from './SlideEditor';

interface SlideRendererProps {
  slide: SlideData;
  scale?: number;
  className?: string;
}

export default function SlideRenderer({ slide, scale = 1, className = "absolute top-0 left-0" }: SlideRendererProps) {
  return (
    <div 
      className={`${className} w-[1080px] h-[1080px] overflow-hidden origin-top-left bg-white`} 
      style={{ 
        backgroundColor: slide.bgColor, 
        transform: scale !== 1 ? `scale(${scale})` : undefined,
        width: 1080,
        height: 1080
      }} 
      id={`render-slide-${slide.id}`}
    >
      {slide.elements.map(el => (
        <div 
          key={el.id} 
          style={{ 
            position: 'absolute', 
            left: el.x, 
            top: el.y, 
            width: el.width, 
            height: el.type === 'text' ? 'auto' : el.height 
          }}
        >
          {el.type === 'text' && (
            <div 
              className="w-full h-full p-2 font-sans leading-tight overflow-hidden"
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
          {el.type === 'logo' && el.url && (
            <div className="w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={el.url} alt="Logo" className="w-full h-full object-contain pointer-events-none" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
