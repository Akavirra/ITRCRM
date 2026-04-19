import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};
export const contentType = 'image/png';
export const runtime = 'edge';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          borderRadius: '90px',
        }}
      >
        <div
          style={{
            fontSize: '220px',
            fontWeight: 900,
            color: '#1565c0',
            letterSpacing: '-0.03em',
            fontFamily: 'sans-serif',
          }}
        >
          IT
        </div>
      </div>
    ),
    { ...size }
  );
}
