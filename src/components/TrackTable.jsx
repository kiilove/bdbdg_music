// TrackTable.js
import React, { useState } from "react";
import { Table, Button, Card, List, message, Col, Row } from "antd";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";

const TrackTable = ({
  tracks,
  onPlay,
  onAddToPlaylist,
  onBatchAddToPlaylist,
  trackPlaylistMap,
}) => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const formatTime = (time) => {
    if (isNaN(time) || time === undefined || time === null) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleSelectChange = (selectedKeys) => {
    setSelectedRowKeys(selectedKeys);
  };

  const handlePlaySingle = (track) => {
    if (!track || !track.path) {
      message.error("재생할 수 없는 트랙입니다.");
      return;
    }

    const trackToPlay = {
      id: track.id,
      title: track.title,
      path: track.path,
      albumArt: track.albumArt || "/default-album-art.jpg",
      startTime: Number(track.startTime) || 0,
      endTime: Number(track.endTime) || 0,
    };

    console.log("재생할 트랙 정보:", trackToPlay);
    onPlay([trackToPlay]);
  };

  const handleBatchPlay = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("재생할 트랙을 선택하세요.");
      return;
    }

    const selectedTracks = tracks
      .filter((track) => selectedRowKeys.includes(track.id))
      .map((track) => ({
        id: track.id,
        title: track.title,
        path: track.path,
        albumArt: track.albumArt || "/default-album-art.jpg",
        startTime: Number(track.startTime) || 0,
        endTime: Number(track.endTime) || 0,
      }));

    console.log("재생할 트랙 목록:", selectedTracks);
    onPlay(selectedTracks);
    setSelectedRowKeys([]);
  };

  const handleBatchAddToPlaylist = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("플레이리스트에 추가할 트랙을 선택하세요.");
      return;
    }
    onBatchAddToPlaylist(selectedRowKeys);
    setSelectedRowKeys([]);
  };

  const handleEditTrack = (track) => {
    navigate(`/track-editor/${track.id}`);
  };

  const handleAddSingleTrack = (track) => {
    if (!track) {
      message.error("추가할 트랙이 존재하지 않습니다.");
      return;
    }
    onAddToPlaylist(track.id);
  };

  // 모바일 버전 렌더링
  if (isMobile) {
    return (
      <div>
        <div className="flex gap-2 mb-4">
          <Button
            onClick={handleBatchPlay}
            disabled={!selectedRowKeys.length}
            className="flex-1"
          >
            선택된 트랙 재생
          </Button>
          <Button
            onClick={handleBatchAddToPlaylist}
            disabled={!selectedRowKeys.length}
            className="flex-1"
          >
            선택된 트랙 플레이리스트에 추가
          </Button>
        </div>
        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={tracks}
          renderItem={(track) => (
            <Card
              key={track.id}
              onClick={() =>
                setSelectedRowKeys((prevKeys) =>
                  prevKeys.includes(track.id)
                    ? prevKeys.filter((key) => key !== track.id)
                    : [...prevKeys, track.id]
                )
              }
            >
              <Row gutter={[16, 16]}>
                <Col span={8} className="flex justify-center">
                  <img
                    src={track.albumArt || "/default-album-art.jpg"}
                    alt="Album Art"
                    style={{
                      width: 100,
                      height: 100,
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                </Col>
                <Col span={16}>
                  <div style={{ marginBottom: 8 }}>
                    <h4
                      style={{
                        marginBottom: 4,
                        cursor: "pointer",
                        color: "#1890ff",
                      }}
                      onClick={() => handleEditTrack(track)}
                    >
                      {track.title}
                    </h4>
                    <p style={{ marginBottom: 2, color: "#595959" }}>
                      장르: {track.genres ? track.genres.join(", ") : "없음"}
                    </p>
                    <p style={{ marginBottom: 2, color: "#595959" }}>
                      언어: {track.language || "없음"}
                    </p>
                    <p style={{ marginBottom: 2, color: "#595959" }}>
                      시작: {formatTime(track.startTime)}
                    </p>
                    <p style={{ marginBottom: 2, color: "#595959" }}>
                      종료: {formatTime(track.endTime)}
                    </p>
                    <p style={{ marginBottom: 2, color: "#595959" }}>
                      플레이리스트:{" "}
                      {trackPlaylistMap[track.id]?.length
                        ? trackPlaylistMap[track.id].join(", ")
                        : "없음"}
                    </p>
                  </div>
                  <div style={{ marginTop: 10, textAlign: "right" }}>
                    <Button
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySingle(track);
                      }}
                      style={{ padding: "0 8px" }}
                    >
                      재생
                    </Button>
                    <Button
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTrack(track);
                      }}
                      style={{ padding: "0 8px" }}
                    >
                      편집
                    </Button>
                    <Button
                      type="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddSingleTrack(track);
                      }}
                      style={{ padding: "0 8px" }}
                    >
                      추가
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

  // 데스크탑 버전 컬럼 정의
  const columns = [
    {
      title: "앨범아트",
      dataIndex: "albumArt",
      key: "albumArt",
      render: (url) => (
        <img
          src={url || "/default-album-art.jpg"}
          alt="Album Art"
          style={{
            width: 50,
            height: 50,
            objectFit: "cover",
            borderRadius: 4,
          }}
        />
      ),
    },
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
      render: (text, record) => (
        <span
          onClick={() => handleEditTrack(record)}
          style={{ cursor: "pointer", color: "#1890ff" }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "장르",
      dataIndex: "genres",
      key: "genres",
      render: (genres) => (genres ? genres.join(", ") : ""),
    },
    {
      title: "언어",
      dataIndex: "language",
      key: "language",
    },
    {
      title: "플레이리스트",
      key: "playlists",
      render: (_, record) =>
        trackPlaylistMap[record.id]?.length
          ? trackPlaylistMap[record.id].join(", ")
          : "없음",
    },
    {
      title: "동작",
      key: "action",
      render: (_, record) => (
        <>
          <Button
            type="link"
            onClick={() => handlePlaySingle(record)}
            style={{ padding: "0 5px" }}
          >
            재생
          </Button>
          <Button
            type="link"
            onClick={() => handleEditTrack(record)}
            style={{ padding: "0 5px" }}
          >
            편집
          </Button>
          <Button
            type="link"
            onClick={() => handleAddSingleTrack(record)}
            style={{ padding: "0 5px" }}
          >
            추가
          </Button>
        </>
      ),
    },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Button
          onClick={handleBatchPlay}
          disabled={!selectedRowKeys.length}
          style={{ marginRight: 8 }}
        >
          선택된 트랙 재생
        </Button>
        <Button
          onClick={handleBatchAddToPlaylist}
          disabled={!selectedRowKeys.length}
        >
          선택된 트랙 플레이리스트에 추가
        </Button>
      </div>
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: handleSelectChange,
        }}
        columns={columns}
        dataSource={tracks}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: true }}
      />
    </>
  );
};

export default TrackTable;
