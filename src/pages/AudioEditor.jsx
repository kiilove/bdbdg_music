import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Spin,
  Input,
  Select,
  Button,
  Form,
  Upload,
  Checkbox,
  Table,
  Image,
  Card,
  Tooltip,
} from "antd";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import {
  UploadOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
  PlusOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import useFirebaseStorage from "../hooks/useFirebaseStorage";

const { Option } = Select;

const AudioEditor = () => {
  const location = useLocation();
  const { audioUrl } = location.state || {};
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [fileName, setFileName] = useState("");
  const [albumArt, setAlbumArt] = useState(null);
  const [lyrics, setLyrics] = useState("");
  const [editableLyrics, setEditableLyrics] = useState([]);
  const [timelineEnabled, setTimelineEnabled] = useState(false);
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const regions = useRef(null);
  const resizeRegion = useRef(null);
  const { urls } = useFirebaseStorage(albumArt ? [albumArt] : [], "album_art");
  const [form] = Form.useForm();

  useEffect(() => {
    if (!audioUrl) {
      console.error("오디오 URL이 유효하지 않습니다.");
      setIsLoading(false);
      return;
    }

    // 파일 이름 추출 및 확장자 제거
    const extractFileName = (url) => {
      const decodedUrl = decodeURIComponent(url);
      const parts = decodedUrl.split("/");
      const fullName = parts[parts.length - 1].split("?")[0];
      return fullName.replace(/\.[^/.]+$/, ""); // 확장자 제거
    };

    const fileNameFromUrl = extractFileName(audioUrl);
    setFileName(fileNameFromUrl);
    form.setFieldsValue({ title: fileNameFromUrl });

    const initWavesurfer = async () => {
      try {
        console.log("wavesurfer 초기화 시작");

        regions.current = RegionsPlugin.create();

        wavesurfer.current = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: "rgb(200, 0, 200)",
          progressColor: "rgb(100, 0, 100)",
          plugins: [regions.current],
        });

        wavesurfer.current.on("ready", () => {
          console.log("wavesurfer 로딩 완료");
          setIsLoading(false);
          const audioDuration = wavesurfer.current.getDuration();
          setDuration(audioDuration);

          regions.current.clearRegions();

          resizeRegion.current = regions.current.addRegion({
            start: 0,
            end: audioDuration,
            content: "재생구간선택",
            color: "rgba(0, 255, 0, 0.1)",
            drag: false,
            resize: true,
          });

          setStartTime(0);
          setEndTime(audioDuration);
        });

        wavesurfer.current.on("error", (error) => {
          console.error("wavesurfer 에러:", error);
          setIsLoading(false);
        });

        regions.current.on("region-updated", (region) => {
          if (region === resizeRegion.current) {
            setStartTime(region.start);
            setEndTime(region.end);
          }
        });

        await wavesurfer.current.load(audioUrl);
      } catch (error) {
        console.error("wavesurfer 초기화 중 오류 발생:", error);
        setIsLoading(false);
      }
    };

    initWavesurfer();

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }
    };
  }, [audioUrl, form]);

  const handlePlayPause = () => {
    if (wavesurfer.current) {
      wavesurfer.current.playPause();
    }
  };

  const handlePlayRegion = () => {
    if (wavesurfer.current && resizeRegion.current) {
      wavesurfer.current.stop();
      wavesurfer.current.seekTo(startTime / duration);
      wavesurfer.current.play();

      const checkEndTime = () => {
        if (wavesurfer.current.getCurrentTime() >= endTime) {
          wavesurfer.current.pause();
          wavesurfer.current.un("audioprocess", checkEndTime);
        }
      };

      wavesurfer.current.on("audioprocess", checkEndTime);
    }
  };

  const handleLyricsChange = (e) => {
    const processedLyrics = e.target.value
      .split("\n")
      .filter((line) => !line.startsWith("[") && !line.endsWith("]"));
    setLyrics(processedLyrics.join("\n"));
    setEditableLyrics(
      processedLyrics.map((line) => ({
        line,
        start: 0,
        end: 0,
      }))
    );
  };

  const handleAddRow = (index) => {
    setEditableLyrics((prevLyrics) => {
      const newRow = { line: "", start: 0, end: 0 };
      const updatedLyrics = [...prevLyrics];
      updatedLyrics.splice(index + 1, 0, newRow);
      if (index >= 0 && index < prevLyrics.length) {
        updatedLyrics[index + 1].start = updatedLyrics[index].end;
      }
      return updatedLyrics;
    });
  };

  const handleDeleteRow = (index) => {
    setEditableLyrics((prevLyrics) => {
      const updatedLyrics = prevLyrics.filter((_, i) => i !== index);
      if (index < updatedLyrics.length && index > 0) {
        updatedLyrics[index].start = updatedLyrics[index - 1].end;
      }
      return updatedLyrics;
    });
  };

  const handleResetLyrics = () => {
    const processedLyrics = lyrics
      .split("\n")
      .filter((line) => line.trim() !== "");
    setEditableLyrics(
      processedLyrics.map((line) => ({
        line,
        start: 0,
        end: 0,
      }))
    );
  };

  const handleEditableLyricsChange = (index, key, value) => {
    setEditableLyrics((prevLyrics) =>
      prevLyrics.map((lyric, i) => {
        if (i === index) {
          const updatedLyric = { ...lyric, [key]: value };
          if (key === "end" && i < prevLyrics.length - 1) {
            prevLyrics[i + 1].start = value;
          }
          return updatedLyric;
        }
        return lyric;
      })
    );
  };

  const handleSave = (values) => {
    const albumArtUrl = urls[0] || "/default/album_art.png";
    const saveData = {
      title: values.title,
      path: audioUrl,
      genres: values.genres,
      language: values.language,
      albumArt: albumArtUrl,
      isLyricsTimeline: timelineEnabled,
      lyrics: timelineEnabled
        ? editableLyrics.map((lyric) => ({
            line: lyric.line,
            start: lyric.start,
            end: lyric.end,
          }))
        : lyrics.split("\n").map((line) => ({
            line,
            start: 0,
            end: 0,
          })),
    };
    console.log("저장할 데이터:", saveData);
  };

  const columns = [
    {
      title: "가사",
      dataIndex: "line",
      key: "line",
      render: (_, record, index) => (
        <Input
          value={record.line}
          onChange={(e) =>
            handleEditableLyricsChange(index, "line", e.target.value)
          }
        />
      ),
    },
    {
      title: "시작",
      dataIndex: "start",
      key: "start",
      render: (_, record, index) => (
        <Input
          type="number"
          step="0.1"
          value={record.start}
          onChange={(e) =>
            handleEditableLyricsChange(
              index,
              "start",
              parseFloat(e.target.value)
            )
          }
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: "종료",
      dataIndex: "end",
      key: "end",
      render: (_, record, index) => (
        <Input
          type="number"
          step="0.1"
          value={record.end}
          onChange={(e) =>
            handleEditableLyricsChange(index, "end", parseFloat(e.target.value))
          }
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: "작업",
      key: "action",
      render: (_, __, index) => (
        <div>
          <Tooltip title="추가">
            <Button
              onClick={() => handleAddRow(index)}
              icon={<PlusOutlined />}
              style={{
                marginRight: 8,
                backgroundColor: "#52c41a",
                color: "white",
              }}
            />
          </Tooltip>
          <Tooltip title="삭제">
            <Button
              onClick={() => handleDeleteRow(index)}
              icon={<DeleteOutlined />}
              style={{ backgroundColor: "#ff2c36", color: "white" }}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 w-full" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Card
        title="Audio Editor"
        bordered={false}
        style={{ maxWidth: 1200, margin: "0 auto" }}
      >
        <div className="w-full mb-4 relative" style={{ minHeight: "250px" }}>
          {isLoading && (
            <div className="absolute inset-0 flex justify-center items-center">
              <Spin />
            </div>
          )}
          <div ref={waveformRef} className="w-full h-48" />
        </div>
        <div className="flex justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div>시작 시간: {startTime.toFixed(2)}초</div>
            <div>종료 시간: {endTime.toFixed(2)}초</div>
            <div>재생 시간: {(endTime - startTime).toFixed(2)}초</div>
          </div>
          <div className="flex space-x-2">
            <Tooltip title="재생/일시정지">
              <Button
                type="text"
                icon={<PlayCircleOutlined style={{ fontSize: 30 }} />}
                onClick={handlePlayPause}
              />
            </Tooltip>
            <Tooltip title="구간 재생">
              <Button
                type="text"
                icon={<PlaySquareOutlined style={{ fontSize: 30 }} />}
                onClick={handlePlayRegion}
              />
            </Tooltip>
          </div>
        </div>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="title" label="제목" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="genres" label="장르" rules={[{ required: true }]}>
            <Select mode="tags" placeholder="장르 선택">
              <Option value="pop">Pop</Option>
              <Option value="hiphop">Hip Hop</Option>
              <Option value="rock">Rock</Option>
              <Option value="jazz">Jazz</Option>
              <Option value="classical">Classical</Option>
              <Option value="hard rock">Hard Rock</Option>
              <Option value="rock ballad">Rock Ballad</Option>
            </Select>
          </Form.Item>
          <Form.Item name="language" label="언어" rules={[{ required: true }]}>
            <Select>
              <Option value="korean">한국어</Option>
              <Option value="english">English</Option>
            </Select>
          </Form.Item>
          <div className="flex flex-col mb-4">
            <Upload
              beforeUpload={(file) => {
                setAlbumArt(file);
                return false;
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>앨범 아트 업로드</Button>
            </Upload>
            {albumArt && (
              <Image
                src={URL.createObjectURL(albumArt)}
                alt="Album Art Preview"
                width={200}
                style={{ marginTop: 16 }}
              />
            )}
          </div>
          <Form.Item label="가사">
            <Input.TextArea
              rows={8}
              placeholder="가사 입력"
              onChange={handleLyricsChange}
            />
          </Form.Item>
          <Form.Item>
            <Checkbox
              checked={timelineEnabled}
              onChange={(e) => setTimelineEnabled(e.target.checked)}
            >
              타임라인 입력
            </Checkbox>
          </Form.Item>
          {timelineEnabled && (
            <div>
              <Button onClick={handleResetLyrics} style={{ marginBottom: 16 }}>
                초기화
              </Button>
              <Table
                dataSource={editableLyrics}
                columns={columns}
                pagination={false}
                rowKey={(record, index) => `${record.line}-${index}`}
                style={{ marginTop: 16 }}
              />
            </div>
          )}
          <Form.Item style={{ marginTop: 16 }}>
            <Button type="primary" htmlType="submit" block>
              저장하기
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AudioEditor;
