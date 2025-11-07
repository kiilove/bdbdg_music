// components/PlaylistModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Button,
  Input,
  Space,
  Typography,
  message,
  Checkbox,
  Divider,
  Empty,
  Spin,
  Card,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";
import DraggableTrackList from "./DraggableTrackList";

const { Text } = Typography;

export default function PlaylistModal({ open, onClose, files = [] }) {
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [checkedKeys, setCheckedKeys] = useState({});
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [previewTrack, setPreviewTrack] = useState(null);
  const audioRef = useRef(null);

  // 모달 닫히면 오디오 정지
  useEffect(() => {
    if (!open) {
      audioRef.current?.audio?.current?.pause();
      setPreviewTrack(null);
      setSelectedTracks([]);
    }
  }, [open]);

  // 열릴 때 파일 자동 선택
  useEffect(() => {
    if (open && files.length > 0) {
      const all = {};
      files.forEach((f) => (all[f.fullPath] = true));
      setCheckedKeys(all);
      setSelectedTracks(files);
    }
  }, [open, files]);

  // 플레이리스트 불러오기
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "track_play_list"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setPlaylists(list);
      } catch (e) {
        console.error(e);
        message.error("플레이리스트 불러오기 실패");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const selectedCount = useMemo(
    () => Object.values(checkedKeys).filter(Boolean).length,
    [checkedKeys]
  );

  const toggleAll = (checked) => {
    const next = {};
    if (checked) files.forEach((f) => (next[f.fullPath] = true));
    setCheckedKeys(next);
    setSelectedTracks(checked ? files : []);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      message.warning("새 재생목록 이름을 입력하세요.");
      return;
    }
    try {
      setLoading(true);
      const docRef = await addDoc(collection(db, "track_play_list"), {
        name: newPlaylistName.trim(),
        createdAt: serverTimestamp(),
      });
      setPlaylists((prev) => [
        ...prev,
        { id: docRef.id, name: newPlaylistName.trim() },
      ]);
      setSelectedPlaylistId(docRef.id);
      setNewPlaylistName("");
      message.success("재생목록이 생성되었습니다.");
    } catch (e) {
      console.error(e);
      message.error("재생목록 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTracks = async () => {
    if (!selectedPlaylistId) {
      message.warning("추가할 재생목록을 선택하세요.");
      return;
    }

    if (selectedTracks.length === 0) {
      message.warning("추가할 파일을 선택하세요.");
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);

      // 🔹 순서대로 playIndex 부여
      selectedTracks.forEach((track, idx) => {
        const trackRef = doc(
          collection(db, "track_play_list", selectedPlaylistId, "tracks")
        );
        batch.set(trackRef, {
          name: track.name,
          url: track.url,
          fullPath: track.fullPath,
          playIndex: idx + 1,
          addedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      message.success(`${selectedTracks.length}개 트랙이 추가되었습니다.`);
      onClose?.();
    } catch (e) {
      console.error(e);
      message.error("트랙 추가 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="재생목록에 추가"
      width={720}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          닫기
        </Button>,
        <Button
          key="ok"
          type="primary"
          loading={loading}
          onClick={handleAddTracks}
        >
          선택 항목 추가
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
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

          {/* ✅ 파일 선택 및 순서 정렬 영역 */}
          <div>
            <Text strong>파일 선택 및 정렬</Text>
            <div className="mt-2 mb-2">
              <Checkbox
                onChange={(e) => toggleAll(e.target.checked)}
                checked={selectedCount === files.length && files.length > 0}
                indeterminate={
                  selectedCount > 0 && selectedCount < files.length
                }
              >
                전체 선택
              </Checkbox>{" "}
              <Text type="secondary">
                ({selectedTracks.length}/{files.length})
              </Text>
            </div>

            {selectedTracks.length === 0 ? (
              <Empty description="선택된 파일이 없습니다." />
            ) : (
              <DraggableTrackList
                items={selectedTracks}
                onReorder={setSelectedTracks}
                onPreview={setPreviewTrack}
                previewTrack={previewTrack}
              />
            )}
          </div>

          <Divider />

          {/* 재생목록 선택 */}
          <div>
            <Text strong>재생목록 선택</Text>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid #eee",
                borderRadius: 8,
                padding: 8,
                marginTop: 8,
              }}
            >
              {playlists.length === 0 ? (
                <Empty description="재생목록이 없습니다. 새로 만들어보세요." />
              ) : (
                playlists.map((pl) => (
                  <div
                    key={pl.id}
                    onClick={() => setSelectedPlaylistId(pl.id)}
                    style={{
                      cursor: "pointer",
                      background:
                        selectedPlaylistId === pl.id
                          ? "rgba(24,144,255,0.08)"
                          : "transparent",
                      borderRadius: 8,
                      padding: 8,
                      marginBottom: 6,
                    }}
                  >
                    <Text strong>{pl.name}</Text>
                  </div>
                ))
              )}
            </div>

            <Space style={{ marginTop: 10 }}>
              <Input
                placeholder="새 재생목록 이름"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onPressEnter={handleCreatePlaylist}
                style={{ width: 260 }}
              />
              <Button icon={<PlusOutlined />} onClick={handleCreatePlaylist}>
                새로 만들기
              </Button>
            </Space>
          </div>
        </Space>
      </Spin>
    </Modal>
  );
}
