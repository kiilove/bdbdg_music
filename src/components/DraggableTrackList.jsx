// components/DraggableTrackList.jsx
"use client";

import React, { useMemo } from "react";
// import ReactDOM from "react-dom"; // 💡 제거됨: 모달 없음
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Space, Button, Typography, Popconfirm, Tag } from "antd";
import {
  DragOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

/** 기본: 고유하고 안정적인 draggableId 생성 */
function defaultGetItemId(item, idx) {
  const raw =
    item?.id ||
    item?.fullPath ||
    item?.url ||
    `${item?.name || item?.title || "track"}-${idx}`;
  return String(raw).replace(/[^a-zA-Z0-9_\-.:]/g, "_");
}

/** 기본: 표시명 생성 */
function defaultGetItemName(item) {
  return (
    item?.displayName ||
    item?.name ||
    item?.title ||
    item?.filename ||
    item?.fullPath ||
    item?.url ||
    "이름 없음"
  );
}

/**
 * 재사용 가능한 드래그앤드롭 트랙 리스트 (일반 DOM 환경용)
 * props:
 * - items: Array<any>
 * - onReorder: (newList) => void
 * - onPreview: (track|null) => void
 * - onDelete: (track) => void
 * - previewTrack: 현재 재생 중 트랙
 * - getItemId?: (item, index) => string
 * - getItemName?: (item) => string
 * - showIndex?: boolean
 */
export default function DraggableTrackList({
  items = [],
  onReorder,
  onPreview,
  onDelete,
  previewTrack,
  getItemId = defaultGetItemId,
  getItemName = defaultGetItemName,
  // 💡 usePortal prop 제거됨
  showIndex = true,
}) {
  const rows = useMemo(
    () =>
      items.map((item, index) => ({
        item,
        index,
        id: getItemId(item, index),
        label: getItemName(item),
      })),
    [items, getItemId, getItemName]
  );

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    const reordered = Array.from(items);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder?.(reordered);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="track-list" direction="vertical">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            style={{
              maxHeight: 340,
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: 8,
              padding: 8,
              background: snapshot.isDraggingOver ? "#f5fbff" : "#fafafa",
            }}
          >
            {rows.map(({ item, index, id, label }) => {
              const isPlaying = previewTrack?.url === item?.url;

              const content = (drag, snap) => (
                <div
                  ref={drag.innerRef}
                  {...drag.draggableProps}
                  style={{
                    userSelect: "none",
                    marginBottom: 6,
                    background: snap.isDragging ? "#e6f7ff" : "#fff",
                    border: "1px solid #ddd",
                    borderRadius: 6,
                    padding: "6px 10px",
                    display: "grid",
                    gridTemplateColumns: showIndex
                      ? "44px 1fr auto"
                      : "1fr auto",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: snap.isDragging
                      ? "0 2px 6px rgba(0,0,0,0.15)"
                      : "none",
                    ...drag.draggableProps.style,
                  }}
                >
                  {/* 왼쪽 인덱스 + 핸들 */}
                  {showIndex && (
                    <Space>
                      <Tag
                        color="blue"
                        style={{ minWidth: 32, textAlign: "center" }}
                      >
                        {index + 1}
                      </Tag>
                      {/* 드래그 핸들 분리 로직 유지 (버튼 클릭 방지) */}
                      <span
                        {...drag.dragHandleProps}
                        style={{ cursor: "grab" }}
                      >
                        <DragOutlined style={{ color: "#999" }} />
                      </span>
                    </Space>
                  )}

                  {/* 이름/경로 영역 */}
                  <div
                    title={label}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Text>
                      {label}
                      {item?.playIndex ? (
                        <Text type="secondary"> (idx: {item.playIndex})</Text>
                      ) : null}
                    </Text>
                  </div>

                  {/* 우측 액션 */}
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        isPlaying ? (
                          <PauseCircleOutlined />
                        ) : (
                          <PlayCircleOutlined />
                        )
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview?.(isPlaying ? null : item);
                      }}
                    >
                      {isPlaying ? "정지" : "미리듣기"}
                    </Button>

                    <Popconfirm
                      title="이 트랙을 삭제할까요?"
                      okText="삭제"
                      cancelText="취소"
                      onConfirm={(e) => {
                        e?.stopPropagation?.();
                        onDelete?.(item);
                      }}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      >
                        삭제
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              );

              return (
                <Draggable key={id} draggableId={id} index={index}>
                  {(drag, snap) =>
                    // 💡 모달이 제거되었으므로, 포털 없이 인라인으로 렌더링합니다.
                    content(drag, snap)
                  }
                </Draggable>
              );
            })}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
