import { WebPlugin as n } from "@capacitor/core";
class m extends n {
  //@ts-ignore
  openInWebView(e) {
    throw this.unimplemented("Not implemented on web.");
  }
  //@ts-ignore
  openInSystemBrowser(e) {
    throw this.unimplemented("Not implemented on web.");
  }
  //@ts-ignore
  openInExternalBrowser(e) {
    throw this.unimplemented("Not implemented on web.");
  }
  //@ts-ignore
  close() {
    throw this.unimplemented("Not implemented on web.");
  }
}
export {
  m as InAppBrowserWeb
};
