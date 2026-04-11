/**
 * verify-camera-capture.cjs
 *
 * Static verification script for Camera Capture + Image Preview (Phase 4).
 * Reads source files via fs.readFileSync and validates expo-camera
 * integration patterns via regex matching.
 *
 * Tests R-P4-01, R-P4-02, R-P4-03, R-P4-04, R-P4-05, R-P4-06
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let failures = 0;
let passes = 0;

function check(id, description, condition) {
  if (condition) {
    passes++;
    process.stdout.write(`  PASS  ${id}: ${description}\n`);
  } else {
    failures++;
    console.error(`  FAIL  ${id}: ${description}`);
  }
}

// --- R-P4-01: package.json declares expo-camera and expo-image-manipulator ---
// # Tests R-P4-01
const pkgPath = path.join(ROOT, "apps/trucker/package.json");
const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

check(
  "R-P4-01",
  "package.json declares expo-camera and expo-image-manipulator in dependencies",
  pkgJson.dependencies["expo-camera"] !== undefined &&
    pkgJson.dependencies["expo-image-manipulator"] !== undefined
);

// --- R-P4-02: app.json has camera permission entries ---
// # Tests R-P4-02
const appJsonPath = path.join(ROOT, "apps/trucker/app.json");
const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
const appJson = JSON.parse(appJsonContent);

const hasNSCamera =
  /NSCameraUsageDescription/.test(appJsonContent) ||
  (appJson.expo &&
    appJson.expo.plugins &&
    JSON.stringify(appJson.expo.plugins).includes("NSCameraUsageDescription"));
const hasAndroidCamera =
  /CAMERA/.test(appJsonContent) &&
  (/android/.test(appJsonContent) || /permissions/.test(appJsonContent));

check(
  "R-P4-02",
  "app.json includes NSCameraUsageDescription and Android CAMERA permission",
  hasNSCamera && hasAndroidCamera
);

// --- R-P4-03: CameraScreen imports CameraView and calls takePictureAsync ---
// # Tests R-P4-03
const cameraScreenPath = path.join(
  ROOT,
  "apps/trucker/src/app/(camera)/camera.tsx"
);
const cameraContent = fs.readFileSync(cameraScreenPath, "utf-8");

check(
  "R-P4-03",
  "CameraScreen imports CameraView from expo-camera and calls takePictureAsync on a Pressable",
  /CameraView/.test(cameraContent) &&
    /expo-camera/.test(cameraContent) &&
    /takePictureAsync/.test(cameraContent) &&
    /Pressable/.test(cameraContent)
);

// --- R-P4-04: PreviewScreen renders Image with uri and has Retake + Use Photo ---
// # Tests R-P4-04
const previewScreenPath = path.join(
  ROOT,
  "apps/trucker/src/app/(camera)/preview.tsx"
);
const previewContent = fs.readFileSync(previewScreenPath, "utf-8");

check(
  "R-P4-04",
  "PreviewScreen renders Image with uri source, has Retake and Use Photo buttons",
  /Image/.test(previewContent) &&
    /source.*uri/.test(previewContent) &&
    /[Rr]etake/.test(previewContent) &&
    /[Uu]se\s*[Pp]hoto/.test(previewContent)
);

// --- R-P4-05: imageService exports compressImage with manipulateAsync ---
// # Tests R-P4-05
const imageServicePath = path.join(
  ROOT,
  "apps/trucker/src/services/imageService.ts"
);
const imageServiceContent = fs.readFileSync(imageServicePath, "utf-8");

check(
  "R-P4-05",
  "imageService.ts exports compressImage calling manipulateAsync with resize and compress: 0.7",
  /export/.test(imageServiceContent) &&
    /compressImage/.test(imageServiceContent) &&
    /manipulateAsync/.test(imageServiceContent) &&
    /resize/.test(imageServiceContent) &&
    /0\.7/.test(imageServiceContent)
);

// --- R-P4-06: CameraScreen calls useCameraPermissions and shows Grant Permission ---
// # Tests R-P4-06
check(
  "R-P4-06",
  "CameraScreen calls useCameraPermissions and renders Grant Permission prompt when denied",
  /useCameraPermissions/.test(cameraContent) &&
    /[Gg]rant\s*[Pp]ermission/.test(cameraContent)
);

// --- Summary ---
process.stdout.write(`\n  Results: ${passes} passed, ${failures} failed\n`);

if (failures > 0) {
  process.exit(1);
}
