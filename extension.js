const vscode = require("vscode");
const { WebBrowserViewProvider } = require("./webBrowserViewProvider");

let globalWebviewProvider = null;

function activate(context) {
  const webviewProvider = new WebBrowserViewProvider(context.extensionUri, context);
  globalWebviewProvider = webviewProvider;

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebBrowserViewProvider.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const registerCommand = (command, callback) => {
    context.subscriptions.push(vscode.commands.registerCommand(command, callback));
  };

  registerCommand("web-browser-preview.openUrl", async () => {
    const currentUrl = webviewProvider.getCurrentUrl() ?? webviewProvider.getWebViewState().url;
    const url = await vscode.window.showInputBox({
      prompt: "Enter the URL to open",
      value: currentUrl || "https://",
      placeHolder: "e.g., https://www.google.com",
    });
    if (url && webviewProvider) {
      webviewProvider.navigate(url);
      vscode.commands.executeCommand(`${WebBrowserViewProvider.viewType}.focus`);
    }
  });

  registerCommand("web-browser-preview.openAsPanel", () => {
    const panel = vscode.window.createWebviewPanel(
      "webBrowserPreviewPanel",
      "Web Browser Preview Panel",
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "webview")],
      }
    );
    panel.webview.html = webviewProvider.getHtmlForWebview(panel.webview); // Verwende eine generische Methode

    const messageListener = panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "urlChangedByWebview":
            try {
              panel.title = `Browser: ${new URL(message.url).hostname}`;
            } catch (e) {
              panel.title = "Web Browser Preview Panel";
            }
            break;
          // Hier könnten weitere Nachrichten vom Panel behandelt werden
        }
      },
      undefined,
      context.subscriptions
    );
    panel.onDidDispose(() => messageListener.dispose(), null, context.subscriptions);
  });

  registerCommand("web-browser-preview.focus", () => {
    vscode.commands.executeCommand(`${WebBrowserViewProvider.viewType}.focus`);
  });

  registerCommand("web-browser-preview.checkConnection", () => {
    if (webviewProvider) {
      const status = webviewProvider.isViewVisible() ? "active" : "inactive or not focused";
      vscode.window.showInformationMessage(`Browser Preview connection (Sidebar) is ${status}.`);
    }
  });

  const createNavigationCommand = (commandName, action) => {
    registerCommand(`web-browser-preview.${commandName}`, () => {
      if (webviewProvider?.isViewVisible()) { // Prüfe ob die View sichtbar ist
        action();
      } else {
        vscode.window.showInformationMessage(
          `Browser Preview is not active to perform ${commandName}.`
        );
      }
    });
  };

  createNavigationCommand("goBack", () => webviewProvider.goBack());
  createNavigationCommand("goForward", () => webviewProvider.goForward());
  createNavigationCommand("reload", () => webviewProvider.reload());
}

function deactivate() {
  if (globalWebviewProvider) {
    try {
      globalWebviewProvider.dispose();
    } catch (error) {
      console.error("Error disposing globalWebviewProvider:", error);
    }
    globalWebviewProvider = null;
  }
}

module.exports = {
  activate,
  deactivate,
};