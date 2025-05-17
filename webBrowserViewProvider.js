const vscode = require("vscode");

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function escapeAttribute(value) {
  if (value === null || typeof value === "undefined") return "";
  return String(value).replace(/"/g, "&quot;");
}

class WebBrowserViewProvider {
  static viewType = "webBrowserPreviewView";

  _view = null;
  _extensionUri = null;
  _context = null;
  _disposables = [];

  _webviewState = {
    url: " http://localhost:xyz",
    zoom: 100,
    activeBreakpoint: "responsive",
    selectedMobileDeviceId: "",
    selectedTabletDeviceId: "",
    orientation: "portrait",
    userHasManuallyZoomedResponsive: false,
  };

  constructor(extensionUri, context) {
    this._extensionUri = extensionUri;
    this._context = context;
    this._loadWebViewState();
  }

  _loadWebViewState() {
    const savedState = this._context.workspaceState.get(
      `webviewState:${WebBrowserViewProvider.viewType}`
    );
    if (savedState) {
      this._webviewState.url = savedState.url ?? this._webviewState.url;
      this._webviewState.zoom =
        typeof savedState.zoom === "number"
          ? savedState.zoom
          : this._webviewState.zoom;
      this._webviewState.activeBreakpoint =
        savedState.activeBreakpoint ?? this._webviewState.activeBreakpoint;
      this._webviewState.selectedMobileDeviceId =
        savedState.selectedMobileDeviceId ??
        this._webviewState.selectedMobileDeviceId;
      this._webviewState.selectedTabletDeviceId =
        savedState.selectedTabletDeviceId ??
        this._webviewState.selectedTabletDeviceId;
      this._webviewState.orientation =
        savedState.orientation ?? this._webviewState.orientation;
      this._webviewState.userHasManuallyZoomedResponsive =
        savedState.userHasManuallyZoomedResponsive ??
        this._webviewState.userHasManuallyZoomedResponsive;
    }
  }

  _saveWebViewState() {
    if (this._context) {
      this._context.workspaceState.update(
        `webviewState:${WebBrowserViewProvider.viewType}`,
        this._webviewState
      );
    }
  }

  resolveWebviewView(webviewView, _context, _token) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, "webview")],
    };

    webviewView.webview.html = this._getBrowserHtmlForWebview(
      webviewView.webview
    );

    const messageListener = webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case "webviewReady":
          this.postMessageToWebview({
            command: "restoreState",
            state: this._webviewState,
          });
          break;
        case "urlChangedByWebview":
          if (this._webviewState.url !== data.url) {
            this._webviewState.url = data.url;
            this._saveWebViewState();
          }
          break;
        case "viewParametersChanged":
          this._webviewState.activeBreakpoint =
            data.activeBreakpoint ?? this._webviewState.activeBreakpoint;
          this._webviewState.selectedMobileDeviceId =
            data.selectedMobileDeviceId ??
            this._webviewState.selectedMobileDeviceId;
          this._webviewState.selectedTabletDeviceId =
            data.selectedTabletDeviceId ??
            this._webviewState.selectedTabletDeviceId;
          this._webviewState.orientation =
            data.orientation ?? this._webviewState.orientation;
          this._webviewState.zoom = data.zoom ?? this._webviewState.zoom;
          this._webviewState.userHasManuallyZoomedResponsive =
            data.userHasManuallyZoomedResponsive ??
            this._webviewState.userHasManuallyZoomedResponsive;
          this._saveWebViewState();
          break;
        case "openExternal":
          try {
            vscode.env.openExternal(vscode.Uri.parse(data.url));
          } catch (e) {
            vscode.window.showErrorMessage(
              `Invalid URL for external opening: ${data.url}`
            );
          }
          break;
        case "openDevTools":
          vscode.commands.executeCommand(
            "workbench.action.webview.openDeveloperTools"
          );
          break;
        default:
      }
    });

    this._disposables.push(messageListener);
    webviewView.onDidDispose(() => this.dispose(), null, this._disposables);

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) {
        this.postMessageToWebview({
          command: "restoreState",
          state: this._webviewState,
        });
      }
    });
  }

  dispose() {
    this._saveWebViewState();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    this._view = null;
  }

  postMessageToWebview(message) {
    if (!this._view?.webview) return false;
    try {
      this._view.webview.postMessage(message);
      return true;
    } catch (error) {
      return false;
    }
  }

  navigate(url) {
    this.postMessageToWebview({
      command: "setUrl",
      url: url,
      isInitialLoad: false,
    });
    if (this._view) {
      vscode.commands.executeCommand(
        `${WebBrowserViewProvider.viewType}.focus`
      );
    }
  }

  goBack() {
    this.postMessageToWebview({ command: "goBack" });
  }
  goForward() {
    this.postMessageToWebview({ command: "goForward" });
  }
  reload() {
    this.postMessageToWebview({ command: "reload" });
  }

  getCurrentUrl() {
    return this._webviewState.url;
  }

  _getBrowserHtmlForWebview(webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "script.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "webview", "style.css")
    );
    const nonce = getNonce();

    return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                font-src ${webview.cspSource} data:;
                style-src ${webview.cspSource} 'unsafe-inline'; 
                script-src 'nonce-${nonce}'; 
                frame-src *; 
                connect-src ${webview.cspSource};
                img-src ${webview.cspSource} data:; 
            ">
            <link href="${styleUri}" rel="stylesheet">
            <title>Web Browser Preview</title>
            <meta id="web-browser-preview-settings" 
                  data-initial-url="${escapeAttribute(this._webviewState.url)}" 
                  data-zoom="${this._webviewState.zoom}" 
                  data-active-breakpoint="${escapeAttribute(
                    this._webviewState.activeBreakpoint
                  )}"
                  data-selected-mobile-device-id="${escapeAttribute(
                    this._webviewState.selectedMobileDeviceId
                  )}"
                  data-selected-tablet-device-id="${escapeAttribute(
                    this._webviewState.selectedTabletDeviceId
                  )}"
                  data-orientation="${this._webviewState.orientation}"
                  data-user-has-manually-zoomed-responsive="${
                    this._webviewState.userHasManuallyZoomedResponsive
                  }"
                  data-device-frame-radius="var(--device-frame-radius)">
        </head>
        <body>
            <div class="browser-toolbar top-toolbar">
                <div class="navigation-controls">
                    <button id="backButton" title="Back" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button id="forwardButton" title="Forward" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <button id="reloadButton" title="Reload" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <div class="url-container">
                    <input type="text" id="urlInput" placeholder="Enter URL..." />
                </div>
            <div class="action-controls">
              <button id="devToolsButton" title="Open Developer Tools" class="icon-button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="3" />
                  <polyline points="10 8 6 12 10 16" />
                  <polyline points="14 8 18 12 14 16" />
                </svg>
              </button>
              </div>
            </div>

            <div id="iframeHost">
                <div id="deviceFrame" class="device-frame">
                    <iframe id="browserFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock" src="about:blank"></iframe>
                </div>
            </div>

            <div class="browser-toolbar bottom-toolbar">
                <div class="left-controls">
                    <button id="rotateDevice" title="Rotate Device" class="icon-button">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                    <div id="zoomControls" class="zoom-controls">
                        <button id="zoomOut" title="Zoom out" class="icon-button">
                            <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke-width="2"></line></svg>
                        </button>
                        <span id="zoomLevel" title="Current Zoom">100%</span>
                        <button id="zoomIn" title="Zoom in" class="icon-button">
                            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke-width="2"></line><line x1="5" y1="12" x2="19" y2="12" stroke-width="2"></line></svg>
                        </button>
                    </div>
                </div>

                <div class="device-controls">
                    <button id="deviceResponsive" title="Responsive" class="icon-button device-button active">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="1"></rect>
                            <polyline points="2 6 12 6 22 6"></polyline>
                            <polyline points="2 18 12 18 22 18"></polyline>
                        </svg>
                    </button>
                    <button id="deviceMobile" title="Mobile" class="icon-button device-button">
                        <svg viewBox="0 0 24 24"><rect x="7" y="2" width="10" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    </button>
                    <button id="deviceTablet" title="Tablet" class="icon-button device-button">
                        <svg viewBox="0 0 24 24"><rect x="3" y="2" width="18" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    </button>
                </div>
               
                <div class="right-controls">
                    <span class="resize-info" id="resizeInfo"></span>
                    <select id="specificDeviceSelect" class="specific-device-select-dropdown" style="display: none;" title="Select Specific Device"></select>
                </div>
            </div>

            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
  }
}

module.exports = {
  WebBrowserViewProvider,
};