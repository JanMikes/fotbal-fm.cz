"use client";

export default function PixelFootballPlayer() {
  return (
    <div className="pixel-runner-container">
      {/* Animated wrapper that moves across screen */}
      <div className="pixel-player-wrapper">
        {/* Frame 1 - legs apart */}
        <div className="pixel-frame-1"></div>
        {/* Frame 2 - legs together */}
        <div className="pixel-frame-2"></div>
        {/* Ball at feet */}
        <div className="pixel-ball"></div>
      </div>
    </div>
  );
}
