import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'iPostal1 InsightHub — AI-Powered Dashboard Builder';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0e14 0%, #161b22 40%, #0d1117 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow effects */}
        <div
          style={{
            position: 'absolute',
            top: '-20%',
            left: '10%',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(88,166,255,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-10%',
            right: '15%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(188,140,255,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Sparkle icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'rgba(88,166,255,0.15)',
            marginBottom: '24px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '52px',
            fontWeight: 800,
            color: '#e6edf3',
            letterSpacing: '-1px',
            marginBottom: '12px',
            display: 'flex',
          }}
        >
          iPostal1 InsightHub
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '24px',
            fontWeight: 400,
            color: '#8b949e',
            marginBottom: '40px',
            display: 'flex',
          }}
        >
          AI-Powered Dashboard Builder
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { label: 'Natural Language', color: '#58a6ff' },
            { label: 'Live Charts', color: '#3fb950' },
            { label: 'Templates', color: '#bc8cff' },
            { label: 'Instant Deploy', color: '#39d2c0' },
          ].map((pill) => (
            <div
              key={pill.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 20px',
                borderRadius: '9999px',
                background: `${pill.color}15`,
                border: `1px solid ${pill.color}30`,
                fontSize: '16px',
                fontWeight: 600,
                color: pill.color,
              }}
            >
              {pill.label}
            </div>
          ))}
        </div>

        {/* Bottom URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            fontSize: '16px',
            color: '#484f58',
            display: 'flex',
          }}
        >
          dashboards.jeffcoy.net
        </div>
      </div>
    ),
    { ...size }
  );
}
