/**
 * Development work by David Lane
 */
// Shared poster utilities (render, download, share)
async function renderPosterCanvas(element, options = {}) {
  if (!window.html2canvas) {
    throw new Error('html2canvas is not available');
  }
  const scale = options.scale || 2;
  const backgroundColor = options.backgroundColor !== undefined ? options.backgroundColor : '#ffffff';
  return window.html2canvas(element, {
    scale,
    backgroundColor,
    useCORS: true,
    allowTaint: true
  });
}

function canvasToDataUrl(canvas) {
  return canvas.toDataURL('image/png');
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
  });
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadPdfFromCanvas(canvas, filename) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error('jsPDF is not available');
  }

  const { jsPDF } = window.jspdf;
  const width = canvas.width;
  const height = canvas.height;
  const pdf = new jsPDF({
    orientation: height >= width ? 'portrait' : 'landscape',
    unit: 'pt',
    format: [width, height]
  });

  const imageData = canvasToDataUrl(canvas);
  pdf.addImage(imageData, 'PNG', 0, 0, width, height);
  pdf.save(filename);
}

async function uploadPosterShare(dataUrl, title, type) {
  const response = await fetch('/api/poster-generator/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData: dataUrl, title, type })
  });
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to create share link');
  }
  return data;
}

async function sharePoster(options) {
  const {
    canvas,
    title,
    text,
    fileName,
    shareUrl
  } = options;

  const blob = await canvasToBlob(canvas);
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      title,
      text,
      files: [file],
      url: shareUrl
    });
    return true;
  }

  if (navigator.share) {
    await navigator.share({
      title,
      text,
      url: shareUrl
    });
    return true;
  }

  return false;
}

window.posterUtils = {
  renderPosterCanvas,
  canvasToDataUrl,
  downloadDataUrl,
  downloadPdfFromCanvas,
  uploadPosterShare,
  sharePoster
};
