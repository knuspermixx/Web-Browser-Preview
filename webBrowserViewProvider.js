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
    url: "about:blank",
    zoom: 70,
    currentMode: "responsive",
    selectedDeviceId: "",
    orientation: "portrait",
    userHasManuallyZoomedResponsive: false,
    customDeviceWidth: 360,
    customDeviceHeight: 640,
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
      this._webviewState.currentMode =
        savedState.currentMode ?? this._webviewState.currentMode;
      this._webviewState.selectedDeviceId =
        savedState.selectedDeviceId ?? this._webviewState.selectedDeviceId;
      this._webviewState.orientation =
        savedState.orientation ?? this._webviewState.orientation;
      this._webviewState.userHasManuallyZoomedResponsive =
        savedState.userHasManuallyZoomedResponsive ??
        this._webviewState.userHasManuallyZoomedResponsive;
      this._webviewState.customDeviceWidth =
        savedState.customDeviceWidth ?? this._webviewState.customDeviceWidth;
      this._webviewState.customDeviceHeight =
        savedState.customDeviceHeight ?? this._webviewState.customDeviceHeight;
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

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

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
          this._webviewState.currentMode =
            data.currentMode ?? this._webviewState.currentMode;
          this._webviewState.selectedDeviceId =
            data.selectedDeviceId ?? this._webviewState.selectedDeviceId;
          this._webviewState.orientation =
            data.orientation ?? this._webviewState.orientation;
          this._webviewState.zoom = data.zoom ?? this._webviewState.zoom;
          this._webviewState.userHasManuallyZoomedResponsive =
            data.userHasManuallyZoomedResponsive ??
            this._webviewState.userHasManuallyZoomedResponsive;
          this._webviewState.customDeviceWidth =
            data.customDeviceWidth ?? this._webviewState.customDeviceWidth;
          this._webviewState.customDeviceHeight =
            data.customDeviceHeight ?? this._webviewState.customDeviceHeight;
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
      return this._view.webview.postMessage(message);
    } catch (error) {
      console.error("Failed to post message to webview:", error);
      return false;
    }
  }

  navigate(url) {
    const success = this.postMessageToWebview({
      command: "setUrl",
      url: url,
      isInitialLoad: false,
    });
    if (success && this._view) {
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
  getWebViewState() {
    return { ...this._webviewState };
  }
  isViewVisible() {
    return this._view?.visible ?? false;
  }

  getHtmlForWebview(webview) {
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
            <meta name="theme-color" content="transparent">
            <meta http-equiv="Content-Security-Policy" content="
                default-src 'none';
                font-src ${webview.cspSource} data:;
                style-src 'self' ${webview.cspSource} 'unsafe-inline';
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
                data-current-mode="${escapeAttribute(
                  this._webviewState.currentMode
                )}"
                data-selected-device-id="${escapeAttribute(
                  this._webviewState.selectedDeviceId
                )}"
                data-orientation="${escapeAttribute(
                  this._webviewState.orientation
                )}"
                data-user-has-manually-zoomed-responsive="${
                  this._webviewState.userHasManuallyZoomedResponsive
                }"
                data-device-frame-radius="var(--device-frame-radius)"
                data-custom-device-width="${
                  this._webviewState.customDeviceWidth
                }"
                data-custom-device-height="${
                  this._webviewState.customDeviceHeight
                }">
        </head>
        <body>
            <div class="browser-toolbar top-toolbar">
                <div class="navigation-controls">
                    <button id="backButton" title="Zurück" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button id="forwardButton" title="Vorwärts" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                    <button id="reloadButton" title="Neu laden" class="icon-button">
                        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                    </button>
                </div>
                <div class="url-container">
                    <input type="text" id="urlInput" placeholder="URL eingeben..." />
                </div>
                <div class="action-controls">
                    <button id="devToolsButton" title="Entwicklertools öffnen" class="icon-button">
                        <span>Dev Tools</span>
                        <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="2" width="20" height="20" rx="3" />
                            <polyline points="10 8 6 12 10 16" />
                            <polyline points="14 8 18 12 14 16" />
                        </svg>
                    </button>
                </div>
            </div>

            <div id="iframeHost">
                <div id="deviceFrame" class="device-frame">
                    <iframe id="browserFrame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock allow-orientation-lock" src="about:blank"></iframe>
                </div>
            </div>

            <div class="browser-toolbar bottom-toolbar">
                <div class="controls-area">
                    <div class="device-controls-group">
                        <select id="deviceSelectDropdown" title="Select Device"></select>
                        <button id="rotateDeviceButton" title="Rotate Device" class="icon-button">
                            <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                        </button>
                        </div>
                    <span class="dimension-info" id="dimensionInfoArea">
                        <span id="deviceInfoTextLabel" style="display:none;"></span>
                        <div id="customDimensionInputGroup" style="display:none;">
                            <input type="number" id="customDeviceWidth" class="custom-device-input" placeholder="W" title="Custom Width (px)" min="50" max="5000" />
                            <span class="custom-device-separator">×</span>
                            <input type="number" id="customDeviceHeight" class="custom-device-input" placeholder="H" title="Custom Height (px)" min="50" max="5000" />
                            px
                        </div>
                        <span id="deviceInfoZoomText" style="display:none;"></span>

                        <div id="responsiveControlsGroup" style="display:none;">
                            <span id="responsiveWidthLabel"></span>
                            <button id="zoomOutResponsiveButton" title="Zoom out" class="icon-button responsive-zoom-button">
                                <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12" stroke-width="2.5"></line></svg>
                            </button>
                            <span id="zoomLevelResponsiveText" title="Current Zoom">100%</span>
                            <button id="zoomInResponsiveButton" title="Zoom in" class="icon-button responsive-zoom-button">
                                <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" stroke-width="2.5"></line><line x1="5" y1="12" x2="19" y2="12" stroke-width="2.5"></line></svg>
                            </button>
                        </div>
                    </span>
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