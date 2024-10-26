import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
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
  message,
} from "antd";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import {
  UploadOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
} from "@ant-design/icons";
import useFirebaseStorage from "../hooks/useFirebaseStorage";
import {
  useFirestoreUpdateData,
  useFirestoreGetDocument,
} from "../hooks/useFirestores";
import dayjs from "dayjs";

const { Option } = Select;

const TrackEditor = () => {
  const { trackId } = useParams();
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
  const [form] = Form.useForm();

  const { urls, uploadFiles } = useFirebaseStorage("album_art");
  const { getDocument, data: trackData } = useFirestoreGetDocument("tracks");
  const { updateData } = useFirestoreUpdateData("tracks");

  useEffect(() => {
    if (trackId) {
      getDocument(trackId).then((docData) => {
        if (docData) {
          initializeForm(docData);
          loadWaveform(docData.path, docData.startTime, docData.endTime);
        } else {
          message.error("데이터를 불러오지 못했습니다.");
        }
      });
    }
  }, [trackId]);

  const initializeForm = (data) => {
    form.setFieldsValue({
      title: data.title,
      genres: data.genres,
      language: data.language,
    });
    setFileName(data.title);
    setStartTime(data.startTime || 0);
    setEndTime(data.endTime || data.duration || 0);
    setLyrics(data.lyrics.map((lyric) => lyric.line).join("\n"));
    setTimelineEnabled(data.isLyricsTimeline || false);
    setEditableLyrics(data.lyrics || []);
    setAlbumArt(data.albumArt);
  };

  const loadWaveform = async (audioPath, start, end) => {
    try {
      if (!audioPath) {
        throw new Error("오디오 경로가 유효하지 않습니다.");
      }

      // 기존의 wavesurfer 인스턴스를 파괴하여 중복 방지
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
      }

      regions.current = RegionsPlugin.create();
      wavesurfer.current = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: "rgb(200, 0, 200)",
        progressColor: "rgb(100, 0, 100)",
        plugins: [regions.current],
      });

      wavesurfer.current.on("ready", () => {
        setIsLoading(false);
        const audioDuration = wavesurfer.current.getDuration();
        setDuration(audioDuration);

        // 시작과 끝 위치를 설정한 Region 생성
        resizeRegion.current = regions.current.addRegion({
          start: start || 0,
          end: end || audioDuration,
          content: "재생구간선택",
          color: "rgba(0, 255, 0, 0.1)",
          drag: false,
          resize: true,
        });
        setStartTime(start || 0);
        setEndTime(end || audioDuration);
      });

      wavesurfer.current.on("error", (error) => {
        console.error("Wavesurfer error:", error);
        setIsLoading(false);
      });

      regions.current.on("region-updated", (region) => {
        if (region === resizeRegion.current) {
          setStartTime(region.start);
          setEndTime(region.end);
        }
      });

      await wavesurfer.current.load(audioPath);
    } catch (error) {
      console.error("Waveform loading error:", error);
      setIsLoading(false);
    }
  };

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
      wavesurfer.current.on("audioprocess", () => {
        if (wavesurfer.current.getCurrentTime() >= endTime) {
          wavesurfer.current.pause();
        }
      });
    }
  };

  const handleLyricsChange = (e) => {
    const processedLyrics = e.target.value
      .split("\n")
      .filter((line) => !line.startsWith("[") && !line.endsWith("]"));
    setLyrics(processedLyrics.join("\n"));
    setEditableLyrics(
      processedLyrics.map((line) => ({ line, start: 0, end: 0 }))
    );
  };

  const handleUploadAlbumArt = (file) => {
    setAlbumArt(file);
    uploadFiles([file]);
    return false;
  };

  const handleSave = async (values) => {
    const albumArtUrl = urls[0] || albumArt || "/default/album_art.png";
    const saveData = {
      title: values.title,
      path: trackData.path,
      genres: values.genres,
      language: values.language,
      albumArt: albumArtUrl,
      isLyricsTimeline: timelineEnabled,
      startTime,
      endTime,
      playingTime: (endTime - startTime).toFixed(2),
      updatedAt: dayjs(new Date()).format("YYYY-MM-DD HH:mm:ss"),
      lyrics: timelineEnabled
        ? editableLyrics.map((lyric) => ({
            line: lyric.line,
            start: lyric.start,
            end: lyric.end,
          }))
        : lyrics.split("\n").map((line) => ({ line, start: 0, end: 0 })),
    };

    try {
      await updateData(trackId, saveData);
      message.success(`${saveData.title}이 성공적으로 업데이트되었습니다.`);
    } catch (error) {
      message.error(`트랙 업데이트에 실패했습니다: ${error}`);
    }
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
            setEditableLyrics((prevLyrics) =>
              prevLyrics.map((lyric, i) =>
                i === index ? { ...lyric, line: e.target.value } : lyric
              )
            )
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
            setEditableLyrics((prevLyrics) =>
              prevLyrics.map((lyric, i) =>
                i === index
                  ? { ...lyric, start: parseFloat(e.target.value) }
                  : lyric
              )
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
            setEditableLyrics((prevLyrics) =>
              prevLyrics.map((lyric, i) =>
                i === index
                  ? { ...lyric, end: parseFloat(e.target.value) }
                  : lyric
              )
            )
          }
          style={{ width: 70 }}
        />
      ),
    },
  ];

  return (
    <div className="p-4 w-full" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Card
        title="Track Editor"
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
              <Option value="hardrock">Hard Rock</Option>
              <Option value="rockballad">Rock Ballad</Option>
              <Option value="남자보컬">남자보컬</Option>
              <Option value="여자보컬">여자보컬</Option>
            </Select>
          </Form.Item>
          <Form.Item name="language" label="언어" rules={[{ required: true }]}>
            <Select>
              <Option value="korean">한국어</Option>
              <Option value="english">English</Option>
            </Select>
          </Form.Item>
          <div className="flex flex-col mb-4">
            <Upload beforeUpload={handleUploadAlbumArt} showUploadList={false}>
              <Button icon={<UploadOutlined />}>앨범 아트 업로드</Button>
            </Upload>
            {albumArt && (
              <Image
                src={albumArt}
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
              value={lyrics}
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
            <Table
              dataSource={editableLyrics}
              columns={columns}
              pagination={false}
              rowKey={(record, index) => `${record.line}-${index}`}
              style={{ marginTop: 16 }}
            />
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

export default TrackEditor;
