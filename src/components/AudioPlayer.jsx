// src/components/AudioPlayer.jsx
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

const AudioPlayer = ({
  playlist,
  autoPlay = true,
  forceIndex = 0,
  forceStartTime = 0,
  onPlaylistChange, // 부모 컴포넌트로 현재 상태를 전달하는 콜백
}) => {
  const [localPlaylist, setLocalPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(forceIndex);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playMode, setPlayMode] = useState("all");
  const audioRef = useRef(new Audio());

  // 중복 호출 방지를 위한 플래그
  const nextTrackTriggeredRef = useRef(false);

  // duration 값을 즉시 접근 가능하도록 useRef 사용
  const durationRef = useRef(0);

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
    localPlaylist && localPlaylist.length > 0
      ? localPlaylist[currentIndex]
      : null;

  const loadTrack = (track, playImmediately = false, startTime = 0) => {
    if (!track) {
      console.error("재생할 트랙이 없습니다.");
      message.error("재생할 트랙이 없습니다.");
      return;
    }

    const audio = audioRef.current;
    nextTrackTriggeredRef.current = false;

    audio.src = track.path;
    audio.currentTime = track.startTime + startTime || 0;

    audio.onloadedmetadata = () => {
      const trackDuration = track.playingTime
        ? parseFloat(track.playingTime)
        : track.endTime
        ? track.endTime - (track.startTime || 0)
        : audio.duration;

      setDuration(trackDuration > 0 ? trackDuration : audio.duration);
      durationRef.current = trackDuration > 0 ? trackDuration : audio.duration;
      setCurrentTime(startTime);

      audio.ontimeupdate = () => {
        const elapsed = audio.currentTime - (track.startTime || 0);
        setCurrentTime(elapsed);

        if (
          !nextTrackTriggeredRef.current &&
          elapsed >= durationRef.current - 0.5
        ) {
          nextTrackTriggeredRef.current = true;
          handleNext();
        }
      };

      audio.onended = () => {
        if (!nextTrackTriggeredRef.current) {
          handleNext();
        }
      };

      if (playImmediately) {
        audio.play().catch((error) => {
          console.error("트랙 재생 오류:", error);
          setIsPlaying(false);
          message.error("트랙을 재생하는 중 오류가 발생했습니다.");
        });
      }
    };

    audio.onerror = (e) => {
      console.error(`Error loading track "${track.title}":`, e);
      message.error(`트랙 로딩 중 오류가 발생했습니다: ${track.title}`);
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
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;
    loadTrack(currentTrack, isPlaying, forceStartTime);
  }, [currentTrack, forceStartTime]);

  useEffect(() => {
    const audio = audioRef.current;

    const isPlaylistChanged = playlist !== localPlaylist;

    // 이전 상태를 부모에게 전달
    if (isPlaylistChanged && onPlaylistChange && currentTrack) {
      const playbackInfo = {
        currentPlaylistId: localPlaylist?.id || null,
        currentTrackId: localPlaylist[currentIndex]?.id || null,
        currentTrackTitle: localPlaylist[currentIndex]?.title || "",
        currentTime: currentTime,
        currentIndex,
      };
      console.log(
        "Sending playback info to parent before playlist change:",
        playbackInfo
      );
      onPlaylistChange(playbackInfo);
    }

    // 새로운 playlist를 로컬로 저장
    if (isPlaylistChanged) {
      setLocalPlaylist(playlist);
    }

    audio.pause();
    setCurrentTime(0);
    setDuration(0);
    durationRef.current = 0;

    setTimeout(() => {
      if (playlist && playlist.length > 0) {
        setCurrentIndex(forceIndex);
        if (autoPlay) {
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    }, 500);

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [playlist, forceIndex]);

  const handlePlayPause = () => {
    if (!currentTrack) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }
    setIsPlaying(!isPlaying);
  };

  const handleNext = () => {
    if (!localPlaylist || localPlaylist.length === 0) return;

    const isLastTrack = currentIndex >= localPlaylist.length - 1;

    switch (playMode) {
      case "all":
        setCurrentIndex(isLastTrack ? 0 : currentIndex + 1);
        break;
      case "one":
        loadTrack(currentTrack, true);
        break;
      case "shuffle":
        let newIndex = Math.floor(Math.random() * localPlaylist.length);
        while (newIndex === currentIndex) {
          newIndex = Math.floor(Math.random() * localPlaylist.length);
        }
        setCurrentIndex(newIndex);
        break;
      default:
        message.error("알 수 없는 재생 모드입니다.");
    }
  };

  const handlePrevious = () => {
    setCurrentIndex(currentIndex > 0 ? currentIndex - 1 : 0);
    setIsPlaying(true);
  };

  const handleSliderChange = (value) => {
    if (!currentTrack) return;
    const audio = audioRef.current;
    audio.currentTime = (currentTrack.startTime || 0) + value;
    setCurrentTime(value);
  };

  const handleChangePlayMode = () => {
    const modes = ["all", "one", "shuffle"];
    const nextMode = modes[(modes.indexOf(playMode) + 1) % modes.length];
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
        />
        <Button
          icon={<StepForwardOutlined style={{ fontSize: "32px" }} />}
          onClick={handleNext}
          size="large"
        />
        <Button
          icon={playModeIcons[playMode]}
          onClick={handleChangePlayMode}
          size="large"
        />
      </div>

      <Slider
        value={currentTime}
        max={duration}
        onChange={handleSliderChange}
      />
      <div className="flex justify-between text-sm">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <List
        size="small"
        dataSource={localPlaylist}
        renderItem={(track, index) => (
          <List.Item
            className={index === currentIndex ? "bg-blue-100" : ""}
            onClick={() => {
              setCurrentIndex(index);
              setIsPlaying(true);
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
