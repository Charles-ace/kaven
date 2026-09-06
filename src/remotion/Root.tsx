import React from "react";
import { Composition } from "remotion";
import { LimboTeaser30s } from "./LimboTeaser";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="LimboTeaser"
        component={LimboTeaser30s}
        durationInFrames={900} // 30 seconds at 30 fps
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
