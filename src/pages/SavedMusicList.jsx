// src/pages/SavedMusicList.js
import React, { useEffect } from "react";
import { Table, Tabs, Spin, message, Button } from "antd";
import { useFirestoreQuery } from "../hooks/useFirestores"; // 커스텀 훅
import { useNavigate } from "react-router-dom";

const { TabPane } = Tabs;

const SavedMusicList = () => {
  const navigate = useNavigate();

  // 'songs' 컬렉션 데이터 불러오기
  const fetchSongs = useFirestoreQuery();
  const {
    data: songsData,
    loading: songsLoading,
    error: songsError,
    fetchData: fetchSongsData,
  } = fetchSongs;

  // 'play_lists' 컬렉션 데이터 불러오기
  const fetchPlaylists = useFirestoreQuery();
  const {
    data: playlistsData,
    loading: playlistsLoading,
    error: playlistsError,
    fetchData: fetchPlaylistsData,
  } = fetchPlaylists;

  // 현재 활성 탭 상태 관리
  const [activeTab, setActiveTab] = React.useState("all_songs");

  useEffect(() => {
    // 'songs'와 'play_lists' 컬렉션을 실시간으로 구독
    const unsubscribeSongs = fetchSongsData("songs", "createdAt", "desc");
    const unsubscribePlaylists = fetchPlaylistsData(
      "play_lists",
      "createdAt",
      "desc"
    );

    // 컴포넌트 언마운트 시 구독 해제
    return () => {
      unsubscribeSongs();
      unsubscribePlaylists();
    };
  }, [fetchSongsData, fetchPlaylistsData]);

  useEffect(() => {
    if (songsError) {
      message.error("전체곡 목록을 불러오는 중 오류가 발생했습니다.");
    }
    if (playlistsError) {
      message.error("플레이리스트 목록을 불러오는 중 오류가 발생했습니다.");
    }
  }, [songsError, playlistsError]);

  // 탭 변경 핸들러
  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  // "전체곡" 탭의 테이블 컬럼 정의
  const songsColumns = [
    {
      title: "제목",
      dataIndex: "title",
      key: "title",
    },
    {
      title: "파일명",
      dataIndex: "fileName",
      key: "fileName",
    },
    {
      title: "동작",
      key: "action",
      render: (text, record) => (
        <>
          <Button
            type="link"
            onClick={() => {
              navigate("/editor", { state: { audioUrl: record.url } });
            }}
            style={{ marginRight: 8 }}
          >
            재생시간 설정
          </Button>
          {/* 플레이리스트에 추가 기능을 원할 경우 추가할 수 있습니다 */}
        </>
      ),
    },
  ];

  // "플레이리스트" 탭의 테이블 컬럼 정의
  const playlistsColumns = [
    {
      title: "플레이리스트 이름",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "동작",
      key: "action",
      render: (text, record) => (
        <>
          <Button
            type="link"
            onClick={() => {
              navigate("/playlist", { state: { playlistId: record.id } });
            }}
          >
            보기
          </Button>
        </>
      ),
    },
  ];

  // 로딩 상태 관리: 두 컬렉션 중 하나라도 로딩 중일 경우 스피너 표시
  const isLoading = songsLoading || playlistsLoading;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">저장된 음악 목록</h2>
      {isLoading ? (
        <Spin className="flex justify-center items-center min-h-screen" />
      ) : (
        <Tabs activeKey={activeTab} onChange={handleTabChange}>
          <TabPane tab="전체곡" key="all_songs">
            <Table
              dataSource={songsData}
              columns={songsColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane tab="플레이리스트" key="playlists">
            <Table
              dataSource={playlistsData}
              columns={playlistsColumns}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
        </Tabs>
      )}
    </div>
  );
};

export default SavedMusicList;
