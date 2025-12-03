"use client";

export default function PixelFootballPlayer() {
  return (
    <div className="runner-container">
      {/* Animated sprite that runs across screen */}
      <div className="sprite-wrapper">
        <div className="sprite-character"></div>
        <div className="sprite-ball"></div>
      </div>
    </div>
  );
}
