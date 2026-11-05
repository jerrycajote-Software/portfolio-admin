import React, { useState, useRef, useEffect, useCallback } from "react";

export interface RedactionZone {
  id: string;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  label?: string;
  blurRadius?: number;
}

interface SignatureRedactionToolProps {
  initialImageUrl?: string | null;
  initialPdfUrl?: string | null;
  initialBlurData?: string | null;
  onUploadComplete: (result: {
    imageUrl: string;
    pdfUrl?: string | null;
    blurData: string;
  }) => void;
}

const PRESETS: Record<string, { x: number; y: number; width: number; height: number; label: string }> = {
  bottom_right: { x: 62, y: 76, width: 32, height: 18, label: "Bottom Right" },
  bottom_center: { x: 34, y: 76, width: 32, height: 18, label: "Bottom Center" },
  bottom_left: { x: 6, y: 76, width: 32, height: 18, label: "Bottom Left" },
  bottom_wide: { x: 5, y: 74, width: 90, height: 20, label: "Entire Bottom Band" },
  center_seal: { x: 35, y: 38, width: 30, height: 24, label: "Center Seal" },
  top_right: { x: 65, y: 8, width: 30, height: 16, label: "Top Right" },
};

function parseInitialZones(raw?: string | null): RedactionZone[] {
  if (!raw) {
    return [{ id: "zone-1", ...PRESETS.bottom_right, label: "Privacy Cover 1" }];
  }
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.zones) && data.zones.length > 0) {
      return data.zones.map((z: any, idx: number) => ({
        id: z.id || `zone-${idx + 1}`,
        x: typeof z.x === "number" ? z.x : 62,
        y: typeof z.y === "number" ? z.y : 76,
        width: typeof z.width === "number" ? z.width : 32,
        height: typeof z.height === "number" ? z.height : 18,
        label: z.label || `Privacy Cover ${idx + 1}`,
        blurRadius: z.blurRadius,
      }));
    }
    if (typeof data.x === "number") {
      return [
        {
          id: "zone-1",
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          label: data.label || "Privacy Cover 1",
          blurRadius: data.blurRadius,
        },
      ];
    }
  } catch {
    // fallback
  }
  return [{ id: "zone-1", ...PRESETS.bottom_right, label: "Privacy Cover 1" }];
}

export function SignatureRedactionTool({
  initialImageUrl,
  initialPdfUrl,
  initialBlurData,
  onUploadComplete,
}: SignatureRedactionToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [rawPdfDataUrl, setRawPdfDataUrl] = useState<string | null>(null);
  const [bakedPreviewUrl, setBakedPreviewUrl] = useState<string | null>(() => initialImageUrl || null);

  // Multi-page PDF state
  const [totalPages, setTotalPages] = useState<number>(1);
  const [activePageIndex, setActivePageIndex] = useState<number>(1);
  const [pageThumbnails, setPageThumbnails] = useState<Array<{ pageNum: number; dataUrl: string }>>([]);
  const [viewMode, setViewMode] = useState<"editor" | "scroll">("editor");
  const [scrollAllPagesUrls, setScrollAllPagesUrls] = useState<Array<{ pageNum: number; dataUrl: string }>>([]);
  const pdfDocRef = useRef<any>(null);

  // Multiple privacy covers state
  const [zones, setZones] = useState<RedactionZone[]>(() => parseInitialZones(initialBlurData));
  const [activeZoneId, setActiveZoneId] = useState<string>(() => zones[0]?.id || "zone-1");
  const [blurIntensity, setBlurIntensity] = useState<number>(14);
  const [showWatermark, setShowWatermark] = useState<boolean>(true);

  // Drag interaction state
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  // Load PDF.js from Cloudflare cdnjs on demand
  const loadPdfJs = useCallback(async () => {
    if ((window as unknown as { pdfjsLib?: any }).pdfjsLib) {
      return (window as unknown as { pdfjsLib: any }).pdfjsLib;
    }
    return new Promise<any>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.onload = () => {
        const lib = (window as unknown as { pdfjsLib: any }).pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(lib);
      };
      script.onerror = () => reject(new Error("Failed to load PDF.js from CDN"));
      document.body.appendChild(script);
    });
  }, []);

  // Pixel-level box blur / pixelate algorithm
  const applyPixelBlur = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    const rx = Math.max(0, Math.floor(x));
    const ry = Math.max(0, Math.floor(y));
    const rw = Math.min(ctx.canvas.width - rx, Math.floor(width));
    const rh = Math.min(ctx.canvas.height - ry, Math.floor(height));
    if (rw <= 0 || rh <= 0) return;

    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const data = imgData.data;
    const blockSize = Math.max(6, Math.floor(radius));

    for (let py = 0; py < rh; py += blockSize) {
      for (let px = 0; px < rw; px += blockSize) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let dy = 0; dy < blockSize && py + dy < rh; dy++) {
          for (let dx = 0; dx < blockSize && px + dx < rw; dx++) {
            const idx = ((py + dy) * rw + (px + dx)) * 4;
            r += data[idx];
            g += data[idx + 1];
            b += data[idx + 2];
            a += data[idx + 3];
            count++;
          }
        }
        if (count > 0) {
          r = Math.floor(r / count);
          g = Math.floor(g / count);
          b = Math.floor(b / count);
          a = Math.floor(a / count);
          for (let dy = 0; dy < blockSize && py + dy < rh; dy++) {
            for (let dx = 0; dx < blockSize && px + dx < rw; dx++) {
              const idx = ((py + dy) * rw + (px + dx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = a;
            }
          }
        }
      }
    }
    ctx.putImageData(imgData, rx, ry);
  };

  // Draw interactive preview with all privacy covers
  const drawInteractivePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const sourceImg = sourceImageRef.current;
    if (!canvas || !sourceImg) return;

    const containerWidth = containerRef.current?.clientWidth
      ? Math.max(600, containerRef.current.clientWidth - 40)
      : 1200;
    const maxWidth = Math.min(1400, containerWidth);
    const scale = Math.min(1.5, maxWidth / sourceImg.width);
    canvas.width = sourceImg.width * scale;
    canvas.height = sourceImg.height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw source document page
    ctx.drawImage(sourceImg, 0, 0, canvas.width, canvas.height);

    // Draw each privacy cover zone
    zones.forEach((z) => {
      const zX = (z.x / 100) * canvas.width;
      const zY = (z.y / 100) * canvas.height;
      const zW = (z.width / 100) * canvas.width;
      const zH = (z.height / 100) * canvas.height;
      const isActive = z.id === activeZoneId;

      // Apply blur to this zone
      applyPixelBlur(ctx, zX, zY, zW, zH, blurIntensity * scale);

      // Frosted glass tint
      ctx.fillStyle = isActive ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(zX, zY, zW, zH);

      // Border line around redacted zone
      if (isActive) {
        ctx.strokeStyle = "rgba(79, 70, 229, 0.95)"; // indigo-600 active border
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = "rgba(100, 116, 139, 0.75)"; // slate-500 inactive border
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
      }
      ctx.strokeRect(zX, zY, zW, zH);
      ctx.setLineDash([]);

      // Corner handles for active cover
      if (isActive) {
        ctx.fillStyle = "rgba(79, 70, 229, 1)";
        const handleSize = 6;
        ctx.fillRect(zX - handleSize / 2, zY - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(zX + zW - handleSize / 2, zY - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(zX - handleSize / 2, zY + zH - handleSize / 2, handleSize, handleSize);
        ctx.fillRect(zX + zW - handleSize / 2, zY + zH - handleSize / 2, handleSize, handleSize);
      }

      // Watermark badge / cover label
      if (showWatermark && zW > 45 && zH > 18) {
        ctx.fillStyle = isActive ? "rgba(15, 23, 42, 0.9)" : "rgba(51, 65, 85, 0.8)";
        const fontSize = Math.max(10, Math.min(13, Math.floor(zH * 0.28)));
        ctx.font = `600 ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const labelText = z.label ? `🔒 ${z.label}` : "🔒 Redacted";
        ctx.fillText(labelText, zX + zW / 2, zY + zH / 2);
      }
    });
  }, [zones, activeZoneId, blurIntensity, showWatermark]);

  // Pre-load initial image if provided (e.g. editing existing certificate)
  useEffect(() => {
    if (!file && initialImageUrl && !sourceImageRef.current) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        sourceImageRef.current = img;
        drawInteractivePreview();
      };
      img.src = initialImageUrl;
      setBakedPreviewUrl(initialImageUrl);
    }
  }, [initialImageUrl, file, drawInteractivePreview]);

  useEffect(() => {
    if (sourceImageRef.current) {
      drawInteractivePreview();
    }
  }, [zones, activeZoneId, blurIntensity, showWatermark, drawInteractivePreview]);

  useEffect(() => {
    const handleResize = () => {
      if (sourceImageRef.current) {
        drawInteractivePreview();
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [drawInteractivePreview]);

  // Render a specific page from loaded PDF to the main canvas
  const renderPdfPage = useCallback(
    async (pdfDoc: any, pageNumber: number) => {
      setStatusMessage(`Rendering page ${pageNumber} of ${pdfDoc.numPages}...`);
      const page = await pdfDoc.getPage(pageNumber);

      // Render at 2x resolution for crisp high-definition certificate export
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = hiddenCanvasRef.current;
      if (!canvas) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      await page.render({ canvasContext: ctx, viewport }).promise;

      const img = new Image();
      img.onload = () => {
        sourceImageRef.current = img;
        drawInteractivePreview();
        setStatusMessage(null);
      };
      img.src = canvas.toDataURL("image/png");
    },
    [drawInteractivePreview]
  );

  // Switch active page
  const handleSelectPage = async (pageNumber: number) => {
    if (!pdfDocRef.current || pageNumber === activePageIndex) return;
    setActivePageIndex(pageNumber);
    setViewMode("editor");
    await renderPdfPage(pdfDocRef.current, pageNumber);
  };

  // Generate thumbnails and full pages for all pages in PDF
  const generateAllPagesViews = async (pdfDoc: any) => {
    const thumbs: Array<{ pageNum: number; dataUrl: string }> = [];
    const fullPages: Array<{ pageNum: number; dataUrl: string }> = [];

    const thumbCanvas = document.createElement("canvas");
    const thumbCtx = thumbCanvas.getContext("2d");

    const fullCanvas = document.createElement("canvas");
    const fullCtx = fullCanvas.getContext("2d");

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      const page = await pdfDoc.getPage(p);

      // Mini thumbnail for scroll bar
      if (thumbCtx) {
        const thumbViewport = page.getViewport({ scale: 0.35 });
        thumbCanvas.width = thumbViewport.width;
        thumbCanvas.height = thumbViewport.height;
        await page.render({ canvasContext: thumbCtx, viewport: thumbViewport }).promise;
        thumbs.push({ pageNum: p, dataUrl: thumbCanvas.toDataURL("image/jpeg", 0.75) });
      }

      // High-res preview for vertical scroll view
      if (fullCtx) {
        const fullViewport = page.getViewport({ scale: 1.3 });
        fullCanvas.width = fullViewport.width;
        fullCanvas.height = fullViewport.height;
        await page.render({ canvasContext: fullCtx, viewport: fullViewport }).promise;
        fullPages.push({ pageNum: p, dataUrl: fullCanvas.toDataURL("image/jpeg", 0.88) });
      }
    }

    setPageThumbnails(thumbs);
    setScrollAllPagesUrls(fullPages);
  };

  // Process selected file
  const processFile = useCallback(
    async (selectedFile: File) => {
      setFile(selectedFile);
      setUploadSuccess(false);
      setUploadError(null);
      setStatusMessage("Reading document...");

      const isPdfFile =
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf");
      setIsPdf(isPdfFile);

      try {
        if (isPdfFile) {
          setStatusMessage("Loading PDF document...");
          const pdfjs = await loadPdfJs();
          const arrayBuffer = await selectedFile.arrayBuffer();

          // Store raw PDF data URL for backup / upload
          const reader = new FileReader();
          reader.onload = (e) => setRawPdfDataUrl(e.target?.result as string);
          reader.readAsDataURL(selectedFile);

          const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
          const pdfDoc = await loadingTask.promise;
          pdfDocRef.current = pdfDoc;
          setTotalPages(pdfDoc.numPages);
          setActivePageIndex(1);

          // Render active page 1
          await renderPdfPage(pdfDoc, 1);

          // Generate scroll previews and thumbnails if multi-page
          if (pdfDoc.numPages > 1) {
            setStatusMessage(`Generating previews for ${pdfDoc.numPages} PDF pages...`);
            await generateAllPagesViews(pdfDoc);
            setStatusMessage(null);
          }
        } else {
          // Standard Image file
          setStatusMessage("Loading certificate image...");
          setTotalPages(1);
          setActivePageIndex(1);
          setPageThumbnails([]);
          setScrollAllPagesUrls([]);
          pdfDocRef.current = null;

          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const img = new Image();
            img.onload = () => {
              const canvas = hiddenCanvasRef.current;
              if (canvas) {
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0);
              }
              sourceImageRef.current = img;
              drawInteractivePreview();
              setStatusMessage(null);
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(selectedFile);
        }
      } catch (err: any) {
        console.error("Error processing document:", err);
        setUploadError(`Failed to load document: ${err.message}`);
        setStatusMessage(`Error loading document: ${err.message}`);
      }
    },
    [loadPdfJs, renderPdfPage, drawInteractivePreview]
  );

  // Active zone lookup
  const activeZone = zones.find((z) => z.id === activeZoneId) || zones[0] || {
    id: "zone-1",
    ...PRESETS.bottom_right,
    label: "Privacy Cover 1",
  };

  // Add new privacy cover
  const handleAddZone = () => {
    const nextIndex = zones.length + 1;
    const offsetPreset =
      nextIndex % 3 === 2
        ? PRESETS.bottom_left
        : nextIndex % 3 === 0
        ? PRESETS.bottom_center
        : PRESETS.bottom_right;

    const newZone: RedactionZone = {
      id: `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      x: Math.max(5, (offsetPreset.x + zones.length * 3) % 70),
      y: offsetPreset.y,
      width: offsetPreset.width,
      height: offsetPreset.height,
      label: `Privacy Cover ${nextIndex}`,
    };

    setZones((prev) => [...prev, newZone]);
    setActiveZoneId(newZone.id);
  };

  // Remove privacy cover
  const handleRemoveZone = (idToRemove: string) => {
    if (zones.length <= 1) {
      return;
    }
    setZones((prev) => {
      const filtered = prev.filter((z) => z.id !== idToRemove);
      if (activeZoneId === idToRemove && filtered.length > 0) {
        setActiveZoneId(filtered[0].id);
      }
      return filtered;
    });
  };

  // Update active privacy cover
  const updateActiveZone = (updates: Partial<RedactionZone>) => {
    setZones((prev) =>
      prev.map((z) => (z.id === activeZoneId ? { ...z, ...updates } : z))
    );
  };

  // Apply preset to active privacy cover
  const applyPresetToActive = (preset: typeof PRESETS[keyof typeof PRESETS]) => {
    updateActiveZone({
      x: preset.x,
      y: preset.y,
      width: preset.width,
      height: preset.height,
    });
  };

  // Canvas mouse interactions for dragging covers
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    // Check hit against zones in reverse order (topmost first)
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i];
      if (
        clickX >= z.x &&
        clickX <= z.x + z.width &&
        clickY >= z.y &&
        clickY <= z.y + z.height
      ) {
        setActiveZoneId(z.id);
        isDraggingRef.current = true;
        dragOffsetRef.current = { dx: clickX - z.x, dy: clickY - z.y };
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const newX = Math.max(0, Math.min(100 - activeZone.width, currentX - dragOffsetRef.current.dx));
    const newY = Math.max(0, Math.min(100 - activeZone.height, currentY - dragOffsetRef.current.dy));

    updateActiveZone({
      x: Math.round(newX),
      y: Math.round(newY),
    });
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
  };

  // Bake pixel blur into high-res canvas + upload to storage
  const handleRedactAndUpload = async () => {
    setUploadError(null);
    const sourceImg = sourceImageRef.current;
    const hiddenCanvas = hiddenCanvasRef.current;

    if (!sourceImg || !hiddenCanvas) {
      setUploadError("Document image is not ready. Please select or drop a file first.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Baking privacy covers into certificate image...");

    try {
      hiddenCanvas.width = sourceImg.width;
      hiddenCanvas.height = sourceImg.height;
      const ctx = hiddenCanvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D canvas context");

      // Draw original full-res image
      ctx.drawImage(sourceImg, 0, 0);

      // Burn in EVERY privacy cover zone
      zones.forEach((z) => {
        const zX = (z.x / 100) * hiddenCanvas.width;
        const zY = (z.y / 100) * hiddenCanvas.height;
        const zW = (z.width / 100) * hiddenCanvas.width;
        const zH = (z.height / 100) * hiddenCanvas.height;

        applyPixelBlur(ctx, zX, zY, zW, zH, blurIntensity * 1.5);

        // Frosted glass overlay
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillRect(zX, zY, zW, zH);

        if (showWatermark) {
          ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
          const fontSize = Math.max(12, Math.min(22, Math.floor(zH * 0.25)));
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const labelText = z.label ? `🔒 ${z.label}` : "🔒 Signature Redacted";
          ctx.fillText(labelText, zX + zW / 2, zY + zH / 2);
        }
      });

      setStatusMessage("Uploading sanitized certificate image...");

      // Export sanitized image as WebP (or browser PNG fallback)
      const sanitizedDataUrl = hiddenCanvas.toDataURL("image/webp", 0.92);
      const actualMime = sanitizedDataUrl.split(";")[0]?.replace("data:", "") || "image/webp";
      const ext = actualMime === "image/png" ? "png" : "webp";

      const baseName = file?.name.replace(/\.[^/.]+$/, "") || "certificate";
      const pageSuffix = totalPages > 1 ? `-p${activePageIndex}` : "";
      const sanitizedFilename = `${baseName}${pageSuffix}-sanitized.${ext}`;

      // Upload sanitized image
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataUrl: sanitizedDataUrl,
          filename: sanitizedFilename,
          contentType: actualMime,
          folder: "certificates",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Upload failed with HTTP ${res.status}`);
      }

      const uploadResult = await res.json();

      // Upload raw multi-page PDF if available
      let pdfUrl: string | null = null;
      if (isPdf && rawPdfDataUrl) {
        setStatusMessage("Uploading original PDF document...");
        try {
          const pdfRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dataUrl: rawPdfDataUrl,
              filename: file?.name || "document.pdf",
              contentType: "application/pdf",
              folder: "certificates/pdf",
            }),
          });
          if (pdfRes.ok) {
            const pdfJson = await pdfRes.json();
            pdfUrl = pdfJson.url;
          }
        } catch (pdfErr) {
          console.warn("Raw PDF upload skipped/failed:", pdfErr);
        }
      }

      // Metadata with multiple zones support + single-zone fallback
      const primaryZone = zones[0] || { x: 0, y: 0, width: 0, height: 0 };
      const blurData = JSON.stringify({
        zones: zones.map((z) => ({
          id: z.id,
          x: z.x,
          y: z.y,
          width: z.width,
          height: z.height,
          label: z.label,
        })),
        x: primaryZone.x,
        y: primaryZone.y,
        width: primaryZone.width,
        height: primaryZone.height,
        blurIntensity,
        showWatermark,
        page: activePageIndex,
        totalPages,
        redactedAt: new Date().toISOString(),
      });

      setBakedPreviewUrl(sanitizedDataUrl);
      setUploadSuccess(true);
      setStatusMessage(
        `Successfully uploaded (${uploadResult.provider})! ${zones.length} privacy cover(s) permanently baked.`
      );

      onUploadComplete({
        imageUrl: uploadResult.url,
        pdfUrl,
        blurData,
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      const errMsg = err.message || "Failed to upload certificate";
      setUploadError(errMsg);
      setStatusMessage(`Upload failed: ${errMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>🛡️ Signature Redaction &amp; Media Upload</span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
              PDF &amp; Image
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Upload single or multi-page documents. Add privacy covers over signatures or seals, preview in real time, and save.
          </p>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-xl shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "editor"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              ✏️ Redact Page {activePageIndex}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("scroll")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "scroll"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              📜 Scroll All ({totalPages} Pages)
            </button>
          </div>
        )}
      </div>

      {/* File Dropzone */}
      <div className="flex items-center gap-4">
        <label className="flex-1 flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl cursor-pointer bg-white transition-colors">
          <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{file ? file.name : (initialImageUrl ? "Change PDF / Certificate File" : "Select or Drop PDF / Image file")}</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1">
            Accepts multi-page .pdf, .png, .jpg, .jpeg, .webp (up to 25MB)
          </span>
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) processFile(selected);
            }}
          />
        </label>
      </div>

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-xl text-xs font-medium flex items-center justify-between ${
            uploadSuccess
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : isProcessing
              ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          <span>{statusMessage}</span>
          {uploadSuccess && <span className="font-bold text-emerald-600">✓ Uploaded</span>}
        </div>
      )}

      {/* Multi-Page PDF Horizontal Scroll Strip */}
      {totalPages > 1 && pageThumbnails.length > 0 && viewMode === "editor" && (
        <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>📑 PDF Pages ({totalPages}):</span>
              <span className="text-indigo-600 font-semibold font-mono">
                Page {activePageIndex} active
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={activePageIndex <= 1}
                onClick={() => handleSelectPage(activePageIndex - 1)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700"
              >
                ◀ Prev
              </button>
              <button
                type="button"
                disabled={activePageIndex >= totalPages}
                onClick={() => handleSelectPage(activePageIndex + 1)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700"
              >
                Next ▶
              </button>
            </div>
          </div>

          {/* Horizontal scroll container for all pages */}
          <div className="overflow-x-auto flex gap-3 pb-1 pt-1 scrollbar-thin">
            {pageThumbnails.map((thumb) => {
              const isSelected = thumb.pageNum === activePageIndex;
              return (
                <button
                  key={thumb.pageNum}
                  type="button"
                  onClick={() => handleSelectPage(thumb.pageNum)}
                  className={`flex flex-col items-center p-1.5 rounded-xl border transition-all flex-shrink-0 ${
                    isSelected
                      ? "border-indigo-600 bg-indigo-50/70 shadow-sm ring-2 ring-indigo-500/30"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                  }`}
                >
                  <img
                    src={thumb.dataUrl}
                    alt={`Page ${thumb.pageNum}`}
                    className="w-20 h-28 object-contain rounded bg-white shadow-xs"
                  />
                  <span
                    className={`mt-1.5 text-[11px] font-semibold ${
                      isSelected ? "text-indigo-700" : "text-slate-600"
                    }`}
                  >
                    Page {thumb.pageNum}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Continuous Scroll All Pages View */}
      {viewMode === "scroll" && scrollAllPagesUrls.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs">
            <span className="font-semibold">
              Scroll down to inspect all {totalPages} pages of your PDF document.
            </span>
            <button
              type="button"
              onClick={() => setViewMode("editor")}
              className="px-3 py-1 rounded-lg font-bold bg-indigo-600 text-white text-xs hover:bg-indigo-700 transition-colors"
            >
              Back to Redaction Editor
            </button>
          </div>

          <div className="max-h-[620px] overflow-y-auto space-y-6 p-4 bg-slate-900/10 rounded-2xl border border-slate-300">
            {scrollAllPagesUrls.map((p) => (
              <div
                key={p.pageNum}
                className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-700">
                    Page {p.pageNum} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectPage(p.pageNum)}
                    className="px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
                  >
                    Select Page {p.pageNum} for Redaction
                  </button>
                </div>
                <div className="p-3 flex justify-center bg-slate-100/50">
                  <img
                    src={p.dataUrl}
                    alt={`Document Page ${p.pageNum}`}
                    className="max-w-full h-auto rounded border border-slate-200 shadow-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive Visual Redaction Canvas Mode */}
      {viewMode === "editor" && sourceImageRef.current && (
        <div className="space-y-4 pt-1">
          {/* Privacy Covers Manager Header */}
          <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Privacy Covers ({zones.length}):
                </span>
                <span className="text-[11px] text-slate-500">
                  Click a cover to edit or drag directly on preview
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddZone}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-xs flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>+ Add Privacy Cover</span>
              </button>
            </div>

            {/* Privacy Covers Tabs / List */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
              {zones.map((z, idx) => {
                const isActive = z.id === activeZoneId;
                return (
                  <div
                    key={z.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      isActive
                        ? "bg-indigo-50 border-indigo-500 text-indigo-700 shadow-xs ring-1 ring-indigo-500/30"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveZoneId(z.id)}
                      className="cursor-pointer"
                    >
                      <span>🔒 {z.label || `Cover #${idx + 1}`}</span>
                    </button>
                    {zones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveZone(z.id)}
                        title="Delete this privacy cover"
                        className="ml-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Cover Fine-Tuning Controls */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Cover Label:</span>
                <input
                  type="text"
                  value={activeZone.label || ""}
                  onChange={(e) => updateActiveZone({ label: e.target.value })}
                  placeholder="e.g. Signature #1, Seal, ID Number"
                  className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 w-48 font-medium focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <span>Blur Strength:</span>
                  <input
                    type="range"
                    min="6"
                    max="28"
                    value={blurIntensity}
                    onChange={(e) => setBlurIntensity(Number(e.target.value))}
                    className="w-20 h-1.5 bg-slate-200 rounded-lg accent-indigo-600 cursor-pointer"
                  />
                </label>

                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showWatermark}
                    onChange={(e) => setShowWatermark(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <span>Privacy Badge</span>
                </label>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-600">Quick Presets:</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => applyPresetToActive(p)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Coordinate Number Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
              <div>
                <label className="block text-slate-500 font-semibold mb-1">X Position (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeZone.x}
                  onChange={(e) => updateActiveZone({ x: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="w-full px-2 py-1 rounded border border-slate-300 text-center font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Y Position (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={activeZone.y}
                  onChange={(e) => updateActiveZone({ y: Math.max(0, Math.min(100, Number(e.target.value))) })}
                  className="w-full px-2 py-1 rounded border border-slate-300 text-center font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Width (%)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={activeZone.width}
                  onChange={(e) => updateActiveZone({ width: Math.max(5, Math.min(100, Number(e.target.value))) })}
                  className="w-full px-2 py-1 rounded border border-slate-300 text-center font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 font-semibold mb-1">Height (%)</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={activeZone.height}
                  onChange={(e) => updateActiveZone({ height: Math.max(5, Math.min(100, Number(e.target.value))) })}
                  className="w-full px-2 py-1 rounded border border-slate-300 text-center font-mono"
                />
              </div>
            </div>
          </div>

          {/* Interactive Preview Canvas */}
          <div
            ref={containerRef}
            className="relative w-full rounded-xl overflow-hidden border border-slate-300 bg-slate-900/10 flex flex-col items-center shadow-inner p-3"
          >
            <div className="w-full flex items-center justify-between pb-2 text-[11px] text-slate-600 font-medium">
              <span>🖱️ Drag covers on the document to reposition</span>
              {totalPages > 1 && (
                <span className="font-bold text-indigo-700">
                  Editing Page {activePageIndex} of {totalPages}
                </span>
              )}
            </div>
            <canvas
              ref={previewCanvasRef}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              className="max-w-full h-auto rounded-lg shadow-md border border-slate-200 cursor-move"
            />
          </div>

          {/* Error Banner Right Above Button */}
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">⚠️</span>
                <span className="truncate">{uploadError}</span>
              </div>
              <button
                type="button"
                onClick={handleRedactAndUpload}
                disabled={isProcessing}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex-shrink-0 transition-colors shadow-xs"
              >
                Retry
              </button>
            </div>
          )}

          {/* Success Baked Document Preview Card */}
          {uploadSuccess && bakedPreviewUrl && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-extrabold text-sm">✓</span>
                  <span>Cover(s) Baked &amp; Certificate File Attached!</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-full uppercase">
                  Ready to Save
                </span>
              </div>

              <div className="flex items-center gap-4 bg-white/80 p-2.5 rounded-xl border border-emerald-200">
                <img
                  src={bakedPreviewUrl}
                  alt="Redacted certificate thumbnail"
                  className="w-24 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50 shadow-xs flex-shrink-0"
                />
                <div className="text-xs text-slate-700 space-y-0.5 min-w-0">
                  <p className="font-bold text-slate-900">
                    {zones.length} Privacy Cover(s) Permanently Applied
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isPdf ? `Rendered from Page ${activePageIndex} of ${totalPages}.` : "Image sanitized."} The redacted image is attached and will be stored when you submit the form.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Upload Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-500">
              {isPdf
                ? `PDF Page ${activePageIndex} will be redacted & saved as certificate thumbnail.`
                : "Image ready."}{" "}
              {zones.length} privacy cover(s) active.
            </span>
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleRedactAndUpload}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                uploadSuccess
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25"
                  : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25"
              } disabled:opacity-50`}
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Applying Covers &amp; Uploading...</span>
                </>
              ) : uploadSuccess ? (
                <>
                  <span>✓</span>
                  <span>Re-apply &amp; Update Attached File</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Apply {zones.length} Cover(s) &amp; Attach File</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Hidden processing canvas */}
      <canvas ref={hiddenCanvasRef} className="hidden" />
    </div>
  );
}
