import React, { useEffect, useState, useRef } from "react";
import { Slider, Button, List, message } from "antd";
import {
  PlayCircleFilled,
  PauseCircleFilled,
  StepBackwardOutlined,
  StepForwardOutlined,
  RetweetOutlined,
  SyncOutlined,
  SwapOutlined,
} from "@ant-design/icons";

const AudioPlayer = ({ playlist, autoPlay = true }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState("all");
  const audioRef = useRef(new Audio());

  const playModeIcons = {
    all: <RetweetOutlined />,
    one: <SyncOutlined />,
    shuffle: <SwapOutlined />,
  };

  const playModeTitles = {
    all: "전체 반복",
    one: "한 곡 반복",
    shuffle: "셔플",
  };

  const currentTrack =
    playlist && playlist.length > 0 ? playlist[currentIndex] : null;

  const loadTrack = (track, playImmediately = false) => {
    if (!track) {
      message.error("재생할 트랙이 없습니다.");
      return;
    }

    const audio = audioRef.current;
    audio.src = track.path;
    audio.currentTime = track.startTime || 0;
    audio.load();

    audio.onloadedmetadata = () => {
      const trackDuration =
        (track.endTime || audio.duration) - (track.startTime || 0);
      setDuration(trackDuration > 0 ? trackDuration : audio.duration);
      setCurrentTime(0);

      audio.ontimeupdate = () => {
        const elapsed = audio.currentTime - (track.startTime || 0);
        setCurrentTime(elapsed);
      };

      audio.onended = () => handleNext();

      if (playImmediately) {
        audio.play().catch((error) => {
          console.error("트랙 재생 오류:", error);
          setIsPlaying(false);
          message.error("트랙을 재생하는 중 오류가 발생했습니다.");
        });
      }
    };
  };

  useEffect(() => {
    const audio = audioRef.current;

    if (isPlaying && currentTrack) {
      audio.play().catch((error) => {
        console.error("재생 오류:", error);
        setIsPlaying(false);
        message.error("재생 중 오류가 발생했습니다.");
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!currentTrack) return;
    loadTrack(currentTrack, isPlaying);
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    audio.pause();
    setCurrentTime(0);
    setDuration(0);

    if (playlist && playlist.length > 0) {
      setCurrentIndex(0);
      if (autoPlay) {
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setIsPlaying(false);
    }

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [playlist]);

  const handlePlayPause = () => {
    if (!currentTrack) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }
    setIsPlaying(!isPlaying);
  };

  // 다음 트랙 핸들러
  const handleNext = () => {
    if (!playlist || playlist.length === 0) return;

    const isLastTrack = currentIndex >= playlist.length - 1;

    switch (playMode) {
      case "all":
        if (!isLastTrack) {
          setCurrentIndex(currentIndex + 1);
        } else {
          setCurrentIndex(0); // 전체 반복에서는 마지막 트랙 후 첫 번째 트랙으로 돌아갑니다.
        }
        break;

      case "one":
        // 현재 곡을 다시 로드해서 한 곡 반복
        loadTrack(currentTrack);
        setIsPlaying(true);
        break;

      case "shuffle":
        if (playlist.length > 1) {
          let newIndex = Math.floor(Math.random() * playlist.length);
          while (newIndex === currentIndex) {
            newIndex = Math.floor(Math.random() * playlist.length);
          }
          setCurrentIndex(newIndex);
        } else {
          loadTrack(currentTrack);
          setIsPlaying(true);
        }
        break;

      default:
        message.error("알 수 없는 재생 모드입니다.");
        break;
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    } else {
      message.warning("이전 트랙이 없습니다.");
    }
  };

  const handleSliderChange = (value) => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    audio.currentTime = (currentTrack.startTime || 0) + value;
    setCurrentTime(value);
  };

  const handleChangePlayMode = () => {
    const modes = ["all", "one", "shuffle"];
    const currentModeIndex = modes.indexOf(playMode);
    const nextMode = modes[(currentModeIndex + 1) % modes.length];
    setPlayMode(nextMode);
    message.info(`${playModeTitles[nextMode]} 모드로 변경되었습니다.`);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="audio-player p-4 rounded-lg shadow bg-white">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">
          {currentTrack?.title || "트랙을 선택하세요"}
        </h3>
      </div>

      <div className="flex justify-center gap-4 mb-4">
        <Button
          icon={<StepBackwardOutlined style={{ fontSize: "32px" }} />}
          onClick={handlePrevious}
          size="large"
          style={{ borderRadius: "8px", border: "2px solid #ddd" }}
        />
        <Button
          icon={
            isPlaying ? (
              <PauseCircleFilled style={{ fontSize: "64px" }} />
            ) : (
              <PlayCircleFilled style={{ fontSize: "64px" }} />
            )
          }
          onClick={handlePlayPause}
          size="large"
          type="primary"
          shape="circle"
          style={{ borderRadius: "50%", border: "2px solid #ddd" }}
        />
        <Button
          icon={<StepForwardOutlined style={{ fontSize: "32px" }} />}
          onClick={handleNext}
          size="large"
          style={{ borderRadius: "8px", border: "2px solid #ddd" }}
        />
        <Button
          icon={playModeIcons[playMode]}
          onClick={handleChangePlayMode}
          size="large"
          style={{ borderRadius: "8px", border: "2px solid #ddd" }}
        />
      </div>

      <Slider
        value={currentTime}
        max={duration}
        onChange={handleSliderChange}
        className="mb-4"
      />
      <div className="flex justify-between text-sm">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <List
        size="small"
        dataSource={playlist}
        renderItem={(track, index) => (
          <List.Item
            className={`cursor-pointer ${
              index === currentIndex ? "bg-blue-100" : ""
            }`}
            onClick={() => setCurrentIndex(index)}
            style={{
              padding: "8px 16px",
              borderBottom: "1px solid #f0f0f0",
              backgroundColor: index === currentIndex ? "#e6f7ff" : "white",
            }}
          >
            {index === currentIndex && isPlaying && (
              <PlayCircleFilled className="text-blue-500 mr-2" />
            )}
            {track.title}
          </List.Item>
        )}
      />
    </div>
  );
};

export default AudioPlayer;
