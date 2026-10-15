type IdeaStartupProps = {
  variant: 'desktop' | 'mobile'
}

const meshCurves = [
  'M430 82C600 98 624 302 845 516',
  'M470 66C622 118 665 310 890 492',
  'M520 54C665 137 708 315 930 456',
  'M576 50C711 158 752 316 956 410',
  'M632 62C758 183 790 312 970 358',
  'M676 88C798 211 818 299 966 304',
  'M708 124C827 235 835 280 942 251',
  'M725 170C840 250 838 255 900 208',
]

const meshRibs = [
  'M435 85C540 176 623 238 725 170',
  'M452 132C570 212 658 271 790 139',
  'M477 184C612 250 707 301 849 119',
  'M510 244C655 290 749 330 895 125',
  'M552 309C697 328 788 356 927 154',
  'M600 373C737 365 824 380 944 201',
  'M654 431C776 401 853 402 948 267',
  'M715 480C817 431 881 422 934 342',
]

function SplashArtwork({ variant }: IdeaStartupProps) {
  const isDesktop = variant === 'desktop'
  const x = isDesktop ? 698 : 286
  const y = isDesktop ? 381 : 853
  const width = isDesktop ? 351 : 356
  const height = isDesktop ? 211 : 209
  const titleX = isDesktop ? 66 : 500
  const metaX = isDesktop ? 70 : 500
  const markX = isDesktop ? 70 : 300
  const studioX = isDesktop ? 163 : 398
  const statusX = isDesktop ? 70 : 300
  const progressX = isDesktop ? 70 : 300
  const progressWidth = isDesktop ? 860 : 400
  const screenPath = isDesktop
    ? 'M713 381H1043L1049 592H698L707 391Q708 381 713 381Z'
    : 'M296 853H632Q639 853 640 862L642 1062H286L292 863Q293 853 296 853Z'
  const suffix = isDesktop ? 'desktop' : 'mobile'

  return (
    <svg
      className={`idea-startup idea-startup--${variant}`}
      viewBox={isDesktop ? '0 0 1672 941' : '0 0 941 1672'}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`idea-screen-${suffix}`}>
          <path d={screenPath} />
        </clipPath>
        <linearGradient id={`idea-spectrum-${suffix}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#3155ff" />
          <stop offset="0.48" stopColor="#8744ff" />
          <stop offset="1" stopColor="#ff2b91" />
        </linearGradient>
        <radialGradient id={`idea-glow-${suffix}`} cx="65%" cy="48%" r="54%">
          <stop offset="0" stopColor="#7356ff" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#cc2fd2" stopOpacity="0.13" />
          <stop offset="1" stopColor="#020207" stopOpacity="0" />
        </radialGradient>
        <filter id={`idea-blur-${suffix}`} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="15" />
        </filter>
      </defs>

      <g clipPath={`url(#idea-screen-${suffix})`}>
        <svg x={x} y={y} width={width} height={height} viewBox="0 0 1000 600" preserveAspectRatio="none">
          <rect width="1000" height="600" fill="#020207" />
          <ellipse
            cx="696"
            cy="286"
            rx="330"
            ry="250"
            fill={`url(#idea-glow-${suffix})`}
            filter={`url(#idea-blur-${suffix})`}
          />

          <g className="idea-mesh" fill="none" stroke={`url(#idea-spectrum-${suffix})`}>
            <path className="idea-mesh__spine" d="M401 105C559 36 672 167 724 297C770 411 851 443 970 410" />
            {meshCurves.map((curve) => <path d={curve} key={curve} />)}
            {meshRibs.map((rib) => <path d={rib} key={rib} />)}
          </g>

          <g className="idea-brand-lockup">
            <text
              className="idea-title"
              x={titleX}
              y="146"
              textAnchor={isDesktop ? 'start' : 'middle'}
            >
              IntelliJ IDEA
            </text>
            <text
              className="idea-edition"
              x={metaX}
              y="187"
              textAnchor={isDesktop ? 'start' : 'middle'}
            >
              JAVA WORKSPACE
            </text>
          </g>

          <g className="idea-mark" transform={`translate(${markX} 330)`}>
            <rect width="72" height="72" rx="15" fill={`url(#idea-spectrum-${suffix})`} />
            <rect x="12" y="12" width="48" height="48" rx="5" fill="#08080d" />
            <text x="22" y="45">IJ</text>
            <path d="M20 52h21" />
          </g>
          <text className="idea-studio" x={studioX} y="373">Eason.dev</text>

          <g className="idea-status-copy">
            <text className="idea-status idea-status--one" x={statusX} y="480">Preparing workspace</text>
            <text className="idea-status idea-status--two" x={statusX} y="480">Loading Java services</text>
            <text className="idea-status idea-status--three" x={statusX} y="480">Opening Projects</text>
          </g>

          <rect className="idea-progress-track" x={progressX} y="510" width={progressWidth} height="9" rx="4.5" />
          <rect className="idea-progress-fill" x={progressX} y="510" width={progressWidth} height="9" rx="4.5" />
        </svg>
      </g>
    </svg>
  )
}

export function IdeaStartup() {
  return (
    <div className="idea-startup-layer">
      <SplashArtwork variant="desktop" />
      <SplashArtwork variant="mobile" />
    </div>
  )
}
