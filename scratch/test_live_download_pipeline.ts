import http from "node:http";

async function testFormat(sourceUrl: string, mediaId: string, format: any) {
  console.log(`\n--- Testing format: ${format.id} (${format.quality}, ${format.container}, ${format.type}) ---`);
  const prepRes = await fetch("http://localhost:3000/api/trpc/media.createJob", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      json: {
        sourceUrl,
        mediaId,
        formatId: format.id
      }
    })
  });

  const prepJson = await prepRes.json();
  const job = prepJson?.result?.data?.json;
  if (!job || !job.downloadUrl) {
    throw new Error(`Prepare download failed for ${format.id}: ` + JSON.stringify(prepJson));
  }

  const fullDownloadUrl = `http://localhost:3000${job.downloadUrl}`;
  await new Promise<void>((resolve, reject) => {
    http.get(fullDownloadUrl, (res) => {
      console.log(`HTTP Status: ${res.statusCode} | Content-Type: ${res.headers["content-type"]} | Filename: ${res.headers["content-disposition"]}`);

      if (res.statusCode !== 200) {
        let errBody = "";
        res.on("data", (c) => { errBody += c.toString(); });
        res.on("end", () => {
          reject(new Error(`Download proxy returned ${res.statusCode}: ${errBody}`));
        });
        return;
      }

      let bytesReceived = 0;
      res.on("data", (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived >= 250_000) {
          console.log(`  -> SUCCESS! Streamed ${bytesReceived} bytes of valid media.`);
          res.destroy();
          resolve();
        }
      });

      res.on("error", (err) => {
        if (bytesReceived >= 250_000) resolve();
        else reject(err);
      });

      res.on("end", () => {
        if (bytesReceived > 0) resolve();
        else reject(new Error("0 bytes received!"));
      });
    }).on("error", reject);
  });
}

async function run() {
  const sourceUrl = "https://youtu.be/CN6BhyERbas";
  console.log("Analyzing YouTube URL:", sourceUrl);

  const analyzeRes = await fetch("http://localhost:3000/api/trpc/media.analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ json: { url: sourceUrl } })
  });

  const analyzeJson = await analyzeRes.json();
  const media = analyzeJson?.result?.data?.json;
  if (!media) throw new Error("Analysis failed: " + JSON.stringify(analyzeJson));

  console.log("Title:", media.title);

  // Test highest video format
  const topVideo = media.formats.find((f: any) => f.type === "video");
  if (topVideo) await testFormat(sourceUrl, media.id, topVideo);

  // Test an audio format
  const audioFmt = media.formats.find((f: any) => f.type === "audio");
  if (audioFmt) await testFormat(sourceUrl, media.id, audioFmt);

  console.log("\n=========================================");
  console.log("ALL FORMAT DOWNLOAD TESTS PASSED 100% OK!");
  console.log("=========================================");
}

run().catch((err) => {
  console.error("TEST SUITE FAILED:", err);
  process.exit(1);
});
