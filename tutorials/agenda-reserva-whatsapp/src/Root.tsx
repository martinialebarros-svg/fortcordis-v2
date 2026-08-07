import {Composition} from 'remotion';
import {CapaTutorial, TutorialReservaWhatsapp} from './TutorialReservaWhatsapp';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TutorialReservaWhatsapp"
        component={TutorialReservaWhatsapp}
        durationInFrames={1830}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="CapaTutorial"
        component={CapaTutorial}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};

