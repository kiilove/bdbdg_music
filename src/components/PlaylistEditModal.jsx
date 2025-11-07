"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Modal,
  Button,
  Spin,
  Empty,
  message,
  Space,
  Typography,
  Popconfirm,
  Card,
} from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import DraggableTrackList from "./DraggableTrackList";
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

const { Text } = Typography;

/**
 * PlaylistEditModal
 * 기존 재생목록을 편집하는 모달
 * 기능: 순서변경, 미리듣기, 트랙삭제
 */
export default function PlaylistEditModal({ open, onClose, playlistId }) {
  const [loading, setLoading] = useState(true);
  const [playlistName, setPlaylistName] = useState("");
  const [tracks, setTracks] = useState([]);
  const [previewTrack, setPreviewTrack] = useState(null);
  const audioRef = useRef(null);

  // 🔹 모달이 열리면 Firestore 실시간 구독
  useEffect(() => {
    if (!open || !playlistId) return;

    const playlistRef = doc(db, "track_play_list", playlistId);
    const tracksRef = query(
      collection(db, "track_play_list", playlistId, "tracks"),
      orderBy("playIndex", "asc")
    );

    const unsubPlaylist = onSnapshot(playlistRef, (snap) => {
      if (snap.exists()) setPlaylistName(snap.data().name || "(제목 없음)");
    });

    const unsubTracks = onSnapshot(tracksRef, (snap) => {
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
  }, [open, playlistId]);

  // 🔹 순서 변경 후 Firestore 반영
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
      } catch (e) {
        console.error(e);
        message.error("순서 저장 중 오류가 발생했습니다.");
      }
    },
    [playlistId]
  );

  // 🔹 트랙 삭제
  const handleDeleteTrack = async (trackId) => {
    try {
      await deleteDoc(
        doc(db, "track_play_list", playlistId, "tracks", trackId)
      );
      message.success("트랙이 삭제되었습니다.");
    } catch (e) {
      console.error(e);
      message.error("삭제 중 오류가 발생했습니다.");
    }
  };

  // 🔹 미리듣기 정지 처리
  useEffect(() => {
    if (!previewTrack) {
      try {
        audioRef.current?.audio?.current?.pause();
      } catch (_) {}
    }
  }, [previewTrack]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={`플레이리스트 수정 - ${playlistName}`}
      width={720}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          닫기
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        {tracks.length === 0 ? (
          <Empty description="이 재생목록에 트랙이 없습니다." />
        ) : (
          <Space direction="vertical" className="w-full" size="large">
            {/* 🎵 미리듣기 플레이어 */}
            {previewTrack && (
              <Card
                size="small"
                title={`미리듣기: ${previewTrack.name}`}
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

            {/* 🔸 DnD 트랙 목록 */}
            <DraggableTrackList
              items={tracks}
              onReorder={handleReorder}
              onPreview={setPreviewTrack}
              previewTrack={previewTrack}
            />

            {/* 🗑️ 삭제 버튼 목록 */}
            <div>
              <Text strong>트랙 삭제</Text>
              <div style={{ marginTop: 8 }}>
                {tracks.map((t) => (
                  <Popconfirm
                    key={t.id}
                    title="이 트랙을 삭제할까요?"
                    onConfirm={() => handleDeleteTrack(t.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button
                      size="small"
                      danger
                      style={{ margin: "4px" }}
                      icon={<DeleteOutlined />}
                    >
                      {t.name}
                    </Button>
                  </Popconfirm>
                ))}
              </div>
            </div>
          </Space>
        )}
      </Spin>
    </Modal>
  );
}
