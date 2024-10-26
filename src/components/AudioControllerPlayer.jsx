// src/components/AudioControllerPlayer.js
import React, {
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";

const AudioControllerPlayer = forwardRef((props, ref) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useImperativeHandle(ref, () => ({
    play() {
      if (audioRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    },
    pause() {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    },
    seekTo(time) {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
      }
    },
    getCurrentTime() {
      return audioRef.current ? audioRef.current.currentTime : 0;
    },
  }));

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div>
      <audio ref={audioRef} controls style={{ width: "100%" }} />
      <button onClick={handlePlayPause}>
        {isPlaying ? "일시정지" : "재생"}
      </button>
    </div>
  );
});

export default AudioControllerPlayer;
