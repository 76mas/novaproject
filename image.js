const fs = require('fs');
const { createCanvas } = require('canvas');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Configure PDF.js to work in Node.js environment
const NodeCanvasFactory = require('pdfjs-dist/lib/display/node_utils').NodeCanvasFactory;
const NodeCMapReaderFactory = require('pdfjs-dist/lib/display/node_utils').NodeCMapReaderFactory;

class NodeCanvasFactoryCustom {
  create(width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return {
      canvas,
      context
    };
  }

  reset(canvasAndContext, width, height) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext) {
    // Canvas cleanup if needed
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

async function convertPdfToImage(pdfPath, outputPath, options = {}) {
  try {
    const {
      scale = 2.0,      // Higher scale = better quality
      format = 'png',   // png or jpeg
      quality = 0.9     // JPEG quality (0-1)
    } = options;

    console.log('Reading PDF file...');
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    console.log('Loading PDF document...');
    const loadingTask = pdfjsLib.getDocument({
      data: pdfBuffer,
      useSystemFonts: true,
      disableFontFace: false,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true
    });
    
    const pdf = await loadingTask.promise;
    console.log(`PDF loaded. Total pages: ${pdf.numPages}`);
    
    // Get the first page
    const page = await pdf.getPage(1);
    console.log('Retrieved first page');
    
    // Calculate viewport
    const viewport = page.getViewport({ scale });
    console.log(`Page size: ${viewport.width}x${viewport.height}`);
    
    // Create canvas
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    // Set white background
    context.fillStyle = 'white';
    context.fillRect(0, 0, viewport.width, viewport.height);
    
    // Render the page
    console.log('Rendering page...');
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      canvasFactory: new NodeCanvasFactoryCustom()
    };
    
    await page.render(renderContext).promise;
    console.log('Page rendered successfully');
    
    // Save as image
    let buffer;
    if (format.toLowerCase() === 'jpeg' || format.toLowerCase() === 'jpg') {
      buffer = canvas.toBuffer('image/jpeg', { quality });
    } else {
      buffer = canvas.toBuffer('image/png');
    }
    
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ PDF first page converted to image: ${outputPath}`);
    console.log(`   Image size: ${viewport.width}x${viewport.height}`);
    console.log(`   File size: ${(buffer.length / 1024).toFixed(2)} KB`);
    
  } catch (error) {
    console.error('❌ Error converting PDF to image:', error.message);
    console.error('Full error:', error);
  }
}

// Usage examples
async function main() {
  const pdfPath = "C:\\Users\\HussienHamza\\Downloads\\INV-2025-06-010.pdf";      // Path to your PDF file
  const outputPath = 'output.png';   // Output image path
  
  // Basic conversion
  await convertPdfToImage(pdfPath, outputPath);
  
  // High quality conversion
  // await convertPdfToImage(pdfPath, 'output-hq.png', { 
  //   scale: 3.0 
  // });
  
  // JPEG output
  // await convertPdfToImage(pdfPath, 'output.jpg', { 
  //   format: 'jpeg', 
  //   quality: 0.8,
  //   scale: 2.0 
  // });
}

// Check if this file is being run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { convertPdfToImage };