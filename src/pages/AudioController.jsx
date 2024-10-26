// src/components/AudioController.js
import React, { useState, useEffect, useRef } from "react";
import { Button, Select, message, Spin } from "antd";
import AudioControllerPlayer from "../components/AudioControllerPlayer";
import { openDB } from "idb";

const { Option } = Select;

// 플레이리스트 섹션 유형
const PLAYLIST_TYPES = ["대기", "등장", "포징", "포즈다운", "순위발표", "시상"];

// IndexedDB 설정
const DB_NAME = "musicCacheDB";
const DB_VERSION = 1;
const STORE_PLAYLISTS = "track_play_list"; // 플레이리스트가 저장된 스토어
const STORE_TRACKS = "tracks"; // 트랙 정보가 저장된 스토어

const AudioController = () => {
  const audioRefs = useRef({});
  const [playlists, setPlaylists] = useState({
    대기: [],
    등장: [],
    포징: [],
    포즈다운: [],
    순위발표: [],
    시상: [],
  });
  const [selectedPlaylists, setSelectedPlaylists] = useState({});
  const [lastPlaybackTimes, setLastPlaybackTimes] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // 트랙 유효성 검사 함수
  const validateTrack = (track) => {
    const requiredFields = ["id", "title", "path", "duration"];
    return requiredFields.every((field) => track[field]);
  };

  useEffect(() => {
    const fetchPlaylistsAndTracks = async () => {
      setIsLoading(true);
      try {
        const db = await openDB(DB_NAME, DB_VERSION);
        const tx = db.transaction([STORE_PLAYLISTS, STORE_TRACKS], "readonly");
        const playlistsStore = tx.objectStore(STORE_PLAYLISTS);
        const tracksStore = tx.objectStore(STORE_TRACKS);

        // 모든 플레이리스트 가져오기
        const allPlaylists = await playlistsStore.getAll();
        console.log("Fetched Playlists:", allPlaylists);

        if (!allPlaylists || allPlaylists.length === 0) {
          message.warning("플레이리스트가 없습니다.");
          setIsLoading(false);
          return;
        }

        // 각 섹션에 동일한 플레이리스트 할당
        const populatedPlaylists = {};

        for (const section of PLAYLIST_TYPES) {
          populatedPlaylists[section] = await Promise.all(
            allPlaylists.map(async (playlist) => {
              const tracks = await Promise.all(
                playlist.tracks.map(async (trackRef) => {
                  try {
                    let trackData;

                    // trackRef.id가 문자열인지 객체인지 확인
                    if (typeof trackRef.id === "string") {
                      // 문자열인 경우, tracksStore에서 트랙 정보 가져오기
                      const track = await tracksStore.get(trackRef.id);
                      if (track && validateTrack(track)) {
                        trackData = {
                          id: track.id,
                          title: track.title,
                          path: track.path,
                          albumArt: track.albumArt || "/default-album-art.jpg",
                          startTime: Number(track.startTime) || 0,
                          endTime: Number(track.endTime) || track.duration || 0,
                        };
                      } else {
                        console.warn(`유효하지 않은 트랙 ID: ${trackRef.id}`);
                        return null;
                      }
                    } else if (
                      typeof trackRef.id === "object" &&
                      trackRef.id !== null
                    ) {
                      // 객체인 경우, 직접 트랙 정보 사용
                      const track = trackRef.id;
                      if (validateTrack(track)) {
                        trackData = {
                          id: track.id,
                          title: track.title,
                          path: track.path,
                          albumArt: track.albumArt || "/default-album-art.jpg",
                          startTime: Number(track.startTime) || 0,
                          endTime: Number(track.endTime) || track.duration || 0,
                        };
                      } else {
                        console.warn(
                          `유효하지 않은 트랙 객체: ${JSON.stringify(
                            trackRef.id
                          )}`
                        );
                        return null;
                      }
                    } else {
                      console.warn(`알 수 없는 트랙 형식: ${trackRef.id}`);
                      return null;
                    }

                    return trackData;
                  } catch (error) {
                    console.error(
                      `트랙을 불러오는 중 오류 발생: ${trackRef.id}`,
                      error
                    );
                    return null;
                  }
                })
              );

              const validTracks = tracks.filter(Boolean);

              console.log(
                `Section: ${section}, Playlist: ${playlist.name}, Tracks:`,
                validTracks
              );

              return {
                ...playlist,
                tracks: validTracks,
              };
            })
          );
        }

        console.log("Populated Playlists with Tracks:", populatedPlaylists);
        setPlaylists(populatedPlaylists);
      } catch (error) {
        console.error("플레이리스트를 불러오는 중 오류가 발생했습니다.", error);
        message.error("플레이리스트를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylistsAndTracks();
  }, []);

  // 플레이리스트 선택 핸들러
  const handlePlaylistChange = (section, playlistId) => {
    // 선택된 플레이리스트 ID가 해당 섹션에 존재하는지 확인
    const playlistExists = playlists[section].some(
      (pl) => pl.id === playlistId
    );
    if (!playlistExists) {
      message.error("선택된 플레이리스트가 유효하지 않습니다.");
      return;
    }

    setSelectedPlaylists((prev) => ({
      ...prev,
      [section]: playlistId,
    }));
  };

  // 재생 핸들러
  const handlePlay = (section) => {
    const playlistId = selectedPlaylists[section];
    if (!playlistId) {
      message.warning(`${section} 플레이리스트를 선택해주세요.`);
      return;
    }

    const playlist = playlists[section].find((pl) => pl.id === playlistId);
    if (!playlist || playlist.tracks.length === 0) {
      message.warning(`${section} 플레이리스트에 트랙이 없습니다.`);
      return;
    }

    // 다른 섹션의 오디오 플레이어 중지 및 위치 저장
    PLAYLIST_TYPES.forEach((sec) => {
      if (sec !== section && audioRefs.current[sec]) {
        const currentAudio = audioRefs.current[sec];
        currentAudio.pause();
        const lastTime = currentAudio.getCurrentTime();
        setLastPlaybackTimes((prev) => ({
          ...prev,
          [sec]: lastTime,
        }));
      }
    });

    // 선택된 섹션의 오디오 플레이어에 플레이리스트 로드 및 재생
    const audioPlayer = audioRefs.current[section];
    if (audioPlayer) {
      const lastTime =
        lastPlaybackTimes[section] || playlist.tracks[0]?.startTime || 0;
      audioPlayer.loadPlaylist(playlist.tracks, lastTime);
      message.success(`${section} 재생이 시작되었습니다.`);
    }
  };

  // 중지 핸들러
  const handleStop = (section) => {
    const audioPlayer = audioRefs.current[section];
    if (audioPlayer) {
      audioPlayer.pause();
      const lastTime = audioPlayer.getCurrentTime();
      setLastPlaybackTimes((prev) => ({
        ...prev,
        [section]: lastTime,
      }));
      message.info(`${section} 재생이 중지되었습니다.`);
    }
  };

  return (
    <div>
      {PLAYLIST_TYPES.map((section) => (
        <div key={section} style={{ marginBottom: "24px" }}>
          <h3>{section} 섹션</h3>
          {isLoading ? (
            <Spin size="large" />
          ) : (
            <>
              <Select
                style={{ width: "300px", marginBottom: "8px" }}
                placeholder={`${section} 플레이리스트 선택`}
                value={selectedPlaylists[section]}
                onChange={(value) => handlePlaylistChange(section, value)}
              >
                {playlists[section].map((playlist) => (
                  <Option key={playlist.id} value={playlist.id}>
                    {playlist.name} (트랙 수: {playlist.tracks.length})
                  </Option>
                ))}
              </Select>
              <div>
                <Button
                  type="primary"
                  onClick={() => handlePlay(section)}
                  disabled={!selectedPlaylists[section]}
                >
                  {section} 재생 전환
                </Button>
                <Button
                  onClick={() => handleStop(section)}
                  style={{ marginLeft: "8px" }}
                >
                  {section} 중지
                </Button>
              </div>
              <AudioControllerPlayer
                ref={(el) => (audioRefs.current[section] = el)}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default AudioController;
