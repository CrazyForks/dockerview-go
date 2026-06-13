import React from 'react';

interface SparklineProps {
  data: number[];
  color: string;
  fallbackMax?: number;
}

export function Sparkline({ data, color, fallbackMax = 10 }: SparklineProps) {
  if (!data || data.length < 2) return null;
  const width = 120;
  const height = 20;
  const padding = 1;
  
  const maxVal = Math.max(...data, fallbackMax);
  const minVal = 0;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const range = maxVal - minVal || 1;
    const y = height - padding - (((val - minVal) / range) * (height - 2 * padding));
    return { x, y };
  });
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`;
  
  // Unique gradient ID
  const gradId = React.useId().replace(/:/g, '');

  return (
    <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15}/>
          <stop offset="100%" stopColor={color} stopOpacity={0}/>
        </linearGradient>
      </defs>
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} className="transition-[d] duration-500 ease-in-out" />
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none" className="transition-[d] duration-500 ease-in-out" />
    </svg>
  );
}

export function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!text) return null;
  if (!query) return <span>{text}</span>;
  
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return <span>{text}</span>;
  
  const before = text.substring(0, index);
  const match = text.substring(index, index + query.length);
  const after = text.substring(index + query.length);
  
  return (
    <span>
      {before}
      <mark className="bg-accent-cyan/20 text-accent-cyan rounded px-0.5">{match}</mark>
      {after}
    </span>
  );
}
