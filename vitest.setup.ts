import { JSDOM } from "jsdom";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost",
});

Object.defineProperty(globalThis, "window", {
  value: dom.window,
  configurable: true,
});

Object.defineProperty(globalThis, "document", {
  value: dom.window.document,
  configurable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: dom.window.localStorage,
  configurable: true,
});
