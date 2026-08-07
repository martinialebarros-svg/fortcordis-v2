import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Inter';

const {fontFamily} = loadFont('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

const colors = {
  ink: '#07151d',
  navy: '#0b2230',
  cyan: '#22d3ee',
  mint: '#34d399',
  white: '#f8fafc',
  muted: '#b6ced8',
  amber: '#fbbf24',
};

type TutorialSceneProps = {
  image: string;
  step: number;
  title: string;
  caption: string;
  start: number;
  duration: number;
  focusX: number;
  focusY: number;
  badge?: string;
  framed?: boolean;
  redactions?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  }>;
};

const Logo: React.FC<{width?: number}> = ({width = 360}) => (
  <Img src={staticFile('brand/fortcordis-logo.svg')} style={{width, height: 'auto'}} />
);

const Background: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(circle at 78% 18%, rgba(34,211,238,.22), transparent 30%), radial-gradient(circle at 15% 85%, rgba(52,211,153,.18), transparent 34%), linear-gradient(140deg, #061018 0%, #0b2230 55%, #07151d 100%)',
    }}
  />
);

const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 14, stiffness: 110}});
  const opacity = interpolate(frame, [0, 12, 78, 90], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{fontFamily, color: colors.white, opacity}}>
      <Background />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            transform: `translateY(${interpolate(rise, [0, 1], [38, 0])}px)`,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 26,
          }}
        >
          <Logo width={420} />
          <div
            style={{
              border: '1px solid rgba(34,211,238,.5)',
              background: 'rgba(8,29,40,.72)',
              borderRadius: 999,
              padding: '10px 22px',
              fontSize: 23,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            TUTORIAL RÁPIDO • AGENDA
          </div>
          <div style={{fontSize: 46, lineHeight: 1.08, fontWeight: 800, maxWidth: 900}}>
            Como criar uma reserva e enviar pelo WhatsApp
          </div>
          <div style={{fontSize: 23, color: colors.muted}}>Em aproximadamente 1 minuto</div>
          <div style={{fontSize: 16, color: '#86a8b7'}}>Narração gerada por inteligência artificial</div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const CursorPulse: React.FC<{x: number; y: number}> = ({x, y}) => {
  const frame = useCurrentFrame();
  const pulse = (Math.sin(frame / 5) + 1) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 24,
        top: y - 24,
        width: 48,
        height: 48,
        borderRadius: 999,
        border: `5px solid rgba(251,191,36,${0.65 + pulse * 0.35})`,
        boxShadow: `0 0 0 ${8 + pulse * 10}px rgba(251,191,36,${0.2 - pulse * 0.1})`,
      }}
    />
  );
};

const TutorialScene: React.FC<TutorialSceneProps> = ({
  image,
  step,
  title,
  caption,
  start,
  duration,
  focusX,
  focusY,
  badge,
  framed = false,
  redactions = [],
}) => {
  const localFrame = useCurrentFrame();
  const reveal = spring({frame: localFrame, fps: 30, config: {damping: 18, stiffness: 100}});
  const fade = interpolate(localFrame, [0, 12, duration - 14, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const zoom = interpolate(localFrame, [0, duration], [1, 1.035], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const frameScale = framed ? 0.88 : 1;
  const frameLeft = framed ? 110 : 0;
  const frameTop = framed ? 43 : 0;
  const visibleFocusX = frameLeft + focusX * frameScale;
  const visibleFocusY = frameTop + focusY * frameScale;

  return (
    <AbsoluteFill style={{fontFamily, backgroundColor: colors.ink, opacity: fade, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: frameLeft,
          top: frameTop,
          width: 1280 * frameScale,
          height: 720 * frameScale,
          overflow: 'hidden',
          borderRadius: framed ? 22 : 0,
          boxShadow: framed ? '0 22px 62px rgba(0,0,0,.45)' : 'none',
        }}
      >
        <Img
          src={staticFile(`captures/${image}`)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoom})`,
            transformOrigin: `${focusX}px ${focusY}px`,
          }}
        />
      </div>

      {redactions.map((redaction) => (
        <div
          key={`${redaction.x}-${redaction.y}`}
          style={{
            position: 'absolute',
            left: redaction.x,
            top: redaction.y,
            width: redaction.width,
            height: redaction.height,
            borderRadius: 7,
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {redaction.label}
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          inset: '0 auto 0 0',
          width: 272,
          background: 'linear-gradient(180deg, rgba(6,16,24,.98), rgba(11,34,48,.98))',
          borderRight: '2px solid rgba(34,211,238,.38)',
          boxShadow: '20px 0 42px rgba(0,0,0,.32)',
          padding: '34px 25px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateX(${interpolate(reveal, [0, 1], [-280, 0])}px)`,
        }}
      >
        <Logo width={220} />
        <div
          style={{
            marginTop: 58,
            width: 58,
            height: 58,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #22d3ee, #34d399)',
            color: colors.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          {step}
        </div>
        <div style={{marginTop: 22, fontSize: 28, lineHeight: 1.08, fontWeight: 800, color: colors.white}}>
          {title}
        </div>
        <div style={{marginTop: 18, fontSize: 20, lineHeight: 1.35, fontWeight: 500, color: colors.muted}}>
          {caption}
        </div>
        {badge ? (
          <div
            style={{
              marginTop: 'auto',
              padding: '12px 14px',
              borderRadius: 14,
              background: 'rgba(251,191,36,.12)',
              border: '1px solid rgba(251,191,36,.55)',
              color: '#fde68a',
              fontSize: 17,
              lineHeight: 1.3,
              fontWeight: 700,
            }}
          >
            {badge}
          </div>
        ) : null}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 272,
          right: 0,
          bottom: 0,
          height: 12,
          background: 'rgba(15,23,42,.35)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(0, Math.min(100, (localFrame / duration) * 100))}%`,
            background: 'linear-gradient(90deg, #22d3ee, #34d399)',
          }}
        />
      </div>
      <CursorPulse x={visibleFocusX} y={visibleFocusY} />
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const fade = interpolate(local, [0, 14, 220, 240], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{fontFamily, color: colors.white, opacity: fade}}>
      <Background />
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
        <Logo width={410} />
        <div style={{fontSize: 44, fontWeight: 800, marginTop: 38}}>Reserva criada. Mensagem pronta.</div>
        <div style={{fontSize: 26, color: colors.muted, marginTop: 20, maxWidth: 860, lineHeight: 1.3}}>
          Sem confirmação no prazo, o horário volta a ficar disponível automaticamente.
        </div>
        <div
          style={{
            marginTop: 38,
            display: 'inline-flex',
            gap: 12,
            alignItems: 'center',
            padding: '14px 22px',
            borderRadius: 999,
            background: 'rgba(52,211,153,.15)',
            border: '1px solid rgba(52,211,153,.5)',
            color: '#a7f3d0',
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          ✓ Pronto para usar na rotina da secretaria
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const scenes: TutorialSceneProps[] = [
  {
    image: '01-agenda.png',
    step: 1,
    title: 'Abra um novo agendamento',
    caption: 'Na Agenda, clique em “Novo Agendamento”.',
    start: 90,
    duration: 240,
    focusX: 1137,
    focusY: 156,
  },
  {
    image: '02-dados.png',
    step: 2,
    title: 'Preencha os dados do horário',
    caption: 'Informe data, hora, clínica e tipo de atendimento.',
    start: 330,
    duration: 300,
    focusX: 650,
    focusY: 468,
    framed: true,
  },
  {
    image: '03-reserva.png',
    step: 3,
    title: 'Marque como reserva',
    caption: 'O prazo de confirmação já vem preenchido com 3 horas.',
    start: 630,
    duration: 330,
    focusX: 410,
    focusY: 400,
    badge: 'Sem confirmação, o slot será liberado automaticamente.',
    framed: true,
  },
  {
    image: '04-destino.png',
    step: 4,
    title: 'Escolha quem receberá',
    caption: 'Selecione clínica ou tutor e confira o número do WhatsApp.',
    start: 960,
    duration: 300,
    focusX: 700,
    focusY: 190,
    framed: true,
    redactions: [{x: 515, y: 337, width: 182, height: 25, label: 'número cadastrado'}],
  },
  {
    image: '05-mensagem.png',
    step: 5,
    title: 'Envie a mensagem',
    caption: 'Confira o texto e abra o WhatsApp. O envio continua manual.',
    start: 1260,
    duration: 330,
    focusX: 873,
    focusY: 665,
    badge: 'Nunca envie sem conferir o destinatário.',
    framed: true,
    redactions: [{x: 395, y: 181, width: 126, height: 24, label: 'WhatsApp'}],
  },
];

const narrationTracks = [
  {file: '00-intro.mp3', start: 0, duration: 90},
  {file: '01-agenda.mp3', start: 90, duration: 240},
  {file: '02-dados.mp3', start: 330, duration: 300},
  {file: '03-reserva.mp3', start: 630, duration: 330},
  {file: '04-destino.mp3', start: 960, duration: 300},
  {file: '05-mensagem.mp3', start: 1260, duration: 330},
  {file: '06-final.mp3', start: 1590, duration: 240},
];

export const TutorialReservaWhatsapp: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: colors.ink}}>
    <Sequence from={0} durationInFrames={90}>
      <Intro />
    </Sequence>
    {scenes.map((scene) => (
      <Sequence key={scene.step} from={scene.start} durationInFrames={scene.duration}>
        <TutorialScene {...scene} />
      </Sequence>
    ))}
    <Sequence from={1590} durationInFrames={240}>
      <Outro />
    </Sequence>
    {narrationTracks.map((track) => (
      <Sequence key={track.file} from={track.start} durationInFrames={track.duration}>
        <Audio src={staticFile(`audio/${track.file}`)} volume={0.95} />
      </Sequence>
    ))}
  </AbsoluteFill>
);

export const CapaTutorial: React.FC = () => (
  <AbsoluteFill style={{fontFamily, color: colors.white}}>
    <Background />
    <div
      style={{
        position: 'absolute',
        inset: 36,
        borderRadius: 34,
        border: '2px solid rgba(34,211,238,.36)',
        background: 'rgba(6,16,24,.44)',
        display: 'flex',
        alignItems: 'center',
        padding: '64px 72px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{maxWidth: 820}}>
        <Logo width={420} />
        <div style={{fontSize: 58, lineHeight: 1.03, fontWeight: 800, marginTop: 48}}>
          Como criar uma reserva e enviar pelo WhatsApp
        </div>
        <div style={{fontSize: 25, color: colors.muted, marginTop: 28}}>Tutorial rápido para a secretaria</div>
      </div>
      <div
        style={{
          marginLeft: 'auto',
          width: 190,
          height: 190,
          borderRadius: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 100,
          background: 'linear-gradient(135deg, rgba(34,211,238,.25), rgba(52,211,153,.25))',
          border: '2px solid rgba(167,243,208,.35)',
        }}
      >
        🐶
      </div>
    </div>
  </AbsoluteFill>
);
