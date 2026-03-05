class ImageCropper {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.imageInput = document.getElementById('imageInput');
        this.saveCropBtn = document.getElementById('saveCropBtn');
        this.savePngBtn = document.getElementById('savePngBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.messageDiv = document.getElementById('message');
        this.zoomInfo = document.getElementById('zoomInfo');

        // Threshold Controls
        this.darkThreshold = document.getElementById('darkThreshold');
        this.lightThreshold = document.getElementById('lightThreshold');
        this.darkValue = document.getElementById('darkValue');
        this.lightValue = document.getElementById('lightValue');

        // Canvas Größe
        this.canvasSize = 400;
        this.cropSize = 300;

        // Image und Transformation
        this.image = null;
        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;

        // Touch/Drag
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.pointerCount = 0;
        this.lastTouchDistance = 0;

        // Threshold Values
        this.darkThresholdValue = 50;
        this.lightThresholdValue = 100;

        this.setupCanvas();
        this.attachEventListeners();
        this.updateButtonStates();
    }

    setupCanvas() {
        // DPI-aware canvas
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvasSize * dpr;
        this.canvas.height = this.canvasSize * dpr;
        this.canvas.style.width = `${this.canvasSize}px`;
        this.canvas.style.height = `${this.canvasSize}px`;
        this.ctx.scale(dpr, dpr);
        this.drawOverlay();
    }

    attachEventListeners() {
        // File Input
        this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));

        // Mouse Events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Touch Events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));

        // Pointer Events (Apple Pencil, etc.)
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', () => this.handlePointerUp());

        // Threshold Sliders
        this.darkThreshold.addEventListener('input', (e) => {
            this.darkThresholdValue = parseInt(e.target.value);
            this.darkValue.textContent = this.darkThresholdValue;
            this.updateImage();
        });

        this.lightThreshold.addEventListener('input', (e) => {
            this.lightThresholdValue = parseInt(e.target.value);
            this.lightValue.textContent = this.lightThresholdValue;
            this.updateImage();
        });

        // Buttons
        this.saveCropBtn.addEventListener('click', () => this.saveCrop());
        this.savePngBtn.addEventListener('click', () => this.savePng());
        this.resetBtn.addEventListener('click', () => this.reset());
    }

    handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // In Graustufen konvertieren
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                
                // Bild zeichnen
                ctx.drawImage(img, 0, 0);
                
                // Zu Graustufen konvertieren
                ctx.filter = 'grayscale(100%)';
                ctx.drawImage(img, 0, 0);
                
                // Als grayscale image setzen
                const grayImg = new Image();
                grayImg.src = canvas.toDataURL();
                grayImg.onload = () => {
                    this.image = grayImg;
                    this.zoom = 1.0;
                    this.offsetX = 0;
                    this.offsetY = 0;
                    this.updateImage();
                    this.updateButtonStates();
                    this.showMessage('Bild geladen!', 'info');
                };
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    }

    handleMouseDown(e) {
        if (!this.image) return;
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.image) return;
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.offsetX += dx;
        this.offsetY += dy;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.updateImage();
    }

    handleMouseUp() {
        this.isDragging = false;
    }

    handleWheel(e) {
        if (!this.image) return;
        e.preventDefault();
        const scale = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= scale;
        this.zoom = Math.max(0.5, Math.min(this.zoom, 5.0)); // Limit zoom
        this.updateImage();
    }

    // Touch Events
    handleTouchStart(e) {
        if (!this.image) return;
        e.preventDefault();
        this.pointerCount = e.touches.length;

        if (this.pointerCount === 1) {
            this.isDragging = true;
            this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (this.pointerCount === 2) {
            this.isDragging = false;
            this.lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
        }
    }

    handleTouchMove(e) {
        if (!this.image) return;
        e.preventDefault();

        if (e.touches.length === 1 && this.isDragging) {
            const dx = e.touches[0].clientX - this.dragStart.x;
            const dy = e.touches[0].clientY - this.dragStart.y;
            this.offsetX += dx;
            this.offsetY += dy;
            this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            this.updateImage();
        } else if (e.touches.length === 2) {
            const distance = this.getTouchDistance(e.touches[0], e.touches[1]);
            if (this.lastTouchDistance > 0) {
                const scale = distance / this.lastTouchDistance;
                this.zoom *= scale;
                this.zoom = Math.max(0.5, Math.min(this.zoom, 5.0));
                this.updateImage();
            }
            this.lastTouchDistance = distance;
        }
    }

    handleTouchEnd(e) {
        this.isDragging = false;
        this.pointerCount = e.touches.length;
        if (this.pointerCount < 2) {
            this.lastTouchDistance = 0;
        }
    }

    // Pointer Events für bessere Unterstützung
    handlePointerDown(e) {
        if (!this.image) return;
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
    }

    handlePointerMove(e) {
        if (!this.isDragging || !this.image) return;
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.offsetX += dx;
        this.offsetY += dy;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.updateImage();
    }

    handlePointerUp() {
        this.isDragging = false;
    }

    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    updateImage() {
        if (!this.image) return;

        // Canvas löschen
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

        // Image mit Zoom zeichnen
        const w = this.image.width;
        const h = this.image.height;
        const scaledW = w * this.zoom;
        const scaledH = h * this.zoom;

        this.ctx.drawImage(
            this.image,
            this.offsetX,
            this.offsetY,
            scaledW,
            scaledH
        );

        this.drawOverlay();
        this.updateZoomInfo();
    }

    drawOverlay() {
        const pad = (this.canvasSize - this.cropSize) / 2;

        // Semi-transparent overlay - vier Rechtecke außerhalb des crop-bereichs
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        
        // Oben
        this.ctx.fillRect(0, 0, this.canvasSize, pad);
        
        // Unten
        this.ctx.fillRect(0, pad + this.cropSize, this.canvasSize, this.canvasSize - pad - this.cropSize);
        
        // Links
        this.ctx.fillRect(0, pad, pad, this.cropSize);
        
        // Rechts
        this.ctx.fillRect(pad + this.cropSize, pad, this.canvasSize - pad - this.cropSize, this.cropSize);

        // Weißer Border um crop area
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(pad + 1, pad + 1, this.cropSize - 2, this.cropSize - 2);

        // Corner markers
        const cornerSize = 12;
        const cornerOffset = 3;
        this.ctx.fillStyle = 'white';
        
        // Top-left corner (horizontal nach rechts, vertikal nach unten)
        this.ctx.fillRect(pad - cornerOffset, pad - cornerOffset, cornerSize, 2);
        this.ctx.fillRect(pad - cornerOffset, pad - cornerOffset, 2, cornerSize);
        
        // Top-right corner (horizontal nach links, vertikal nach unten)
        this.ctx.fillRect(pad + this.cropSize - cornerSize + cornerOffset, pad - cornerOffset, cornerSize, 2);
        this.ctx.fillRect(pad + this.cropSize + cornerOffset - 2, pad - cornerOffset, 2, cornerSize);
        
        // Bottom-left corner (horizontal nach rechts, vertikal nach oben)
        this.ctx.fillRect(pad - cornerOffset, pad + this.cropSize + cornerOffset - 2, cornerSize, 2);
        this.ctx.fillRect(pad - cornerOffset, pad + this.cropSize - cornerSize + cornerOffset, 2, cornerSize);
        
        // Bottom-right corner (horizontal nach links, vertikal nach oben)
        this.ctx.fillRect(pad + this.cropSize - cornerSize + cornerOffset, pad + this.cropSize + cornerOffset - 2, cornerSize, 2);
        this.ctx.fillRect(pad + this.cropSize + cornerOffset - 2, pad + this.cropSize - cornerSize + cornerOffset, 2, cornerSize);
    }

    updateZoomInfo() {
        this.zoomInfo.textContent = `${this.zoom.toFixed(1)}x`;
    }

    getCroppedImageData() {
        const cropCanvas = document.createElement('canvas');
        const cropCtx = cropCanvas.getContext('2d');
        
        cropCanvas.width = this.cropSize;
        cropCanvas.height = this.cropSize;

        const pad = (this.canvasSize - this.cropSize) / 2;
        
        // In original image coordinates (accounting for zoom and offset)
        const srcX = (pad - this.offsetX) / this.zoom;
        const srcY = (pad - this.offsetY) / this.zoom;
        const srcWidth = this.cropSize / this.zoom;
        const srcHeight = this.cropSize / this.zoom;

        // Zeichne Ausschnitt aus Originalbild mit korrekten Koordinaten
        cropCtx.drawImage(
            this.image,
            srcX,
            srcY,
            srcWidth,
            srcHeight,
            0,
            0,
            this.cropSize,
            this.cropSize
        );

        return cropCanvas;
    }

    processImageToArray(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // RGB zu Grayscale
        const gray = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        // Threshold-Konvertierung mit dynamischen Werten
        const darkThresh = this.darkThresholdValue;
        const lightThresh = this.lightThresholdValue;

        for (let i = 0; i < gray.length; i++) {
            if (gray[i] < darkThresh) {
                gray[i] = 0;
            } else if (gray[i] >= lightThresh) {
                gray[i] = 255;
            } else {
                // Linear interpolieren für Werte dazwischen
                const range = lightThresh - darkThresh;
                gray[i] = Math.round((gray[i] - darkThresh) * (255 / range));
            }
        }

        // Invertieren (EMNIST-Style)
        for (let i = 0; i < gray.length; i++) {
            gray[i] = 255 - gray[i];
        }

        // Normalisieren auf 0-1
        const normalized = new Float32Array(gray.length);
        for (let i = 0; i < gray.length; i++) {
            normalized[i] = gray[i] / 255.0;
        }

        return normalized;
    }

    processCanvasImage(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // RGB zu Grayscale
        const gray = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        // Threshold-Konvertierung mit dynamischen Werten
        const darkThresh = this.darkThresholdValue;
        const lightThresh = this.lightThresholdValue;

        for (let i = 0; i < gray.length; i++) {
            if (gray[i] < darkThresh) {
                gray[i] = 0;
            } else if (gray[i] >= lightThresh) {
                gray[i] = 255;
            } else {
                // Linear interpolieren für Werte dazwischen
                const range = lightThresh - darkThresh;
                gray[i] = Math.round((gray[i] - darkThresh) * (255 / range));
            }
        }

        // Invertieren (EMNIST-Style)
        for (let i = 0; i < gray.length; i++) {
            gray[i] = 255 - gray[i];
        }

        // Zurück in Canvas zeichnen
        const processedCanvas = document.createElement('canvas');
        processedCanvas.width = canvas.width;
        processedCanvas.height = canvas.height;
        const processedCtx = processedCanvas.getContext('2d');
        const processedImageData = processedCtx.createImageData(canvas.width, canvas.height);
        const processedData = processedImageData.data;

        for (let i = 0; i < gray.length; i++) {
            const idx = i * 4;
            processedData[idx] = gray[i];       // R
            processedData[idx + 1] = gray[i];   // G
            processedData[idx + 2] = gray[i];   // B
            processedData[idx + 3] = 255;       // A
        }

        processedCtx.putImageData(processedImageData, 0, 0);
        return processedCanvas;
    }

    resizeImage(canvas, targetSize) {
        // Canvas mit Zielgröße
        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = targetSize;
        resizeCanvas.height = targetSize;
        const resizeCtx = resizeCanvas.getContext('2d');
        
        resizeCtx.drawImage(canvas, 0, 0, targetSize, targetSize);
        return resizeCanvas;
    }

    async saveCrop() {
        if (!this.image) {
            this.showMessage('Bitte zuerst ein Bild laden!', 'error');
            return;
        }

        try {
            // Cropped image
            const croppedCanvas = this.getCroppedImageData();
            
            // Auf 35x35 resizen
            const resized = this.resizeImage(croppedCanvas, 35);
            
            // Zu Array verarbeiten
            const arrayData = this.processImageToArray(resized);

            // NPY speichern
            this.downloadNPY(arrayData, '35x35_crop.npy');
            this.showMessage('✅ Als NPY heruntergeladen!', 'success');
        } catch (error) {
            console.error(error);
            this.showMessage('❌ Fehler beim Speichern', 'error');
        }
    }

    async savePng() {
        if (!this.image) {
            this.showMessage('Bitte zuerst ein Bild laden!', 'error');
            return;
        }

        try {
            // Cropped image
            const croppedCanvas = this.getCroppedImageData();
            
            // Auf 35x35 resizen
            const resized = this.resizeImage(croppedCanvas, 35);

            // Bildverarbeitung durchführen
            const processedCanvas = this.processCanvasImage(resized);

            // PNG herunterladen
            processedCanvas.toBlob((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = '35x35_crop.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                this.showMessage('✅ Als PNG heruntergeladen!', 'success');
            });
        } catch (error) {
            console.error(error);
            this.showMessage('❌ Fehler beim Speichern', 'error');
        }
    }

    downloadNPY(arrayData, filename) {
        // Einfaches NPY-Format (numpy 1.0)
        // Header: magic + version + dict_size + dict + padding
        
        const shape = [35, 35];
        const dtype = '<f4'; // little-endian float32
        
        // Python dict string
        const dictStr = `{'descr': '${dtype}', 'fortran_order': False, 'shape': (${shape[0]}, ${shape[1]}), }`;
        
        // Padding für Alignment
        const headerLen = 10 + dictStr.length + 1; // magic(6) + version(2) + len(2) + dict + newline
        const padding = 16 - (headerLen % 16);
        const paddedDict = dictStr + ' '.repeat(Math.max(1, padding));
        
        // Header
        const magic = new Uint8Array([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]); // \x93NUMPY
        const version = new Uint8Array([0x01, 0x00]); // version 1.0
        const headerLen2 = new Uint16Array([paddedDict.length + 1]);
        
        // Encoding
        const encoder = new TextEncoder();
        const dictBytes = encoder.encode(paddedDict);
        const newline = new Uint8Array([0x0A]);
        
        // Data (float32, little-endian)
        const dataBuffer = new ArrayBuffer(arrayData.length * 4);
        const dataView = new Float32Array(dataBuffer);
        dataView.set(arrayData);
        
        // Alles zusammensetzen
        const total = magic.length + version.length + 2 + dictBytes.length + newline.length + dataBuffer.byteLength;
        const fileBuffer = new Uint8Array(total);
        
        let offset = 0;
        fileBuffer.set(magic, offset);
        offset += magic.length;
        fileBuffer.set(version, offset);
        offset += version.length;
        fileBuffer.set(new Uint8Array(headerLen2.buffer), offset);
        offset += 2;
        fileBuffer.set(dictBytes, offset);
        offset += dictBytes.length;
        fileBuffer.set(newline, offset);
        offset += newline.length;
        fileBuffer.set(new Uint8Array(dataBuffer), offset);
        
        // Blob und Download
        const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    reset() {
        this.image = null;
        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.imageInput.value = '';
        
        // Canvas schwarz machen
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);
        
        this.drawOverlay();
        this.updateZoomInfo();
        this.updateButtonStates();
        this.showMessage('Zurückgesetzt', 'info');
    }

    updateButtonStates() {
        const hasImage = this.image !== null;
        this.saveCropBtn.disabled = !hasImage;
        this.savePngBtn.disabled = !hasImage;
        this.resetBtn.disabled = !hasImage;
    }

    showMessage(text, type) {
        this.messageDiv.textContent = text;
        this.messageDiv.className = `message ${type}`;
        
        // Auto-hide nach 3 Sekunden
        setTimeout(() => {
            this.messageDiv.textContent = '';
            this.messageDiv.className = 'message';
        }, 3000);
    }
}

// App initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new ImageCropper();
});
