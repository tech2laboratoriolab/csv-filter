import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST() {
  return new Promise<NextResponse>((resolve) => {
    const scraperDir = path.join(process.cwd(), "scraper");
    const child = spawn("python", ["scraper.py"], {
      cwd: scraperDir,
      timeout: 300_000,
    });

    let output = "";
    let error = "";

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer) => {
      // Python logs go to stderr too (logging module)
      output += chunk.toString();
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve(
        NextResponse.json({ success: false, error: "Timeout (5 minutos)", output }, { status: 504 })
      );
    }, 300_000);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(NextResponse.json({ success: true, output, error: null }));
      } else {
        resolve(
          NextResponse.json({ success: false, output, error: `Scraper saiu com codigo ${code}` }, { status: 500 })
        );
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve(
        NextResponse.json({ success: false, output, error: err.message }, { status: 500 })
      );
    });
  });
}
