// useFirebaseStorage Hook

import { useState } from "react";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

const useFirebaseStorage = (storagePath) => {
  const [progress, setProgress] = useState(0);
  const [urls, setUrls] = useState([]);
  const [errors, setErrors] = useState([]);

  const uploadFiles = (files) => {
    if (!files || files.length === 0) return;

    const storage = getStorage();
    const promises = Array.from(files).map((file) => {
      const fileRef = ref(storage, `${storagePath}/${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file);

      return new Promise((resolve, reject) => {
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
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setUrls((prevUrls) => [...prevUrls, downloadURL]);
            resolve(downloadURL);
          }
        );
      });
    });

    Promise.all(promises)
      .then((uploadedUrls) => {
        setProgress(0); // Reset progress after all uploads are complete
        setUrls(uploadedUrls);
      })
      .catch((error) => {
        console.error("File upload failed:", error);
      });
  };

  return { progress, urls, errors, uploadFiles };
};

export default useFirebaseStorage;
