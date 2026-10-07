/**
 * Transient OCR views, never the photo saved with a record.
 * Small SpyGlass lettering is enlarged before reading. A separate contrast
 * view retains bright coloured lettering on dark game backgrounds.
 */
export async function dinoPhotoViews(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  const scale = Math.min(3,Math.max(1,1200/image.naturalWidth),3200/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height = Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx = canvas.getContext("2d",{willReadFrequently:true});
  if (!ctx) throw new Error("Préparation de l'image impossible.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const colour = canvas.toDataURL("image/png");
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
  for (let i=0;i<pixels.data.length;i+=4) {
    const light = Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);
    const value = light>=155 ? 0 : 255;
    pixels.data[i] = pixels.data[i+1] = pixels.data[i+2] = value;
    pixels.data[i+3] = 255;
  }
  ctx.putImageData(pixels,0,0);
  return { colour,contrast:canvas.toDataURL("image/png"),width:canvas.width,height:canvas.height };
}