import * as pdfjsLib from "pdfjs-dist/webpack";

export async function pdfToImage(arrayBuffer, setDimations) {


  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const page = await pdf.getPage(1);

  const viewport = page.getViewport({ scale: 1.5 });

  const canvas = document.createElement("canvas");

  canvas.width = viewport.width;

  canvas.height = viewport.height;

  setDimations({
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  });

  await page.render({ canvasContext: canvas.getContext("2d"), viewport })
    .promise;

  return canvas.toDataURL();
}