// imageUtils.js

const compressImage = (file, options) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const { width, height } = getDimensions(img, options);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: blob.type,
            });
            resolve(compressedFile);
          },
          file.type,
          0.8
        );
      };
    };
    reader.onerror = (error) => {
      reject(error);
    };
  });
};

const getDimensions = (img, options) => {
  const { maxWidthOrHeight, quality } = options;
  const aspectRatio = img.width / img.height;
  if (img.width <= maxWidthOrHeight && img.height <= maxWidthOrHeight) {
    return { width: img.width, height: img.height };
  } else if (aspectRatio > 1) {
    return {
      width: maxWidthOrHeight,
      height: Math.round(maxWidthOrHeight / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxWidthOrHeight * aspectRatio),
      height: maxWidthOrHeight,
    };
  }
};

export { compressImage };
