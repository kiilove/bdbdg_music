// pages/MusicExplorer.jsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  Breadcrumb,
  Button,
  Card,
  Empty,
  List,
  Space,
  Typography,
  message,
  Spin,
  Checkbox,
  Input,
  Select,
  Tag,
  Row,
  Col,
  Divider,
} from "antd";
import {
  FolderOpenOutlined,
  FileOutlined,
  PlusCircleOutlined,
  StepBackwardOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  StepForwardOutlined,
  CaretRightOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SoundOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";

import { listFolder, toCrumbs, crumbsToPath } from "../utils/storageUtils";
import { db } from "../firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";

import DraggableTrackList from "../components/DraggableTrackList";

const { Text, Title } = Typography;
const { Option } = Select;

const _idFrom = (s) =>
  btoa(unescape(encodeURIComponent(String(s || ""))))
    .replace(/=+$/g, "")
    .replace(/[+/]/g, "-");

export default function MusicExplorer() {
  // -------- Left (Storage Explorer) --------
  const [currentPath, setCurrentPath] = useState("mp3");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [checkedMap, setCheckedMap] = useState({});

  // -------- Player / Queue --------
  const [playQueue, setPlayQueue] = useState([]); // [{name,url,fullPath}, ...]
  const [playIndex, setPlayIndex] = useState(0);
  const audioRef = useRef(null);
  const queueListRef = useRef(null);

  const nowPlaying = useMemo(
    () =>
      playQueue.length
        ? playQueue[Math.max(0, Math.min(playIndex, playQueue.length - 1))]
        : null,
    [playQueue, playIndex]
  );

  // -------- Right (Playlists) --------
  const [playlists, setPlaylists] = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [targetPlaylistId, setTargetPlaylistId] = useState(null);

  // 선택 파일 목록
  const selectedFiles = useMemo(
    () => files.filter((f) => checkedMap[f.fullPath]).map((f) => ({ ...f })),
    [files, checkedMap]
  );

  // 선택된 파일(드래그 영역)
  const [sortedSelected, setSortedSelected] = useState([]);

  // -------- Bulk Sync (생략 없이 유지) --------
  const [syncStatus, setSyncStatus] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  // 선택 변경시 드래그 영역 반영
  useEffect(() => {
    setSortedSelected(selectedFiles);
  }, [selectedFiles]);

  // -------- Breadcrumb --------
  const crumbs = useMemo(() => toCrumbs(currentPath), [currentPath]);
  const goToCrumb = (idx) => {
    const next = crumbs.slice(0, idx + 1);
    setCurrentPath(crumbsToPath(next));
  };

  // -------- Load folder --------
  const loadFolder = useCallback(async (path) => {
    setLoadingFolder(true);
    try {
      const { folders, files } = await listFolder(path);
      setFolders(folders);
      setFiles(files.filter((f) => f.name.toLowerCase().endsWith(".mp3")));
      setCheckedMap({});
    } catch (e) {
      console.error(e);
      message.error("폴더를 불러오지 못했습니다.");
    } finally {
      setLoadingFolder(false);
    }
  }, []);

  useEffect(() => {
    loadFolder(currentPath);
  }, [currentPath, loadFolder]);

  const openFolder = (fullPath) => setCurrentPath(fullPath);

  const toggleAll = (checked) => {
    if (checked) {
      const all = {};
      files.forEach((f) => (all[f.fullPath] = true));
      setCheckedMap(all);
    } else {
      setCheckedMap({});
    }
  };

  const addAllFolderFiles = () => {
    if (!files.length) {
      message.info("이 폴더에 파일이 없습니다.");
      return;
    }
    const all = {};
    files.forEach((f) => (all[f.fullPath] = true));
    setCheckedMap(all);
  };

  // -------- Playlists: subscribe + track count --------
  useEffect(() => {
    const ref = collection(db, "track_play_list");
    const qRef = query(ref, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qRef,
      async (snap) => {
        let list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          _countLoading: true,
          trackCount: 0,
        }));
        setPlaylists(list);
        setLoadingPlaylists(false);

        try {
          const counted = await Promise.all(
            list.map(async (pl) => {
              const tracksRef = collection(
                db,
                "track_play_list",
                pl.id,
                "tracks"
              );
              const tSnap = await getDocs(tracksRef);
              return { ...pl, trackCount: tSnap.size, _countLoading: false };
            })
          );
          setPlaylists(counted);
        } catch (err) {
          console.debug("trackCount fetch error:", err);
        }
      },
      (err) => {
        console.error(err);
        message.error("플레이리스트를 불러오지 못했습니다.");
        setLoadingPlaylists(false);
      }
    );

    return () => unsub();
  }, []);

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      message.warning("재생목록 이름을 입력하세요.");
      return;
    }
    try {
      const docRef = await addDoc(collection(db, "track_play_list"), {
        name: newPlaylistName.trim(),
        createdAt: serverTimestamp(),
      });
      setNewPlaylistName("");
      setTargetPlaylistId(docRef.id);
      message.success("재생목록이 생성되었습니다.");
    } catch (e) {
      console.error(e);
      message.error("재생목록 생성 실패");
    }
  };

  // ---------- Bulk Sync 로직들 (기존 그대로) ----------
  const handleSyncSingleFolder = async ({ folderName, files }) => {
    const existingPlaylist = playlists.find((pl) => pl.name === folderName);
    let playlistId = existingPlaylist?.id;

    if (!playlistId) {
      const docRef = await addDoc(collection(db, "track_play_list"), {
        name: folderName,
        createdAt: serverTimestamp(),
      });
      playlistId = docRef.id;
    }

    const tracksCol = collection(db, "track_play_list", playlistId, "tracks");

    const existingSnap = await getDocs(
      query(tracksCol, orderBy("playIndex", "asc"))
    );
    const existingTracks = existingSnap.docs.map((d) => d.data());
    const existingTrackUrls = new Set(existingTracks.map((t) => t.url));

    const currentFileUrls = new Set(files.map((f) => f.url));
    const retainedExistingTracks = existingTracks.filter((t) =>
      currentFileUrls.has(t.url)
    );

    const newTracksToAdd = files
      .filter((file) => !existingTrackUrls.has(file.url))
      .map((f) => ({
        name: f.name,
        url: f.url,
        fullPath: f.fullPath,
        isNew: true,
        addedAt: serverTimestamp(),
      }));

    const allTracks = [...retainedExistingTracks, ...newTracksToAdd]
      .map((t) => ({ ...t, sortName: t.name || t.fullPath, isNew: t.isNew }))
      .sort((a, b) => a.sortName.localeCompare(b.sortName));

    const batch = writeBatch(db);

    allTracks.forEach((track, i) => {
      const docId = _idFrom(
        track.fullPath || track.url || track.name || `${Date.now()}-${i}`
      );
      const trackRef = doc(tracksCol, docId);
      batch.set(
        trackRef,
        {
          name: track.name,
          url: track.url,
          fullPath: track.fullPath ?? null,
          playIndex: i + 1,
          addedAt: track.addedAt || serverTimestamp(),
        },
        { merge: true }
      );
    });

    const tracksToDelete = existingTracks.filter(
      (et) => !currentFileUrls.has(et.url)
    );
    tracksToDelete.forEach((track) => {
      const docId = _idFrom(track.fullPath || track.url || track.name);
      const trackRef = doc(tracksCol, docId);
      batch.delete(trackRef);
    });

    await batch.commit();
    return {
      newTracksSavedCount: newTracksToAdd.length,
      tracksDeletedCount: tracksToDelete.length,
      totalTracks: allTracks.length,
    };
  };

  const scanAllFoldersAndCheckChanges = async () => {
    setIsScanning(true);
    setSyncStatus([]);
    const hide = message.loading("모든 폴더 구조를 스캔 중...", 0);

    try {
      const scanDirectory = async (currentPath, allFolderDetails = []) => {
        const currentPathCrumb = toCrumbs(currentPath);
        const folderName = currentPathCrumb.slice(-1)[0];

        const { folders: subFolders, files: currentFiles } = await listFolder(
          currentPath
        );
        const musicFiles = currentFiles.filter((f) =>
          f.name.toLowerCase().endsWith(".mp3")
        );

        if (musicFiles.length > 0 && currentPath !== "mp3") {
          allFolderDetails.push({
            fullPath: currentPath,
            folderName: folderName,
            files: musicFiles,
          });
        }
        for (const folder of subFolders) {
          await scanDirectory(folder.fullPath, allFolderDetails);
        }
        return allFolderDetails;
      };

      const allFoldersWithFiles = await scanDirectory("mp3");

      if (allFoldersWithFiles.length === 0) {
        message.info("mp3 폴더 하위에 음악 파일이 있는 폴더가 없습니다.");
        hide();
        setIsScanning(false);
        return;
      }

      const statusUpdates = [];
      for (const folderDetail of allFoldersWithFiles) {
        const folderName = folderDetail.folderName;
        const fileUrls = new Set(folderDetail.files.map((f) => f.url));
        const fileCount = fileUrls.size;

        const existingPlaylist = playlists.find((pl) => pl.name === folderName);
        let playlistId = existingPlaylist?.id;

        let playlistTrackCount = 0;
        let needsSync = false;

        if (playlistId) {
          const tracksCol = collection(
            db,
            "track_play_list",
            playlistId,
            "tracks"
          );
          const existingSnap = await getDocs(tracksCol);
          const existingTracks = existingSnap.docs.map((d) => d.data());
          playlistTrackCount = existingTracks.length;
          const existingTrackUrls = new Set(existingTracks.map((t) => t.url));

          if (fileCount !== playlistTrackCount) {
            needsSync = true;
          } else {
            const allFilesMatch = [...fileUrls].every((url) =>
              existingTrackUrls.has(url)
            );
            const allTracksMatch = [...existingTrackUrls].every((url) =>
              fileUrls.has(url)
            );
            if (!allFilesMatch || !allTracksMatch) needsSync = true;
          }
        } else {
          needsSync = true;
        }

        statusUpdates.push({
          ...folderDetail,
          playlistId: playlistId,
          fileCount: fileCount,
          playlistTrackCount: playlistTrackCount,
          needsSync: needsSync,
          files: folderDetail.files,
        });
      }

      setSyncStatus(statusUpdates);
      hide();
      message.success(
        `총 ${allFoldersWithFiles.length}개 폴더 스캔 완료. ${
          statusUpdates.filter((s) => s.needsSync).length
        }개 폴더 갱신 필요.`
      );
    } catch (e) {
      hide();
      console.error("SCANNING_ERROR", e);
      message.error(`폴더 스캔 실패: ${e?.message || "알 수 없는 오류"}`);
    } finally {
      setIsScanning(false);
    }
  };

  const syncAllNeededFolders = async () => {
    const foldersToSync = syncStatus.filter((s) => s.needsSync);
    if (foldersToSync.length === 0) {
      message.info("갱신할 폴더가 없습니다.");
      return;
    }

    setIsSyncingAll(true);
    const hide = message.loading(
      `총 ${foldersToSync.length}개 폴더 동기화 시작...`,
      0
    );

    let successCount = 0;
    let failCount = 0;

    for (const folder of foldersToSync) {
      try {
        await handleSyncSingleFolder({
          folderName: folder.folderName,
          files: folder.files,
        });
        successCount++;
        setSyncStatus((prev) =>
          prev.map((s) =>
            s.fullPath === folder.fullPath
              ? {
                  ...s,
                  needsSync: false,
                  playlistTrackCount: folder.files.length,
                }
              : s
          )
        );
      } catch (e) {
        console.error(`SYNC_FAILED: ${folder.folderName}`, e);
        failCount++;
      }
    }

    hide();
    setIsSyncingAll(false);
    message.success(
      `전체 동기화 완료: 성공 ${successCount}건, 실패 ${failCount}건.`
    );
    await scanAllFoldersAndCheckChanges();
  };

  // ---------- Add To Playlist ----------
  const handleAddToPlaylist = async () => {
    if (!targetPlaylistId) {
      message.warning("추가할 재생목록을 선택하세요.");
      return;
    }
    if (!sortedSelected.length) {
      message.warning("추가할 파일을 선택하세요.");
      return;
    }

    try {
      const tracksCol = collection(
        db,
        "track_play_list",
        targetPlaylistId,
        "tracks"
      );
      const existsSnap = await getDocs(
        query(tracksCol, orderBy("playIndex", "asc"))
      );
      let baseIndex = 0;
      if (!existsSnap.empty) {
        const last = existsSnap.docs
          .map((d) => d.data())
          .filter((t) => typeof t.playIndex === "number")
          .sort((a, b) => a.playIndex - b.playIndex)
          .slice(-1)[0];
        baseIndex = last?.playIndex || existsSnap.size;
      }

      const batch = writeBatch(db);
      sortedSelected.forEach((track, i) => {
        const docId = _idFrom(
          track.fullPath || track.url || track.name || `${Date.now()}-${i}`
        );
        const trackRef = doc(
          db,
          "track_play_list",
          targetPlaylistId,
          "tracks",
          docId
        );
        batch.set(
          trackRef,
          {
            name: track.name,
            url: track.url,
            fullPath: track.fullPath ?? null,
            playIndex: baseIndex + i + 1,
            addedAt: serverTimestamp(),
          },
          { merge: true }
        );
      });

      await batch.commit();
      message.success(`${sortedSelected.length}개 트랙이 저장되었습니다.`);
      setCheckedMap({});
      setSortedSelected([]);
    } catch (e) {
      console.error("ADD_TRACKS_ERROR", e);
      message.error(`트랙 추가 실패: ${e?.message || "알 수 없는 오류"}`);
    }
  };

  // ---------- Player Controls ----------
  const playQueueFromTracks = (tracks, start = 0) => {
    setPlayQueue(tracks);
    setPlayIndex(Math.max(0, Math.min(start, tracks.length - 1)));
  };

  const handlePlaySelectedList = () => {
    if (!sortedSelected.length) {
      message.warning("선택된 파일이 없습니다.");
      return;
    }
    playQueueFromTracks(sortedSelected, 0);
  };

  const handlePlayAllPlaylist = async (playlistId) => {
    try {
      const tracksRef = collection(db, "track_play_list", playlistId, "tracks");
      const snap = await getDocs(query(tracksRef, orderBy("playIndex", "asc")));
      const tracks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!tracks.length) {
        message.warning("이 재생목록에 트랙이 없습니다.");
        return;
      }
      playQueueFromTracks(tracks, 0);
    } catch (err) {
      console.error(err);
      message.error("재생 중 오류가 발생했습니다.");
    }
  };

  const handlePrev = () => {
    if (!playQueue.length) return;
    setPlayIndex((i) => (i > 0 ? i - 1 : 0));
  };

  const handleNext = () => {
    if (!playQueue.length) return;
    setPlayIndex((i) => (i < playQueue.length - 1 ? i + 1 : i));
  };

  const handleEnded = () => {
    if (playIndex < playQueue.length - 1) {
      setPlayIndex((i) => i + 1);
    }
  };

  const stopPlayback = () => {
    try {
      audioRef.current?.audio?.current?.pause();
    } catch {}
    setPlayQueue([]);
    setPlayIndex(0);
  };

  // 현재 곡이 바뀔 때, Queue 리스트에서 스크롤 따라가게
  useEffect(() => {
    if (!queueListRef.current) return;
    const el = queueListRef.current.querySelector(
      `[data-queue-idx="${playIndex}"]`
    );
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [playIndex]);

  const foldersNeedingSync = syncStatus.filter((s) => s.needsSync);

  return (
    <div style={{ padding: 16 }}>
      <Title level={3} style={{ marginBottom: 12 }}>
        Music Explorer 🎶
      </Title>

      {/* ===== Player + Queue (항상 보이는 재생목록) ===== */}
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col xs={24} md={12} lg={10}>
          <Card
            size="small"
            title={
              <Space>
                <SoundOutlined />
                <span>Player</span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  icon={<StepBackwardOutlined />}
                  onClick={handlePrev}
                />
                <Button
                  size="small"
                  icon={<StepForwardOutlined />}
                  onClick={handleNext}
                />
                <Button
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={stopPlayback}
                >
                  정지
                </Button>
              </Space>
            }
          >
            {nowPlaying ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text strong>
                    {nowPlaying.name}{" "}
                    <Text type="secondary">
                      ({playIndex + 1}/{playQueue.length})
                    </Text>
                  </Text>
                </div>
                <ReactH5AudioPlayer
                  ref={audioRef}
                  src={nowPlaying.url}
                  autoPlay
                  showJumpControls={false}
                  customAdditionalControls={[]}
                  customVolumeControls={[]}
                  layout="horizontal"
                  style={{ marginTop: 8 }}
                  onEnded={handleEnded}
                />
              </>
            ) : (
              <Empty
                description="재생 중인 곡이 없습니다."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12} lg={14}>
          <Card
            size="small"
            title={
              <Space>
                <span>현재 재생목록</span>
                <Tag color="blue">{playQueue.length}곡</Tag>
              </Space>
            }
            extra={
              <Space>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setPlayQueue([]);
                    setPlayIndex(0);
                  }}
                >
                  비우기
                </Button>
                <Button
                  size="small"
                  icon={<CaretRightOutlined />}
                  disabled={!playQueue.length}
                  onClick={() => {
                    if (playQueue.length) {
                      // 현재 인덱스에서 재생 재개
                      const i = Math.max(
                        0,
                        Math.min(playIndex, playQueue.length - 1)
                      );
                      setPlayIndex(i);
                    }
                  }}
                >
                  재생
                </Button>
              </Space>
            }
          >
            {playQueue.length === 0 ? (
              <Empty
                description="오른쪽 '선택된 파일 정렬'에서 재생 버튼이나, 아래 플레이리스트의 '전체 재생'을 눌러보세요."
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <div
                ref={queueListRef}
                style={{
                  maxHeight: 240,
                  overflowY: "auto",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {playQueue.map((t, i) => {
                  const isCurrent = i === playIndex;
                  return (
                    <div
                      key={t.fullPath || t.url || `${t.name}-${i}`}
                      data-queue-idx={i}
                      onClick={() => setPlayIndex(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "6px 10px",
                        marginBottom: 6,
                        border: "1px solid #f0f0f0",
                        borderRadius: 6,
                        cursor: "pointer",
                        background: isCurrent
                          ? "rgba(24,144,255,0.06)"
                          : "#fff",
                      }}
                      title="클릭하여 해당 곡 재생"
                    >
                      <Space>
                        <Tag color={isCurrent ? "processing" : "default"}>
                          {i + 1}
                        </Tag>
                        <Text strong={isCurrent}>{t.name}</Text>
                      </Space>

                      <Space>
                        {isCurrent ? (
                          <Text type="secondary">재생중</Text>
                        ) : (
                          <Button
                            type="text"
                            size="small"
                            icon={<PlayCircleOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPlayIndex(i);
                            }}
                          >
                            재생
                          </Button>
                        )}
                      </Space>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* ===== Main Layout ===== */}
      <Row gutter={16}>
        {/* LEFT: Storage Explorer */}
        <Col xs={24} md={12} lg={10} xl={9}>
          <Card
            size="small"
            title="Storage Explorer"
            extra={
              <Space>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => loadFolder(currentPath)}
                >
                  새로고침
                </Button>
              </Space>
            }
          >
            <Breadcrumb style={{ marginBottom: 12 }}>
              {crumbs.map((c, idx) => (
                <Breadcrumb.Item key={idx}>
                  <a onClick={() => goToCrumb(idx)}>{c}</a>
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>

            {/* Folders */}
            <Card
              size="small"
              title="Folders"
              loading={loadingFolder}
              style={{ marginBottom: 12 }}
            >
              {folders.length === 0 ? (
                <Empty description="하위 폴더가 없습니다." />
              ) : (
                <List
                  grid={{ gutter: 12, xs: 1, sm: 2 }}
                  dataSource={folders}
                  renderItem={(f) => (
                    <List.Item key={f.fullPath}>
                      <Card
                        hoverable
                        bodyStyle={{ padding: 12 }}
                        actions={[
                          <Button
                            key="move"
                            type="text"
                            size="small"
                            icon={<FolderOpenOutlined />}
                            onClick={() => setCurrentPath(f.fullPath)}
                          >
                            이동
                          </Button>,
                        ]}
                        onClick={() => openFolder(f.fullPath)}
                      >
                        <Space>
                          <FolderOpenOutlined />
                          <Text strong>{f.name}</Text>
                        </Space>
                      </Card>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            {/* Files */}
            <Card size="small" title="Files" loading={loadingFolder}>
              <div style={{ marginBottom: 8 }}>
                <Checkbox
                  onChange={(e) => toggleAll(e.target.checked)}
                  checked={
                    files.length > 0 &&
                    files.every((f) => checkedMap[f.fullPath])
                  }
                  indeterminate={
                    Object.keys(checkedMap).length > 0 &&
                    !files.every((f) => checkedMap[f.fullPath])
                  }
                >
                  전체 선택
                </Checkbox>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  ({Object.values(checkedMap).filter(Boolean).length}/
                  {files.length})
                </Text>
                <Button
                  size="small"
                  type="text"
                  onClick={addAllFolderFiles}
                  style={{ marginLeft: 16 }}
                >
                  모두 선택 반영
                </Button>
              </div>

              {files.length === 0 ? (
                <Empty description="이 폴더에 MP3 파일이 없습니다." />
              ) : (
                <List
                  itemLayout="horizontal"
                  dataSource={files}
                  renderItem={(file) => (
                    <List.Item
                      key={file.fullPath}
                      actions={[
                        <Checkbox
                          key="chk"
                          checked={!!checkedMap[file.fullPath]}
                          onChange={(e) =>
                            setCheckedMap((prev) => ({
                              ...prev,
                              [file.fullPath]: e.target.checked,
                            }))
                          }
                        />,
                        <Button
                          key="play"
                          type="link"
                          onClick={() => {
                            setPlayQueue([file]);
                            setPlayIndex(0);
                          }}
                        >
                          재생
                        </Button>,
                        <a
                          key="open"
                          href={file.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          열기
                        </a>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileOutlined style={{ fontSize: 18 }} />}
                        title={file.name}
                        description={file.fullPath}
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Card>
        </Col>

        {/* RIGHT: Playlist side */}
        <Col xs={24} md={12} lg={14} xl={15}>
          {/* 전체 폴더 자동 동기화 */}
          <Card
            size="small"
            title="전체 폴더 자동 동기화 관리"
            style={{ marginBottom: 12 }}
            extra={
              <Space>
                <Button
                  size="small"
                  icon={<SyncOutlined spin={isScanning} />}
                  onClick={scanAllFoldersAndCheckChanges}
                  disabled={isScanning || isSyncingAll}
                >
                  {isScanning ? "스캔 중..." : "폴더 변경 스캔 시작"}
                </Button>
                <Button
                  size="small"
                  type="primary"
                  icon={<PlusCircleOutlined />}
                  onClick={syncAllNeededFolders}
                  loading={isSyncingAll}
                  disabled={
                    foldersNeedingSync.length === 0 ||
                    isScanning ||
                    isSyncingAll
                  }
                >
                  {isSyncingAll
                    ? "일괄 동기화 중..."
                    : `전체 갱신 (${foldersNeedingSync.length}개)`}
                </Button>
              </Space>
            }
          >
            {isScanning && <Spin tip="하위 폴더를 탐색 중입니다..." />}

            {!isScanning && syncStatus.length === 0 && (
              <Empty description="스캔을 시작하세요." />
            )}

            {!isScanning && syncStatus.length > 0 && (
              <List
                size="small"
                header={
                  <Text strong>총 {syncStatus.length}개 폴더 스캔 결과</Text>
                }
                bordered
                dataSource={syncStatus}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      item.needsSync && !isSyncingAll ? (
                        <Button
                          size="small"
                          onClick={() => handleSyncSingleFolder(item)}
                        >
                          단일 갱신
                        </Button>
                      ) : null,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        item.needsSync ? (
                          <WarningOutlined style={{ color: "orange" }} />
                        ) : (
                          <CheckCircleOutlined style={{ color: "green" }} />
                        )
                      }
                      title={<Text strong>{item.folderName}</Text>}
                      description={item.fullPath}
                    />
                    <div>
                      <Tag color={item.needsSync ? "error" : "success"}>
                        {item.needsSync ? "갱신 필요" : "동기화 완료"}
                      </Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        ({item.fileCount} Files / {item.playlistTrackCount}{" "}
                        Tracks)
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Card>

          {/* Selected files -> reorder -> add to playlist */}
          <Card
            size="small"
            title={
              <Space>
                선택된 파일 정렬 및 추가
                <Tag color="blue">{sortedSelected.length}개</Tag>
              </Space>
            }
            extra={
              <Space>
                <Select
                  size="small"
                  style={{ minWidth: 220 }}
                  placeholder="추가할 재생목록 선택"
                  value={targetPlaylistId || undefined}
                  onChange={(v) => setTargetPlaylistId(v)}
                  loading={loadingPlaylists}
                >
                  {playlists.map((pl) => (
                    <Option key={pl.id} value={pl.id}>
                      {pl.name} {pl._countLoading ? "" : `(${pl.trackCount})`}
                    </Option>
                  ))}
                </Select>
                <Button
                  size="small"
                  type="primary"
                  disabled={!sortedSelected.length || !targetPlaylistId}
                  onClick={handleAddToPlaylist}
                >
                  선택 항목 추가
                </Button>
                <Button
                  size="small"
                  icon={<CaretRightOutlined />}
                  disabled={!sortedSelected.length}
                  onClick={handlePlaySelectedList}
                >
                  선택 목록 재생
                </Button>
              </Space>
            }
            style={{ marginBottom: 12 }}
          >
            {sortedSelected.length === 0 ? (
              <Empty description="왼쪽에서 파일을 체크하고 드래그하세요." />
            ) : (
              <DraggableTrackList
                items={sortedSelected}
                onReorder={setSortedSelected}
                onPreview={(track) => {
                  if (!track) {
                    setPlayQueue([]);
                    setPlayIndex(0);
                  } else {
                    const startIndex = sortedSelected.findIndex(
                      (t) => t.url === track.url
                    );
                    playQueueFromTracks(
                      sortedSelected,
                      startIndex >= 0 ? startIndex : 0
                    );
                  }
                }}
                onDelete={(itemToRemove) => {
                  const keyToRemove = itemToRemove.fullPath || itemToRemove.url;
                  setCheckedMap((prev) => {
                    const next = { ...prev };
                    delete next[keyToRemove];
                    return next;
                  });
                  setSortedSelected((prev) =>
                    prev.filter((x) => (x.fullPath || x.url) !== keyToRemove)
                  );
                }}
                previewTrack={nowPlaying}
              />
            )}
          </Card>

          {/* Playlists list */}
          <Card
            size="small"
            title="플레이리스트 목록"
            loading={loadingPlaylists}
          >
            {playlists.length === 0 ? (
              <Empty description="저장된 플레이리스트가 없습니다." />
            ) : (
              <List
                grid={{ gutter: 12, xs: 1, sm: 2, md: 2, lg: 3 }}
                dataSource={playlists}
                renderItem={(pl) => (
                  <List.Item key={pl.id}>
                    <Card
                      size="small"
                      title={<Text strong>{pl.name}</Text>}
                      extra={
                        <Button
                          size="small"
                          type="text"
                          icon={<PlayCircleOutlined />}
                          onClick={() => handlePlayAllPlaylist(pl.id)}
                        >
                          전체 재생
                        </Button>
                      }
                      style={{ borderRadius: 10 }}
                    >
                      <Space direction="vertical">
                        <Tag color="blue">
                          {pl._countLoading ? "..." : `${pl.trackCount}곡`}
                        </Tag>
                        <Text type="secondary">
                          생성일:{" "}
                          {pl.createdAt?.toDate
                            ? pl.createdAt.toDate().toLocaleString()
                            : "알 수 없음"}
                        </Text>
                      </Space>
                      <Divider style={{ margin: "8px 0" }} />
                      <Space>
                        <a href={`/playlist/${pl.id}`}>상세/편집</a>
                      </Space>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
