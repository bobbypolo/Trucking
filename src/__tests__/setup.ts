import "@testing-library/jest-dom";
import { vi, beforeAll, afterAll } from "vitest";

// Canvas getContext mock — suppresses jsdom "Not implemented" warning
// BolGenerator.tsx and Scanner.tsx call canvas.getContext("2d") which jsdom cannot handle
const canvasContextStub = {
  drawImage: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
  putImageData: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  strokeStyle: "#000",
  fillStyle: "#000",
  lineWidth: 1,
  font: "10px sans-serif",
  textAlign: "start" as CanvasTextAlign,
  textBaseline: "alphabetic" as CanvasTextBaseline,
  canvas: { width: 300, height: 150 },
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => canvasContextStub,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,");
});

afterAll(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

// window.location navigation mock — suppresses jsdom warning for
// Auth.tsx (window.location.href = url) and CompanyProfile.tsx (window.location.assign)
// Preserves real location shape; only stubs navigation methods
const locationDescriptor = Object.getOwnPropertyDescriptor(window, "location");
beforeAll(() => {
  Object.defineProperty(window, "location", {
    value: {
      ...window.location,
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
      href: "http://localhost:3101/",
      origin: "http://localhost:3101",
      pathname: "/",
      search: "",
      hash: "",
    },
    writable: true,
    configurable: true,
  });
});
afterAll(() => {
  if (locationDescriptor) {
    Object.defineProperty(window, "location", locationDescriptor);
  }
});
