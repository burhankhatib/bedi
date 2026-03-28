import { registerPlugin as T } from "@capacitor/core";
var t = /* @__PURE__ */ ((e) => (e[e.TOP = 0] = "TOP", e[e.BOTTOM = 1] = "BOTTOM", e))(t || {}), E = /* @__PURE__ */ ((e) => (e[e.PAGE_SHEET = 0] = "PAGE_SHEET", e[e.FORM_SHEET = 1] = "FORM_SHEET", e[e.FULL_SCREEN = 2] = "FULL_SCREEN", e))(E || {}), s = /* @__PURE__ */ ((e) => (e[e.BOTTOM_SHEET = 0] = "BOTTOM_SHEET", e[e.FULL_SCREEN = 1] = "FULL_SCREEN", e))(s || {}), a = /* @__PURE__ */ ((e) => (e[e.FLIP_HORIZONTAL = 0] = "FLIP_HORIZONTAL", e[e.CROSS_DISSOLVE = 1] = "CROSS_DISSOLVE", e[e.COVER_VERTICAL = 2] = "COVER_VERTICAL", e))(a || {}), r = /* @__PURE__ */ ((e) => (e[e.FADE_IN = 0] = "FADE_IN", e[e.FADE_OUT = 1] = "FADE_OUT", e[e.SLIDE_IN_LEFT = 2] = "SLIDE_IN_LEFT", e[e.SLIDE_OUT_RIGHT = 3] = "SLIDE_OUT_RIGHT", e))(r || {}), O = /* @__PURE__ */ ((e) => (e[e.CLOSE = 0] = "CLOSE", e[e.CANCEL = 1] = "CANCEL", e[e.DONE = 2] = "DONE", e))(O || {});
const l = {
  allowZoom: !1,
  hardwareBack: !0,
  pauseMedia: !0
}, _ = {
  allowOverScroll: !0,
  enableViewportScale: !1,
  allowInLineMediaPlayback: !1,
  surpressIncrementalRendering: !1,
  viewStyle: E.FULL_SCREEN,
  animationEffect: a.COVER_VERTICAL,
  allowsBackForwardNavigationGestures: !0
}, R = {
  showToolbar: !0,
  showURL: !0,
  clearCache: !0,
  clearSessionCache: !0,
  mediaPlaybackRequiresUserAction: !1,
  closeButtonText: "Close",
  toolbarPosition: t.TOP,
  showNavigationButtons: !0,
  leftToRight: !1,
  customWebViewUserAgent: null,
  android: l,
  iOS: _
}, L = {
  closeButtonText: O.DONE,
  viewStyle: E.FULL_SCREEN,
  animationEffect: a.COVER_VERTICAL,
  enableBarsCollapsing: !0,
  enableReadersMode: !1
}, o = {
  showTitle: !1,
  hideToolbarOnScroll: !1,
  viewStyle: s.BOTTOM_SHEET,
  startAnimation: r.FADE_IN,
  exitAnimation: r.FADE_OUT
}, C = {
  android: o,
  iOS: L
}, I = T("InAppBrowser", {
  web: () => import("./web-B3Ll3yFB.js").then((e) => new e.InAppBrowserWeb())
});
export {
  r as AndroidAnimation,
  s as AndroidViewStyle,
  o as DefaultAndroidSystemBrowserOptions,
  l as DefaultAndroidWebViewOptions,
  C as DefaultSystemBrowserOptions,
  R as DefaultWebViewOptions,
  L as DefaultiOSSystemBrowserOptions,
  _ as DefaultiOSWebViewOptions,
  O as DismissStyle,
  I as InAppBrowser,
  t as ToolbarPosition,
  a as iOSAnimation,
  E as iOSViewStyle
};
