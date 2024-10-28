// SavedMusicList.jsx
import React, { useEffect, useState } from "react";
import { Tabs, Spin, message, Row, Col, Modal } from "antd";
import TrackTable from "../components/TrackTable";
import PlaylistTable from "../components/PlaylistTable";
import AudioPlayer from "../components/AudioPlayer";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import {
  useFirestoreQuery,
  useFirestoreAddData,
  useFirestoreUpdateData,
} from "../hooks/useFirestores";
import { openDB } from "idb";

const { TabPane } = Tabs;

// IndexedDB 설정
const DB_NAME = "musicCacheDB";
const DB_VERSION = 1;
const STORE_TRACKS = "tracks";
const STORE_PLAYLISTS = "track_play_list"; // 실제 컬렉션 이름으로 변경
const STORE_AUDIO_CACHE = "audioCache";

const SavedMusicList = () => {
  // 상태 관리
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [currentPlaylist, setCurrentPlaylist] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [activeTab, setActiveTab] = useState("all_tracks");
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState(null);
  // 추가된 상태
  const [trackPlaylistMap, setTrackPlaylistMap] = useState({});
  // Firestore hooks (컬렉션 이름 수정)
  const trackQuery = useFirestoreQuery();
  const playListQuery = useFirestoreQuery();
  const addPlaylist = useFirestoreAddData("track_play_list"); // 수정
  const updatePlaylist = useFirestoreUpdateData("track_play_list"); // 수정

  // IndexedDB 초기화
  const initializeDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_TRACKS)) {
          db.createObjectStore(STORE_TRACKS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) {
          db.createObjectStore(STORE_PLAYLISTS, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_CACHE)) {
          db.createObjectStore(STORE_AUDIO_CACHE);
        }
      },
    });
  };

  // IndexedDB에 데이터 저장
  const saveToIndexedDB = async (storeName, data) => {
    try {
      const db = await initializeDB();
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      data.forEach((item) => store.put(item));
      await tx.done;
      console.log(`${storeName} 저장 완료`);
    } catch (error) {
      console.error(`${storeName} 저장 실패:`, error);
      throw error;
    }
  };

  // IndexedDB에서 데이터 가져오기
  const getFromIndexedDB = async (storeName) => {
    try {
      const db = await initializeDB();
      const store = db.transaction(storeName).objectStore(storeName);
      const allData = await store.getAll();
      console.log(`${storeName} 데이터 가져오기 완료`);
      return allData;
    } catch (error) {
      console.error(`${storeName} 데이터 가져오기 실패:`, error);
      return [];
    }
  };

  // 특정 트랙 가져오기
  const getTrackFromIndexedDB = async (trackId) => {
    try {
      if (!trackId) throw new Error("트랙 ID가 지정되지 않았습니다.");
      const db = await initializeDB();
      const store = db.transaction(STORE_TRACKS).objectStore(STORE_TRACKS);
      const track = await store.get(trackId);
      if (!track) throw new Error(`트랙을 찾을 수 없습니다: ${trackId}`);
      return track;
    } catch (error) {
      console.error(`트랙 가져오기 실패 (ID: ${trackId}):`, error);
      return null;
    }
  };

  // 오프라인/온라인 상태 관리
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      message.success("온라인 상태입니다. 데이터를 동기화합니다.");
      syncData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      message.warning("오프라인 상태입니다. 캐시된 데이터를 사용합니다.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // 데이터 동기화
  const syncData = async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    Modal.info({
      title: "데이터 동기화 중...",
      content: "데이터를 동기화하는 중입니다. 잠시만 기다려 주세요.",
      closable: false,
      maskClosable: false,
      okButtonProps: { style: { display: "none" } },
    });

    try {
      const [tracksData, playlistsData] = await Promise.all([
        trackQuery.getDocuments("tracks"),
        playListQuery.getDocuments("track_play_list"), // Firestore 쿼리 시에도 실제 컬렉션 이름 사용
      ]);

      // IndexedDB에 데이터 저장
      await saveToIndexedDB(STORE_TRACKS, tracksData);
      await saveToIndexedDB(STORE_PLAYLISTS, playlistsData);

      // 오디오 파일 캐싱
      await cacheAudioFiles(tracksData);
      // 추가된 계산
      const trackPlaylistMap = calculateTrackPlaylistMap(
        tracksData,
        playlistsData
      );
      setTrackPlaylistMap(trackPlaylistMap);

      setTracks(tracksData);
      setPlaylists(playlistsData);
      message.success("데이터 동기화가 완료되었습니다.");
    } catch (error) {
      console.error("데이터 동기화 실패:", error);
      message.error("데이터 동기화 중 오류가 발생했습니다.");
    } finally {
      Modal.destroyAll();
      setIsSyncing(false);
    }
  };
  const calculateTrackPlaylistMap = (tracks, playlists) => {
    const map = {};
    tracks.forEach((track) => {
      map[track.id] = playlists
        .filter((playlist) =>
          playlist.tracks.some((trackRef) => trackRef.id === track.id)
        )
        .map((playlist) => playlist.name);
    });
    return map;
  };

  // 오디오 파일 캐싱 함수
  const cacheAudioFiles = async (tracks) => {
    console.log("오디오 파일 캐싱 시작...");
    const db = await initializeDB();

    for (const track of tracks) {
      try {
        // 트랙이 이미 캐시되어 있는지 확인
        const txCheck = db.transaction(STORE_AUDIO_CACHE, "readonly");
        const audioStoreCheck = txCheck.objectStore(STORE_AUDIO_CACHE);
        const cached = await audioStoreCheck.get(track.id);
        await txCheck.done;

        if (!cached) {
          console.log(`캐싱 중: ${track.title}`);

          // 오디오 데이터를 먼저 가져옴
          const response = await fetch(track.path);
          if (!response.ok)
            throw new Error(`오디오 파일을 가져올 수 없습니다: ${track.path}`);
          const blob = await response.blob();

          // 트랜잭션을 생성하여 저장
          const txSave = db.transaction(STORE_AUDIO_CACHE, "readwrite");
          const audioStoreSave = txSave.objectStore(STORE_AUDIO_CACHE);
          audioStoreSave.put(blob, track.id);
          await txSave.done;

          console.log(`캐싱 완료: ${track.title}`);
        } else {
          console.log(`이미 캐시됨: ${track.title}`);
        }
      } catch (error) {
        console.error(`트랙 캐싱 실패: ${track.title}`, error);
      }
    }

    console.log("오디오 파일 캐싱 완료");
    message.success("오디오 파일 캐싱이 완료되었습니다.");
  };

  // 앱 초기화
  const initializeApp = async () => {
    setIsLoading(true);
    try {
      const [cachedTracks, cachedPlaylists] = await Promise.all([
        getFromIndexedDB(STORE_TRACKS),
        getFromIndexedDB(STORE_PLAYLISTS),
      ]);

      if (cachedTracks.length && cachedPlaylists.length) {
        setTracks(cachedTracks);
        setPlaylists(cachedPlaylists);

        // 추가된 계산
        const trackPlaylistMap = calculateTrackPlaylistMap(
          cachedTracks,
          cachedPlaylists
        );
        setTrackPlaylistMap(trackPlaylistMap);
        console.log("캐시된 데이터 로드 완료");
      }

      if (isOnline) {
        await syncData();
      }
    } catch (error) {
      console.error("초기화 오류:", error);
      message.error("데이터 로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 트랙 재생 핸들러
  const handlePlayTracks = async (selectedTracks) => {
    try {
      if (!selectedTracks || selectedTracks.length === 0) {
        message.error("재생할 트랙이 선택되지 않았습니다.");
        return;
      }

      const trackIds = selectedTracks.map((track) => track.id).filter(Boolean);

      if (trackIds.length === 0) {
        message.error("유효한 트랙 ID가 없습니다.");
        return;
      }

      const tracksToPlay = await Promise.all(
        trackIds.map((id) => getTrackFromIndexedDB(id))
      );
      const validTracks = tracksToPlay.filter(Boolean);

      if (validTracks.length === 0) {
        message.error("재생할 수 있는 트랙이 없습니다.");
        return;
      }

      setCurrentPlaylist(validTracks);
      console.log("재생할 트랙 설정 완료:", validTracks);
    } catch (error) {
      console.error("재생 준비 실패:", error);
      message.error("재생 준비 중 오류가 발생했습니다.");
    }
  };

  // 플레이리스트 재생 핸들러
  const handlePlayPlaylist = async (playlist) => {
    if (!playlist?.tracks?.length) {
      message.warning("플레이리스트가 비어있습니다.");
      return;
    }

    try {
      const tracksToPlay = await Promise.all(
        playlist.tracks.map((track) => getTrackFromIndexedDB(track.id))
      );
      const validTracks = tracksToPlay.filter(Boolean);

      if (validTracks.length === 0) {
        message.error("재생할 수 있는 트랙이 없습니다.");
        return;
      }

      setCurrentPlaylist(validTracks);
      console.log("플레이리스트 재생 설정 완료:", validTracks);
    } catch (error) {
      console.error("플레이리스트 재생 준비 실패:", error);
      message.error("플레이리스트 재생 준비 중 오류가 발생했습니다.");
    }
  };

  // 단일 트랙을 플레이리스트에 추가하는 함수
  const handleAddSingleTrackToPlaylist = (track) => {
    setSelectedTrackIds([track.id]);
    setIsModalVisible(true);
  };

  // 여러 트랙을 플레이리스트에 추가하는 함수
  const handleAddMultipleTracksToPlaylist = (trackIds) => {
    setSelectedTrackIds(trackIds);
    setIsModalVisible(true);
  };

  // 플레이리스트에 트랙 추가 핸들러
  const handleAddToPlaylist = async () => {
    try {
      if (newPlaylistName) {
        // 새로운 플레이리스트 생성
        const newPlaylist = await addPlaylist.addData({
          name: newPlaylistName,
          tracks: selectedTrackIds.map((id, index) => ({
            id,
            playIndex: index + 1,
          })),
        });

        // IndexedDB에 저장
        await saveToIndexedDB(STORE_PLAYLISTS, [newPlaylist]);

        setPlaylists((prev) => [...prev, newPlaylist]);
        message.success("새 플레이리스트가 생성되었습니다.");
      } else if (selectedPlaylist) {
        console.log(selectedPlaylist);
        console.log(selectedTrackIds);
        // 기존 플레이리스트에 트랙 추가
        const playlist = playlists.find((p) => p.id === selectedPlaylist);
        if (playlist) {
          const updatedTracks = [
            ...playlist.tracks,
            ...selectedTrackIds.map((id, index) => ({
              id,
              playIndex: playlist.tracks.length + index + 1,
            })),
          ];
          console.log("업데이트된 트랙:", updatedTracks);

          const updatedPlaylist = {
            ...playlist,
            tracks: updatedTracks,
          };

          await updatePlaylist.updateData(selectedPlaylist, {
            tracks: updatedTracks,
          });

          // IndexedDB 업데이트
          await saveToIndexedDB(STORE_PLAYLISTS, [updatedPlaylist]);

          setPlaylists((prev) =>
            prev.map((p) => (p.id === selectedPlaylist ? updatedPlaylist : p))
          );

          message.success("트랙이 플레이리스트에 추가되었습니다.");
        }
      } else {
        message.warning("플레이리스트를 선택하거나 새로 생성하세요.");
        return;
      }

      // 모달 닫기 및 상태 초기화
      setIsModalVisible(false);
      setNewPlaylistName("");
      setSelectedPlaylist("");
      setSelectedTrackIds([]);
    } catch (error) {
      console.error("플레이리스트 수정 실패:", error);
      message.error("플레이리스트 수정 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="p-4">
      <div
        className={`mb-2 ${isOnline ? "text-green-500" : "text-orange-500"}`}
      >
        {isOnline ? "온라인 모드" : "오프라인 모드 (캐시된 데이터 사용)"}
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <AudioPlayer playlist={currentPlaylist} />
        </Col>
        <Col xs={24}>
          {isLoading || isSyncing ? (
            <div className="flex flex-col items-center justify-center p-8">
              <Spin size="large" />
              <div className="mt-4">
                {isSyncing ? "데이터 동기화 중..." : "데이터 로딩 중..."}
              </div>
            </div>
          ) : (
            <Tabs
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                // 탭 변경 시 선택된 플레이리스트 초기화
                if (key !== "playlists") {
                  setSelectedPlaylistForView(null);
                }
              }}
            >
              <TabPane tab="전체곡" key="all_tracks">
                <TrackTable
                  tracks={tracks}
                  trackPlaylistMap={trackPlaylistMap} // 추가된 부분
                  onPlay={handlePlayTracks}
                  onAddToPlaylist={handleAddSingleTrackToPlaylist}
                  onBatchAddToPlaylist={handleAddMultipleTracksToPlaylist}
                />
              </TabPane>
              <TabPane tab="플레이리스트" key="playlists">
                <PlaylistTable
                  playlists={playlists}
                  tracks={tracks}
                  onPlay={handlePlayPlaylist}
                  onSelect={(playlist) => setSelectedPlaylistForView(playlist)}
                />
                {selectedPlaylistForView && (
                  <div style={{ marginTop: "16px" }}>
                    <h3>{selectedPlaylistForView.name}</h3>
                    <TrackTable
                      tracks={selectedPlaylistForView.tracks
                        .map((trackRef) =>
                          tracks.find((t) => t.id === trackRef.id)
                        )
                        .filter(Boolean)}
                      onPlay={handlePlayTracks}
                      onAddToPlaylist={handleAddSingleTrackToPlaylist}
                      onBatchAddToPlaylist={handleAddMultipleTracksToPlaylist}
                    />
                  </div>
                )}
              </TabPane>
            </Tabs>
          )}
        </Col>
      </Row>

      <AddToPlaylistModal
        visible={isModalVisible}
        playlists={playlists}
        onCancel={() => {
          setIsModalVisible(false);
          setNewPlaylistName("");
          setSelectedPlaylist("");
          setSelectedTrackIds([]);
        }}
        onCreatePlaylist={handleAddToPlaylist}
        newPlaylistName={newPlaylistName}
        setNewPlaylistName={setNewPlaylistName}
        selectedPlaylist={selectedPlaylist}
        setSelectedPlaylist={setSelectedPlaylist}
      />
    </div>
  );
};

export default SavedMusicList;
