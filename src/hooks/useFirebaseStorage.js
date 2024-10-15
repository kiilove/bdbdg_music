import { useState, useEffect } from "react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  getMetadata,
  updateMetadata,
} from "firebase/storage";
import ColorThief from "colorthief";
import { compressImage } from "./imageUtils";

const useFirebaseStorage = (files, storagePath) => {
  const [progress, setProgress] = useState(0);
  const [urls, setUrls] = useState([]);
  const [errors, setErrors] = useState([]);
  const [representativeImage, setRepresentativeImage] = useState(null);

  //console.log(files);
  useEffect(() => {
    const storage = getStorage();
    const originalRef = ref(storage, `${storagePath}/original`);
    const compressRef = ref(storage, `${storagePath}/compress`);

    const promises = Array.from(files).map((file, index) => {
      const metadataPromise = getMetadata(ref(storage, file.name)).catch(
        () => null
      );

      return Promise.all([metadataPromise]).then(async ([existingMetadata]) => {
        if (existingMetadata && existingMetadata.size === file.size) {
          setUrls((prevUrls) => [
            ...prevUrls,
            {
              url: existingMetadata.customMetadata.compressedUrl,
              ...existingMetadata.customMetadata,
            },
          ]);
          return null;
        }

        const maxSize = 1024 * 1024;
        const compressOptions = { maxWidthOrHeight: 1024, quality: 0.5 };
        const shouldCompress = file.size > maxSize;
        const compressedFile = shouldCompress
          ? await compressImage(file, compressOptions)
          : file;

        const newName = `bdbdg_${Date.now()}`;
        const uploadRef = shouldCompress
          ? ref(compressRef, newName)
          : ref(originalRef, newName);
        const uploadMetadata = {
          contentType: compressedFile.type,
          customMetadata: {
            url: "",
          },
        };

        // ColorThief 라이브러리를 사용하여 테마 색상 추출
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = URL.createObjectURL(compressedFile);
        const colorThief = new ColorThief();
        const colorPalette = await new Promise((resolve) => {
          img.addEventListener("load", () => {
            const palette = colorThief.getPalette(img, 5);
            resolve(palette);
          });
        });

        const customMetadata = {
          name: compressedFile.name, // 원래 파일 이름 설정
          contentDisposition: `attachment; filename="${compressedFile.name}"`, // 다운로드 시 파일 이름 설정
          colorTheme: [
            `rgb(${colorPalette[0].join(",")})`,
            `rgb(${colorPalette[1].join(",")})`,
            `rgb(${colorPalette[2].join(",")})`,
            `rgb(${colorPalette[3].join(",")})`,
            `rgb(${colorPalette[4].join(",")})`,
          ],
        };

        const uploadTask = uploadBytesResumable(
          uploadRef,
          compressedFile,
          uploadMetadata
        );

        return new Promise((resolve) => {
          uploadTask.on(
            "state_changed",
            (snapshot) => {
              const progress = Math.round(
                (snapshot.bytesTransferred / snapshot.totalBytes) * 100
              );
              setProgress(progress);
            },
            (error) => {
              setErrors((prevErrors) => [
                ...prevErrors,
                { name: file.name, error },
              ]);
              resolve(null);
            },
            async () => {
              const downloadURL = await getDownloadURL(uploadRef);
              const originalUrl = shouldCompress
                ? uploadMetadata.customMetadata.url
                : downloadURL;
              const compressedUrl = shouldCompress ? downloadURL : originalUrl;

              const customMetadata = {
                name: compressedFile.name,
                contentDisposition: `attachment; filename="${compressedFile.name}"`,
                colorTheme: [
                  `rgb(${colorPalette[0].join(",")})`,
                  `rgb(${colorPalette[1].join(",")})`,
                  `rgb(${colorPalette[2].join(",")})`,
                  `rgb(${colorPalette[3].join(",")})`,
                  `rgb(${colorPalette[4].join(",")})`,
                ],
              };

              // 이미지 메타데이터 업데이트
              try {
                await updateMetadata(uploadRef, { customMetadata });
              } catch (error) {
                console.error(error);
              }

              setUrls((prevUrls) => [
                ...prevUrls,
                { url: originalUrl, compressedUrl, ...customMetadata },
              ]);

              const image = {
                url: originalUrl,
                compressedUrl,
                ...customMetadata,
              };

              if (index === 0) {
                setRepresentativeImage(image);
              }

              resolve(image);
            }
          );
        }).then((image) => {
          if (!image) {
            return null;
          }
          const { url, compressedUrl, ...metadata } = image;
          const finalUrl = compressedUrl || url;
          return {
            url,
            compressedUrl: compressedUrl ? finalUrl : null,
            ...metadata,
          };
        });
      });
    });

    Promise.all(promises).then((uploadedImages) => {
      setProgress(0);
      const uploadedUrls = uploadedImages
        .filter((image) => image !== null)
        .map(({ url, compressedUrl, ...metadata }) => ({
          originalUrl: url,
          compressedUrl,
          ...metadata,
        }));
      setUrls(uploadedUrls);
    });
  }, [files, storagePath]);

  return { progress, urls, errors, representativeImage };
};

export default useFirebaseStorage;
