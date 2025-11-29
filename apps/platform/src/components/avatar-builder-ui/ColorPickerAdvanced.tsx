/**
 * ColorPickerAdvanced - HSL Color Wheel with material editing
 * 
 * Features:
 * - Interactive HSL color wheel (hue ring + SL square)
 * - Material tabs (skin, hair, outfit, accessories)
 * - Recent colors history
 * - Preset palettes
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { COLOR_PRESETS, SKIN_TONE_PRESETS, type ColorPreset } from './types';

export type MaterialCategory = 'skin' | 'hair' | 'outfit' | 'accessories';

export interface ColorPickerAdvancedProps {
  /** Current color as RGBA [0-1] */
  color: [number, number, number, number];
  /** Called when color changes */
  onChange: (color: [number, number, number, number]) => void;
  /** Current material category */
  activeCategory?: MaterialCategory;
  /** Called when category changes */
  onCategoryChange?: (category: MaterialCategory) => void;
  /** Optional title */
  title?: string;
  /** Whether to show material tabs */
  showMaterialTabs?: boolean;
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

// Color conversion utilities
function rgbToHsl(r: number, g: number, b: number): HSL {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      break;
    case g:
      h = ((b - r) / d + 2) / 6;
      break;
    case b:
      h = ((r - g) / d + 4) / 6;
      break;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  if (s === 0) {
    return [l, l, l];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ];
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${a < 1 ? toHex(a) : ''}`;
}

function hexToRgba(hex: string): [number, number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  if (!result) return [0, 0, 0, 1];
  return [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255,
    result[4] ? parseInt(result[4], 16) / 255 : 1,
  ];
}

const MATERIAL_TABS: { id: MaterialCategory; label: string; icon: string }[] = [
  { id: 'skin', label: 'Skin', icon: '👤' },
  { id: 'hair', label: 'Hair', icon: '💇' },
  { id: 'outfit', label: 'Outfit', icon: '👕' },
  { id: 'accessories', label: 'Gear', icon: '🎒' },
];

const MAX_RECENT_COLORS = 8;

/**
 * Advanced color picker with HSL wheel
 */
export const ColorPickerAdvanced = memo(function ColorPickerAdvanced({
  color,
  onChange,
  activeCategory = 'skin',
  onCategoryChange,
  title = 'Color',
  showMaterialTabs = true,
}: ColorPickerAdvancedProps) {
  // Convert RGBA to HSL
  const hsl = rgbToHsl(color[0], color[1], color[2]);
  const [localHsl, setLocalHsl] = useState<HSL>(hsl);
  const [recentColors, setRecentColors] = useState<[number, number, number, number][]>([]);
  
  // Refs for canvas
  const hueWheelRef = useRef<HTMLCanvasElement>(null);
  const slSquareRef = useRef<HTMLCanvasElement>(null);
  
  // Update local HSL when color prop changes
  useEffect(() => {
    const newHsl = rgbToHsl(color[0], color[1], color[2]);
    setLocalHsl(newHsl);
  }, [color[0], color[1], color[2]]);

  // Draw hue wheel
  useEffect(() => {
    const canvas = hueWheelRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const centerX = size / 2;
    const centerY = size / 2;
    const outerRadius = size / 2 - 2;
    const innerRadius = outerRadius - 20;

    ctx.clearRect(0, 0, size, size);

    // Draw hue ring
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = (angle + 1) * Math.PI / 180;

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();

      const [r, g, b] = hslToRgb(angle, 100, 50);
      ctx.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
      ctx.fill();
    }

    // Draw hue indicator
    const indicatorAngle = (localHsl.h - 90) * Math.PI / 180;
    const indicatorRadius = (outerRadius + innerRadius) / 2;
    const indicatorX = centerX + Math.cos(indicatorAngle) * indicatorRadius;
    const indicatorY = centerY + Math.sin(indicatorAngle) * indicatorRadius;

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [localHsl.h]);

  // Draw SL square
  useEffect(() => {
    const canvas = slSquareRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;

    // Create gradient for saturation (left to right)
    const satGradient = ctx.createLinearGradient(0, 0, size, 0);
    satGradient.addColorStop(0, '#808080');
    const [r, g, b] = hslToRgb(localHsl.h, 100, 50);
    satGradient.addColorStop(1, `rgb(${r * 255}, ${g * 255}, ${b * 255})`);

    ctx.fillStyle = satGradient;
    ctx.fillRect(0, 0, size, size);

    // Create gradient for lightness (top to bottom)
    const lightGradient = ctx.createLinearGradient(0, 0, 0, size);
    lightGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    lightGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    lightGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    lightGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

    ctx.fillStyle = lightGradient;
    ctx.fillRect(0, 0, size, size);

    // Draw SL indicator
    const indicatorX = (localHsl.s / 100) * size;
    const indicatorY = (1 - localHsl.l / 100) * size;

    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [localHsl]);

  // Handle hue wheel interaction
  const handleHueWheelInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueWheelRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;
    
    let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
    if (angle < 0) angle += 360;

    const newHsl = { ...localHsl, h: angle };
    setLocalHsl(newHsl);
    
    const [r, g, b] = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    onChange([r, g, b, color[3]]);
  }, [localHsl, color, onChange]);

  // Handle SL square interaction
  const handleSlSquareInteraction = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = slSquareRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

    const s = (x / canvas.width) * 100;
    const l = (1 - y / canvas.height) * 100;

    const newHsl = { ...localHsl, s, l };
    setLocalHsl(newHsl);
    
    const [r, g, b] = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
    onChange([r, g, b, color[3]]);
  }, [localHsl, color, onChange]);

  // Handle drag on canvases
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingSl, setIsDraggingSl] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      if (isDraggingHue || isDraggingSl) {
        // Add to recent colors
        setRecentColors((prev) => {
          const newRecent = [[...color] as [number, number, number, number], ...prev];
          return newRecent.slice(0, MAX_RECENT_COLORS);
        });
      }
      setIsDraggingHue(false);
      setIsDraggingSl(false);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingHue && hueWheelRef.current) {
        const rect = hueWheelRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left - hueWheelRef.current.width / 2;
        const y = e.clientY - rect.top - hueWheelRef.current.height / 2;
        
        let angle = Math.atan2(y, x) * 180 / Math.PI + 90;
        if (angle < 0) angle += 360;

        const newHsl = { ...localHsl, h: angle };
        setLocalHsl(newHsl);
        
        const [r, g, b] = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
        onChange([r, g, b, color[3]]);
      }

      if (isDraggingSl && slSquareRef.current) {
        const rect = slSquareRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(slSquareRef.current.width, e.clientX - rect.left));
        const y = Math.max(0, Math.min(slSquareRef.current.height, e.clientY - rect.top));

        const s = (x / slSquareRef.current.width) * 100;
        const l = (1 - y / slSquareRef.current.height) * 100;

        const newHsl = { ...localHsl, s, l };
        setLocalHsl(newHsl);
        
        const [r, g, b] = hslToRgb(newHsl.h, newHsl.s, newHsl.l);
        onChange([r, g, b, color[3]]);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDraggingHue, isDraggingSl, localHsl, color, onChange]);

  // Handle preset click
  const handlePresetClick = useCallback((preset: ColorPreset) => {
    onChange(preset.color);
    setRecentColors((prev) => {
      const newRecent = [[...preset.color] as [number, number, number, number], ...prev];
      return newRecent.slice(0, MAX_RECENT_COLORS);
    });
  }, [onChange]);

  // Handle hex input
  const [hexInput, setHexInput] = useState(rgbaToHex(color[0], color[1], color[2], color[3]));

  useEffect(() => {
    setHexInput(rgbaToHex(color[0], color[1], color[2], color[3]));
  }, [color]);

  const handleHexChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHexInput(value);
    
    if (/^#?[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value)) {
      const rgba = hexToRgba(value);
      onChange(rgba);
    }
  }, [onChange]);

  // Get presets based on category
  const presets = activeCategory === 'skin' ? SKIN_TONE_PRESETS : COLOR_PRESETS;

  return (
    <div className="color-picker-advanced">
      {/* Header */}
      <div className="color-picker-advanced__header">
        <span className="color-picker-advanced__title">{title}</span>
        <div 
          className="color-picker-advanced__preview"
          style={{ 
            backgroundColor: `rgba(${color[0] * 255}, ${color[1] * 255}, ${color[2] * 255}, ${color[3]})` 
          }}
        />
      </div>

      {/* Material tabs */}
      {showMaterialTabs && (
        <div className="color-picker-advanced__tabs">
          {MATERIAL_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`color-picker-advanced__tab ${activeCategory === tab.id ? 'color-picker-advanced__tab--active' : ''}`}
              onClick={() => onCategoryChange?.(tab.id)}
              title={tab.label}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Color wheel section */}
      <div className="color-picker-advanced__wheel-section">
        {/* Hue wheel */}
        <div className="color-picker-advanced__hue-wheel">
          <canvas
            ref={hueWheelRef}
            width={140}
            height={140}
            onMouseDown={(e) => {
              setIsDraggingHue(true);
              handleHueWheelInteraction(e);
            }}
          />
          {/* SL square inside the wheel */}
          <div className="color-picker-advanced__sl-container">
            <canvas
              ref={slSquareRef}
              width={80}
              height={80}
              onMouseDown={(e) => {
                setIsDraggingSl(true);
                handleSlSquareInteraction(e);
              }}
            />
          </div>
        </div>
      </div>

      {/* HSL sliders */}
      <div className="color-picker-advanced__sliders">
        <div className="color-picker-advanced__slider-row">
          <label>H</label>
          <input
            type="range"
            min="0"
            max="360"
            value={localHsl.h}
            onChange={(e) => {
              const h = Number(e.target.value);
              const newHsl = { ...localHsl, h };
              setLocalHsl(newHsl);
              const [r, g, b] = hslToRgb(h, newHsl.s, newHsl.l);
              onChange([r, g, b, color[3]]);
            }}
            className="color-picker-advanced__slider color-picker-advanced__slider--hue"
          />
          <span>{Math.round(localHsl.h)}°</span>
        </div>
        <div className="color-picker-advanced__slider-row">
          <label>S</label>
          <input
            type="range"
            min="0"
            max="100"
            value={localHsl.s}
            onChange={(e) => {
              const s = Number(e.target.value);
              const newHsl = { ...localHsl, s };
              setLocalHsl(newHsl);
              const [r, g, b] = hslToRgb(newHsl.h, s, newHsl.l);
              onChange([r, g, b, color[3]]);
            }}
            className="color-picker-advanced__slider"
          />
          <span>{Math.round(localHsl.s)}%</span>
        </div>
        <div className="color-picker-advanced__slider-row">
          <label>L</label>
          <input
            type="range"
            min="0"
            max="100"
            value={localHsl.l}
            onChange={(e) => {
              const l = Number(e.target.value);
              const newHsl = { ...localHsl, l };
              setLocalHsl(newHsl);
              const [r, g, b] = hslToRgb(newHsl.h, newHsl.s, l);
              onChange([r, g, b, color[3]]);
            }}
            className="color-picker-advanced__slider"
          />
          <span>{Math.round(localHsl.l)}%</span>
        </div>
      </div>

      {/* Hex input */}
      <div className="color-picker-advanced__hex">
        <label>Hex</label>
        <input
          type="text"
          value={hexInput}
          onChange={handleHexChange}
          className="color-picker-advanced__hex-input"
          placeholder="#RRGGBB"
        />
      </div>

      {/* Presets */}
      <div className="color-picker-advanced__presets">
        <span className="color-picker-advanced__presets-label">
          {activeCategory === 'skin' ? 'Skin Tones' : 'Color Presets'}
        </span>
        <div className="color-picker-advanced__presets-grid">
          {presets.map((preset) => (
            <button
              key={preset.id}
              className="color-picker-advanced__preset"
              style={{
                backgroundColor: `rgba(${preset.color[0] * 255}, ${preset.color[1] * 255}, ${preset.color[2] * 255}, ${preset.color[3]})`,
              }}
              onClick={() => handlePresetClick(preset)}
              title={preset.name}
            />
          ))}
        </div>
      </div>

      {/* Recent colors */}
      {recentColors.length > 0 && (
        <div className="color-picker-advanced__recent">
          <span className="color-picker-advanced__presets-label">Recent</span>
          <div className="color-picker-advanced__presets-grid">
            {recentColors.map((recentColor, index) => (
              <button
                key={index}
                className="color-picker-advanced__preset"
                style={{
                  backgroundColor: `rgba(${recentColor[0] * 255}, ${recentColor[1] * 255}, ${recentColor[2] * 255}, ${recentColor[3]})`,
                }}
                onClick={() => onChange(recentColor)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

