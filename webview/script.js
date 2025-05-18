(function () {
  const vscode = acquireVsCodeApi();
  const state = vscode.getState() || {};
  const settingsElement = document.getElementById("web-browser-preview-settings");

  const getElement = (id) => document.getElementById(id);

  // --- CONSTANTS ---
  const CUSTOM_DEVICE_ID = "custom";
  const DESKTOP_REFERENCE_WIDTH = 1280;
  const MODE_RESPONSIVE = "responsive";
  const MODE_DEVICE = "device";

  const DEVICE_PRESETS = [
    { name: "iPhone SE (3rd gen)", type: "mobile", id: "iphonese3", portrait: { width: 375, height: 667 }, landscape: { width: 667, height: 375 } },
    { name: "Samsung Galaxy S25", type: "mobile", id: "galaxys25", portrait: { width: 360, height: 800 }, landscape: { width: 800, height: 360 } },
    { name: "iPhone 16 Pro", type: "mobile", id: "iphone16pro", portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } },
    { name: "Google Pixel 9", type: "mobile", id: "pixel9", portrait: { width: 412, height: 915 }, landscape: { width: 915, height: 412 } },
    { name: "Samsung Galaxy S25 Ultra", type: "mobile", id: "galaxys25ultra", portrait: { width: 412, height: 892 }, landscape: { width: 892, height: 412 } },
    { name: "iPhone 16 Pro Max", type: "mobile", id: "iphone16promax", portrait: { width: 430, height: 932 }, landscape: { width: 932, height: 430 } },
    { name: "iPad Mini (6th gen)", type: "tablet", id: "ipadmini6", portrait: { width: 744, height: 1133 }, landscape: { width: 1133, height: 744 } },
    { name: 'Samsung Galaxy Tab S10 (11")', type: "tablet", id: "galaxytabs10_11", portrait: { width: 800, height: 1280 }, landscape: { width: 1280, height: 800 } },
    { name: 'iPad Air 11" (M2)', type: "tablet", id: "ipadair11m2", portrait: { width: 834, height: 1194 }, landscape: { width: 1194, height: 834 } },
    { name: "Samsung Galaxy Tab S10 Ultra", type: "tablet", id: "galaxytabs10ultra", portrait: { width: 962, height: 1539 }, landscape: { width: 1539, height: 962 } },
    { name: 'iPad Pro 13" (M4)', type: "tablet", id: "ipadpro13m4", portrait: { width: 1024, height: 1366 }, landscape: { width: 1366, height: 1024 } },
  ];
  const DEFAULT_DEVICE_ID = DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : "";

  // --- STATE VARIABLES ---
  let currentUrl = state.url ?? settingsElement.dataset.initialUrl ?? "about:blank";
  let activeZoom = typeof state.zoom === "number" ? state.zoom : 100;
  let currentMode = state.currentMode ?? settingsElement.dataset.currentMode ?? MODE_RESPONSIVE;
  let selectedDeviceId = state.selectedDeviceId ?? settingsElement.dataset.selectedDeviceId ?? (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : CUSTOM_DEVICE_ID);
  let customDeviceWidth = state.customDeviceWidth ?? 360;
  let customDeviceHeight = state.customDeviceHeight ?? 640;
  let currentOrientation = state.orientation ?? settingsElement.dataset.orientation ?? "portrait";
  let userHasManuallyZoomedResponsive = state.userHasManuallyZoomedResponsive ?? settingsElement.dataset.userHasManuallyZoomedResponsive === "true" ?? false;
  let currentDevice = null;

  // --- ELEMENTS CACHE ---
  const elements = {
    backButton: getElement("backButton"),
    forwardButton: getElement("forwardButton"),
    reloadButton: getElement("reloadButton"),
    iframeHost: getElement("iframeHost"),
    browserFrame: getElement("browserFrame"),
    deviceFrame: getElement("deviceFrame"),
    urlInput: getElement("urlInput"),
    devToolsButton: getElement("devToolsButton"),
    resizeInfo: getElement("resizeInfo"),

    // Steuerelemente
    zoomControlsContainer: getElement("zoomControlsContainer"),
    zoomInButton: getElement("zoomIn"),
    zoomOutButton: getElement("zoomOut"),
    zoomLevelDisplay: getElement("zoomLevel"),
    deviceSelectDropdown: getElement("deviceSelectDropdown"),
    customDeviceContainer: getElement("customDeviceContainer"),
    customDeviceWidthInput: getElement("customDeviceWidth"),
    customDeviceHeightInput: getElement("customDeviceHeight"),
    rotateDeviceButton: getElement("rotateDeviceButton"),
  };

  // --- INITIALIZATION ---
  function initialize() {
    populateDeviceDropdown();
    navigateTo(currentUrl, false);
    setupEventListeners();
    
    vscode.postMessage({ type: "webviewReady" });

    if (currentMode === MODE_RESPONSIVE && !userHasManuallyZoomedResponsive) {
        calculateAndApplyInitialResponsiveZoom();
    } else {
        applyCurrentState(false); // Zustand anwenden ohne erneutes Speichern
    }
    updateNavigationButtonsState();
  }
  
  function calculateAndApplyInitialResponsiveZoom() {
    const panelWidth = elements.iframeHost.offsetWidth;
    if (panelWidth > 0) {
      let newZoom = Math.round((panelWidth / DESKTOP_REFERENCE_WIDTH) * 100);
      activeZoom = Math.max(25, Math.min(100, newZoom));
      activeZoom = Math.round(activeZoom / 10) * 10;
    } else {
      activeZoom = state.zoom || 50;
    }
    userHasManuallyZoomedResponsive = false;
    applyCurrentState(false); // Zustand anwenden ohne erneutes Speichern
  }

  function populateDeviceDropdown() {
    if (!elements.deviceSelectDropdown) return;
    elements.deviceSelectDropdown.innerHTML = "";
    
    // Responsive Option als erstes hinzufügen
    const responsiveOption = document.createElement("option");
    responsiveOption.value = "responsive";
    responsiveOption.textContent = "Responsive";
    elements.deviceSelectDropdown.appendChild(responsiveOption);
    
    // Custom Device als zweites hinzufügen
    const customOption = document.createElement("option");
    customOption.value = CUSTOM_DEVICE_ID;
    customOption.textContent = "Custom Device";
    elements.deviceSelectDropdown.appendChild(customOption);
    
    // Gruppierte Optionen nach Gerätekategorien
    const deviceTypes = {};
    
    // Geräte nach Typ sammeln
    DEVICE_PRESETS.forEach(device => {
      if (!deviceTypes[device.type]) {
        deviceTypes[device.type] = [];
      }
      deviceTypes[device.type].push(device);
    });
    
    // Für jeden Gerätetyp eine optgroup erstellen
    Object.keys(deviceTypes).forEach(type => {
      const group = document.createElement("optgroup");
      group.label = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize type
      
      // Geräte zum optgroup hinzufügen
      deviceTypes[type].forEach(device => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = device.name;
        group.appendChild(option);
      });
      
      elements.deviceSelectDropdown.appendChild(group);
    });

    // Setze den ausgewählten Wert basierend auf dem aktuellen Modus
    if (currentMode === MODE_RESPONSIVE) {
      elements.deviceSelectDropdown.value = "responsive";
    } else {
      elements.deviceSelectDropdown.value = selectedDeviceId || CUSTOM_DEVICE_ID;
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    elements.backButton?.addEventListener("click", () => history.back());
    elements.forwardButton?.addEventListener("click", () => history.forward());
    elements.reloadButton?.addEventListener("click", () => {
      try {
        elements.browserFrame.contentWindow?.location.reload();
      } catch (e) {
        elements.browserFrame.src = elements.browserFrame.src;
      }
    });
    elements.devToolsButton?.addEventListener("click", () => vscode.postMessage({ type: "openDevTools" }));

    elements.urlInput?.addEventListener("change", () => navigateTo(elements.urlInput.value));
    elements.urlInput?.addEventListener("keyup", (event) => {
      if (event.key === "Enter") navigateTo(elements.urlInput.value);
    });

    // Diese Tab-Button Listener werden nicht mehr benötigt, da wir jetzt ein Dropdown verwenden

    elements.deviceSelectDropdown?.addEventListener("change", (event) => {
      const selectedValue = event.target.value;
      
      if (selectedValue === "responsive") {
        // Responsive Modus aktivieren
        currentMode = MODE_RESPONSIVE;
        if (!userHasManuallyZoomedResponsive) {
          calculateAndApplyInitialResponsiveZoom();
        } else {
          applyCurrentState();
        }
      } else {
        // Gerätemodus aktivieren
        currentMode = MODE_DEVICE;
        selectedDeviceId = selectedValue;
        applyCurrentState();
      }
    });

    elements.rotateDeviceButton?.addEventListener("click", toggleOrientation);
    elements.zoomInButton?.addEventListener("click", () => changeZoom(10));
    elements.zoomOutButton?.addEventListener("click", () => changeZoom(-10));

    let customDeviceUpdateTimeout;
    const handleCustomDeviceInputChange = (event, dimension) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value > 0) {
        if (dimension === 'width') customDeviceWidth = value;
        else customDeviceHeight = value;
        clearTimeout(customDeviceUpdateTimeout);
        customDeviceUpdateTimeout = setTimeout(() => {
            if (selectedDeviceId === CUSTOM_DEVICE_ID && currentMode === MODE_DEVICE) applyCurrentState();
        }, 300);
      }
    };
    elements.customDeviceWidthInput?.addEventListener("input", (e) => handleCustomDeviceInputChange(e, 'width'));
    elements.customDeviceWidthInput?.addEventListener("change", (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) customDeviceWidth = value;
        if (selectedDeviceId === CUSTOM_DEVICE_ID && currentMode === MODE_DEVICE) applyCurrentState();
    });
    elements.customDeviceHeightInput?.addEventListener("input", (e) => handleCustomDeviceInputChange(e, 'height'));
    elements.customDeviceHeightInput?.addEventListener("change", (e) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) customDeviceHeight = value;
        if (selectedDeviceId === CUSTOM_DEVICE_ID && currentMode === MODE_DEVICE) applyCurrentState();
    });

    elements.browserFrame.addEventListener("load", handleIframeLoad);

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (currentMode === MODE_RESPONSIVE && !userHasManuallyZoomedResponsive) {
          calculateAndApplyInitialResponsiveZoom();
        } else {
          applyCurrentState(false); // Nur UI anpassen, nicht unbedingt speichern
        }
      }, 150);
    });

    window.addEventListener("message", handleVSCodeMessage);
    window.addEventListener("beforeunload", saveStateToVsCode);
  }

  // --- VIEW MODE (TAB) AND STATE MANAGEMENT ---
  function setViewMode(newMode, persistState = true) {
    if (currentMode === newMode && !persistState) return; // Verhindere unnötige Updates beim Initialisieren

    currentMode = newMode;

    // Aktualisiere das Dropdown-Menü, um den aktuellen Modus anzuzeigen
    if (elements.deviceSelectDropdown) {
      if (currentMode === MODE_RESPONSIVE) {
        elements.deviceSelectDropdown.value = "responsive";
      } else {
        elements.deviceSelectDropdown.value = selectedDeviceId || CUSTOM_DEVICE_ID;
      }
    }
    
    // Wenn in den Responsive-Modus gewechselt wird und vorher manuell nicht gezoomt wurde, Zoom neu berechnen
    if (currentMode === MODE_RESPONSIVE && !userHasManuallyZoomedResponsive) {
        calculateAndApplyInitialResponsiveZoom(); // Dies ruft applyCurrentState intern auf
    } else {
        applyCurrentState(persistState);
    }
  }

  function applyCurrentState(persistState = true) {
    updateCurrentDevice(); // Definiere currentDevice

    // UI-Elemente ein-/ausblenden basierend auf aktuellem Modus
    if (currentMode === MODE_DEVICE) {
        // Anzeigen/Verstecken der gerätespezifischen Steuerelemente
        elements.customDeviceContainer.style.display = (selectedDeviceId === CUSTOM_DEVICE_ID) ? "flex" : "none";
        elements.rotateDeviceButton.style.display = (currentDevice) ? "flex" : "none";
        elements.zoomControlsContainer.style.display = "none"; // Zoom-Controls im Gerätmodus ausblenden

        // Sicherstellen, dass die Eingabefelder die korrekten Werte haben, wenn Custom Device aktiv ist
        if (selectedDeviceId === CUSTOM_DEVICE_ID) {
            elements.customDeviceWidthInput.value = customDeviceWidth;
            elements.customDeviceHeightInput.value = customDeviceHeight;
        }
    } else { // Responsive-Modus
        elements.customDeviceContainer.style.display = "none";
        elements.rotateDeviceButton.style.display = "none";
        elements.zoomControlsContainer.style.display = "flex"; // Zoom-Controls nur im Responsive-Modus anzeigen
    }


    // Zoom-Logik basierend auf dem aktuellen Modus
    if (currentMode === MODE_RESPONSIVE) {
        // `activeZoom` wird verwendet oder neu berechnet, falls nicht manuell gezoomt
        if (!userHasManuallyZoomedResponsive) {
            const panelWidth = elements.iframeHost.offsetWidth;
            if (panelWidth > 0) {
                let newZoom = Math.round((panelWidth / DESKTOP_REFERENCE_WIDTH) * 100);
                activeZoom = Math.max(25, Math.min(100, newZoom));
                activeZoom = Math.round(activeZoom / 10) * 10;
            } else {
                activeZoom = state.zoom || 50;
            }
        }
    } else if (currentMode === MODE_DEVICE && currentDevice) {
      const deviceDims = currentDevice[currentOrientation] || currentDevice.portrait;
      if (deviceDims && deviceDims.width > 0 && deviceDims.height > 0) {
        const hostPaddingHorizontal = parseInt(getComputedStyle(elements.iframeHost).paddingLeft, 10) + parseInt(getComputedStyle(elements.iframeHost).paddingRight, 10) || 0;
        const hostPaddingVertical = parseInt(getComputedStyle(elements.iframeHost).paddingTop, 10) + parseInt(getComputedStyle(elements.iframeHost).paddingBottom, 10) || 0;
        const availableWidth = elements.iframeHost.offsetWidth - hostPaddingHorizontal;
        const availableHeight = elements.iframeHost.offsetHeight - hostPaddingVertical;
        const scaleX = availableWidth / deviceDims.width;
        const scaleY = availableHeight / deviceDims.height;
        const scaleFactor = Math.min(scaleX, scaleY, 1);
        activeZoom = Math.max(10, Math.floor(scaleFactor * 100));
      } else {
        activeZoom = 100; // Fallback für ungültige Custom-Größen
      }
    }
    
    elements.zoomLevelDisplay.innerText = `${activeZoom}%`;
    updateDeviceFrameAndIframe();
    updateResizeInfo();

    if (persistState) {
      saveStateToVsCode();
      vscode.postMessage({
        type: "viewParametersChanged",
        currentMode: currentMode,
        selectedDeviceId: selectedDeviceId,
        orientation: currentOrientation,
        zoom: activeZoom,
        userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
        customDeviceWidth: customDeviceWidth,
        customDeviceHeight: customDeviceHeight
      });
    }
  }

  function updateCurrentDevice() {
    if (selectedDeviceId === CUSTOM_DEVICE_ID) {
      currentDevice = {
        id: CUSTOM_DEVICE_ID, name: "Custom", type: "custom",
        portrait: { width: customDeviceWidth, height: customDeviceHeight },
        landscape: { width: customDeviceHeight, height: customDeviceWidth },
      };
    } else {
      currentDevice = DEVICE_PRESETS.find(d => d.id === selectedDeviceId) || (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0] : null);
    }
  }

  function updateDeviceFrameAndIframe() {
    const scaleFactor = activeZoom / 100;
    let frameWidth, frameHeight, iframeContentWidth, iframeContentHeight;

    if (currentMode === MODE_RESPONSIVE || !currentDevice) {
      frameWidth = "100%"; frameHeight = "100%";
      iframeContentWidth = `${100 / scaleFactor}%`; iframeContentHeight = `${100 / scaleFactor}%`;
      elements.deviceFrame.style.borderRadius = "0";
    } else { // MODE_DEVICE
      const dims = currentDevice[currentOrientation] || currentDevice.portrait;
       if (!dims || dims.width <= 0 || dims.height <= 0) {
          frameWidth = "100%"; frameHeight = "100%";
          iframeContentWidth = `${100 / scaleFactor}%`; iframeContentHeight = `${100 / scaleFactor}%`;
          elements.deviceFrame.style.borderRadius = "0";
      } else {
          frameWidth = `${dims.width * scaleFactor}px`; frameHeight = `${dims.height * scaleFactor}px`;
          iframeContentWidth = `${dims.width}px`; iframeContentHeight = `${dims.height}px`;
          elements.deviceFrame.style.borderRadius = settingsElement.dataset.deviceFrameRadius || "8px";
      }
    }
    elements.deviceFrame.style.width = frameWidth; elements.deviceFrame.style.height = frameHeight;
    elements.browserFrame.style.transform = `scale(${scaleFactor})`;
    elements.browserFrame.style.width = iframeContentWidth; elements.browserFrame.style.height = iframeContentHeight;
  }

  function updateResizeInfo() {
    if (!elements.resizeInfo) return;
    
    if (currentMode === MODE_RESPONSIVE) {
      const scaleFactor = activeZoom / 100;
      const width = Math.round(elements.iframeHost.offsetWidth / scaleFactor);
      const height = Math.round(elements.iframeHost.offsetHeight / scaleFactor);
      elements.resizeInfo.textContent = `${width} × ${height} (${activeZoom}%)`;
    } else if (currentDevice) { // MODE_DEVICE
      const dims = currentDevice[currentOrientation] || currentDevice.portrait;
      
      if (dims && dims.width > 0 && dims.height > 0) {
        elements.resizeInfo.textContent = `${dims.width} × ${dims.height} (${activeZoom}%)`;
      } else if (currentDevice.id === CUSTOM_DEVICE_ID) {
        elements.resizeInfo.textContent = `${customDeviceWidth} × ${customDeviceHeight} (${activeZoom}%)`;
      } else {
        elements.resizeInfo.textContent = `${currentDevice.name} (${activeZoom}%)`;
      }
    } else {
      elements.resizeInfo.textContent = "";
    }
  }

  function changeZoom(delta) {
    if (currentMode !== MODE_RESPONSIVE) return; // Manuelles Zoomen nur im Responsive-Modus
    const minZoom = 10; const maxZoom = 300;
    let newZoom = activeZoom + delta;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    newZoom = Math.round(newZoom / 10) * 10;
    if (activeZoom !== newZoom) {
      activeZoom = newZoom;
      userHasManuallyZoomedResponsive = true;
      applyCurrentState();
    }
  }

  function toggleOrientation() {
    if (currentMode !== MODE_DEVICE || !currentDevice) return;
    currentOrientation = (currentOrientation === "portrait") ? "landscape" : "portrait";
    applyCurrentState();
  }

  function navigateTo(url, isFromUserInputOrInternalNav = true) {
    let newUrl = (url || "").trim();
    if (!newUrl || (newUrl === "about:blank" && elements.browserFrame.src === newUrl && !isFromUserInputOrInternalNav)) {
      return;
    }
    if (!/^(https?|about|file):/i.test(newUrl)) {
      if (newUrl.includes(".") || newUrl.startsWith("localhost") || newUrl.includes(":")) {
        newUrl = `https://${newUrl}`;
      } else if (newUrl !== "about:blank") {
        newUrl = `https://www.google.com/search?q=${encodeURIComponent(newUrl)}`;
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

  function setUrlInAddressBar(url) {
    if (elements.urlInput.value !== url) elements.urlInput.value = url;
  }

  function updateNavigationButtonsState() {
    const isBlank = currentUrl === "about:blank" || !elements.browserFrame.src || elements.browserFrame.src === "about:blank";
    elements.backButton.disabled = isBlank;
    elements.forwardButton.disabled = isBlank;
    elements.reloadButton.disabled = isBlank;
  }

  function handleIframeLoad() {
    let iframeActualUrl = "about:blank";
    try {
      iframeActualUrl = (elements.browserFrame.contentWindow?.location.href !== "about:blank")
        ? elements.browserFrame.contentWindow.location.href
        : (elements.browserFrame.src || "about:blank");
    } catch (e) { iframeActualUrl = elements.browserFrame.src || "about:blank"; }

    if (currentUrl !== iframeActualUrl && iframeActualUrl !== "about:blank") {
      currentUrl = iframeActualUrl;
      setUrlInAddressBar(currentUrl);
      vscode.postMessage({ type: "urlChangedByWebview", url: currentUrl });
      saveStateToVsCode();
    } else if (elements.urlInput.value !== iframeActualUrl) {
      setUrlInAddressBar(iframeActualUrl);
    }
    updateNavigationButtonsState();
  }

  function handleVSCodeMessage(event) {
    const { command, url, isInitialLoad, state: newState } = event.data;
    switch (command) {
      case "setUrl": navigateTo(url, !isInitialLoad); break;
      case "goBack": elements.browserFrame.contentWindow?.history.back(); break;
      case "goForward": elements.browserFrame.contentWindow?.history.forward(); break;
      case "reload": elements.reloadButton?.click(); break;
      case "restoreState":
        if (newState) {
          currentUrl = newState.url ?? "about:blank";
          activeZoom = typeof newState.zoom === "number" ? newState.zoom : 100;
          currentMode = newState.currentMode ?? MODE_RESPONSIVE;
          selectedDeviceId = newState.selectedDeviceId ?? (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : CUSTOM_DEVICE_ID);
          currentOrientation = newState.orientation ?? "portrait";
          userHasManuallyZoomedResponsive = newState.userHasManuallyZoomedResponsive ?? false;
          customDeviceWidth = newState.customDeviceWidth ?? 360;
          customDeviceHeight = newState.customDeviceHeight ?? 640;

          if (selectedDeviceId !== CUSTOM_DEVICE_ID && !DEVICE_PRESETS.find(d => d.id === selectedDeviceId)) {
            selectedDeviceId = (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : CUSTOM_DEVICE_ID);
          }
          elements.deviceSelectDropdown.value = selectedDeviceId;

          setUrlInAddressBar(currentUrl);
          setViewMode(currentMode, false); // Modus/Tab setzen ohne erneutes Speichern

          if (elements.browserFrame.src !== currentUrl && (currentUrl !== "about:blank" || elements.browserFrame.src !== "about:blank" )) {
            navigateTo(currentUrl, false);
          }
          updateNavigationButtonsState();
        }
        break;
    }
  }

  function saveStateToVsCode() {
    vscode.setState({
      url: currentUrl, zoom: activeZoom, currentMode: currentMode,
      selectedDeviceId: selectedDeviceId, orientation: currentOrientation,
      userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
      customDeviceWidth: customDeviceWidth, customDeviceHeight: customDeviceHeight,
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();