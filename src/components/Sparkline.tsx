'use client';

export default function Sparkline({ 
  data, 
  color = '#3b82f6',
  className,
  strokeWidth = 2,
}: { 
  data: number[];
  color?: string;
  className?: string;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - strokeWidth - ((val - min) / range) * (height - strokeWidth * 2);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `M ${points[0].split(',')[0]},${height} L ${points.join(' L ')} L ${points[points.length - 1].split(',')[0]},${height} Z`;

  // Provide a clean, unique ID for the gradient based on color string
  const gradId = `sparkline-grad-${color.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <svg 
      className={className}
      width="100%" 
      height="100%" 
      viewBox={`0 0 ${width} ${height}`} 
      preserveAspectRatio="none" 
      style={{ overflow: 'visible', display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gradId})`} />
      <path 
        d={pathD} 
        fill="none" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
