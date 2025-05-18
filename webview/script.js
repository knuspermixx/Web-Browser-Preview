(function () {
  const vscode = acquireVsCodeApi();
  const state = vscode.getState() || {};
  const settingsElement = document.getElementById(
    "web-browser-preview-settings"
  );

  const getElement = (id) => document.getElementById(id);

  const CUSTOM_DEVICE_ID = "custom";
  const DESKTOP_REFERENCE_WIDTH = 1280;
  const MODE_RESPONSIVE = "responsive";
  const MODE_DEVICE = "device";

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
  const DEFAULT_DEVICE_ID =
    DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : "";

  let currentUrl =
    state.url ?? settingsElement.dataset.initialUrl ?? "about:blank";
  let activeZoom = typeof state.zoom === "number" ? state.zoom : 70;
  let currentMode =
    state.currentMode ?? settingsElement.dataset.currentMode ?? MODE_RESPONSIVE;
  let selectedDeviceId =
    state.selectedDeviceId ??
    settingsElement.dataset.selectedDeviceId ??
    (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : CUSTOM_DEVICE_ID);
  let customDeviceWidth = parseInt(
    state.customDeviceWidth ?? settingsElement.dataset.customDeviceWidth ?? 360,
    10
  );
  let customDeviceHeight = parseInt(
    state.customDeviceHeight ??
      settingsElement.dataset.customDeviceHeight ??
      640,
    10
  );
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
    devToolsButton: getElement("devToolsButton"),
    dimensionInfoArea: getElement("dimensionInfoArea"),
    deviceInfoTextLabel: getElement("deviceInfoTextLabel"),
    customDimensionInputGroup: getElement("customDimensionInputGroup"),
    customDeviceWidthInput: getElement("customDeviceWidth"),
    customDeviceHeightInput: getElement("customDeviceHeight"),
    deviceInfoZoomText: getElement("deviceInfoZoomText"),
    responsiveControlsGroup: getElement("responsiveControlsGroup"),
    responsiveWidthLabel: getElement("responsiveWidthLabel"),
    zoomOutResponsiveButton: getElement("zoomOutResponsiveButton"),
    zoomLevelResponsiveText: getElement("zoomLevelResponsiveText"),
    zoomInResponsiveButton: getElement("zoomInResponsiveButton"),
    deviceSelectDropdown: getElement("deviceSelectDropdown"),
    rotateDeviceButton: getElement("rotateDeviceButton"),
  };

  function initialize() {
    populateDeviceDropdown();
    navigateTo(currentUrl, false);
    setupEventListeners();

    const zoomOutBtn = elements.zoomOutResponsiveButton;
    const zoomLevel = elements.zoomLevelResponsiveText;
    const zoomInBtn = elements.zoomInResponsiveButton;
    if (
      zoomOutBtn &&
      zoomLevel &&
      zoomInBtn &&
      !zoomOutBtn.parentNode.classList.contains("responsive-zoom-input-group")
    ) {
      const group = document.createElement("span");
      group.className = "responsive-zoom-input-group";
      zoomOutBtn.parentNode.insertBefore(group, zoomOutBtn);
      group.appendChild(zoomOutBtn);
      group.appendChild(zoomLevel);
      group.appendChild(zoomInBtn);
    }

    vscode.postMessage({ type: "webviewReady" });

    const initialDropdownValue = elements.deviceSelectDropdown.value;
    if (initialDropdownValue === "responsive") {
      currentMode = MODE_RESPONSIVE;
      if (
        !userHasManuallyZoomedResponsive &&
        (state.currentMode === MODE_RESPONSIVE || !state.currentMode)
      ) {
        activeZoom = 70;
        applyCurrentState(false);
      } else {
        applyCurrentState(false);
      }
    } else {
      currentMode = MODE_DEVICE;
      selectedDeviceId = initialDropdownValue;
      applyCurrentState(false);
    }
    updateNavigationButtonsState();
  }

  function calculateAndApplyInitialResponsiveZoom() {
    activeZoom = 70;
    userHasManuallyZoomedResponsive = false;
    applyCurrentState(true);
  }

  function populateDeviceDropdown() {
    if (!elements.deviceSelectDropdown) return;
    elements.deviceSelectDropdown.innerHTML = "";

    const responsiveOption = document.createElement("option");
    responsiveOption.value = "responsive";
    responsiveOption.textContent = "Responsive";
    elements.deviceSelectDropdown.appendChild(responsiveOption);

    const customOption = document.createElement("option");
    customOption.value = CUSTOM_DEVICE_ID;
    customOption.textContent = "Custom Device";
    elements.deviceSelectDropdown.appendChild(customOption);

    const deviceTypes = {};
    DEVICE_PRESETS.forEach((device) => {
      if (!deviceTypes[device.type]) {
        deviceTypes[device.type] = [];
      }
      deviceTypes[device.type].push(device);
    });

    Object.keys(deviceTypes).forEach((type) => {
      const group = document.createElement("optgroup");
      group.label = type.charAt(0).toUpperCase() + type.slice(1);
      deviceTypes[type].forEach((device) => {
        const option = document.createElement("option");
        option.value = device.id;
        option.textContent = device.name;
        group.appendChild(option);
      });
      elements.deviceSelectDropdown.appendChild(group);
    });

    if (currentMode === MODE_RESPONSIVE) {
      elements.deviceSelectDropdown.value = "responsive";
    } else {
      elements.deviceSelectDropdown.value =
        selectedDeviceId ||
        (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0].id : CUSTOM_DEVICE_ID);
    }
  }

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
    elements.devToolsButton?.addEventListener("click", () =>
      vscode.postMessage({ type: "openDevTools" })
    );

    elements.urlInput?.addEventListener("change", () =>
      navigateTo(elements.urlInput.value)
    );
    elements.urlInput?.addEventListener("keyup", (event) => {
      if (event.key === "Enter") navigateTo(elements.urlInput.value);
    });

    elements.deviceSelectDropdown?.addEventListener("change", (event) => {
      const selectedValue = event.target.value;
      if (selectedValue === "responsive") {
        currentMode = MODE_RESPONSIVE;
        if (!userHasManuallyZoomedResponsive) {
          calculateAndApplyInitialResponsiveZoom();
        } else {
          applyCurrentState();
        }
      } else {
        currentMode = MODE_DEVICE;
        selectedDeviceId = selectedValue;
        applyCurrentState();
      }
    });

    elements.rotateDeviceButton?.addEventListener("click", toggleOrientation);

    elements.zoomInResponsiveButton?.addEventListener("click", () =>
      changeZoom(10)
    );
    elements.zoomOutResponsiveButton?.addEventListener("click", () =>
      changeZoom(-10)
    );

    let customDeviceUpdateTimeout;
    const handleCustomDeviceInputChange = (event, dimension) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value) && value >= 50 && value <= 5000) {
        if (dimension === "width") customDeviceWidth = value;
        else customDeviceHeight = value;

        clearTimeout(customDeviceUpdateTimeout);
        customDeviceUpdateTimeout = setTimeout(() => {
          if (
            currentMode === MODE_DEVICE &&
            selectedDeviceId === CUSTOM_DEVICE_ID
          ) {
            applyCurrentState();
          }
        }, 300);
      }
    };
    elements.customDeviceWidthInput?.addEventListener("input", (e) =>
      handleCustomDeviceInputChange(e, "width")
    );
    elements.customDeviceWidthInput?.addEventListener("change", (e) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 50 && value <= 5000)
        customDeviceWidth = value;
      else e.target.value = customDeviceWidth;
      if (currentMode === MODE_DEVICE && selectedDeviceId === CUSTOM_DEVICE_ID)
        applyCurrentState();
    });
    elements.customDeviceHeightInput?.addEventListener("input", (e) =>
      handleCustomDeviceInputChange(e, "height")
    );
    elements.customDeviceHeightInput?.addEventListener("change", (e) => {
      const value = parseInt(e.target.value, 10);
      if (!isNaN(value) && value >= 50 && value <= 5000)
        customDeviceHeight = value;
      else e.target.value = customDeviceHeight;
      if (currentMode === MODE_DEVICE && selectedDeviceId === CUSTOM_DEVICE_ID)
        applyCurrentState();
    });

    elements.browserFrame.addEventListener("load", handleIframeLoad);

    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (
          currentMode === MODE_RESPONSIVE &&
          !userHasManuallyZoomedResponsive
        ) {
          calculateAndApplyInitialResponsiveZoom();
        } else {
          applyCurrentState(false);
        }
      }, 150);
    });

    window.addEventListener("message", handleVSCodeMessage);
    window.addEventListener("beforeunload", saveStateToVsCode);
  }

  function applyCurrentState(persistState = true) {
    updateCurrentDevice();

    elements.deviceInfoTextLabel.style.display = "none";
    elements.customDimensionInputGroup.style.display = "none";
    elements.deviceInfoZoomText.style.display = "none";
    elements.responsiveControlsGroup.style.display = "none";
    elements.rotateDeviceButton.style.display = "none";

    if (currentMode === MODE_DEVICE) {
      if (currentDevice) {
        elements.rotateDeviceButton.style.display = "flex";
      }
      elements.deviceInfoZoomText.style.display = "inline";

      if (selectedDeviceId === CUSTOM_DEVICE_ID) {
        elements.customDimensionInputGroup.style.display = "flex";
        elements.customDeviceWidthInput.value = customDeviceWidth;
        elements.customDeviceHeightInput.value = customDeviceHeight;
      } else {
        elements.deviceInfoTextLabel.style.display = "inline";
      }
    } else {
      elements.responsiveControlsGroup.style.display = "flex";
    }

    if (currentMode === MODE_RESPONSIVE) {
    } else if (currentMode === MODE_DEVICE && currentDevice) {
      const deviceDims =
        currentDevice[currentOrientation] || currentDevice.portrait;
      if (deviceDims && deviceDims.width > 0 && deviceDims.height > 0) {
        const hostPaddingHorizontal =
          parseInt(getComputedStyle(elements.iframeHost).paddingLeft, 10) +
            parseInt(getComputedStyle(elements.iframeHost).paddingRight, 10) ||
          0;
        const hostPaddingVertical =
          parseInt(getComputedStyle(elements.iframeHost).paddingTop, 10) +
            parseInt(getComputedStyle(elements.iframeHost).paddingBottom, 10) ||
          0;

        const availableWidth =
          elements.iframeHost.offsetWidth - hostPaddingHorizontal;
        const availableHeight =
          elements.iframeHost.offsetHeight - hostPaddingVertical;

        if (availableWidth > 0 && availableHeight > 0) {
          const scaleX = availableWidth / deviceDims.width;
          const scaleY = availableHeight / deviceDims.height;
          const scaleFactor = Math.min(scaleX, scaleY, 1);
          activeZoom = Math.max(10, Math.floor(scaleFactor * 100));
        } else {
          activeZoom = state.zoom || 70;
        }
      } else {
        activeZoom = 70;
      }
    }

    updateDeviceFrameAndIframe();
    updateInfoArea();

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
        customDeviceHeight: customDeviceHeight,
      });
    }
  }

  function updateCurrentDevice() {
    if (selectedDeviceId === CUSTOM_DEVICE_ID) {
      currentDevice = {
        id: CUSTOM_DEVICE_ID,
        name: "Custom",
        type: "custom",
        portrait: { width: customDeviceWidth, height: customDeviceHeight },
        landscape: { width: customDeviceHeight, height: customDeviceWidth },
      };
    } else {
      currentDevice =
        DEVICE_PRESETS.find((d) => d.id === selectedDeviceId) ||
        (DEVICE_PRESETS.length > 0 ? DEVICE_PRESETS[0] : null);
    }
  }

  function updateDeviceFrameAndIframe() {
    const scaleFactor = activeZoom / 100;
    let frameWidth, frameHeight, iframeContentWidth, iframeContentHeight;

    if (currentMode === MODE_RESPONSIVE || !currentDevice) {
      frameWidth = "100%";
      frameHeight = "100%";
      iframeContentWidth = `${100 / scaleFactor}%`;
      iframeContentHeight = `${100 / scaleFactor}%`;
      elements.deviceFrame.style.borderRadius = "0";
    } else {
      const dims = currentDevice[currentOrientation] || currentDevice.portrait;
      if (!dims || dims.width <= 0 || dims.height <= 0) {
        frameWidth = "100%";
        frameHeight = "100%";
        iframeContentWidth = `${100 / scaleFactor}%`;
        iframeContentHeight = `${100 / scaleFactor}%`;
        elements.deviceFrame.style.borderRadius = "0";
      } else {
        frameWidth = `${dims.width * scaleFactor}px`;
        frameHeight = `${dims.height * scaleFactor}px`;
        iframeContentWidth = `${dims.width}px`;
        iframeContentHeight = `${dims.height}px`;
        elements.deviceFrame.style.borderRadius =
          settingsElement.dataset.deviceFrameRadius || "8px";
      }
    }
    elements.deviceFrame.style.width = frameWidth;
    elements.deviceFrame.style.height = frameHeight;
    elements.browserFrame.style.transform = `scale(${scaleFactor})`;
    elements.browserFrame.style.width = iframeContentWidth;
    elements.browserFrame.style.height = iframeContentHeight;
  }

  function updateInfoArea() {
    if (!elements.dimensionInfoArea) return;

    elements.responsiveWidthLabel.textContent = "";
    elements.zoomLevelResponsiveText.textContent = "";
    elements.deviceInfoTextLabel.textContent = "";
    elements.deviceInfoZoomText.textContent = "";

    if (currentMode === MODE_RESPONSIVE) {
      const panelWidth = elements.iframeHost.offsetWidth;
      const panelHeight = elements.iframeHost.offsetHeight;
      if (panelWidth > 0 && panelHeight > 0) {
        const scaleFactor = activeZoom / 100;
        const effectiveWidth = Math.round(panelWidth / scaleFactor);
        const effectiveHeight = Math.round(panelHeight / scaleFactor);
        elements.responsiveWidthLabel.textContent = `${effectiveWidth} × ${effectiveHeight} px`;
      } else {
        elements.responsiveWidthLabel.textContent = `Responsive`;
      }
      elements.zoomLevelResponsiveText.textContent = `${activeZoom}%`;
    } else if (currentDevice) {
      if (selectedDeviceId === CUSTOM_DEVICE_ID) {
      } else {
        const dims =
          currentDevice[currentOrientation] || currentDevice.portrait;
        if (dims && dims.width > 0 && dims.height > 0) {
          elements.deviceInfoTextLabel.textContent = `${dims.width} × ${dims.height} px`;
        } else {
          elements.deviceInfoTextLabel.textContent =
            currentDevice.name || "Device";
        }
      }
      elements.deviceInfoZoomText.textContent = `(${activeZoom}%)`;
    }
  }

  function changeZoom(delta) {
    if (currentMode !== MODE_RESPONSIVE) return;
    const minZoom = 10;
    const maxZoom = 300;
    let newZoom = activeZoom + delta;
    newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
    newZoom = Math.round(newZoom / 5) * 5;
    if (activeZoom !== newZoom) {
      activeZoom = newZoom;
      userHasManuallyZoomedResponsive = true;
      applyCurrentState();
    }
  }

  function toggleOrientation() {
    if (currentMode !== MODE_DEVICE || !currentDevice) return;
    currentOrientation =
      currentOrientation === "portrait" ? "landscape" : "portrait";
    applyCurrentState();
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

  function setUrlInAddressBar(url) {
    if (elements.urlInput && elements.urlInput.value !== url)
      elements.urlInput.value = url;
  }

  function updateNavigationButtonsState() {
    const isBlank =
      currentUrl === "about:blank" ||
      !elements.browserFrame.src ||
      elements.browserFrame.src === "about:blank";
    if (elements.backButton) elements.backButton.disabled = isBlank;
    if (elements.forwardButton) elements.forwardButton.disabled = isBlank;
    if (elements.reloadButton) elements.reloadButton.disabled = isBlank;
  }

  function handleIframeLoad() {
    let iframeActualUrl = "about:blank";
    try {
      iframeActualUrl =
        elements.browserFrame.contentWindow?.location.href &&
        elements.browserFrame.contentWindow.location.href !== "about:blank"
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
    } else if (
      elements.urlInput &&
      elements.urlInput.value !== iframeActualUrl
    ) {
      setUrlInAddressBar(iframeActualUrl);
    }
    updateNavigationButtonsState();
  }

  function handleVSCodeMessage(event) {
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
          activeZoom = typeof newState.zoom === "number" ? newState.zoom : 70;
          currentMode = newState.currentMode ?? MODE_RESPONSIVE;
          selectedDeviceId =
            newState.selectedDeviceId ??
            (DEVICE_PRESETS.length > 0
              ? DEVICE_PRESETS[0].id
              : CUSTOM_DEVICE_ID);
          currentOrientation = newState.orientation ?? "portrait";
          userHasManuallyZoomedResponsive =
            newState.userHasManuallyZoomedResponsive ?? false;
          customDeviceWidth = parseInt(newState.customDeviceWidth ?? 360, 10);
          customDeviceHeight = parseInt(newState.customDeviceHeight ?? 640, 10);

          if (
            selectedDeviceId !== CUSTOM_DEVICE_ID &&
            !DEVICE_PRESETS.find((d) => d.id === selectedDeviceId)
          ) {
            selectedDeviceId =
              DEVICE_PRESETS.length > 0
                ? DEVICE_PRESETS[0].id
                : CUSTOM_DEVICE_ID;
          }

          if (elements.deviceSelectDropdown) {
            elements.deviceSelectDropdown.value =
              currentMode === MODE_RESPONSIVE ? "responsive" : selectedDeviceId;
          }
          if (elements.customDeviceWidthInput)
            elements.customDeviceWidthInput.value = customDeviceWidth;
          if (elements.customDeviceHeightInput)
            elements.customDeviceHeightInput.value = customDeviceHeight;

          setUrlInAddressBar(currentUrl);
          applyCurrentState(false);

          if (
            elements.browserFrame.src !== currentUrl &&
            (currentUrl !== "about:blank" ||
              elements.browserFrame.src !== "about:blank")
          ) {
            navigateTo(currentUrl, false);
          }
          updateNavigationButtonsState();
        }
        break;
    }
  }

  function saveStateToVsCode() {
    vscode.setState({
      url: currentUrl,
      zoom: activeZoom,
      currentMode: currentMode,
      selectedDeviceId: selectedDeviceId,
      orientation: currentOrientation,
      userHasManuallyZoomedResponsive: userHasManuallyZoomedResponsive,
      customDeviceWidth: customDeviceWidth,
      customDeviceHeight: customDeviceHeight,
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
