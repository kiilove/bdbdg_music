// SavedMusicList.jsx
import React, { useEffect, useState, useCallback } from "react";
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

// Firestore SDK (경로는 프로젝트에 맞게)
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const { TabPane } = Tabs;

// ====== IndexedDB & Store Names ======
const DB_NAME = "musicCacheDB";
const BASE_DB_VERSION = 1;

const STORE_TRACKS = "tracks";
const STORE_PLAYLISTS = "track_play_list";
const STORE_AUDIO_CACHE = "audioCache";

// 레거시 스토어명을 표준 스토어로 마이그레이션
const LEGACY_PLAYLIST_STORES = ["track_playlists", "playlists"];
const LEGACY_TRACK_STORES = ["track", "music_tracks"];

// ====== IDB: 자가-치유 & 마이그레이션 ======
async function openDbRaw(version = BASE_DB_VERSION, upgradeCb) {
  return openDB(DB_NAME, version, { upgrade: upgradeCb });
}

async function ensureStores() {
  let db = await openDbRaw();
  let needUpgrade = false;

  if (!db.objectStoreNames.contains(STORE_TRACKS)) needUpgrade = true;
  if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) needUpgrade = true;
  if (!db.objectStoreNames.contains(STORE_AUDIO_CACHE)) needUpgrade = true;

  if (needUpgrade) {
    const newVersion = db.version + 1;
    db.close();
    db = await openDbRaw(newVersion, (dbOnUpgrade) => {
      if (!dbOnUpgrade.objectStoreNames.contains(STORE_TRACKS)) {
        dbOnUpgrade.createObjectStore(STORE_TRACKS, { keyPath: "id" });
      }
      if (!dbOnUpgrade.objectStoreNames.contains(STORE_PLAYLISTS)) {
        dbOnUpgrade.createObjectStore(STORE_PLAYLISTS, { keyPath: "id" });
      }
      if (!dbOnUpgrade.objectStoreNames.contains(STORE_AUDIO_CACHE)) {
        dbOnUpgrade.createObjectStore(STORE_AUDIO_CACHE);
      }
    });
  }

  // 레거시 → 표준 마이그레이션
  for (const legacy of LEGACY_PLAYLIST_STORES) {
    if (db.objectStoreNames.contains(legacy)) {
      const tx = db.transaction([legacy, STORE_PLAYLISTS], "readwrite");
      const all = await tx.objectStore(legacy).getAll();
      if (Array.isArray(all) && all.length) {
        for (const pl of all) {
          if (pl?.id) await tx.objectStore(STORE_PLAYLISTS).put(pl);
        }
      }
      await tx.done;
    }
  }
  for (const legacy of LEGACY_TRACK_STORES) {
    if (db.objectStoreNames.contains(legacy)) {
      const tx = db.transaction([legacy, STORE_TRACKS], "readwrite");
      const all = await tx.objectStore(legacy).getAll();
      if (Array.isArray(all) && all.length) {
        for (const t of all) {
          if (t?.id) await tx.objectStore(STORE_TRACKS).put(t);
        }
      }
      await tx.done;
    }
  }

  return db;
}

async function getDB() {
  return ensureStores();
}

// ====== IDB helpers ======
async function saveToIndexedDB(storeName, data) {
  const db = await getDB();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  data.forEach((item) => store.put(item));
  await tx.done;
}

async function getAllFromIndexedDB(storeName) {
  const db = await getDB();
  const store = db.transaction(storeName).objectStore(storeName);
  return store.getAll();
}

async function getTrackFromIDB(trackId) {
  const db = await getDB();
  const store = db.transaction(STORE_TRACKS).objectStore(STORE_TRACKS);
  return store.get(trackId);
}

async function cacheAudioBlob(id, blob) {
  const db = await getDB();
  const tx = db.transaction(STORE_AUDIO_CACHE, "readwrite");
  tx.objectStore(STORE_AUDIO_CACHE).put(blob, id);
  await tx.done;
}

async function getCachedAudioBlob(id) {
  const db = await getDB();
  const store = db
    .transaction(STORE_AUDIO_CACHE)
    .objectStore(STORE_AUDIO_CACHE);
  return store.get(id);
}

// ====== Firestore fallback for tracks (상위 & 서브컬렉션) ======
async function readTrackFromFirestore(trackId, playlistId) {
  // 1) 상위 /tracks
  let snap = await getDoc(doc(db, STORE_TRACKS, String(trackId)));
  if (!snap.exists() && playlistId) {
    // 2) /track_play_list/{pid}/tracks/{trackId}
    try {
      snap = await getDoc(
        doc(
          db,
          STORE_PLAYLISTS,
          String(playlistId),
          STORE_TRACKS,
          String(trackId)
        )
      );
    } catch (_) {}
  }
  if (!snap.exists()) return null;

  const track = { id: snap.id, ...snap.data() };
  await saveToIndexedDB(STORE_TRACKS, [track]); // 캐시
  return track;
}

// ====== Utils ======
const normalizeTrackRef = (ref) => {
  if (typeof ref === "string") return { id: ref };
  if (ref && typeof ref === "object")
    return { id: ref.id, playIndex: ref.playIndex };
  return null;
};

const calculateTrackPlaylistMap = (tracks, playlists) => {
  const map = {};
  const ids = new Set(tracks.map((t) => t.id));
  for (const t of ids) map[t] = [];

  playlists.forEach((pl) => {
    const refs = Array.isArray(pl.tracks)
      ? pl.tracks.map(normalizeTrackRef).filter(Boolean)
      : [];
    refs.forEach((r) => {
      if (ids.has(r.id)) {
        if (!map[r.id]) map[r.id] = [];
        map[r.id].push(pl.name);
      }
    });
  });
  return map;
};

// ====== Component ======
const SavedMusicList = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [trackPlaylistMap, setTrackPlaylistMap] = useState({});

  const [currentPlaylist, setCurrentPlaylist] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [activeTab, setActiveTab] = useState("all_tracks");
  const [selectedPlaylistForView, setSelectedPlaylistForView] = useState(null);

  // Firestore hooks
  const trackQuery = useFirestoreQuery();
  const playListQuery = useFirestoreQuery();
  const addPlaylist = useFirestoreAddData(STORE_PLAYLISTS);
  const updatePlaylist = useFirestoreUpdateData(STORE_PLAYLISTS);

  // online/offline
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

  // 초기화
  const initializeApp = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cachedTracks, cachedPlaylists] = await Promise.all([
        getAllFromIndexedDB(STORE_TRACKS),
        getAllFromIndexedDB(STORE_PLAYLISTS),
      ]);

      if (cachedTracks.length || cachedPlaylists.length) {
        setTracks(cachedTracks);
        setPlaylists(cachedPlaylists);
        setTrackPlaylistMap(
          calculateTrackPlaylistMap(cachedTracks, cachedPlaylists)
        );
      }

      if (isOnline) {
        await syncData();
      }
    } catch (e) {
      console.error("초기화 오류:", e);
      message.error("데이터 로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  useEffect(() => {
    initializeApp();
  }, [initializeApp]);

  // 동기화
  const syncData = useCallback(async () => {
    if (!isOnline) return;
    setIsSyncing(true);

    const modal = Modal.info({
      title: "데이터 동기화 중...",
      content: "데이터를 동기화하는 중입니다. 잠시만 기다려 주세요.",
      closable: false,
      maskClosable: false,
      okButtonProps: { style: { display: "none" } },
    });

    try {
      const [tracksData, playlistsData] = await Promise.all([
        trackQuery.getDocuments(STORE_TRACKS),
        playListQuery.getDocuments(STORE_PLAYLISTS),
      ]);

      // IDB 저장
      await saveToIndexedDB(STORE_TRACKS, tracksData);
      await saveToIndexedDB(STORE_PLAYLISTS, playlistsData);

      // 메모리 반영
      setTracks(tracksData);
      setPlaylists(playlistsData);
      setTrackPlaylistMap(calculateTrackPlaylistMap(tracksData, playlistsData));

      // 오디오 캐시 (best-effort)
      cacheAudioFiles(tracksData).catch((e) =>
        console.debug("오디오 캐시 오류(무시):", e)
      );

      message.success("데이터 동기화가 완료되었습니다.");
    } catch (error) {
      console.error("데이터 동기화 실패:", error);
      message.error("데이터 동기화 중 오류가 발생했습니다.");
    } finally {
      modal.destroy();
      setIsSyncing(false);
    }
  }, [isOnline, trackQuery, playListQuery]);

  // 오디오 파일 캐시 (best-effort)
  const cacheAudioFiles = async (tracks) => {
    const db = await getDB();
    for (const track of tracks) {
      try {
        const exists = await getCachedAudioBlob(track.id);
        if (exists) continue;

        if (!track?.path) continue; // 경로 없으면 스킵
        const res = await fetch(track.path, { mode: "cors" });
        if (!res.ok) throw new Error(`오디오 fetch 실패: ${track.path}`);
        const blob = await res.blob();

        const tx = db.transaction(STORE_AUDIO_CACHE, "readwrite");
        tx.objectStore(STORE_AUDIO_CACHE).put(blob, track.id);
        await tx.done;
      } catch (error) {
        console.debug(`트랙 캐싱 실패(${track?.title || track?.id}):`, error);
      }
    }
    // 사용자 알림은 조용히 (대량 캐싱 시 UX 저하 방지)
  };

  // 재생: 트랙 배열
  const handlePlayTracks = async (selectedTracks) => {
    try {
      if (!selectedTracks?.length) {
        message.error("재생할 트랙이 선택되지 않았습니다.");
        return;
      }

      const trackIds = selectedTracks.map((t) => t.id).filter(Boolean);
      if (!trackIds.length) {
        message.error("유효한 트랙 ID가 없습니다.");
        return;
      }

      // IDB → Firestore 폴백(+캐시)
      const result = await Promise.all(
        trackIds.map(async (id) => {
          const fromIDB = await getTrackFromIDB(id);
          if (fromIDB) return fromIDB;

          // 플레이리스트 문맥이 없으니 상위 tracks만 먼저 시도
          const fromFS = await readTrackFromFirestore(id);
          return fromFS;
        })
      );
      const valid = result.filter(Boolean);
      if (!valid.length) {
        message.error("재생할 수 있는 트랙이 없습니다.");
        return;
      }

      setCurrentPlaylist(valid);
    } catch (error) {
      console.error("재생 준비 실패:", error);
      message.error("재생 준비 중 오류가 발생했습니다.");
    }
  };

  // 재생: 플레이리스트
  const handlePlayPlaylist = async (playlist) => {
    if (!playlist?.tracks?.length) {
      message.warning("플레이리스트가 비어있습니다.");
      return;
    }
    try {
      const refs = playlist.tracks.map(normalizeTrackRef).filter(Boolean);

      const tracksToPlay = await Promise.all(
        refs.map(async (r) => {
          const fromIDB = await getTrackFromIDB(r.id);
          if (fromIDB) return fromIDB;
          // 플레이리스트 컨텍스트로 서브컬렉션까지 시도
          return readTrackFromFirestore(r.id, playlist.id);
        })
      );

      const valid = tracksToPlay.filter(Boolean);
      if (!valid.length) {
        message.error("재생할 수 있는 트랙이 없습니다.");
        return;
      }
      setCurrentPlaylist(valid);
    } catch (error) {
      console.error("플레이리스트 재생 준비 실패:", error);
      message.error("플레이리스트 재생 준비 중 오류가 발생했습니다.");
    }
  };

  // 플리 추가(단일/다중)
  const handleAddSingleTrackToPlaylist = (track) => {
    if (!track?.id) {
      message.error("추가할 트랙이 존재하지 않습니다.");
      return;
    }
    setSelectedTrackIds([track.id]);
    setIsModalVisible(true);
  };
  const handleAddMultipleTracksToPlaylist = (trackIds) => {
    if (!trackIds?.length) {
      message.warning("플레이리스트에 추가할 트랙을 선택하세요.");
      return;
    }
    setSelectedTrackIds(trackIds);
    setIsModalVisible(true);
  };

  // 플리에 트랙 추가 저장
  const handleAddToPlaylist = async () => {
    try {
      if (newPlaylistName) {
        // 새 플레이리스트
        const newPlaylist = await addPlaylist.addData({
          name: newPlaylistName,
          tracks: selectedTrackIds.map((id, i) => ({ id, playIndex: i + 1 })),
          updatedAt: Date.now(),
        });
        await saveToIndexedDB(STORE_PLAYLISTS, [newPlaylist]);
        setPlaylists((prev) => [...prev, newPlaylist]);
        setTrackPlaylistMap((prev) => {
          const next = { ...prev };
          selectedTrackIds.forEach((id) => {
            next[id] = [...(next[id] || []), newPlaylist.name];
          });
          return next;
        });
        message.success("새 플레이리스트가 생성되었습니다.");
      } else if (selectedPlaylist) {
        const playlist = playlists.find((p) => p.id === selectedPlaylist);
        if (!playlist) {
          message.error("선택한 플레이리스트를 찾을 수 없습니다.");
          return;
        }
        const base = Array.isArray(playlist.tracks)
          ? playlist.tracks.map(normalizeTrackRef).filter(Boolean)
          : [];
        const appended = selectedTrackIds.map((id, idx) => ({
          id,
          playIndex: base.length + idx + 1,
        }));
        const updatedTracks = [...base, ...appended];

        const updatedPlaylist = {
          ...playlist,
          tracks: updatedTracks,
          updatedAt: Date.now(),
        };

        await updatePlaylist.updateData(selectedPlaylist, {
          tracks: updatedTracks,
          updatedAt: updatedPlaylist.updatedAt,
        });
        await saveToIndexedDB(STORE_PLAYLISTS, [updatedPlaylist]);

        setPlaylists((prev) =>
          prev.map((p) => (p.id === selectedPlaylist ? updatedPlaylist : p))
        );

        // 맵도 반영
        setTrackPlaylistMap((prev) => {
          const next = { ...prev };
          selectedTrackIds.forEach((id) => {
            next[id] = [...(next[id] || []), playlist.name];
          });
          return next;
        });

        message.success("트랙이 플레이리스트에 추가되었습니다.");
      } else {
        message.warning("플레이리스트를 선택하거나 새로 생성하세요.");
        return;
      }

      // 리셋
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
                if (key !== "playlists") setSelectedPlaylistForView(null);
              }}
            >
              <TabPane tab="전체곡" key="all_tracks">
                <TrackTable
                  tracks={tracks}
                  trackPlaylistMap={trackPlaylistMap}
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
                  <div style={{ marginTop: 16 }}>
                    <h3>{selectedPlaylistForView.name}</h3>
                    <TrackTable
                      tracks={selectedPlaylistForView.tracks
                        .map((ref) => {
                          const r = normalizeTrackRef(ref);
                          if (!r) return null;
                          return tracks.find((t) => t.id === r.id);
                        })
                        .filter(Boolean)}
                      trackPlaylistMap={trackPlaylistMap}
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
