import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button, Spin, Slider } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";

const AudioEditor = () => {
  const location = useLocation();
  const { audioUrl } = location.state || {};
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(10);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeButton, setActiveButton] = useState(null);
  const waveContainerRef = useRef(null);
  const wavesurferRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!audioUrl) {
      console.error("오디오 URL이 유효하지 않습니다.");
      setIsLoading(false);
      return;
    }

    wavesurferRef.current = WaveSurfer.create({
      container: waveContainerRef.current,
      waveColor: "rgb(200, 0, 200)",
      progressColor: "rgb(100, 0, 100)",
      responsive: true,
      url: audioUrl,
      plugins: [RegionsPlugin.create()],
    });

    wavesurferRef.current.on("ready", () => {
      setIsLoading(false);
      const duration = wavesurferRef.current.getDuration();
      setEndTime(duration);
    });

    wavesurferRef.current.on("play", () => setIsPlaying(true));
    wavesurferRef.current.on("pause", () => setIsPlaying(false));

    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
      }
      clearInterval(intervalRef.current);
    };
  }, [audioUrl]);

  const handleWaveformClick = (e) => {
    if (!wavesurferRef.current) return;

    const boundingRect = waveContainerRef.current.getBoundingClientRect();
    const x = e.clientX - boundingRect.left;
    const progress = x / boundingRect.width;
    const clickedTime = progress * wavesurferRef.current.getDuration();

    if (activeButton === "start") {
      setStartTime(clickedTime);
      setActiveButton(null); // 시간 설정 후 비활성화
    } else if (activeButton === "end") {
      setEndTime(clickedTime);
      setActiveButton(null); // 시간 설정 후 비활성화
    }
  };

  const handleZoomChange = (value) => {
    setZoom(value);
    wavesurferRef.current.zoom(value);
  };

  const togglePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const playSegment = () => {
    if (!wavesurferRef.current) return;

    wavesurferRef.current.pause();
    wavesurferRef.current.seekTo(
      startTime / wavesurferRef.current.getDuration()
    );
    wavesurferRef.current.play();

    intervalRef.current = setInterval(() => {
      if (wavesurferRef.current.getCurrentTime() >= endTime) {
        wavesurferRef.current.pause();
        clearInterval(intervalRef.current);
      }
    }, 100);
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Audio Editor</h2>
      <div
        className="w-full mb-4 relative h-[100px]"
        onClick={handleWaveformClick} // 클릭 이벤트 추가
      >
        {isLoading && (
          <div className="absolute inset-0 flex justify-center items-center">
            <Spin />
          </div>
        )}
        <div
          ref={waveContainerRef}
          id="waveform"
          className={isLoading ? "invisible" : "visible"}
        />
      </div>
      <div className="mb-4">
        <Button
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={togglePlayPause}
        >
          {isPlaying ? "Pause" : "Play"}
        </Button>
      </div>
      <div className="mb-4">
        <Button
          onClick={() => setActiveButton("start")}
          type={activeButton === "start" ? "primary" : "default"}
        >
          시작시간 설정 ({startTime.toFixed(2)}초)
        </Button>
        <Button
          onClick={() => setActiveButton("end")}
          type={activeButton === "end" ? "primary" : "default"}
          style={{ marginLeft: 8 }}
        >
          종료시간 설정 ({endTime.toFixed(2)}초)
        </Button>
      </div>
      <div className="mb-4">
        <Button onClick={playSegment} type="primary">
          구간 재생
        </Button>
      </div>
      <div className="mb-4">
        <span>Zoom: </span>
        <Slider
          min={10}
          max={1000}
          value={zoom}
          onChange={handleZoomChange}
          style={{ width: 200, display: "inline-block", marginLeft: 16 }}
        />
      </div>
    </div>
  );
};

export default AudioEditor;
