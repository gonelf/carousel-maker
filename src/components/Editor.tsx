"use client";

import React, { useState, useRef, useEffect } from 'react';
import SlideEditor, { SlideData } from './SlideEditor';
import { Download, Plus, Loader2, ImagePlus } from 'lucide-react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import SlideRenderer from './SlideRenderer';

function SlidePreview({ slide, scale = 0.2037 }: { slide: SlideData; scale?: number }) {
  return (
    <div className="relative overflow-hidden" style={{ width: 1080 * scale, height: 1080 * scale }}>
      <SlideRenderer slide={slide} scale={scale} />
    </div>
  );
}

export default function Editor() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [globalLogo, setGlobalLogo] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('Brand Name');
  const [brandHandle, setBrandHandle] = useState('@handle');
  const [zoom, setZoom] = useState(0.5);
  const containerRef = useRef<HTMLElement>(null);

  // Load from cache on mount
  useEffect(() => {
    const saved = localStorage.getItem('carousel-project');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.slides) setSlides(parsed.slides);
        if (parsed.url) setUrl(parsed.url);
        if (parsed.brandName) setBrandName(parsed.brandName);
        if (parsed.brandHandle) setBrandHandle(parsed.brandHandle);
        if (parsed.globalLogo) setGlobalLogo(parsed.globalLogo);
      } catch (e) {
        console.error("Failed to load cache", e);
      }
    }
  }, []);

  // Save to cache on change
  useEffect(() => {
    if (slides.length > 0 || url || globalLogo || brandName !== 'Brand Name' || brandHandle !== '@handle') {
      const data = { slides, url, globalLogo, brandName, brandHandle };
      localStorage.setItem('carousel-project', JSON.stringify(data));
    }
  }, [slides, url, globalLogo, brandName, brandHandle]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // ctrlKey natively triggers on trackpad pinch gestures
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom(prev => {
          const newZoom = prev - (e.deltaY * 0.005);
          return Math.min(Math.max(0.2, newZoom), 2.0);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleGenerate = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (data.slides) {
        const generatedSlides: SlideData[] = data.slides.map((slideObj: { title: string; body: string }, i: number) => {
          const isTitleSlide = i === 0;
          return {
            id: `slide-${i}`,
            text: slideObj.title, // Keep a reference if needed
            bgColor: '#111111',
            textColor: '#ffffff',
            logoUrl: globalLogo,
            elements: [
              ...(isTitleSlide ? [{ 
                id: `swipe-${i}`, type: 'text', content: 'Swipe →', 
                x: 880, y: 940, width: 140, height: 50, 
                fontSize: 24, fontWeight: 'bold', textAlign: 'center',
                color: '#000000', backgroundColor: '#FFD700', borderRadius: 25, padding: 10
              }] : [{
                id: `step-${i}`, type: 'text', content: i.toString(), 
                x: 60, y: 60, width: 80, height: 80, 
                fontSize: 32, fontWeight: 'bold', textAlign: 'center',
                color: '#000000', backgroundColor: '#FFD700', borderRadius: 40, padding: 20
              }]),
              { 
                id: `text-title-${i}`, 
                type: 'text', 
                content: slideObj.title, 
                x: 80, 
                y: isTitleSlide ? 300 : 250, 
                width: 920, 
                height: 250,
                fontSize: isTitleSlide ? 86 : 72,
                fontWeight: 'bold',
                textAlign: 'left'
              },
              { 
                id: `text-body-${i}`, 
                type: 'text', 
                content: slideObj.body, 
                x: 80, 
                y: isTitleSlide ? 580 : 550, 
                width: 920, 
                height: 320,
                fontSize: 38,
                fontWeight: 'normal',
                textAlign: 'left',
                color: '#e5e7eb' // subtle gray from examples
              },
              { id: `brand-name-${i}`, type: 'text', content: brandName, x: 160, y: 920, width: 400, height: 40, fontSize: 32, fontWeight: 'bold', textAlign: 'left' },
              { id: `brand-handle-${i}`, type: 'text', content: brandHandle, x: 160, y: 960, width: 400, height: 40, fontSize: 24, fontWeight: 'normal', textAlign: 'left', color: '#9ca3af' },
              ...(globalLogo ? [{ id: `logo-${i}`, type: 'logo', url: globalLogo, x: 60, y: 920, width: 80, height: 80 }] : [{
                id: `logo-circle-${i}`, type: 'text', content: brandName ? brandName.charAt(0).toUpperCase() : 'Y',
                x: 60, y: 920, width: 80, height: 80,
                fontSize: 36, fontWeight: 'bold', textAlign: 'center',
                color: '#000000', backgroundColor: '#FFD700', borderRadius: 40, padding: 18
              }])
            ]
          };
        });
        setSlides(generatedSlides);
        setActiveSlideIndex(0);
      } else {
        alert(data.error || "Failed to generate slides");
      }
    } catch {
      alert("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const updateActiveSlide = (updated: SlideData) => {
    const newSlides = [...slides];
    newSlides[activeSlideIndex] = updated;
    setSlides(newSlides);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target?.result as string;
        setGlobalLogo(res);
        // Add logo to all slides
        setSlides(prev => prev.map(s => {
          const filteredElements = s.elements.filter(el => !el.id.startsWith('logo-circle-'));
          if (!filteredElements.some(el => el.type === 'logo')) {
             return {
               ...s,
               logoUrl: res,
                elements: [...filteredElements, { id: `logo-${s.id}`, type: 'logo', url: res, x: 60, y: 920, width: 80, height: 80 } as { id: string; type: 'logo'; url: string; x: number; y: number; width: number; height: number }]
             }
          } else {
             return {
               ...s,
               logoUrl: res,
               elements: filteredElements.map(el => el.type === 'logo' ? { ...el, url: res } : el)
             }
          }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const updateGlobalBrandName = (newName: string) => {
    setBrandName(newName);
    setSlides(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => el.id.startsWith('brand-name-') ? { ...el, content: newName } : el)
    })));
  };

  const updateGlobalBrandHandle = (newHandle: string) => {
    setBrandHandle(newHandle);
    setSlides(prev => prev.map(s => ({
      ...s,
      elements: s.elements.map(el => el.id.startsWith('brand-handle-') ? { ...el, content: newHandle } : el)
    })));
  };

  const downloadPDF = async () => {
    if (slides.length === 0) return;
    setLoading(true);
    try {
      // 1080px at 96dpi = 810pt
      const pdf = new jsPDF({ 
        orientation: 'portrait', 
        unit: 'pt', 
        format: [810, 810] 
      });

      for (let i = 0; i < slides.length; i++) {
        const slideId = slides[i].id;
        const slideElement = document.getElementById(`render-slide-${slideId}`);
        if (slideElement) {
          try {
            // small delay to ensure rendering is complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const dataUrl = await htmlToImage.toJpeg(slideElement, {
              width: 1080,
              height: 1080,
              pixelRatio: 2,
              quality: 0.8,
              style: {
                transform: 'none',
                left: '0',
                top: '0',
                position: 'relative'
              },
              backgroundColor: slides[i].bgColor
            });
            
            if (i > 0) pdf.addPage([810, 810], 'portrait');
            pdf.addImage(dataUrl, 'JPEG', 0, 0, 810, 810, undefined, 'FAST');
          } catch (slideErr) {
            console.error(`Error capturing slide ${i} (${slideId}):`, slideErr);
            throw slideErr; // rethrow to catch in main block
          }
        } else {
          console.warn(`Slide element not found: render-slide-${slideId}`);
        }
      }
      pdf.save("carousel.pdf");
    } catch (err) {
      console.error("PDF Export Final Error:", err);
      alert(`Failed to export PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the project? This will clear all slides and settings.")) {
      setSlides([]);
      setUrl('');
      setGlobalLogo(null);
      setBrandName('Brand Name');
      setBrandHandle('@handle');
      setActiveSlideIndex(0);
      localStorage.removeItem('carousel-project');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 text-gray-900">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Carousel Maker</h1>
        <div className="flex flex-1 items-center justify-center max-w-2xl mx-8">
          <input 
            type="url" 
            placeholder="Paste your blog post URL here..." 
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button 
            onClick={handleGenerate} 
            disabled={loading || !url}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-r-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "Generate"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleReset} 
            className="text-gray-500 hover:text-red-600 px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-1"
          >
            Reset
          </button>
          <button onClick={downloadPDF} disabled={slides.length === 0} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" /> Export PDF
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-6 py-2 flex items-center justify-center shadow-sm z-10">
        {slides.length > 0 && (
          <div className="flex items-center gap-x-6 w-full max-w-5xl justify-center">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Bg</span>
              <input 
                type="color" 
                value={slides[activeSlideIndex].bgColor} 
                onChange={(e) => updateActiveSlide({ ...slides[activeSlideIndex], bgColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-none shadow-sm"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Txt</span>
              <input 
                type="color" 
                value={slides[activeSlideIndex].textColor} 
                onChange={(e) => updateActiveSlide({ ...slides[activeSlideIndex], textColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-none shadow-sm"
              />
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={brandName}
                onChange={(e) => updateGlobalBrandName(e.target.value)}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Brand Name"
              />
              <input 
                type="text" 
                value={brandHandle}
                onChange={(e) => updateGlobalBrandHandle(e.target.value)}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="@handle"
              />
            </div>
            <label htmlFor="logo-upload" className="flex items-center gap-1.5 text-[10px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 px-2 py-1.5 rounded border border-gray-200 cursor-pointer transition-colors whitespace-nowrap uppercase tracking-tighter">
              <ImagePlus className="w-3 h-3" /> Logo
            </label>
            <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />

            <div className="h-6 w-px bg-gray-200 mx-1" />

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-gray-500 whitespace-nowrap tracking-tighter">{Math.round(zoom * 100)}%</span>
              <input 
                type="range" 
                min="0.2" max="1.5" step="0.05" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-24 lg:w-32 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <button onClick={() => setZoom(0.5)} className="text-[9px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-tighter">Reset</button>
            </div>
          </div>
        )}
      </div>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar thumbnails */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-4 space-y-4 shadow-inner">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><Plus className="w-4 h-4"/> Slides</h2>
          {slides.map((s, idx) => (
            <div 
              key={s.id} 
              onClick={() => setActiveSlideIndex(idx)}
              className={`relative aspect-square w-full rounded-lg border-2 cursor-pointer transition-all overflow-hidden bg-white
                ${activeSlideIndex === idx ? 'border-blue-600 shadow-md scale-105' : 'border-gray-200 hover:border-gray-400 opacity-70'}
              `}
            >
              <SlidePreview slide={s} scale={(256 - 32 - 4) / 1080} />
            </div>
          ))}
          {slides.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-10">No slides yet. Generate from URL!</div>
          )}
        </aside>

        {/* Main Canvas Area */}
        <section ref={containerRef} className="flex-1 flex flex-col p-6 overflow-y-auto bg-gray-100 items-center bg-dot-pattern">
          {slides.length > 0 ? (
            <div className="flex flex-col items-center w-full">
               
               {/* 540px is half of 1080px (scale 0.5 rendering) */}
               <div className="relative mt-4 ring-1 ring-gray-200 shadow-xl bg-white transition-all overflow-hidden rounded-lg mx-auto" style={{ width: 1080 * zoom, height: 1080 * zoom }}>
                 <SlideEditor slide={slides[activeSlideIndex]} zoom={zoom} onChange={updateActiveSlide} />
               </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
               <div className="text-center">
                 <ImagePlus className="w-16 h-16 mx-auto mb-4 opacity-50" />
                 <p className="text-lg">Paste a URL and generate to see your carousel canvas.</p>
               </div>
            </div>
          )}
        </section>
      </main>

      <div className="fixed -left-[5000px] top-0 -z-50 pointer-events-none overflow-hidden" style={{ width: 1080, height: 1080 }}>
        {slides.map(s => (
          <SlideRenderer key={`render-${s.id}`} slide={s} className="relative" />
        ))}
      </div>
    </div>
  );
}
