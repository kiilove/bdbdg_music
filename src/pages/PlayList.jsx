"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Card,
  List,
  Typography,
  message,
  Spin,
  Empty,
  Space,
  Button,
  Tag,
  Popconfirm,
} from "antd";
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  FolderOpenOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
} from "firebase/firestore";
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import PlaylistEditor from "../components/PlaylistEditModal";

const { Title, Text } = Typography;

export default function PlayList() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const audioRef = useRef(null);

  // 🔹 Firestore에서 전체 재생목록 구독 (트랙 개수 포함)
  useEffect(() => {
    const ref = collection(db, "track_play_list");
    const q = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      async (snap) => {
        try {
          const listWithCounts = await Promise.all(
            snap.docs.map(async (d) => {
              const data = d.data();
              const tracksRef = collection(
                db,
                "track_play_list",
                d.id,
                "tracks"
              );
              const trackSnap = await getDocs(tracksRef);
              const trackCount = trackSnap.size;

              return {
                id: d.id,
                ...data,
                trackCount,
              };
            })
          );
          setPlaylists(listWithCounts);
        } catch (e) {
          console.error("트랙 개수 계산 실패:", e);
          message.error("플레이리스트를 불러오는 중 오류가 발생했습니다.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error(err);
        message.error("플레이리스트를 불러오지 못했습니다.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handlePlayAll = async (playlistId) => {
    try {
      const tracksRef = collection(db, "track_play_list", playlistId, "tracks");
      const snap = await getDocs(query(tracksRef, orderBy("playIndex", "asc")));
      const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (tracks.length === 0) {
        message.warning("트랙이 없습니다.");
        return;
      }

      setSelectedTrack(tracks[0]);
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      message.error("재생 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      try {
        audioRef.current?.audio?.current?.pause();
      } catch (_) {}
    }
  }, [isPlaying]);

  const handleDeletePlaylist = async (playlistId) => {
    try {
      await deleteDoc(doc(db, "track_play_list", playlistId));
      message.success("플레이리스트가 삭제되었습니다.");
    } catch (err) {
      console.error(err);
      message.error("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleCloseEditor = () => setEditingPlaylistId(null);

  return (
    <div style={{ padding: 24 }}>
      <Title level={3} style={{ marginBottom: 16 }}>
        플레이리스트 관리
      </Title>

      {selectedTrack && (
        <Card
          size="small"
          title={`Now Playing: ${selectedTrack.name}`}
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="text"
              size="small"
              icon={<PauseCircleOutlined />}
              onClick={() => setIsPlaying(false)}
            >
              정지
            </Button>
          }
        >
          <ReactH5AudioPlayer
            ref={audioRef}
            src={selectedTrack.url}
            autoPlay={isPlaying}
            onEnded={() => setIsPlaying(false)}
            showJumpControls={false}
            customAdditionalControls={[]}
            layout="horizontal"
          />
        </Card>
      )}

      {loading ? (
        <Spin
          size="large"
          style={{ display: "block", marginTop: 100, textAlign: "center" }}
        />
      ) : playlists.length === 0 ? (
        <Empty
          description="저장된 플레이리스트가 없습니다."
          style={{ marginTop: 80 }}
        />
      ) : (
        <List
          grid={{ gutter: 16, column: 2 }}
          dataSource={playlists}
          renderItem={(playlist) => (
            <List.Item>
              <Card
                key={playlist.id}
                title={
                  <Space>
                    <FolderOpenOutlined />
                    <Text strong>{playlist.name}</Text>
                  </Space>
                }
                extra={
                  <Space>
                    <Button
                      type="text"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handlePlayAll(playlist.id)}
                    >
                      전체 재생
                    </Button>
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      onClick={() => setEditingPlaylistId(playlist.id)}
                    >
                      수정
                    </Button>
                    <Popconfirm
                      title="플레이리스트를 삭제할까요?"
                      onConfirm={() => handleDeletePlaylist(playlist.id)}
                      okText="삭제"
                      cancelText="취소"
                    >
                      <Button type="text" icon={<DeleteOutlined />} danger>
                        삭제
                      </Button>
                    </Popconfirm>
                  </Space>
                }
                style={{ cursor: "default", borderRadius: 10 }}
              >
                <Space direction="vertical">
                  <Tag color="blue">
                    {playlist.trackCount > 0
                      ? `${playlist.trackCount}곡`
                      : "0곡"}
                  </Tag>
                  <Text type="secondary">
                    생성일:{" "}
                    {playlist.createdAt?.toDate
                      ? playlist.createdAt.toDate().toLocaleString()
                      : "알 수 없음"}
                  </Text>
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}

      {editingPlaylistId && (
        <PlaylistEditor
          open={!!editingPlaylistId}
          playlistId={editingPlaylistId}
          onClose={handleCloseEditor}
        />
      )}
    </div>
  );
}
