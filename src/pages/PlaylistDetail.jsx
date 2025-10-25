// src/components/PlaylistDetail.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { List, Button, message, Spin } from "antd";
import { useMediaQuery } from "react-responsive";
import { openDB } from "idb";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

// ===== Firestore SDK =====
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

// ===== Firestore Update Hook =====
import { useFirestoreUpdateData } from "../hooks/useFirestores";

// ===== AudioPlayer =====
import AudioPlayer from "../components/AudioPlayer";

// ===== Constants =====
const DB_NAME = "musicCacheDB";
const BASE_DB_VERSION = 1;

const STORE_PLAYLISTS = "track_play_list"; // Firestore 컬렉션명과 동일
const STORE_TRACKS = "tracks"; // Firestore 컬렉션명과 동일
const ItemType = "TRACK_ITEM";

// 과거에 사용했을 수 있는 레거시 스토어명
const LEGACY_PLAYLIST_STORES = ["track_playlists", "playlists"];
const LEGACY_TRACK_STORES = ["track", "music_tracks"];

// ===== IndexedDB Helpers (자가-치유 & 마이그레이션) =====
async function openDbRaw(version = BASE_DB_VERSION, upgradeCb) {
  return openDB(DB_NAME, version, { upgrade: upgradeCb });
}

async function ensureStores() {
  // 1) 현재 버전으로 시도
  let db = await openDbRaw();
  let needUpgrade = false;

  if (!db.objectStoreNames.contains(STORE_PLAYLISTS)) needUpgrade = true;
  if (!db.objectStoreNames.contains(STORE_TRACKS)) needUpgrade = true;

  // 2) 스토어 없으면 즉시 버전업 + 생성
  if (needUpgrade) {
    const newVersion = db.version + 1;
    db.close();
    db = await openDbRaw(newVersion, (dbOnUpgrade) => {
      if (!dbOnUpgrade.objectStoreNames.contains(STORE_PLAYLISTS)) {
        dbOnUpgrade.createObjectStore(STORE_PLAYLISTS, { keyPath: "id" });
      }
      if (!dbOnUpgrade.objectStoreNames.contains(STORE_TRACKS)) {
        dbOnUpgrade.createObjectStore(STORE_TRACKS, { keyPath: "id" });
      }
    });
  }

  // 3) 레거시 스토어 -> 표준 스토어로 1회성 마이그레이션
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

async function readPlaylistFromIDB(playlistId) {
  const db = await getDB();
  try {
    return await db.get(STORE_PLAYLISTS, playlistId);
  } catch (e) {
    console.warn("IDB readPlaylistFromIDB error:", e);
    return null;
  }
}

async function writePlaylistToIDB(playlist) {
  const db = await getDB();
  const tx = db.transaction(STORE_PLAYLISTS, "readwrite");
  await tx.store.put(playlist);
  await tx.done;
}

async function readTrackFromIDB(trackId) {
  const db = await getDB();
  try {
    return await db.get(STORE_TRACKS, trackId);
  } catch (e) {
    console.warn("IDB readTrackFromIDB error:", e);
    return null;
  }
}

async function writeTrackToIDB(track) {
  const db = await getDB();
  const tx = db.transaction(STORE_TRACKS, "readwrite");
  await tx.store.put(track);
  await tx.done;
}

// ===== Firestore Fallbacks =====
async function readPlaylistFromFirestore(playlistId) {
  const snap = await getDoc(doc(db, STORE_PLAYLISTS, String(playlistId)));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// 트랙은 상위 컬렉션(/tracks) 실패 시 플레이리스트 서브컬렉션(/track_play_list/{pid}/tracks)도 시도
async function readTrackFromFirestore(trackId, playlistId) {
  let snap = await getDoc(doc(db, STORE_TRACKS, String(trackId)));
  if (!snap.exists() && playlistId) {
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
  await writeTrackToIDB(track); // 캐시
  return track;
}

// ===== Utils =====
function formatTime(time) {
  if (isNaN(time) || time === undefined || time === null) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

function normalizeTrackRef(ref) {
  if (typeof ref === "string") return { id: ref };
  if (ref && typeof ref === "object")
    return { id: ref.id, playIndex: ref.playIndex };
  return null;
}

// ===== DnD Item (DraggableTrack) =====
function DraggableTrack({ track, findTrack, moveTrack, onDelete }) {
  const navigate = useNavigate();
  const found = findTrack(track.id);
  const originalIndex = found ? found.index : -1;

  const [{ isDragging }, drag] = useDrag(
    () => ({
      type: ItemType,
      item: { id: track.id, originalIndex },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
      end: (item, monitor) => {
        if (
          !monitor.didDrop() &&
          item &&
          typeof item.originalIndex === "number" &&
          item.originalIndex >= 0
        ) {
          moveTrack(item.id, item.originalIndex);
        }
      },
    }),
    [track?.id, originalIndex, moveTrack]
  );

  const [, drop] = useDrop(
    () => ({
      accept: ItemType,
      hover(payload) {
        const draggedId = payload?.id;
        if (!draggedId || draggedId === track.id) return;
        const over = findTrack(track.id);
        if (!over) return;
        const overIndex = over.index;
        if (overIndex < 0) return;
        moveTrack(draggedId, overIndex);
      },
    }),
    [findTrack, moveTrack, track?.id]
  );

  return (
    <div
      ref={(node) => drag(drop(node))}
      style={{
        opacity: isDragging ? 0.5 : 1,
        padding: 8,
        borderRadius: 6,
        marginBottom: 6,
        background: "#fff",
        border: "1px solid #e5e5e5",
        display: "grid",
        gridTemplateColumns: "32px 44px 1fr auto auto auto auto",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span style={{ textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
        {track.playIndex ?? "-"}
      </span>

      <img
        src={track.albumArt || "/default-album-art.jpg"}
        alt="Album Art"
        style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
      />

      <span
        title={track.title}
        style={{
          cursor: "pointer",
          textDecoration: "underline",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        onClick={() => navigate(`/track-editor/${track.id}`)}
      >
        {track.title || "(제목 없음)"}
      </span>

      <span style={{ opacity: 0.7 }}>
        {Array.isArray(track.genres) && track.genres.length > 0
          ? track.genres.join(", ")
          : "장르 없음"}
      </span>

      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        시작: {formatTime(track.startTime)}
      </span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>
        종료: {formatTime(track.endTime)}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ opacity: 0.7 }}>{track.language || "언어 없음"}</span>
        <Button
          danger
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(track.id);
          }}
        >
          삭제
        </Button>
      </div>
    </div>
  );
}

// ===== Main Component =====
export default function PlaylistDetail() {
  const { playlistId } = useParams();
  const location = useLocation();
  const statePlaylist = location?.state?.playlist || null;

  const [playlist, setPlaylist] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playlistTracks, setPlaylistTracks] = useState([]);
  const isMobile = useMediaQuery({ query: "(max-width: 768px)" });

  const updatePlaylist = useFirestoreUpdateData(STORE_PLAYLISTS);

  // 상세 진입: IDB → Firestore → state 순서 폴백
  useEffect(() => {
    let cancelled = false;

    async function fetchPlaylist() {
      try {
        let found = await readPlaylistFromIDB(playlistId);
        if (!found) {
          found = await readPlaylistFromFirestore(playlistId);
          if (found) {
            await writePlaylistToIDB(found); // 캐시
          }
        }
        if (!found && statePlaylist) {
          found = statePlaylist;
        }

        if (!cancelled) {
          if (found) setPlaylist(found);
          else message.error("플레이리스트를 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("플레이리스트 조회 실패:", err);
        if (!cancelled)
          message.error("플레이리스트 조회 중 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchPlaylist();
    return () => {
      cancelled = true;
    };
  }, [playlistId, statePlaylist]);

  // 트랙 로딩: 각 트랙 IDB → Firestore(상위/서브컬렉션) → IDB 캐시
  const loadTracks = useCallback(async () => {
    if (!playlist || !Array.isArray(playlist.tracks)) {
      setPlaylistTracks([]);
      return;
    }

    try {
      const raw = await Promise.all(
        playlist.tracks.map(async (ref) => {
          const norm = normalizeTrackRef(ref);
          const id = norm?.id;
          if (!id) return null;

          let t = await readTrackFromIDB(id);
          if (!t) {
            t = await readTrackFromFirestore(id, playlist?.id);
          }
          return t ? { ...t } : null;
        })
      );

      const tracks = raw.filter(Boolean);

      const sorted = tracks.some((t) => typeof t.playIndex !== "number")
        ? tracks
            .slice()
            .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
            .map((t, i) => ({ ...t, playIndex: i + 1 }))
        : tracks.slice().sort((a, b) => a.playIndex - b.playIndex);

      setPlaylistTracks(sorted);
    } catch (err) {
      console.error("트랙 조회 실패:", err);
      message.error("트랙을 조회하는 중 오류가 발생했습니다.");
      setPlaylistTracks([]);
    }
  }, [playlist]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  // DnD
  const findTrack = useCallback(
    (id) => {
      const index = playlistTracks.findIndex((t) => t.id === id);
      if (index < 0) return null;
      return { track: playlistTracks[index], index };
    },
    [playlistTracks]
  );

  const moveTrack = useCallback(
    (draggedId, overIndex) => {
      if (typeof overIndex !== "number" || overIndex < 0) return;
      const currentIndex = playlistTracks.findIndex((t) => t.id === draggedId);
      if (currentIndex < 0 || currentIndex === overIndex) return;

      const updated = playlistTracks.slice();
      const [dragged] = updated.splice(currentIndex, 1);
      updated.splice(overIndex, 0, dragged);

      const reindexed = updated.map((t, i) => ({ ...t, playIndex: i + 1 }));
      setPlaylistTracks(reindexed);
    },
    [playlistTracks]
  );

  // Firestore + IDB 동기화 (공통)
  const persistPlaylistTracks = useCallback(
    async (tracksForSave) => {
      if (!playlist) return;

      const newTrackRefs = tracksForSave.map((t) => ({
        id: t.id,
        playIndex: t.playIndex,
      }));

      const newPlaylist = {
        ...playlist,
        tracks: newTrackRefs,
        updatedAt: Date.now(),
      };

      if (typeof updatePlaylist?.updateData === "function") {
        await updatePlaylist.updateData(playlist.id, {
          tracks: newTrackRefs,
          updatedAt: newPlaylist.updatedAt,
        });
      } else if (typeof updatePlaylist === "function") {
        await updatePlaylist(playlist.id, {
          tracks: newTrackRefs,
          updatedAt: newPlaylist.updatedAt,
        });
      }

      await writePlaylistToIDB(newPlaylist);
      setPlaylist(newPlaylist);
    },
    [playlist, updatePlaylist]
  );

  // 삭제
  const handleDeleteTrack = useCallback(
    async (trackId) => {
      const updatedTracks = playlistTracks
        .filter((t) => t.id !== trackId)
        .map((t, i) => ({ ...t, playIndex: i + 1 }));
      setPlaylistTracks(updatedTracks);

      try {
        await persistPlaylistTracks(updatedTracks);
        message.success("트랙이 플레이리스트에서 제거되었습니다.");
      } catch (err) {
        console.error("트랙 삭제 저장 실패:", err);
        message.error("삭제 정보를 저장하는 중 오류가 발생했습니다.");
      }
    },
    [playlistTracks, persistPlaylistTracks]
  );

  // 순서 저장
  const handleSaveOrder = useCallback(async () => {
    try {
      await persistPlaylistTracks(playlistTracks);
      message.success("플레이리스트 순서가 저장되었습니다.");
    } catch (error) {
      console.error("순서 저장 실패:", error);
      message.error("플레이리스트 순서 저장 중 오류가 발생했습니다.");
    }
  }, [playlistTracks, persistPlaylistTracks]);

  const handlePlayPlaylist = useCallback(() => {
    if (!playlistTracks.length) {
      message.warning("재생할 트랙이 없습니다.");
      return;
    }
  }, [playlistTracks]);

  // 저장 필요 여부
  const isDirty = useMemo(() => {
    if (!playlist || !Array.isArray(playlist.tracks)) return false;
    const savedRefs = playlist.tracks.map(normalizeTrackRef).filter(Boolean);
    const savedIds = savedRefs.map((r) => r.id).join("|");
    const currentIds = playlistTracks.map((t) => t.id).join("|");
    if (savedIds !== currentIds) return true;
    return playlistTracks.some((t, i) => {
      const saved = savedRefs.find((r) => r.id === t.id);
      return (saved?.playIndex ?? i + 1) !== t.playIndex;
    });
  }, [playlist, playlistTracks]);

  if (isLoading) {
    return (
      <div style={{ padding: isMobile ? 16 : 24, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ padding: isMobile ? 16 : 24 }}>
        <h2>플레이리스트를 찾을 수 없습니다.</h2>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: isMobile ? 16 : 24 }}>
        <AudioPlayer
          playlist={playlistTracks}
          autoPlay={false}
          onPlayAll={handlePlayPlaylist}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "12px 0 16px",
          }}
        >
          <h2 style={{ margin: 0 }}>
            {playlist.name || "제목 없는 플레이리스트"}
          </h2>
          <Button onClick={handlePlayPlaylist}>전체 재생</Button>
          <Button type="primary" onClick={handleSaveOrder} disabled={!isDirty}>
            순서 저장
          </Button>
        </div>

        <List
          bordered
          dataSource={playlistTracks}
          renderItem={(track) => (
            <List.Item key={track.id} style={{ padding: 0, border: "none" }}>
              <DraggableTrack
                track={track}
                findTrack={findTrack}
                moveTrack={moveTrack}
                onDelete={handleDeleteTrack}
              />
            </List.Item>
          )}
        />
      </div>
    </DndProvider>
  );
}
