/** Discord CDN may deliver a losslessly decoded PNG for a JPEG attachment.
 * Validate the actual bytes and, for PNG, the original dimensions rather than
 * confusing a changed encoding with missing media. User uploads stay strict.
 */
export function sourceMediaType(bytes: Buffer, expected?: {width?:number;height?:number;contentType?:string}) {
  let type = "";
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.length>=24) {
    type = "image/png";
    if ((expected?.width && bytes.readUInt32BE(16)!==expected.width) ||
        (expected?.height && bytes.readUInt32BE(20)!==expected.height))
      throw new Error("Discord image dimensions changed; import stopped.");
  } else if (bytes[0]===255 && bytes[1]===216 && bytes[2]===255) type = "image/jpeg";
  else if (bytes.subarray(0,4).toString()==="RIFF" && bytes.subarray(8,12).toString()==="WEBP") type = "image/webp";
  else if (/^GIF8[79]a$/.test(bytes.subarray(0,6).toString())) type = "image/gif";
  else if (bytes.subarray(4,8).toString()==="ftyp") type = "video/mp4";
  if (!type || (expected?.contentType?.startsWith("image/") && !type.startsWith("image/")))
    throw new Error("Discord media bytes are not a supported image or video.");
  return type;
}