(function () {
  const vscode = acquireVsCodeApi();
  const state = vscode.getState() || {};
  const settingsElement = document.getElementById(
    "web-browser-preview-settings"
  );

  const getElement = (id) => document.getElementById(id);

  // Custom device presets
  const CUSTOM_DEVICE = {
    name: "Custom",
    type: "custom",
    id: "custom",
    portrait: { width: 360, height: 640 },
    landscape: { width: 640, height: 360 },
  };
  
  // Desktop-Referenzbreite für responsive Modus
  const DESKTOP_REFERENCE_WIDTH = 1280;

  const DEVICE_PRESETS = [
    {
      name: "iPhone SE (3rd gen)",
      type: "mobile",
      id: "iphonese3",
      portrait: { width: 375, height: 667 },
      landscape: { width: 667, height: 375 },
    },
    {
      name: "Samsung Galaxy S25",
      type: "mobile",
      id: "galaxys25",
      portrait: { width: 360, height: 800 },
      landscape: { width: 800, height: 360 },
    },
    {
      name: "iPhone 16 Pro",
      type: "mobile",
      id: "iphone16pro",
      portrait: { width: 390, height: 844 },
      landscape: { width: 844, height: 390 },
    },
    {
      name: "Google Pixel 9",
      type: "mobile",
      id: "pixel9",
      portrait: { width: 412, height: 915 },
      landscape: { width: 915, height: 412 },
    },
    {
      name: "Samsung Galaxy S25 Ultra",
      type: "mobile",
      id: "galaxys25ultra",
      portrait: { width: 412, height: 892 },
      landscape: { width: 892, height: 412 },
    },
    {
      name: "iPhone 16 Pro Max",
      type: "mobile",
      id: "iphone16promax",
      portrait: { width: 430, height: 932 },
      landscape: { width: 932, height: 430 },
    },
    {
      name: "iPad Mini (6th gen)",
      type: "tablet",
      id: "ipadmini6",
      portrait: { width: 744, height: 1133 },
      landscape: { width: 1133, height: 744 },
    },
    {
      name: 'Samsung Galaxy Tab S10 (11")',
      type: "tablet",
      id: "galaxytabs10_11",
      portrait: { width: 800, height: 1280 },
      landscape: { width: 1280, height: 800 },
    },
    {
      name: 'iPad Air 11" (M2)',
      type: "tablet",
      id: "ipadair11m2",
      portrait: { width: 834, height: 1194 },
      landscape: { width: 1194, height: 834 },
    },
    {
      name: "Samsung Galaxy Tab S10 Ultra",
      type: "tablet",
      id: "galaxytabs10ultra",
      portrait: { width: 962, height: 1539 },
      landscape: { width: 1539, height: 962 },
    },
    {
      name: 'iPad Pro 13" (M4)',
      type: "tablet",
      id: "ipadpro13m4",
      portrait: { width: 1024, height: 1366 },
      landscape: { width: 1366, height: 1024 },
    },
  ];
  const DEFAULT_MOBILE_ID =
    DEVICE_PRESETS.find((d) => d.type === "mobile")?.id || "";
  const DEFAULT_TABLET_ID =
    DEVICE_PRESETS.find((d) => d.type === "tablet")?.id || "";

  let currentUrl =
    state.url ?? settingsElement.dataset.initialUrl ?? "about:blank";
  let activeZoom = typeof state.zoom === "number" ? state.zoom : 100;
  let activeBreakpoint =
    state.activeBreakpoint ??
    settingsElement.dataset.activeBreakpoint ??
    "responsive";
  let selectedMobileDeviceId =
    state.selectedMobileDeviceId ??
    settingsElement.dataset.selectedMobileDeviceId ??
    DEFAULT_MOBILE_ID;
  let selectedTabletDeviceId =
    state.selectedTabletDeviceId ??
    settingsElement.dataset.selectedTabletDeviceId ??
    DEFAULT_TABLET_ID;
  let customDeviceWidth = state.customDeviceWidth ?? 360;
  let customDeviceHeight = state.customDeviceHeight ?? 640;
  let currentOrientation =
    state.orientation ?? settingsElement.dataset.orientation ?? "portrait";
  let userHasManuallyZoomedResponsive =
    state.userHasManuallyZoomedResponsive ??
    settingsElement.dataset.userHasManuallyZoomedResponsive === "true" ??
    false;

  let currentDevice = null;

  const elements = {
    backButton: getElement("backButton"),
    forwardButton: getElement("forwardButton"),
    reloadButton: getElement("reloadButton"),
    iframeHost: getElement("iframeHost"),
    browserFrame: getElement("browserFrame"),
    deviceFrame: getElement("deviceFrame"),
    urlInput: getElement("urlInput"),
    zoomControlsContainer: getElement("zoomControls"),
    zoomInButton: getElement("zoomIn"),
    zoomOutButton: getElement("zoomOut"),
    zoomLevelDisplay: getElement("zoomLevel"),
    resizeInfo: getElement("resizeInfo"),
    devToolsButton: getElement("devToolsButton"),
    rotateDeviceButton: getElement("rotateDevice"),
    deviceResponsiveButton: getElement("deviceResponsive"),
    deviceMobileButton: getElement("deviceMobile"),
    deviceTabletButton: getElement("deviceTablet"),
    specificDeviceSelect: getElement("specificDeviceSelect"),
    customDeviceContainer: getElement("customDeviceContainer"),
    customDeviceWidthInput: getElement("customDeviceWidth"),
    customDeviceHeightInput: getElement("customDeviceHeight"),
  };

  function populateSpecificDeviceDropdown(deviceType) {
    if (!elements.specificDeviceSelect) return;
    elements.specificDeviceSelect.innerHTML = "";

    const devicesToShow = DEVICE_PRESETS.filter((d) => d.type === deviceType);
    if (devicesToShow.length === 0) {
      elements.specificDeviceSelect.style.display = "none";
      return;
    }

    // Hinzufügen der vordefinierten Geräte (nur Name, keine Größe)
    devicesToShow.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent = device.name;
      elements.specificDeviceSelect.appendChild(option);
    });

    // Hinzufügen der benutzerdefinierten Option (nur Name)
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = `Custom`;
    elements.specificDeviceSelect.appendChild(customOption);

    // Die richtige Option auswählen
    if (deviceType === "mobile") {
      elements.specificDeviceSelect.value =
        selectedMobileDeviceId || devicesToShow[0]?.id || "";
    } else if (deviceType === "tablet") {
      elements.specificDeviceSelect.value =
        selectedTabletDeviceId || devicesToShow[0]?.id || "";
    }
    
    // Das Dropdown anzeigen
    elements.specificDeviceSelect.style.display = "inline-block";
    
    // Benutzerdefinierte Eingabefelder ein-/ausblenden
    if (elements.customDeviceContainer) {
      elements.customDeviceContainer.style.display = 
        (deviceType === "mobile" || deviceType === "tablet") && 
        elements.specificDeviceSelect.value === "custom" ? "flex" : "none";
    }
  }

  function setActiveBreakpointButton(breakpoint) {
    const buttons = {
      responsive: elements.deviceResponsiveButton,
      mobile: elements.deviceMobileButton,
      tablet: elements.deviceTabletButton,
    };
    Object.values(buttons).forEach((btn) => btn?.classList.remove("active"));
    buttons[breakpoint]?.classList.add("active");
  }

  function updateNavigationButtonsState() {
    elements.backButton.disabled = false;
    elements.forwardButton.disabled = false;
    const isBlank =
      currentUrl === "about:blank" ||
      !elements.browserFrame.src ||
      elements.browserFrame.src === "about:blank";
    elements.reloadButton.disabled = isBlank;
  }

  function setViewport(newBreakpoint, newOrientation = currentOrientation) {
    activeBreakpoint = newBreakpoint;
    setActiveBreakpointButton(activeBreakpoint);
    currentOrientation =
      activeBreakpoint === "responsive" ? "portrait" : newOrientation;

    let deviceIdToUse = "";
    if (activeBreakpoint === "mobile") {
      deviceIdToUse = selectedMobileDeviceId || DEFAULT_MOBILE_ID;
      populateSpecificDeviceDropdown("mobile");
      elements.resizeInfo.style.display = "none";
    } else if (activeBreakpoint === "tablet") {
      deviceIdToUse = selectedTabletDeviceId || DEFAULT_TABLET_ID;
      populateSpecificDeviceDropdown("tablet");
      elements.resizeInfo.style.display = "none";
    } else {
      elements.specificDeviceSelect.style.display = "none";
      elements.resizeInfo.style.display = "inline";
      currentDevice = { type: "responsive", name: "Responsive" };
      
      // Berechne einen Zoom-Wert, der eine Desktop-ähnliche Breite simuliert
      if (!userHasManuallyZoomedResponsive) {
        // Berechne Zoom basierend auf aktuellem Panel und der Desktop-Referenzbreite
        const panelWidth = elements.iframeHost.offsetWidth;
        if (panelWidth > 0) {
          // Zoom-Wert berechnen, um Desktop-Breite zu simulieren
          activeZoom = Math.round((panelWidth / DESKTOP_REFERENCE_WIDTH) * 100);
          // Zoom auf sinnvolle Grenzen beschränken (25% - 100%)
          activeZoom = Math.max(25, Math.min(100, activeZoom));
        } else {
          // Fallback, falls die Breite noch nicht verfügbar ist
          activeZoom = 50;
        }
      }
      userHasManuallyZoomedResponsive = false;
    }

    if (activeBreakpoint === "mobile" || activeBreakpoint === "tablet") {
      if (deviceIdToUse === "custom") {
        // Wenn ein benutzerdefiniertes Gerät ausgewählt ist, verwenden wir CUSTOM_DEVICE
        // und aktualisieren die Abmessungen
        currentDevice = { ...CUSTOM_DEVICE };
        currentDevice.portrait = { width: customDeviceWidth, height: customDeviceHeight };
        currentDevice.landscape = { width: customDeviceHeight, height: customDeviceWidth };
      } else {
        // Ansonsten suchen wir nach dem vordefinierten Gerät
        currentDevice = DEVICE_PRESETS.find((d) => d.id === deviceIdToUse);
        if (!currentDevice) {
          currentDevice = DEVICE_PRESETS.find((d) => d.type === activeBreakpoint);
          if (activeBreakpoint === "mobile")
            selectedMobileDeviceId = currentDevice?.id || "";
          if (activeBreakpoint === "tablet")
            selectedTabletDeviceId = currentDevice?.id || "";
        }
      }
    }

    const isResponsive = activeBreakpoint === "responsive";
    elements.zoomControlsContainer.style.display = isResponsive
      ? "flex"
      : "none";
    elements.rotateDeviceButton.style.display = !isResponsive ? "flex" : "none";
    elements.rotateDeviceButton.disabled = isResponsive;

    let zoomToApply;
    if (isResponsive) {
      zoomToApply = activeZoom;
    } else if (currentDevice) {
      const deviceDims =
        currentDevice[currentOrientation] || currentDevice.portrait;
      const hostPaddingHorizontal =
        parseInt(getComputedStyle(elements.iframeHost).paddingLeft, 10) +
          parseInt(getComputedStyle(elements.iframeHost).paddingRight, 10) || 0;
      const hostPaddingVertical =
        parseInt(getComputedStyle(elements.iframeHost).paddingTop, 10) +
          parseInt(getComputedStyle(elements.iframeHost).paddingBottom, 10) ||
        0;
      const availableWidth =
        elements.iframeHost.offsetWidth - hostPaddingHorizontal;
      const availableHeight =
        elements.iframeHost.offsetHeight - hostPaddingVertical;
      let scaleFactor = 1;
      if (deviceDims.width > 0 && deviceDims.height > 0) {
        const scaleX = availableWidth / deviceDims.width;
        const scaleY = availableHeight / deviceDims.height;
        scaleFactor = Math.min(scaleX, scaleY, 1);
      }
      zoomToApply = Math.max(10, Math.min(100, Math.floor(scaleFactor * 100)));
    } else {
      zoomToApply = 100;
    }

    setZoomInternal(zoomToApply, true);

    updateResizeInfo();

    vscode.postMessage({
      type: "viewParametersChanged",
      activeBreakpoint: activeBreakpoint,
      selectedMobileDeviceId: selectedMobileDeviceId,
      selectedTabletDeviceId: selectedTabletDeviceId,
      orientation: currentOrientation,
      zoom: activeZoom,
      userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
    });
    saveStateToVsCode();
  }

  function updateDeviceFrameAndIframe() {
    if (!currentDevice) return;

    const scaleFactor = activeZoom / 100;
    const isResponsive = activeBreakpoint === "responsive";

    let frameWidth, frameHeight, iframeContentWidth, iframeContentHeight;

    if (isResponsive) {
      frameWidth = "100%";
      frameHeight = "100%";
      iframeContentWidth = `${100 / scaleFactor}%`;
      iframeContentHeight = `${100 / scaleFactor}%`;
    } else {
      const dims = currentDevice[currentOrientation] || currentDevice.portrait;
      frameWidth = `${dims.width * scaleFactor}px`;
      frameHeight = `${dims.height * scaleFactor}px`;
      iframeContentWidth = `${dims.width}px`;
      iframeContentHeight = `${dims.height}px`;
    }

    elements.deviceFrame.style.width = frameWidth;
    elements.deviceFrame.style.height = frameHeight;
    elements.deviceFrame.style.borderRadius = isResponsive
      ? "0"
      : settingsElement.dataset.deviceFrameRadius || "8px";

    elements.browserFrame.style.transform = `scale(${scaleFactor})`;
    elements.browserFrame.style.width = iframeContentWidth;
    elements.browserFrame.style.height = iframeContentHeight;
  }

  function setUrlInAddressBar(url) {
    if (elements.urlInput.value !== url) {
      elements.urlInput.value = url;
    }
  }

  function navigateTo(url, isFromUserInputOrInternalNav = true) {
    let newUrl = (url || "").trim();
    if (
      !newUrl ||
      (newUrl === "about:blank" &&
        elements.browserFrame.src === newUrl &&
        !isFromUserInputOrInternalNav)
    ) {
      return;
    }
    if (!/^(https?|about|file):/i.test(newUrl)) {
      if (
        newUrl.includes(".") ||
        newUrl.startsWith("localhost") ||
        newUrl.includes(":")
      ) {
        newUrl = `https://${newUrl}`;
      } else if (newUrl !== "about:blank") {
        newUrl = `https://www.google.com/search?q=${encodeURIComponent(
          newUrl
        )}`;
      }
    }
    if (elements.browserFrame.src !== newUrl) {
      elements.browserFrame.src = newUrl;
    }
    setUrlInAddressBar(newUrl);
    if (isFromUserInputOrInternalNav && currentUrl !== newUrl) {
      currentUrl = newUrl;
      vscode.postMessage({ type: "urlChangedByWebview", url: currentUrl });
      saveStateToVsCode();
    }
    updateNavigationButtonsState();
  }

  function setZoomInternal(zoomPercent, isInternalCall = false) {
    // Zoom nur in 10er-Schritten erlauben
    const minZoom = 10;
    const maxZoom = 300;
    let newZoom = Math.max(minZoom, Math.min(maxZoom, Math.round(zoomPercent)));
    // Immer auf Vielfaches von 10 runden
    newZoom = Math.round(newZoom / 10) * 10;
    const zoomChanged = activeZoom !== newZoom;
    activeZoom = newZoom;
    elements.zoomLevelDisplay.innerText = `${activeZoom}%`;

    if (activeBreakpoint === "responsive" && !isInternalCall) {
      userHasManuallyZoomedResponsive = true;
    }

    updateDeviceFrameAndIframe();
    updateResizeInfo();

    if (!isInternalCall && zoomChanged) {
      vscode.postMessage({
        type: "viewParametersChanged",
        activeBreakpoint: activeBreakpoint,
        selectedMobileDeviceId: selectedMobileDeviceId,
        selectedTabletDeviceId: selectedTabletDeviceId,
        orientation: currentOrientation,
        zoom: activeZoom,
        userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
      });
      saveStateToVsCode();
    }
  }

  function updateResizeInfo() {
    if (!elements.resizeInfo || !currentDevice) return;

    if (activeBreakpoint === "responsive") {
      const scaleFactor = activeZoom / 100;
      const width = Math.round(elements.iframeHost.offsetWidth / scaleFactor);
      const height = Math.round(elements.iframeHost.offsetHeight / scaleFactor);
      elements.resizeInfo.textContent = `${width} × ${height} (${activeZoom}%)`;
      elements.resizeInfo.style.display = "inline";
      elements.specificDeviceSelect.style.display = "none";
    } else if (currentDevice.id === "custom") {
      // Bei Custom Devices nur den Zoom anzeigen
      elements.resizeInfo.textContent = `(${activeZoom}%)`;
      elements.resizeInfo.style.display = "inline";
      elements.specificDeviceSelect.style.display = "inline-block";
    } else {
      // Zeige die aktuelle Device-Größe in der Bottom-Bar an und den Zoom in Klammern
      let dims = currentDevice[currentOrientation] || currentDevice.portrait;
      elements.resizeInfo.textContent = `${dims.width} × ${dims.height} (${activeZoom}%)`;
      elements.resizeInfo.style.display = "inline";
      elements.specificDeviceSelect.style.display = "inline-block";
    }
  }

  function toggleOrientation() {
    if (activeBreakpoint === "responsive") return;
    currentOrientation =
      currentOrientation === "portrait" ? "landscape" : "portrait";
    setViewport(activeBreakpoint, currentOrientation);
  }

  function saveStateToVsCode() {
    vscode.setState({
      url: currentUrl,
      zoom: activeZoom,
      activeBreakpoint: activeBreakpoint,
      selectedMobileDeviceId: selectedMobileDeviceId,
      selectedTabletDeviceId: selectedTabletDeviceId,
      orientation: currentOrientation,
      userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
      customDeviceWidth: customDeviceWidth,
      customDeviceHeight: customDeviceHeight,
    });
  }

  elements.browserFrame.addEventListener("load", () => {
    let iframeActualUrl = "about:blank";
    try {
      iframeActualUrl =
        elements.browserFrame.contentWindow?.location.href !== "about:blank"
          ? elements.browserFrame.contentWindow.location.href
          : elements.browserFrame.src || "about:blank";
    } catch (e) {
      iframeActualUrl = elements.browserFrame.src || "about:blank";
    }
    if (currentUrl !== iframeActualUrl && iframeActualUrl !== "about:blank") {
      currentUrl = iframeActualUrl;
      setUrlInAddressBar(currentUrl);
      vscode.postMessage({ type: "urlChangedByWebview", url: currentUrl });
      saveStateToVsCode();
    } else if (elements.urlInput.value !== iframeActualUrl) {
      setUrlInAddressBar(iframeActualUrl);
    }
    updateNavigationButtonsState();
  });

  window.addEventListener("DOMContentLoaded", () => {
    if (!DEVICE_PRESETS.find((d) => d.id === selectedMobileDeviceId))
      selectedMobileDeviceId = DEFAULT_MOBILE_ID;
    if (!DEVICE_PRESETS.find((d) => d.id === selectedTabletDeviceId))
      selectedTabletDeviceId = DEFAULT_TABLET_ID;
      
    // Zurücksetzen des userHasManuallyZoomedResponsive-Flags, 
    // damit die automatische Zoom-Berechnung beim Start angewendet wird
    if (activeBreakpoint === "responsive") {
      userHasManuallyZoomedResponsive = false;
    }

    navigateTo(currentUrl, false);
    setViewport(activeBreakpoint, currentOrientation);
    updateNavigationButtonsState();
    vscode.postMessage({ type: "webviewReady" });
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Bei Größenänderung im Responsive-Modus den Zoom neu berechnen,
      // aber nur wenn der Benutzer nicht manuell gezoomt hat
      if (activeBreakpoint === "responsive" && !userHasManuallyZoomedResponsive) {
        const panelWidth = elements.iframeHost.offsetWidth;
        if (panelWidth > 0) {
          const newZoom = Math.round((panelWidth / DESKTOP_REFERENCE_WIDTH) * 100);
          activeZoom = Math.max(25, Math.min(100, newZoom));
        }
      }
      setViewport(activeBreakpoint, currentOrientation);
    }, 150);
  });

  elements.deviceResponsiveButton?.addEventListener("click", () => {
    // Zurücksetzen des Flags, damit der Zoom neu berechnet wird
    userHasManuallyZoomedResponsive = false;
    setViewport("responsive");
  });
  elements.deviceMobileButton?.addEventListener("click", () =>
    setViewport("mobile")
  );
  elements.deviceTabletButton?.addEventListener("click", () =>
    setViewport("tablet")
  );

  elements.specificDeviceSelect?.addEventListener("change", (event) => {
    const deviceId = event.target.value;
    if (activeBreakpoint === "mobile") {
      selectedMobileDeviceId = deviceId;
    } else if (activeBreakpoint === "tablet") {
      selectedTabletDeviceId = deviceId;
    }

    // Benutzerdefinierte Eingabefelder anzeigen/verstecken je nach Auswahl
    if (elements.customDeviceContainer) {
      elements.customDeviceContainer.style.display = 
        deviceId === "custom" ? "flex" : "none";
        
      // Sicherstellen, dass die Input-Felder die aktuellen Werte anzeigen
      if (deviceId === "custom") {
        if (elements.customDeviceWidthInput) {
          elements.customDeviceWidthInput.value = customDeviceWidth;
        }
        if (elements.customDeviceHeightInput) {
          elements.customDeviceHeightInput.value = customDeviceHeight;
        }
      }
    }
    
    setViewport(activeBreakpoint, currentOrientation);
  });

  if (elements.urlInput) {
    elements.urlInput.addEventListener("change", () =>
      navigateTo(elements.urlInput.value)
    );
    elements.urlInput.addEventListener("keyup", (event) => {
      if (event.key === "Enter") navigateTo(elements.urlInput.value);
    });
  }
  elements.backButton?.addEventListener("click", () => history.back());
  elements.forwardButton?.addEventListener("click", () => history.forward());

  elements.reloadButton?.addEventListener("click", () => {
    try {
      elements.browserFrame.contentWindow?.location.reload();
    } catch (e) {
      elements.browserFrame.src = elements.browserFrame.src;
    }
  });
  elements.devToolsButton?.addEventListener("click", () =>
    vscode.postMessage({ type: "openDevTools" })
  );
  elements.zoomInButton?.addEventListener("click", () => {
    // Wenn der aktuelle Zoom kein Vielfaches von 10 ist, zuerst auf das nächste Vielfache runden
    if (activeZoom % 10 !== 0) {
      setZoomInternal(Math.ceil(activeZoom / 10) * 10, false);
    } else {
      setZoomInternal(activeZoom + 10, false);
    }
  });
  elements.zoomOutButton?.addEventListener("click", () => {
    if (activeZoom % 10 !== 0) {
      setZoomInternal(Math.floor(activeZoom / 10) * 10, false);
    } else {
      setZoomInternal(activeZoom - 10, false);
    }
  });
  elements.rotateDeviceButton?.addEventListener("click", toggleOrientation);

  // Event-Handler für benutzerdefinierte Geräte
  let customDeviceUpdateTimeout;
  
  if (elements.customDeviceWidthInput) {
    elements.customDeviceWidthInput.value = customDeviceWidth;
    
    // Input-Event für Live-Updates mit Verzögerung
    elements.customDeviceWidthInput.addEventListener("input", (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value > 0) {
        customDeviceWidth = value;
        
        // Verzögerung hinzufügen, damit nicht bei jedem Tastendruck aktualisiert wird
        clearTimeout(customDeviceUpdateTimeout);
        customDeviceUpdateTimeout = setTimeout(updateCustomDevice, 300);
      }
    });
    
    // Change-Event für sofortiges Update beim Verlassen des Feldes
    elements.customDeviceWidthInput.addEventListener("change", (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value > 0) {
        customDeviceWidth = value;
        updateCustomDevice();
      }
    });
  }
  
  if (elements.customDeviceHeightInput) {
    elements.customDeviceHeightInput.value = customDeviceHeight;
    
    // Input-Event für Live-Updates mit Verzögerung
    elements.customDeviceHeightInput.addEventListener("input", (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value > 0) {
        customDeviceHeight = value;
        
        // Verzögerung hinzufügen, damit nicht bei jedem Tastendruck aktualisiert wird
        clearTimeout(customDeviceUpdateTimeout);
        customDeviceUpdateTimeout = setTimeout(updateCustomDevice, 300);
      }
    });
    
    // Change-Event für sofortiges Update beim Verlassen des Feldes
    elements.customDeviceHeightInput.addEventListener("change", (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value > 0) {
        customDeviceHeight = value;
        updateCustomDevice();
      }
    });
  }
  
  function updateCustomDevice() {
    if (activeBreakpoint === "mobile" || activeBreakpoint === "tablet") {
      // Aktualisiere die Option im Dropdown (nur Name)
      const customOption = Array.from(elements.specificDeviceSelect.options).find(
        option => option.value === "custom"
      );
      if (customOption) {
        customOption.textContent = `Custom`;
      }
      // Aktualisiere die Ansicht
      setViewport(activeBreakpoint, currentOrientation);
      // Sende die Änderungen an das Webview
      vscode.postMessage({
        type: "viewParametersChanged",
        customDeviceWidth: customDeviceWidth,
        customDeviceHeight: customDeviceHeight
      });
    }
  }

  window.addEventListener("message", (event) => {
    const { command, url, isInitialLoad, state: newState } = event.data;
    switch (command) {
      case "setUrl":
        navigateTo(url, !isInitialLoad);
        break;
      case "goBack":
        elements.browserFrame.contentWindow?.history.back();
        break;
      case "goForward":
        elements.browserFrame.contentWindow?.history.forward();
        break;
      case "reload":
        elements.reloadButton?.click();
        break;
      case "restoreState":
        if (newState) {
          currentUrl = newState.url ?? "about:blank";
          activeZoom = typeof newState.zoom === "number" ? newState.zoom : 100;
          activeBreakpoint = newState.activeBreakpoint ?? "responsive";
          selectedMobileDeviceId =
            newState.selectedMobileDeviceId ?? DEFAULT_MOBILE_ID;
          selectedTabletDeviceId =
            newState.selectedTabletDeviceId ?? DEFAULT_TABLET_ID;
          currentOrientation = newState.orientation ?? "portrait";
          userHasManuallyZoomedResponsive =
            newState.userHasManuallyZoomedResponsive ?? false;
          customDeviceWidth = newState.customDeviceWidth ?? customDeviceWidth;
          customDeviceHeight = newState.customDeviceHeight ?? customDeviceHeight;

          if (
            !DEVICE_PRESETS.find(
              (d) => d.id === selectedMobileDeviceId && d.type === "mobile"
            )
          )
            selectedMobileDeviceId = DEFAULT_MOBILE_ID;
          if (
            !DEVICE_PRESETS.find(
              (d) => d.id === selectedTabletDeviceId && d.type === "tablet"
            )
          )
            selectedTabletDeviceId = DEFAULT_TABLET_ID;

          // Beim Wiederherstellen im Responsive-Modus den Zoom automatisch anpassen,
          // es sei denn, der Benutzer hat manuell gezoomt
          if (activeBreakpoint === "responsive" && !userHasManuallyZoomedResponsive) {
            const panelWidth = elements.iframeHost.offsetWidth;
            if (panelWidth > 0) {
              activeZoom = Math.round((panelWidth / DESKTOP_REFERENCE_WIDTH) * 100);
              activeZoom = Math.max(25, Math.min(100, activeZoom));
            }
          }
          
          setUrlInAddressBar(currentUrl);
          setViewport(activeBreakpoint, currentOrientation);

          if (
            elements.browserFrame.src !== currentUrl &&
            currentUrl !== "about:blank"
          ) {
            navigateTo(currentUrl, false);
          } else if (
            currentUrl === "about:blank" &&
            elements.browserFrame.src !== "about:blank"
          ) {
            elements.browserFrame.src = "about:blank";
          }
          updateNavigationButtonsState();
        }
        break;
    }
  });
  window.addEventListener("beforeunload", saveStateToVsCode);
})();
