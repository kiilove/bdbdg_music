// src/components/PlaylistTable.js
import React from "react";
import { Table, Card, Button, List, Col, Row, Modal, message } from "antd";
import { DeleteOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useMediaQuery } from "react-responsive";
import { useNavigate } from "react-router-dom";
import { openDB } from "idb";

const DB_NAME = "musicCacheDB";
const DB_VERSION = 1;
const STORE_TRACKS = "tracks";

const PlaylistTable = ({ playlists, onPlay, onDeletePlaylist }) => {
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });
  const navigate = useNavigate();

  // IndexedDB에서 트랙 가져오기 함수
  const getTrackFromIndexedDB = async (trackId) => {
    try {
      const db = await openDB(DB_NAME, DB_VERSION);
      const tx = db.transaction(STORE_TRACKS, "readonly");
      const store = tx.objectStore(STORE_TRACKS);
      const track = await store.get(trackId);
      await tx.done;

      if (!track) {
        console.warn("트랙을 찾을 수 없습니다:", trackId);
        return null;
      }

      return track;
    } catch (error) {
      console.error("IndexedDB에서 트랙 가져오기 실패:", error);
      return null;
    }
  };

  const handlePlayPlaylist = async (playlist) => {
    if (!playlist?.tracks?.length) {
      message.warning("플레이리스트가 비어있습니다.");
      return;
    }

    try {
      const tracksToPlay = await Promise.all(
        playlist.tracks.map((track) => getTrackFromIndexedDB(track.id))
      );
      const validTracks = tracksToPlay.filter(Boolean).map((track) => ({
        id: track.id,
        title: track.title,
        path: track.path,
        albumArt: track.albumArt || "/default-album-art.jpg",
        startTime: Number(track.startTime) || 0,
        endTime: Number(track.endTime) || track.duration || 0,
      }));

      if (validTracks.length === 0) {
        message.error("재생할 수 있는 트랙이 없습니다.");
        return;
      }

      // 재생할 트랙 목록을 tracks 키로 감싸서 AudioPlayer에 전달
      onPlay({ tracks: validTracks });
      console.log("플레이리스트 재생 설정 완료:", validTracks);
    } catch (error) {
      console.error("플레이리스트 재생 준비 실패:", error);
      message.error("플레이리스트 재생 준비 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = (playlist) => {
    Modal.confirm({
      title: "플레이리스트 삭제",
      content: `"${playlist.name}" 플레이리스트를 삭제하시겠습니까?`,
      okText: "삭제",
      okType: "danger",
      cancelText: "취소",
      onOk: () => onDeletePlaylist?.(playlist.id),
    });
  };

  const handleViewPlaylist = (playlist) => {
    navigate(`/playlist-detail`, { state: { playlist } });
  };

  if (isMobile) {
    return (
      <div>
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={playlists}
          renderItem={(playlist) => (
            <Card key={playlist.id} className="mb-3">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <div className="mb-2">
                    <h4
                      className="mb-1 font-semibold"
                      style={{ cursor: "pointer", color: "#1890ff" }}
                      onClick={() => handleViewPlaylist(playlist)}
                    >
                      {playlist.name}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      곡 수: {playlist.tracks?.length || 0}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      icon={<PlayCircleOutlined />}
                      type="primary"
                      onClick={() => handlePlayPlaylist(playlist)}
                    >
                      재생
                    </Button>
                    <Button
                      icon={<DeleteOutlined />}
                      danger
                      onClick={() => handleDelete(playlist)}
                    >
                      삭제
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        />
      </div>
    );
  }

  const columns = [
    {
      title: "플레이리스트 이름",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <span
          style={{ cursor: "pointer", color: "#1890ff" }}
          onClick={() => handleViewPlaylist(record)}
        >
          {text}
        </span>
      ),
    },
    {
      title: "곡 수",
      key: "trackCount",
      render: (_, record) => record.tracks?.length || 0,
    },
    {
      title: "동작",
      key: "action",
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            icon={<PlayCircleOutlined />}
            type="primary"
            onClick={() => handlePlayPlaylist(record)}
          >
            재생
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => handleDelete(record)}
          >
            삭제
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Table
        columns={columns}
        dataSource={playlists}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: true }}
      />
    </div>
  );
};

export default PlaylistTable;
