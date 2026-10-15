export function AmbientLayer() {
  return (
    <svg
      className="scene-layer ambient-layer"
      data-scene-layer="phase-2-1-ambient"
      data-depth="near"
      viewBox="0 0 1672 941"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id="monitor-screen-clip">
          <path d="M713 381H1043L1049 592H698L707 391Q708 381 713 381Z" />
        </clipPath>
        <linearGradient id="monitor-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#78b6c8" stopOpacity="0" />
          <stop offset="0.52" stopColor="#78b6c8" stopOpacity="0.12" />
          <stop offset="1" stopColor="#78b6c8" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g
        className="ambient-monitor"
        clipPath="url(#monitor-screen-clip)"
        data-ambient="monitor-screen"
      >
        <path
          className="monitor-sheen"
          d="M690 602L790 370H841L741 602Z"
          fill="url(#monitor-sheen)"
        />
        <rect className="monitor-caret" x="930" y="536" width="1.35" height="6.5" rx="0.45" />
      </g>
    </svg>
  )
}
