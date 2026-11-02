import React, { useState, useRef } from "react";

export interface DemoVideo {
  id: string;
  title: string;
  url: string;
  sizeDisplay?: string;
  description?: string;
}

interface DemoVideosManagerProps {
  videos: DemoVideo[];
  onChange: (videos: DemoVideo[]) => void;
}

const MAX_VIDEOS = 10;
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1GB

export function DemoVideosManager({ videos, onChange }: DemoVideosManagerProps) {
  const [activeUploadIndex, setActiveUploadIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetIndexRef = useRef<number | null>(null);

  const handleAddVideo = () => {
    if (videos.length >= MAX_VIDEOS) return;
    const newVideo: DemoVideo = {
      id: `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Demo Video ${videos.length + 1}`,
      url: "",
      description: "",
    };
    onChange([...videos, newVideo]);
  };

  const handleRemoveVideo = (index: number) => {
    const updated = videos.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleUpdateVideo = (index: number, updates: Partial<DemoVideo>) => {
    const updated = videos.map((v, idx) => (idx === index ? { ...v, ...updates } : v));
    onChange(updated);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= videos.length) return;
    const updated = [...videos];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    onChange(updated);
  };

  const triggerFileUpload = (index: number) => {
    targetIndexRef.current = index;
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetIdx = targetIndexRef.current;
    if (!file || targetIdx === null) return;

    if (file.size > MAX_VIDEO_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setUploadError(
        `Selected video is ${sizeMB} MB, which exceeds the maximum allowed 1GB (1024 MB) limit.`
      );
      return;
    }

    setActiveUploadIndex(targetIdx);
    setUploadProgress(0);
    setUploadError(null);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/video", true);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
      }
    };

    xhr.onload = () => {
      setActiveUploadIndex(null);
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          handleUpdateVideo(targetIdx, {
            url: res.url,
            sizeDisplay: res.sizeDisplay,
            title: videos[targetIdx]?.title || file.name.replace(/\.[^/.]+$/, ""),
          });
        } catch {
          setUploadError("Unexpected server response format.");
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          setUploadError(err.error || `Upload failed with status ${xhr.status}`);
        } catch {
          setUploadError(`Upload failed with status ${xhr.status}`);
        }
      }
    };

    xhr.onerror = () => {
      setActiveUploadIndex(null);
      setUploadError("Network connection error during 1GB video upload.");
    };

    xhr.send(file);
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>🎬 Project Demo Videos</span>
            <span
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                videos.length >= MAX_VIDEOS
                  ? "bg-amber-100 text-amber-800"
                  : "bg-indigo-100 text-indigo-700"
              }`}
            >
              {videos.length} / {MAX_VIDEOS} Videos
            </span>
            <span className="text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
              Max 1GB per video
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Add up to 10 walkthrough or demo videos. Upload direct video files (up to 1GB streamed) or paste YouTube, Vimeo, Loom, or direct MP4 URLs.
          </p>
        </div>

        <button
          type="button"
          disabled={videos.length >= MAX_VIDEOS}
          onClick={handleAddVideo}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>+ Add Demo Video</span>
        </button>
      </div>

      {uploadError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center justify-between">
          <span>⚠️ {uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white border border-slate-200/80">
          <p className="text-xs font-semibold text-slate-600">No demo videos added yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Click &quot;+ Add Demo Video&quot; to attach up to 10 video recordings for this project.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {videos.map((vid, idx) => {
            const isUploading = activeUploadIndex === idx;
            return (
              <div
                key={vid.id}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={vid.title}
                      onChange={(e) => handleUpdateVideo(idx, { title: e.target.value })}
                      placeholder="e.g. Full System Walkthrough"
                      className="px-2.5 py-1 text-xs font-bold text-slate-900 rounded-lg border border-slate-300 w-56 sm:w-72 focus:ring-1 focus:ring-indigo-500"
                    />
                    {vid.sizeDisplay && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {vid.sizeDisplay}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === videos.length - 1}
                      onClick={() => handleMove(idx, "down")}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20"
                      title="Move down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVideo(idx)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors ml-1"
                      title="Delete video"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Upload or URL selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Video URL (Cloudflare Stream, YouTube, Vimeo, or direct MP4)
                    </label>
                    <input
                      type="text"
                      value={vid.url}
                      onChange={(e) => handleUpdateVideo(idx, { url: e.target.value })}
                      placeholder="https://... or /uploads/videos/..."
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:ring-1 focus:ring-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Or Upload Direct Video File (Max 1GB Streamed)
                    </label>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => triggerFileUpload(idx)}
                      className="w-full px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span>{isUploading ? `Uploading ${uploadProgress}%...` : "Select Video File (Up to 1GB)"}</span>
                    </button>
                  </div>
                </div>

                {/* Upload Progress Bar */}
                {isUploading && (
                  <div className="space-y-1">
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 transition-all duration-150"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                      <span>Streaming 1GB video upload directly to disk...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}

                {/* Video Description */}
                <div>
                  <input
                    type="text"
                    value={vid.description || ""}
                    onChange={(e) => handleUpdateVideo(idx, { description: e.target.value })}
                    placeholder="Short description or notes for this demo video (optional)..."
                    className="w-full px-3 py-1 text-xs rounded-lg border border-slate-200 text-slate-700 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Video Preview */}
                {vid.url && (
                  <div className="mt-2 rounded-xl overflow-hidden bg-black/90 border border-slate-200 max-w-lg aspect-video">
                    {vid.url.includes("youtube.com") || vid.url.includes("youtu.be") ? (
                      <iframe
                        src={vid.url.replace("watch?v=", "embed/")}
                        className="w-full h-full"
                        allowFullScreen
                      />
                    ) : (
                      <video src={vid.url} controls className="w-full h-full object-contain" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg"
        className="hidden"
        onChange={handleFileSelected}
      />
    </div>
  );
}

