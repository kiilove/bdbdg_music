import React, { useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase"; // Firebase 설정 파일
import { Select, Table, Button, Spin, Pagination, Card } from "antd";
import { PlayCircleOutlined, PauseCircleOutlined } from "@ant-design/icons";
import { useResponsive } from "../contexts/ResponsiveContext"; // 반응형 컨텍스트
import ReactH5AudioPlayer from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { useNavigate } from "react-router-dom";

const ITEMS_PER_PAGE = 10;

const MusicExplorer = () => {
  const { isMobile } = useResponsive();
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedAudio, setSelectedAudio] = useState(null);
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      const rootRef = ref(storage, "mp3");
      const { prefixes } = await listAll(rootRef);
      const folderNames = prefixes.map((folder) => ({
        name: folder.name,
        fullPath: folder.fullPath,
      }));
      setFolders(folderNames);
      setLoading(false);
    };

    fetchFolders();
  }, []);

  const fetchFiles = async (folderPath) => {
    setLoading(true);
    const folderRef = ref(storage, folderPath);
    const { items } = await listAll(folderRef);

    const files = await Promise.all(
      items.map(async (item) => ({
        key: item.fullPath,
        name: item.name,
        url: await getDownloadURL(item),
      }))
    );

    setFileData(files);
    setLoading(false);
  };

  const handleFolderChange = (value) => {
    setSelectedFolder(value);
    fetchFiles(value);
    setCurrentPage(1);
    setSelectedAudio(null);
    setPlaying(false);
  };

  const handlePlay = (url) => {
    if (selectedAudio === url && playing) {
      setPlaying(false);
    } else {
      setSelectedAudio(url);
      setPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setPlaying(false);
  };

  const paginatedData = fileData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const onPageChange = (page) => {
    setCurrentPage(page);
  };

  // 재생시간 설정 버튼 클릭 핸들러
  const handleSetPlaybackTime = () => {
    if (selectedAudio) {
      navigate("/editor", { state: { audioUrl: selectedAudio } });
    }
  };

  const columns = [
    {
      title: "파일 이름",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div
          className={`flex ${isMobile ? "flex-col" : "flex-row"} items-center`}
        >
          <span className="mr-2">{text}</span>
          <Button
            type="primary"
            icon={
              selectedAudio === record.url && playing ? (
                <PauseCircleOutlined />
              ) : (
                <PlayCircleOutlined />
              )
            }
            onClick={() => handlePlay(record.url)}
          >
            {selectedAudio === record.url && playing ? "일시정지" : "재생"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Music Explorer</h2>
      {/* 플레이어를 상단에 배치 */}
      {selectedAudio && (
        <Card className={`w-full mb-4`} title="Now Playing" bordered={false}>
          <ReactH5AudioPlayer
            src={selectedAudio}
            autoPlay
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={handleAudioEnded}
            showJumpControls={false}
            customAdditionalControls={[]}
            customVolumeControls={[]}
            layout="horizontal"
          />
          {/* 여기에서 음악 재생파형을 보여주고 시작과 끝을 설정할수 있는 페이지로 이동을 시키고 싶어. */}
          <Button onClick={handleSetPlaybackTime}>재생시간 설정</Button>
        </Card>
      )}
      <Select
        className="mb-4 w-full max-w-md"
        placeholder="폴더를 선택하세요"
        onChange={handleFolderChange}
        loading={loading}
      >
        {folders.map((folder) => (
          <Select.Option key={folder.fullPath} value={folder.fullPath}>
            {folder.name}
          </Select.Option>
        ))}
      </Select>
      {loading ? (
        <Spin className="flex justify-center items-center min-h-screen" />
      ) : (
        <>
          <div
            className={`flex ${isMobile ? "flex-col" : "flex-row"} items-start`}
          >
            <div className="flex-1 w-full max-w-3xl mr-4">
              <Table
                dataSource={paginatedData}
                columns={columns}
                pagination={false}
                className="w-full"
                rowKey="key"
              />
              <Pagination
                className="text-center mt-4"
                current={currentPage}
                pageSize={ITEMS_PER_PAGE}
                total={fileData.length}
                onChange={onPageChange}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MusicExplorer;
