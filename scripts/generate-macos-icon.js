const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ICON_VARIANTS = [
  { name: "icon_16x16.png", size: 16 },
  { name: "icon_16x16@2x.png", size: 32 },
  { name: "icon_32x32.png", size: 32 },
  { name: "icon_32x32@2x.png", size: 64 },
  { name: "icon_128x128.png", size: 128 },
  { name: "icon_128x128@2x.png", size: 256 },
  { name: "icon_256x256.png", size: 256 },
  { name: "icon_256x256@2x.png", size: 512 },
  { name: "icon_512x512.png", size: 512 },
  { name: "icon_512x512@2x.png", size: 1024 }
];

function generateMacIcon() {
  if (process.platform !== "darwin") {
    return;
  }

  const projectRoot = path.resolve(__dirname, "..");
  const sourceIcon = path.join(projectRoot, "icon.png");
  const buildDir = path.join(projectRoot, "build");
  const iconsetDir = path.join(buildDir, "app-icon.iconset");
  const outputIcon = path.join(buildDir, "app-icon.icns");

  if (!fs.existsSync(sourceIcon)) {
    throw new Error(`Missing icon source: ${sourceIcon}`);
  }

  fs.rmSync(iconsetDir, { recursive: true, force: true });
  fs.mkdirSync(iconsetDir, { recursive: true });

  for (const variant of ICON_VARIANTS) {
    execFileSync("sips", [
      "-z",
      String(variant.size),
      String(variant.size),
      sourceIcon,
      "--out",
      path.join(iconsetDir, variant.name)
    ]);
  }

  fs.rmSync(outputIcon, { force: true });
  execFileSync("iconutil", ["-c", "icns", iconsetDir, "-o", outputIcon]);
}

module.exports = { generateMacIcon };
