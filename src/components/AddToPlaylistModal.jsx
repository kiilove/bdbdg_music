// AddToPlaylistModal.jsx
import React, { useState } from "react";
import { Modal, Input, Button, List, message } from "antd";
import { PlusOutlined, CloseOutlined } from "@ant-design/icons";

const AddToPlaylistModal = ({
  visible,
  newPlaylistName,
  setNewPlaylistName,
  selectedPlaylist,
  setSelectedPlaylist,
  playlists,
  onCreatePlaylist,
  onCancel,
}) => {
  const [isAddingNewPlaylist, setIsAddingNewPlaylist] = useState(false);

  return (
    <Modal
      title="플레이리스트에 추가"
      visible={visible} // prop 이름 수정
      onOk={onCreatePlaylist} // 상위 컴포넌트의 함수 호출
      onCancel={onCancel}
      okText="추가"
      cancelText="취소"
    >
      <List
        bordered
        dataSource={playlists}
        renderItem={(playlist) => (
          <List.Item
            onClick={() => setSelectedPlaylist(playlist.id)}
            style={{
              cursor: "pointer",
              backgroundColor:
                selectedPlaylist === playlist.id ? "#e6f7ff" : "white",
            }}
          >
            {playlist.name}
          </List.Item>
        )}
        header={
          isAddingNewPlaylist ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <Input
                autoFocus
                placeholder="새 플레이리스트 이름 입력"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                style={{ marginRight: 8 }}
              />
              <Button
                icon={<CloseOutlined />}
                onClick={() => {
                  setIsAddingNewPlaylist(false);
                  setNewPlaylistName("");
                }}
              />
              <Button
                icon={<PlusOutlined />}
                onClick={() => {
                  if (!newPlaylistName.trim()) {
                    message.warning("플레이리스트 이름을 입력하세요.");
                    return;
                  }
                  onCreatePlaylist(); // 새로운 플레이리스트 생성 요청
                  setIsAddingNewPlaylist(false);
                }}
                style={{ marginLeft: 8 }}
              >
                생성
              </Button>
            </div>
          ) : (
            <Button
              icon={<PlusOutlined />}
              type="dashed"
              block
              onClick={() => setIsAddingNewPlaylist(true)}
            >
              새 플레이리스트 추가
            </Button>
          )
        }
      />
    </Modal>
  );
};

export default AddToPlaylistModal;
