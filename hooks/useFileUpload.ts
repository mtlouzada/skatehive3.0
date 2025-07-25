import { useState } from "react";
import imageCompression from "browser-image-compression";
import { uploadToIPFS } from "@/lib/markdown/composeUtils";

export const useImageUpload = (insertAtCursor: (content: string) => void) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isCompressingImage, setIsCompressingImage] = useState(false);

    const handleImageUpload = async (url: string | null, fileName?: string) => {
        setIsUploading(true);
        setIsCompressingImage(false);
        if (url) {
            try {
                const blob = await fetch(url).then((res) => res.blob());
                const formData = new FormData();
                formData.append("file", blob, fileName || "compressed-image.jpg");
                const response = await fetch("/api/pinata", {
                    method: "POST",
                    body: formData,
                });
                if (!response.ok) {
                    throw new Error("Failed to upload file to IPFS");
                }
                const result = await response.json();
                let ipfsUrl = `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`;
                // If GIF, append filename param for better frontend compatibility
                if (fileName && fileName.toLowerCase().endsWith(".gif")) {
                    ipfsUrl += `?filename=${encodeURIComponent(fileName)}`;
                }
                insertAtCursor(`\n![${fileName || "image"}](${ipfsUrl})\n`);
                setIsUploading(false);
            } catch (error) {
                console.error("Error uploading compressed image to IPFS:", error);
                setIsUploading(false);
            }
        } else {
            setIsUploading(false);
            setIsCompressingImage(false); // Reset when no file is selected
        }
    };

    const createImageTrigger = (imageCompressorRef: React.RefObject<any>) => () => {
        if (isCompressingImage) return; // Prevent multiple clicks
        setIsCompressingImage(true);
        // Reset the file input value before triggering to allow multiple uploads
        if (imageCompressorRef.current) {
            imageCompressorRef.current.trigger();
            // Reset the state after a timeout in case user cancels the dialog
            setTimeout(() => {
                setIsCompressingImage(false);
            }, 100);
        }
    };

    return {
        isUploading,
        isCompressingImage,
        handleImageUpload,
        createImageTrigger,
        setIsUploading,
    };
};

export const useVideoUpload = (insertAtCursor: (content: string) => void) => {
    const [isCompressingVideo, setIsCompressingVideo] = useState(false);

    const handleVideoUpload = (url: string | null) => {
        setIsCompressingVideo(false);
        if (url) {
            insertAtCursor(
                `\n<iframe src="${url}" frameborder="0" allowfullscreen></iframe>\n`
            );
        }
    };

    const createVideoTrigger = (videoUploaderRef: React.RefObject<any>) => () => {
        if (isCompressingVideo) return; // Prevent multiple clicks
        setIsCompressingVideo(true);
        // Reset the file input value before triggering to allow multiple uploads
        if (videoUploaderRef.current) {
            videoUploaderRef.current.trigger();
            // Reset the state after a timeout in case user cancels the dialog
            setTimeout(() => {
                setIsCompressingVideo(false);
            }, 100);
        }
    };

    return {
        isCompressingVideo,
        handleVideoUpload,
        createVideoTrigger,
    };
};

export const useGifUpload = () => {
    const [isProcessingGif, setIsProcessingGif] = useState(false);
    const [isUploadingGif, setIsUploadingGif] = useState(false);
    const [gifUrl, setGifUrl] = useState<string | null>(null);
    const [gifSize, setGifSize] = useState<number | null>(null);
    const [gifCaption, setGifCaption] = useState<string>("skatehive-gif");

    const handleGifUpload = (url: string | null, caption?: string) => {
        setIsProcessingGif(!!url);
        setGifUrl(url);
        if (url) {
            fetch(url)
                .then((res) => res.blob())
                .then((blob) => setGifSize(blob.size))
                .catch(() => setGifSize(null));
        } else {
            setGifSize(null);
        }
        setGifCaption(caption || "skatehive-gif");
    };

    const handleGifWebpUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        insertAtCursor: (content: string) => void,
        setIsUploading: (uploading: boolean) => void
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Check file type
        if (!(file.type === "image/gif" || file.type === "image/webp")) {
            alert("Only GIF and WEBP files are allowed.");
            return;
        }
        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("GIF or WEBP file size must be 5MB or less.");
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const response = await fetch("/api/pinata", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                throw new Error("Failed to upload GIF/WEBP to IPFS");
            }
            const result = await response.json();
            let ipfsUrl = `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`;
            if (file.type === "image/gif") {
                // Always append ?filename=skatehive.gif for GIFs
                ipfsUrl += `?filename=skatehive.gif`;
            }
            insertAtCursor(`\n![${file.name}](${ipfsUrl})\n`);
        } catch (error) {
            alert("Error uploading GIF/WEBP to IPFS.");
            console.error("Error uploading GIF/WEBP:", error);
        } finally {
            setIsUploading(false);
            e.target.value = ""; // Reset input
        }
    };

    return {
        isProcessingGif,
        isUploadingGif,
        gifUrl,
        gifSize,
        gifCaption,
        setIsProcessingGif,
        setIsUploadingGif,
        setGifUrl,
        setGifSize,
        setGifCaption,
        handleGifUpload,
        handleGifWebpUpload,
    };
};

export const useFileDropUpload = (insertAtCursor: (content: string) => void) => {
    const [isUploading, setIsUploading] = useState(false);

    const onDrop = async (acceptedFiles: File[]) => {
        setIsUploading(true);
        for (const file of acceptedFiles) {
            let fileToUpload = file;
            let fileName = file.name;
            if (
                file.type.startsWith("image/") &&
                file.type !== "image/gif" &&
                file.type !== "image/webp"
            ) {
                try {
                    const options = {
                        maxSizeMB: 2,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true,
                    };
                    const compressedFile = await imageCompression(file, options);
                    fileToUpload = compressedFile;
                    fileName = compressedFile.name;
                } catch (err) {
                    alert(
                        "Error compressing image: " +
                        (err instanceof Error ? err.message : err)
                    );
                    continue;
                }
            }
            const formData = new FormData();
            formData.append("file", fileToUpload, fileName);
            try {
                const response = await fetch("/api/pinata", {
                    method: "POST",
                    body: formData,
                });
                if (!response.ok) {
                    throw new Error("Failed to upload file");
                }
                const result = await response.json();
                const url = `https://ipfs.skatehive.app/ipfs/${result.IpfsHash}`;
                if (file.type === "image/gif") {
                    // Always append ?filename=skatehive.gif for GIFs
                    insertAtCursor(`\n![${fileName}](${url}?filename=skatehive.gif)\n`);
                } else if (file.type.startsWith("image/")) {
                    insertAtCursor(`\n![${fileName}](${url})\n`);
                } else if (file.type.startsWith("video/")) {
                    insertAtCursor(
                        `\n<iframe src=\"${url}\" frameborder=\"0\" allowfullscreen></iframe>\n`
                    );
                }
            } catch (error) {
                console.error("Error uploading file:", error);
            }
        }
        setIsUploading(false);
    };

    return {
        isUploading,
        onDrop,
    };
};
