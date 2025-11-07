// components/Mp3List.jsx
"use client";

import React, { useEffect, useState } from "react";
import { getMp3Files } from "../utils/getMp3Files";

export default function Mp3List() {
  const [mp3Files, setMp3Files] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFiles() {
      const files = await getMp3Files();
      setMp3Files(files);
      setLoading(false);
    }
    fetchFiles();
  }, []);

  if (loading) return <p>불러오는 중...</p>;

  return (
    <div>
      <h2>/mp3 폴더 파일 목록</h2>
      <ul>
        {mp3Files.map((file) => (
          <li key={file.name}>
            <a href={file.url} target="_blank" rel="noopener noreferrer">
              {file.name}
            </a>
            <audio
              controls
              src={file.url}
              style={{ display: "block", marginTop: 4 }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
