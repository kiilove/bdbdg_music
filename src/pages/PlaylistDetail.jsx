"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { Button, Card, message, Spin, Space } from "antd";
import { db } from "../firebase";
import { useMediaQuery } from "react-responsive";
import DraggableTrackList from "../components/DraggableTrackList";
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewTrack, setPreviewTrack] = useState(null);
  const audioRef = useRef(null);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  // 🔹 Firestore 실시간 구독
  useEffect(() => {
    if (!playlistId) return;

    const playlistRef = doc(db, "track_play_list", playlistId);
    const tracksRef = collection(db, "track_play_list", playlistId, "tracks");
    const tracksQuery = query(tracksRef, orderBy("playIndex", "asc"));

    const unsubPlaylist = onSnapshot(playlistRef, (snap) => {
      if (snap.exists()) setPlaylist({ id: snap.id, ...snap.data() });
    });

    const unsubTracks = onSnapshot(tracksQuery, (snap) => {
      const list = snap.docs.map((d, i) => ({
        id: d.id,
        playIndex: d.data().playIndex ?? i + 1,
        ...d.data(),
      }));
      setTracks(list);
      setLoading(false);
    });

    return () => {
      unsubPlaylist();
      unsubTracks();
    };
  }, [playlistId]);

  // 🔹 드래그앤드롭 순서 변경 후 Firestore에 즉시 반영
  const handleReorder = useCallback(
    async (newList) => {
      try {
        const batch = writeBatch(db);
        newList.forEach((t, idx) => {
          const ref = doc(db, "track_play_list", playlistId, "tracks", t.id);
          batch.update(ref, { playIndex: idx + 1 });
        });
        await batch.commit();
        setTracks(newList.map((t, i) => ({ ...t, playIndex: i + 1 })));
        message.success("순서가 저장되었습니다.");
      } catch (error) {
        console.error(error);
        message.error("순서 저장 중 오류가 발생했습니다.");
      }
    },
    [playlistId]
  );

  // 🔹 트랙 삭제
  const handleDeleteTrack = useCallback(
    async (trackId) => {
      try {
        await deleteDoc(
          doc(db, "track_play_list", playlistId, "tracks", trackId)
        );
        message.success("트랙이 삭제되었습니다.");
      } catch (error) {
        console.error(error);
        message.error("트랙 삭제 중 오류가 발생했습니다.");
      }
    },
    [playlistId]
  );

  // 🔹 전체 재생
  const handlePlayAll = () => {
    if (tracks.length === 0) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }
    setPreviewTrack(tracks[0]);
  };

  // 🔹 미리듣기 종료 시 정지 처리
  useEffect(() => {
    if (!previewTrack) {
      try {
        audioRef.current?.audio?.current?.pause();
      } catch (_) {}
    }
  }, [previewTrack]);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: 40 }}>
        <Spin size="large" />
      </div>
    );

  if (!playlist)
    return (
      <div style={{ padding: 24 }}>
        <h2>플레이리스트를 찾을 수 없습니다.</h2>
      </div>
    );

  return (
    <div style={{ padding: isMobile ? 16 : 24 }}>
      <Space
        style={{
          display: "flex",
          justifyContent: "space-between",
          width: "100%",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>
          {playlist.name || "제목 없는 플레이리스트"}
        </h2>
        <Button type="primary" onClick={handlePlayAll}>
          전체 재생
        </Button>
      </Space>

      {/* 🎵 미리듣기 오디오 플레이어 */}
      {previewTrack && (
        <Card
          size="small"
          title={`Now Playing: ${previewTrack.name}`}
          style={{ marginBottom: 16 }}
          bordered={false}
        >
          <ReactH5AudioPlayer
            ref={audioRef}
            src={previewTrack.url}
            autoPlay
            showJumpControls={false}
            customAdditionalControls={[]}
            layout="horizontal"
            onEnded={() => setPreviewTrack(null)}
            onPause={() => setPreviewTrack(null)}
          />
        </Card>
      )}

      {/* 🎧 드래그앤드롭 트랙 리스트 */}
      <DraggableTrackList
        items={tracks}
        onReorder={handleReorder}
        onPreview={setPreviewTrack}
        previewTrack={previewTrack}
      />

      {/* 🗑️ 삭제 버튼 리스트 (필요시 병합 가능) */}
      {tracks.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {tracks.map((t) => (
            <Button
              key={t.id}
              danger
              size="small"
              style={{ marginRight: 8, marginBottom: 8 }}
              onClick={() => handleDeleteTrack(t.id)}
            >
              {t.name} 삭제
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
