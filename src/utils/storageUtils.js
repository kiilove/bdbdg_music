// utils/storageUtils.js
import { getDownloadURL, listAll, ref } from "firebase/storage";
import { storage } from "../firebase";

/**
 * 지정 경로의 폴더/파일 목록을 반환
 * @param {string} path "mp3" 또는 "mp3/ballad" 등
 * @returns {Promise<{folders: Array<{name, fullPath}>, files: Array<{name, fullPath, url}>}>}
 */
export async function listFolder(path = "mp3") {
  const norm = path.endsWith("/") ? path.slice(0, -1) : path;
  const folderRef = ref(storage, norm);

  const { prefixes, items } = await listAll(folderRef);

  const folders = prefixes.map((p) => ({
    name: p.name,
    fullPath: p.fullPath,
  }));

  const files = await Promise.all(
    items.map(async (it) => ({
      name: it.name,
      fullPath: it.fullPath,
      url: await getDownloadURL(it),
    }))
  );

  return { folders, files };
}

/** 경로를 breadcrumb 배열로 변환 (예: "mp3/a/b" → ["mp3","a","b"]) */
export function toCrumbs(path = "mp3") {
  return (path || "mp3").replace(/\/+$/, "").split("/");
}

/** crumbs 배열을 경로로 (["mp3","a","b"] → "mp3/a/b") */
export function crumbsToPath(crumbs) {
  return crumbs.join("/");
}
