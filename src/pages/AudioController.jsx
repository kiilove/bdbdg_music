// src/components/AudioController.jsx
import React, { useState, useEffect } from "react";
import { Button, Select, message, List } from "antd";
import AudioPlayer from "../components/AudioPlayer";
import { openDB } from "idb";
import { useFirestoreQuery } from "../hooks/useFirestores";

const { Option } = Select;
const PLAYLIST_TYPES = ["대기", "등장", "포징", "포즈다운", "점수발표", "시상"];
const DB_NAME = "musicCacheDB";
const DB_VERSION = 1;
const STORE_TRACKS = "tracks";

const AudioController = () => {
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylists, setSelectedPlaylists] = useState({});
  const [trackLists, setTrackLists] = useState({});
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [selectedSection, setSelectedSection] = useState(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const [lastPlaybackInfo, setLastPlaybackInfo] = useState({});

  const playListQuery = useFirestoreQuery();

  const fetchPlaylist = async () => {
    try {
      const data = await playListQuery.getDocuments("track_play_list");
      setPlaylists(data);
    } catch (error) {
      message.error("플레이리스트를 불러오는 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    fetchPlaylist();
  }, []);

  const fetchTrackFromIndexedDB = async (trackId) => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      const tx = db.transaction(STORE_TRACKS, "readonly");
      const tracksStore = tx.objectStore(STORE_TRACKS);
      const track = await tracksStore.get(trackId);

      if (track) {
        return {
          id: track.id,
          title: track.title,
          path: track.path,
          startTime: track.startTime || 0,
          endTime: track.endTime || track.duration || 0,
          albumArt: track.albumArt || "/default-album-art.jpg",
        };
      } else {
        console.warn(`트랙을 찾을 수 없습니다: ${trackId}`);
        return null;
      }
    } catch (error) {
      console.error(`트랙 로드 오류: ${trackId}`, error);
      return null;
    }
  };

  const handlePlaylistChange = async (section, playlistId) => {
    setSelectedPlaylists((prev) => ({ ...prev, [section]: playlistId }));
    const playlist = playlists.find((pl) => pl.id === playlistId);

    if (playlist) {
      const tracks = await Promise.all(
        playlist.tracks.map((trackRef) => fetchTrackFromIndexedDB(trackRef.id))
      );
      const validTracks = tracks.filter(Boolean);
      setTrackLists((prev) => ({ ...prev, [section]: validTracks }));
    }
  };

  const handlePlayPlaylist = (section) => {
    const tracksToPlay = trackLists[section];
    if (tracksToPlay.length === 0) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }

    const lastInfo = lastPlaybackInfo[section] || {};
    setSelectedSection(section);
    setSelectedTracks(tracksToPlay);
    setAutoPlay(true);

    message.success(`${section} 플레이리스트가 재생됩니다.`);
  };

  const handlePlaylistChangeFromPlayer = (info) => {
    console.log(info);
    if (selectedSection) {
      setLastPlaybackInfo((prev) => ({
        ...prev,
        [selectedSection]: info,
      }));
    }
  };

  return (
    <div>
      <AudioPlayer
        playlist={selectedTracks}
        autoPlay={autoPlay}
        forceIndex={lastPlaybackInfo[selectedSection]?.currentIndex || 0}
        forceStartTime={lastPlaybackInfo[selectedSection]?.currentTime || 0}
        onPlaylistChange={handlePlaylistChangeFromPlayer}
      />

      {PLAYLIST_TYPES.map((section) => (
        <div key={section}>
          <Select
            placeholder={`${section} 플레이리스트 선택`}
            value={selectedPlaylists[section]}
            onChange={(value) => handlePlaylistChange(section, value)}
          >
            {playlists.map((playlist) => (
              <Option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </Option>
            ))}
          </Select>
          <Button onClick={() => handlePlayPlaylist(section)}>재생</Button>
          <List
            dataSource={trackLists[section]}
            renderItem={(track) => <List.Item>{track.title}</List.Item>}
          />
        </div>
      ))}
    </div>
  );
};

export default AudioController;
