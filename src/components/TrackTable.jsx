// TrackTable.jsx
import React, { useMemo, useState, useCallback } from "react";
import {
  Table,
  Button,
  Card,
  List,
  message,
  Col,
  Row,
  Switch,
  Space,
  Badge,
} from "antd";
import { useNavigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";

const TrackTable = ({
  tracks = [],
  onPlay,
  onAddToPlaylist,
  onBatchAddToPlaylist,
  trackPlaylistMap = {},
}) => {
  const navigate = useNavigate();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const safeNumber = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  };

  const formatTime = (time) => {
    const t = safeNumber(time, 0);
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  const handleSelectChange = (keys) => setSelectedRowKeys(keys);

  const toPlayable = (track) => ({
    id: track.id,
    title: track.title,
    path: track.path,
    albumArt: track.albumArt || "/default-album-art.jpg",
    startTime: safeNumber(track.startTime, 0),
    endTime: safeNumber(track.endTime, 0),
  });

  const handlePlaySingle = useCallback(
    (track) => {
      if (!track || !track.path) {
        message.error("재생할 수 없는 트랙입니다.");
        return;
      }
      onPlay?.([toPlayable(track)]);
    },
    [onPlay]
  );

  const handleBatchPlay = useCallback(() => {
    if (!selectedRowKeys.length) {
      message.warning("재생할 트랙을 선택하세요.");
      return;
    }
    const selectedTracks = tracks
      .filter((t) => selectedRowKeys.includes(t.id) && t.path)
      .map(toPlayable);

    if (!selectedTracks.length) {
      message.error("선택된 트랙 중 재생 가능한 항목이 없습니다.");
      return;
    }
    onPlay?.(selectedTracks);
    setSelectedRowKeys([]);
  }, [selectedRowKeys, tracks, onPlay]);

  const handleBatchAddToPlaylist = useCallback(() => {
    if (!selectedRowKeys.length) {
      message.warning("플레이리스트에 추가할 트랙을 선택하세요.");
      return;
    }
    onBatchAddToPlaylist?.(selectedRowKeys);
    setSelectedRowKeys([]);
  }, [selectedRowKeys, onBatchAddToPlaylist]);

  const handleEditTrack = (track) => {
    navigate(`/track-editor/${track.id}`);
  };

  const handleAddSingleTrack = (track) => {
    if (!track) {
      message.error("추가할 트랙이 존재하지 않습니다.");
      return;
    }
    onAddToPlaylist?.(track);
  };

  // ✅ 필터링된 트랙 (미포함만 보기)
  const filteredTracks = useMemo(() => {
    if (!showUnassignedOnly) return tracks;
    return tracks.filter((t) => {
      const list = trackPlaylistMap[t.id];
      return !Array.isArray(list) || list.length === 0;
    });
  }, [showUnassignedOnly, tracks, trackPlaylistMap]);

  // ✅ 데스크탑 컬럼
  const columns = useMemo(
    () => [
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
        width: 80,
        fixed: "left",
      },
      {
        title: "제목",
        dataIndex: "title",
        key: "title",
        render: (text, record) => (
          <span
            onClick={() => handleEditTrack(record)}
            style={{ cursor: "pointer", color: "#1890ff" }}
            title={text}
          >
            {text}
          </span>
        ),
        ellipsis: true,
      },
      {
        title: "장르",
        dataIndex: "genres",
        key: "genres",
        render: (genres) =>
          Array.isArray(genres) && genres.length ? genres.join(", ") : "",
        ellipsis: true,
        width: 160,
      },
      {
        title: "언어",
        dataIndex: "language",
        key: "language",
        width: 100,
      },
      {
        title: "시작",
        dataIndex: "startTime",
        key: "startTime",
        render: (t) => formatTime(t),
        width: 90,
      },
      {
        title: "종료",
        dataIndex: "endTime",
        key: "endTime",
        render: (t) => formatTime(t),
        width: 90,
      },
      {
        title: "플레이리스트",
        key: "playlists",
        render: (_, record) =>
          Array.isArray(trackPlaylistMap[record.id]) &&
          trackPlaylistMap[record.id].length
            ? trackPlaylistMap[record.id].join(", ")
            : "없음",
        ellipsis: true,
        width: 200,
      },
      {
        title: "동작",
        key: "action",
        fixed: "right",
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
        width: 180,
      },
    ],
    [trackPlaylistMap]
  );

  // ===== 모바일 렌더링 =====
  if (isMobile) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex gap-2">
            <Button
              onClick={handleBatchPlay}
              disabled={!selectedRowKeys.length}
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
          <Space size="small">
            <Switch
              checked={showUnassignedOnly}
              onChange={setShowUnassignedOnly}
              size="small"
            />
            <span>미포함만 보기</span>
            <Badge
              count={filteredTracks.length}
              style={{ backgroundColor: "#1890ff" }}
            />
          </Space>
        </div>

        <List
          grid={{ gutter: 16, column: 1 }}
          dataSource={filteredTracks}
          renderItem={(track) => {
            const selected = selectedRowKeys.includes(track.id);
            return (
              <Card
                key={track.id}
                onClick={() =>
                  setSelectedRowKeys((prev) =>
                    prev.includes(track.id)
                      ? prev.filter((k) => k !== track.id)
                      : [...prev, track.id]
                  )
                }
                bodyStyle={{
                  background: selected ? "rgba(24, 144, 255, 0.06)" : undefined,
                }}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTrack(track);
                        }}
                      >
                        {track.title}
                      </h4>
                      <p style={{ marginBottom: 2, color: "#595959" }}>
                        장르:{" "}
                        {Array.isArray(track.genres) && track.genres.length
                          ? track.genres.join(", ")
                          : "없음"}
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
                        {Array.isArray(trackPlaylistMap[track.id]) &&
                        trackPlaylistMap[track.id].length
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
            );
          }}
        />
      </div>
    );
  }

  // ===== 데스크탑 렌더링 =====
  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <Button
            onClick={handleBatchPlay}
            disabled={!selectedRowKeys.length}
            style={{ marginRight: 8 }}
          >
            선택된 트랙 재생
          </Button>
        </div>

        <Space size="small">
          <Switch
            checked={showUnassignedOnly}
            onChange={setShowUnassignedOnly}
          />
          <span>미포함만 보기</span>
          <Badge
            count={filteredTracks.length}
            style={{ backgroundColor: "#1890ff" }}
          />
          <Button
            onClick={handleBatchAddToPlaylist}
            disabled={!selectedRowKeys.length}
          >
            선택된 트랙 플레이리스트에 추가
          </Button>
        </Space>
      </div>

      <Table
        rowSelection={{ selectedRowKeys, onChange: handleSelectChange }}
        onRow={(record) => ({ onDoubleClick: () => handleEditTrack(record) })}
        columns={columns}
        dataSource={filteredTracks}
        rowKey="id"
        pagination={{ pageSize: 10 }}
        scroll={{ x: 900 }}
      />
    </>
  );
};

export default React.memo(TrackTable);
