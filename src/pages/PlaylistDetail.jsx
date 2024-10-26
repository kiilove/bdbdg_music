// src/components/PlaylistDetail.jsx
import React, { useEffect, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { List, Button, message, Spin } from "antd";
import { PlayCircleOutlined } from "@ant-design/icons";
import { useMediaQuery } from "react-responsive";
import { openDB } from "idb";
import AudioPlayer from "../components/AudioPlayer";
import { useFirestoreUpdateData } from "../hooks/useFirestores";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

const DB_NAME = "musicCacheDB";
const DB_VERSION = 1;
const STORE_PLAYLISTS = "track_play_list";
const STORE_TRACKS = "tracks";

const ItemType = "TRACK_ITEM";

const DraggableTrack = ({ track, index, moveTrack, findTrack, onDelete }) => {
  const navigate = useNavigate();
  const originalIndex = findTrack(track.id).index;
  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: ItemType,
      item: { id: track.id, originalIndex },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      end: (item, monitor) => {
        const { id: droppedId, originalIndex } = item;
        const didDrop = monitor.didDrop();
        if (!didDrop) {
          moveTrack(droppedId, originalIndex);
        }
      },
    }),
    [track.id, originalIndex, moveTrack]
  );

  const [, drop] = useDrop(
    () => ({
      accept: ItemType,
      hover({ id: draggedId }) {
        if (draggedId !== track.id) {
          const { index: overIndex } = findTrack(track.id);
          moveTrack(draggedId, overIndex);
        }
      },
    }),
    [findTrack, moveTrack]
  );

  const formatTime = (time) => {
    if (isNaN(time) || time === undefined || time === null) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{
        opacity: isDragging ? 0.5 : 1,
        padding: "8px",
        borderRadius: "4px",
        marginBottom: "4px",
        background: "#fff",
        border: "1px solid #ddd",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}
    >
      <span>{track.playIndex}</span>
      <img
        src={track.albumArt || "/default-album-art.jpg"}
        alt="Album Art"
        className="w-10 h-10 object-cover rounded"
      />
      <span
        style={{ cursor: "pointer", textDecoration: "underline" }}
        onClick={() => navigate(`/track-editor/${track.id}`)}
      >
        {track.title}
      </span>
      <span>{track.genres ? track.genres.join(", ") : "없음"}</span>
      <span>시작: {formatTime(track.startTime)}</span>
      <span>종료: {formatTime(track.endTime)}</span>
      <span>{track.language || "없음"}</span>
      <Button
        danger
        onClick={(e) => {
          e.stopPropagation(); // 이벤트 전파 중단
          onDelete(track.id);
        }}
      >
        삭제
      </Button>
    </div>
  );
};

const PlaylistDetail = () => {
  const { playlistId } = useParams();
  const location = useLocation();
  const { playlist: statePlaylist } = location.state || {};
  const [playlist, setPlaylist] = useState(statePlaylist || null);
  const [isLoading, setIsLoading] = useState(!statePlaylist);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const updatePlaylist = useFirestoreUpdateData("track_play_list");

  useEffect(() => {
    const fetchPlaylist = async () => {
      if (playlist) {
        setIsLoading(false);
        return;
      }

      try {
        const db = await openDB(DB_NAME, DB_VERSION);
        const tx = db.transaction(STORE_PLAYLISTS, "readonly");
        const store = tx.objectStore(STORE_PLAYLISTS);
        const foundPlaylist = await store.get(playlistId);
        await tx.done;

        if (foundPlaylist) {
          setPlaylist(foundPlaylist);
        } else {
          message.error("플레이리스트를 찾을 수 없습니다.");
        }
      } catch (error) {
        console.error("플레이리스트 조회 실패:", error);
        message.error("플레이리스트를 조회하는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylist();
  }, [playlistId, playlist]);

  const getPlaylistTracks = async () => {
    if (!playlist) return [];

    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      const tx = db.transaction(STORE_TRACKS, "readonly");
      const store = tx.objectStore(STORE_TRACKS);
      const tracks = await Promise.all(
        playlist.tracks.map(async (trackRef) => {
          const track = await store.get(trackRef.id);
          return track || null;
        })
      );
      await tx.done;
      return tracks.filter(Boolean);
    } catch (error) {
      console.error("트랙 조회 실패:", error);
      message.error("트랙을 조회하는 중 오류가 발생했습니다.");
      return [];
    }
  };

  useEffect(() => {
    const loadTracks = async () => {
      if (playlist) {
        const tracks = await getPlaylistTracks();
        setPlaylistTracks(tracks);
      }
    };

    loadTracks();
  }, [playlist]);

  const handlePlayPlaylist = () => {
    if (playlistTracks.length === 0) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }
    console.log("재생할 트랙:", playlistTracks);
  };

  const moveTrack = (draggedId, overIndex) => {
    const draggedTrack = playlistTracks.find((track) => track.id === draggedId);
    const updatedTracks = [...playlistTracks];
    updatedTracks.splice(
      updatedTracks.findIndex((t) => t.id === draggedId),
      1
    );
    updatedTracks.splice(overIndex, 0, draggedTrack);

    const newOrder = updatedTracks.map((track, index) => ({
      ...track,
      playIndex: index + 1,
    }));

    setPlaylistTracks(newOrder);
  };

  const findTrack = (id) => {
    const track = playlistTracks.find((t) => t.id === id);
    return {
      track,
      index: playlistTracks.indexOf(track),
    };
  };

  const handleDeleteTrack = (trackId) => {
    const updatedTracks = playlistTracks.filter(
      (track) => track.id !== trackId
    );
    setPlaylistTracks(updatedTracks);
    message.success("트랙이 플레이리스트에서 제거되었습니다.");
  };

  const handleSaveOrder = async () => {
    try {
      const tracksToUpdate = playlistTracks.map((track) => ({
        id: track.id,
        playIndex: track.playIndex,
      }));

      console.log("저장할 트랙 순서:", tracksToUpdate);

      await updatePlaylist.updateData(playlist.id, {
        tracks: tracksToUpdate.filter((track) => track.playIndex !== undefined),
      });
      message.success("플레이리스트 순서가 저장되었습니다.");
    } catch (error) {
      console.error("순서 저장 실패:", error);
      message.error("플레이리스트 순서 저장 중 오류가 발생했습니다.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px" }}>
        <h2>플레이리스트를 찾을 수 없습니다.</h2>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: isMobile ? "16px" : "24px" }}>
        <AudioPlayer playlist={playlistTracks} autoPlay={false} />
        <h2>{playlist.name}</h2>
        <List
          bordered
          dataSource={playlistTracks}
          renderItem={(track, index) => (
            <DraggableTrack
              track={track}
              index={index}
              moveTrack={moveTrack}
              findTrack={findTrack}
              onDelete={handleDeleteTrack}
            />
          )}
        />
        <Button
          type="primary"
          onClick={handleSaveOrder}
          style={{ marginTop: "16px" }}
        >
          순서 저장
        </Button>
      </div>
    </DndProvider>
  );
};

export default PlaylistDetail;
