
    const APP_STATE_KEY = 'vmaMapViewerState';
    // --- App State Management ---
    const appState = {
      map: {
        currentMapId: null,
        loadedOverlayId: null,
        loadingMapController: null,
        rotationLocked: false,
        overlayCache: {},
        view: {
          mode: 'overlay',
          sideRatio: 0.5,
          lensRadius: 150,
        },
        dragging: { sideX: false, sideY: false, lensR: false },
      },
      ui: {
        selectedFeatureId: null,
      },
      research: {
        drawInteraction: null,
        keyDownFinish: null,
        keyDownCancel: null,
        featureIdCounter: 1,
      },
      story: {
        scenes: [],
        editingSceneIndex: null,
        presentationScenes: [],
        currentPresentationIndex: -1,
        autoplayTimer: null,
        isPlaying: false,
      },
      search: {
        abortController: null,
        timer: null,
        lastSearchTime: 0,
      }
    };

    // --- Base layers ---
    const esriImageryLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'VMA Project | Tiles © <a href="https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer">Esri</a>',
        crossOrigin: 'anonymous'
      }),
      visible: true,
      properties: { 'name': 'esri-imagery', 'base': true },
      zIndex: 0
    });
    const googleStreets = new ol.layer.Tile({
      source: new ol.source.XYZ({
        urls: [
          'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', 'https://mt3.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        ],
        maxZoom: 22, crossOrigin: 'anonymous', attributions: 'VMA Project | Tiles © Google'
      }),
      visible: false, properties: { 'name': 'g-streets', 'base': true }, zIndex: 0
    });
    const googleSatellite = new ol.layer.Tile({
      source: new ol.source.XYZ({
        urls: [
          'https://mt0.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
          'https://mt2.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', 'https://mt3.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
        ],
        maxZoom: 22, crossOrigin: 'anonymous', attributions: 'VMA Project | Tiles © Google'
      }),
      visible: false, properties: { 'name': 'g-satellite', 'base': true }, zIndex: 0
    });
    const hcmcPlanningLayer = new ol.layer.Tile({
      source: new ol.source.XYZ({
        url: 'https://sqhkt-qlqh.tphcm.gov.vn/api/tiles/bandoso/{z}/{x}/{y}',
        attributions: 'VMA Project | Tiles © HCMC Department of Planning and Architecture'
      }),
      visible: false,
      properties: { 'name': 'hcmc-planning', 'base': true },
      zIndex: 0
    });

    // --- Overlay & Feature Layers ---
    const warpedMapLayer = new Allmaps.WarpedMapLayer({ zIndex: 10, properties: { 'name': 'allmaps-overlay' } });
    const researchSource = new ol.source.Vector();
    const researchLayer = new ol.layer.VectorImage({
      source: researchSource,
      zIndex: 20,
      imageRatio: 2,
      style: (feature) => {
        if (feature.get('hidden')) return null;
        const color = feature.get('color') || '#2563eb';
        const type = feature.getGeometry().getType();
        const label = feature.get('label') || '';
        const stroke = new ol.style.Stroke({ color: color, width: 2 });
        const fill = new ol.style.Fill({ color: color.slice(0, 7) + '26' });
        const pointBase = new ol.style.Style({ image: new ol.style.Circle({ radius: 5, fill: new ol.style.Fill({ color: color }), stroke: new ol.style.Stroke({ color: '#ffffff', width: 2 }) }) });
        const lineBase = new ol.style.Style({ stroke });
        const polyBase = new ol.style.Style({ stroke, fill });
        let styles = type === 'Point' ? [pointBase] : (type.includes('Line') ? [lineBase] : [polyBase]);
        if (label) {
          const isPoly = type.includes('Polygon');
          styles.push(new ol.style.Style({
            geometry: isPoly ? (f) => f.getGeometry().getInteriorPoint() : undefined,
            text: new ol.style.Text({
              text: label, font: '12px system-ui, Arial', fill: new ol.style.Fill({ color: '#111827' }),
              stroke: new ol.style.Stroke({ color: 'rgba(255,255,255,0.9)', width: 3 }),
              offsetY: isPoly ? 0 : -12, overflow: true
            })
          }));
        }
        return styles;
      },
      properties: { 'name': 'research' }
    });
    const searchSource = new ol.source.Vector();
    const searchLayer = new ol.layer.VectorImage({
      source: searchSource,
      zIndex: 25,
      imageRatio: 2,
      style: new ol.style.Style({
        image: new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: '#f59e0b' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }),
        stroke: new ol.style.Stroke({ color: '#f59e0b', width: 2, lineDash: [6,4] }),
        fill: new ol.style.Fill({ color: 'rgba(245,158,11,0.12)' })
      }),
      properties: { 'name': 'search' }
    });

    // --- Map Initialization ---
    const map = new ol.Map({
      target: 'map',
      layers: [esriImageryLayer, googleStreets, googleSatellite, hcmcPlanningLayer, warpedMapLayer, researchLayer, searchLayer],
      view: new ol.View({
        center: ol.proj.fromLonLat([106.70098, 10.77653]),
        zoom: 14,
        enableRotation: true,
        constrainRotation: false
      }),
      controls: [
        new ol.control.Attribution({ collapsible: false }),
        new ol.control.Rotate({ autoHide: false }),
        new ol.control.Zoom(),
        new ol.control.ScaleLine()
      ]
    });
    const dragRotate  = new ol.interaction.DragRotate({ condition: ol.events.condition.platformModifierKeyOnly });
    const pinchRotate = new ol.interaction.PinchRotate();
    map.addInteraction(dragRotate);
    map.addInteraction(pinchRotate);

    // --- UI Element References ---
    // Main Layout
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');
    const collapsedNav = document.getElementById('collapsed-nav');
    // Control Panel
    const basemapSel = document.getElementById('basemap');
    const zoomToMapBtn = document.getElementById('zoomToMapBtn');
    const mapSelector = document.getElementById('allmapsId');
    const mapTypeFilter = document.getElementById('mapTypeFilter');
    const customMapIdInput = document.getElementById('customMapId');
    const loadCustomBtn = document.getElementById('loadCustomBtn');
    const viewModeButtons = document.getElementById('viewModeButtons');
    const opacityRange = document.getElementById('opacityRange');
    const opLabel = document.getElementById('opLabel');
    const loader = document.getElementById('loader');
    const statusEl = document.getElementById('status');
    const metaBtn = document.getElementById('metaBtn');
    // Research Panel
    // Segmented tool buttons
    const toolModeGroup = document.getElementById('toolModeGroup');
    const toolPointBtn = document.getElementById('toolPointBtn');
    const toolLineBtn = document.getElementById('toolLineBtn');
    const toolPolyBtn = document.getElementById('toolPolyBtn');
    const toolEditBtn = document.getElementById('toolEditBtn');
    // No default selection; start with no active tool
    const researchClear = document.getElementById('researchClear');
    const annoTbody = document.getElementById('annoTbody');
    const exportCsvBtn = document.getElementById('exportCsv');
    const importCsvBtn = document.getElementById('importCsvBtn');
    const importCsvInput = document.getElementById('importCsvInput');
    const searchQuery = document.getElementById('searchQuery');
    const searchResults = document.getElementById('searchResults');
    const searchLocate = document.getElementById('searchLocate');
    const searchClearBtn = document.getElementById('searchClearBtn');
    // Story Panel
    const sceneTitleInput = document.getElementById('sceneTitleInput');
    const sceneDetailsInput = document.getElementById('sceneDetailsInput');
    const sceneDelayInput = document.getElementById('sceneDelayInput');
    const sceneAnnotationList = document.getElementById('sceneAnnotationList');
    const captureSceneBtn = document.getElementById('captureSceneBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const loadStoryBtn = document.getElementById('loadStoryBtn');
    const loadStoryInput = document.getElementById('loadStoryInput');
    const presentStoryBtn = document.getElementById('presentStoryBtn');
    const downloadStoryBtn = document.getElementById('downloadStoryBtn');
    const storyList = document.getElementById('story-list');
    // Viewport Dividers & Handles
    const dividerXEl = document.getElementById('dividerX');
    const dividerYEl = document.getElementById('dividerY');
    const dividerHandleX = document.getElementById('dividerHandleX');
    const dividerHandleY = document.getElementById('dividerHandleY');
    const lensEl = document.getElementById('lens');
    const lensHandle = document.getElementById('lensHandle');
    // Metadata Modal
    const metaModal = document.getElementById('metaModal');
    const metaLinkWrap = document.getElementById('metaLinkWrap');
    const metaSummary = document.getElementById('metaSummary');
    const closeMeta = document.getElementById('closeMeta');
    // Annotation Modal
    const donateModal = document.getElementById('donateModal');
    const donateBtn = document.getElementById('donateBtn');
    const closeDonateBtn = document.getElementById('closeDonate');


    // Annotation Modal
    const annoModal = document.getElementById('annoModal');
    const closeAnnoModalBtn = document.getElementById('closeAnnoModal');
    const annoTitle = document.getElementById('annoTitle');
    const annoLabelInput = document.getElementById('annoLabelInput');
    const annoDetailsInput = document.getElementById('annoDetailsInput');
    const annoColorInput = document.getElementById('annoColorInput');
    const annoImg1Input = document.getElementById('annoImg1Input');
    const annoImg2Input = document.getElementById('annoImg2Input');
    const annoImg2Container = document.getElementById('annoImg2Container');
    const addImg2Btn = document.getElementById('addImg2Btn');
    const removeImg2Btn = document.getElementById('removeImg2Btn');
    const saveAnnoBtn = document.getElementById('saveAnnoBtn');
    // Coordinate Menu
    const coordMenu  = document.getElementById('coordMenu');
    const coordValue = document.getElementById('coordValue');
    const coordCopy  = document.getElementById('coordCopy');
    const coordClose = document.getElementById('coordClose');
    // Popup Overlay
    const popupContainer = document.getElementById('popup');
    const popupContent = document.getElementById('popup-content');
    const popupCloser = document.getElementById('popup-closer');
    // Presentation Overlay
    const presentationOverlay = document.getElementById('presentation-overlay');
    const presentationTitle = document.getElementById('presentation-title');
    const presentationDetails = document.getElementById('presentation-details');
    const presentationCounter = document.getElementById('presentation-counter');
    const presentationPrev = document.getElementById('presentation-prev');
    const presentationNext = document.getElementById('presentation-next');
    const presentationPlayPause = document.getElementById('presentation-play-pause');
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    const presentationExit = document.getElementById('presentation-exit');
    const clearStateBtn = document.getElementById('clearStateBtn');
    let allMapsData = [];

    // --- Sidebar & UI Functions ---
    /**
 * Updates the position of the sidebar toggle button.
 */
    function updateSidebarPosition() {
        const isCollapsed = sidebar.classList.contains('collapsed');
        let currentWidth;
        if (isCollapsed) {
            currentWidth = 64; // collapsed width is fixed at 64px
        } else {
            // expanded width fixed for desktop
            currentWidth = 384;
        }
        sidebarToggle.style.left = `${currentWidth - 2}px`;
    }

    /**
 * Toggles the sidebar between collapsed and expanded states.
 * @param {boolean} isCollapsed - Whether the sidebar should be collapsed.
 */
    function updateSidebar(isCollapsed) {
        sidebar.classList.toggle('collapsed', isCollapsed);
        sidebarToggle.classList.toggle('hidden', isCollapsed);
        if (!isCollapsed) {
            const iconPath = "M11 19l-7-7 7-7m8 14l-7-7 7-7";
            sidebarToggleIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="${iconPath}"></path>`;
            updateSidebarPosition();
        }
        setTimeout(() => map.updateSize(), 350);
    }
    /**
 * Toggles the sidebar's collapsed state.
 */
    function toggleSidebar() {
        updateSidebar(!sidebar.classList.contains('collapsed'));
    }
    /**
 * Shows the specified tab in the sidebar.
 * @param {string} tabName - The name of the tab to show.
 */
    function showTab(tabName) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      document.getElementById(`panel${tabName}`).classList.remove('hidden');
    document.querySelectorAll('.tab-btn-desktop').forEach(t => t.classList.remove('active'));
    document.querySelectorAll(`.tab-btn-desktop[data-tab=\"${tabName}\"]`).forEach(t => t.classList.add('active'));
      if (sidebar.classList.contains('collapsed')) {
        updateSidebar(false);
      }
      if (tabName === 'Story') {
        const scene = appState.story.editingSceneIndex !== null ? appState.story.scenes[appState.story.editingSceneIndex] : null;
        populateSceneAnnotationList(scene ? scene.visibleFeatures : null);
      }
    }
    document.querySelectorAll('.tab-btn-desktop').forEach(button => {
      button.addEventListener('click', () => showTab(button.dataset.tab));
    });
    sidebarToggle.addEventListener('click', toggleSidebar);
    window.addEventListener('resize', updateSidebarPosition);
    collapsedNav.querySelectorAll('.collapsed-tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            showTab(button.dataset.tab);
        });
    });
    mapTypeFilter.addEventListener('change', () => {
        populateMapSelector(mapTypeFilter.value);
        });

    // --- Map Control Functions ---
    /**
 * Zooms the map to the extent of the current historical map.
 */
    function zoomToMapExtent() {
        if (!appState.map.currentMapId) return;
        const extent = warpedMapLayer.getExtent();
        if (extent && !ol.extent.isEmpty(extent)) {
            map.getView().fit(extent, { padding: [80, 80, 80, 80], duration: 500, maxZoom: 18 });
        }
    }
    /**
 * Sets the basemap of the map.
 * @param {string} name - The name of the basemap to set.
 */
    function setBasemap(name) {
      [esriImageryLayer, googleStreets, googleSatellite, hcmcPlanningLayer].forEach(l => l.setVisible(l.getProperties().name === name));
    }
    basemapSel.addEventListener('change', () => { setBasemap(basemapSel.value); queueSaveState(); });
    zoomToMapBtn.addEventListener('click', zoomToMapExtent);

    /**
 * Checks if an interaction is present on the map.
 * @param {ol.interaction.Interaction} i - The interaction to check for.
 * @returns {boolean} - Whether the interaction is present on the map.
 */
    function hasInteraction(i){ return map.getInteractions().getArray().includes(i); }
    /**
 * Enables or disables the rotate interactions on the map.
 * @param {boolean} on - Whether to enable or disable the interactions.
 */
    function enableRotateInteractions(on){
      if (on) {
        if (!hasInteraction(dragRotate))  map.addInteraction(dragRotate);
        if (!hasInteraction(pinchRotate)) map.addInteraction(pinchRotate);
      } else {
        if (hasInteraction(dragRotate))  map.removeInteraction(dragRotate);
        if (hasInteraction(pinchRotate)) map.removeInteraction(pinchRotate);
      }
    }
    /**
 * Locks or unlocks the map's rotation.
 * @param {boolean} lock - Whether to lock the rotation.
 */
    function lockRotation(lock){
      appState.map.rotationLocked = !!lock;
      const v = map.getView();
      if (appState.map.rotationLocked) {
        try { v.setRotation(0); } catch(_) {}
        enableRotateInteractions(false);
      } else {
        enableRotateInteractions(true);
      }
    }

    /**
 * Loads a map from Allmaps.
 * @param {string} id - The Allmaps ID of the map to load.
 */
    async function loadAllmaps(id) {
      if (!id) return;
      if (appState.map.loadingMapController) appState.map.loadingMapController.abort();
      appState.map.loadingMapController = new AbortController();
      const { signal } = appState.map.loadingMapController;

      const cache = appState.map.overlayCache;

      // If already active, just ensure opacity and bail
      if (id === appState.map.loadedOverlayId && appState.map.currentMapId) {
        const v = parseFloat(opacityRange.value);
        try { warpedMapLayer.setMapOpacity(appState.map.currentMapId, v); } catch(_) {}
        return;
      }

      // Hide current map but keep cached
      if (appState.map.currentMapId) {
        try { warpedMapLayer.setMapOpacity(appState.map.currentMapId, 0); } catch(_) {}
      }

      loader.classList.remove('hidden');
      statusEl.textContent = 'Loading map...';
      statusEl.classList.remove('text-red-600');
      metaBtn.disabled = true;
      zoomToMapBtn.disabled = true;

      const annotationUrl = `https://annotations.allmaps.org/images/${id}`;
      metaLinkWrap.innerHTML = `<a class="text-indigo-600 hover:underline" href="${annotationUrl}" target="_blank" rel="noreferrer">${annotationUrl}</a>`;

      try {
        let mapId;
        let annotation;

        if (cache[id]?.mapId) {
          ({ mapId, annotation } = cache[id]);
        } else {
          const response = await fetch(annotationUrl, { signal });
          if (!response.ok) throw new Error(`Annotation not found (HTTP ${response.status})`);
          annotation = await response.json();
          if (signal.aborted) return;
          const mapIds = await warpedMapLayer.addGeoreferenceAnnotation(annotation);
          if (signal.aborted) return;
          if (!mapIds || mapIds.length === 0 || mapIds[0] instanceof Error) throw mapIds[0] || new Error('Failed to add map to layer.');
          mapId = mapIds[0];
          cache[id] = { mapId, annotation };
        }

        appState.map.currentMapId = mapId;
        appState.map.loadedOverlayId = id;

        try { renderMetadataSummary(annotation, null, warpedMapLayer.getExtent()); } catch(_) {}
        metaBtn.disabled = false;
        zoomToMapBtn.disabled = false;
        statusEl.textContent = cache[id]?.annotation ? 'Map data received. Please wait for tiles to load.' : 'Map data received. Please wait for tiles to load.';

        const opacity = parseFloat(opacityRange.value);
        warpedMapLayer.setMapOpacity(mapId, opacity);
        queueSaveState();

      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(err);
        statusEl.textContent = `Error: ${err.message}`;
        statusEl.classList.add('text-red-600');
      } finally {
        if (!signal.aborted) {
          loader.classList.add('hidden');
          appState.map.loadingMapController = null;
        }
      }
    }
    mapSelector.addEventListener('change', () => {
      if (mapSelector.value) {
        loadAllmaps(mapSelector.value);
        customMapIdInput.value = '';
      }
    });
    /**
 * Loads a map from the custom map ID input field.
 */
    const loadFromInput = () => {
      const id = customMapIdInput.value.trim();
      if (id) {
        loadAllmaps(id);
        mapSelector.value = '';
      }
    };
    loadCustomBtn.addEventListener('click', loadFromInput);
    customMapIdInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadFromInput(); });

    // --- Guided Tour ---
    /**
 * Initializes and controls the guided tour feature.
 * This is an Immediately Invoked Function Expression (IIFE) to encapsulate the tour's logic and state.
 */
    (function(){
      const backdrop = document.getElementById('tour-backdrop');
      const highlight = document.getElementById('tour-highlight');
      const popover = document.getElementById('tour-popover');
      const titleEl = document.getElementById('tour-title');
      const textEl = document.getElementById('tour-text');
      const counterEl = document.getElementById('tour-counter');
      const btnNext = document.getElementById('tour-next');
      const btnPrev = document.getElementById('tour-prev');
      const btnSkip = document.getElementById('tour-skip');
      const btnStart = document.getElementById('startTourBtn');

      const steps = [
        { title: 'Welcome', text: 'This quick tour shows how to choose a map, add an annotation, and create a story.', selector: null, placement: 'center', ensure: () => showTab('Map') },
        { title: 'Choose a Map', text: 'Use this module to filter by map type, then pick a map from our collection. You can also add custom map from Allmaps ID.', selector: '#historicalMapModule', placement: 'right', ensure: () => showTab('Map') },
        { title: 'View & Opacity', text: 'Switch between Overlay, Side-by-Side, or Spyglass, and adjust the overlay opacity.', selector: '#viewControls', placement: 'right', ensure: () => showTab('Map') },
        { title: 'Draw Tools', text: 'You can annotate with points, lines, or polygons. Click on the map to start drawing. Press Enter to finish, Esc to cancel.', selector: '#drawTools', placement: 'right', ensure: () => showTab('Annotations') },
        { title: 'Search & Add', text: 'Or add annotation directly from a search. Search is powered by Notimatim and OpenStreetMap.', selector: '#searchModule', placement: 'right', ensure: () => showTab('Annotations') },
        { title: 'Manage Annotations', text: 'Click on the label once to zoom to the annotation, twice to edit labels. Click Edit to add details, color, and up to two images.', selector: '#annoTable', placement: 'left', ensure: () => showTab('Annotations') },
        { title: 'Capture Scene', text: 'Capture a scene to add it to your story. Each scene saves the view, overlay, and visible annotations.', selector: '#captureSceneBtn', placement: 'left', ensure: () => showTab('Story') },
        { title: 'Edit & Reorder', text: 'Use the Edit button to update a scene. To edit view and overlay, switch to Maps panel. Drag scenes to reorder them.', selector: '#story-list', placement: 'left', ensure: () => showTab('Story') },
        { title: 'Story Actions', text: 'Load an existing story, export your story to a file, or present it as an interactive.', selector: '#storyActions', placement: 'left', ensure: () => showTab('Story') }
      ];

      let index = -1;

      /**
   * Shows the tour popover and backdrop.
   */
      function show() {
        backdrop.style.display = 'block';
        popover.style.display = 'block';
        document.addEventListener('keydown', onKey);
        document.addEventListener('scroll', position, true);
        window.addEventListener('resize', position);
      }
      /**
   * Hides the tour popover and backdrop.
   */
      function hide() {
        backdrop.style.display = 'none';
        popover.style.display = 'none';
        highlight.style.display = 'none';
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('scroll', position, true);
        window.removeEventListener('resize', position);
      }
      /**
   * Gets the target element for a tour step.
   * @param {object} step - The tour step.
   * @returns {HTMLElement|null} - The target element or null if not found.
   */
      function targetEl(step) {
        if (!step.selector) return null;
        return document.querySelector(step.selector);
      }
      /**
   * Positions the tour popover and highlight.
   */
      function position() {
        const step = steps[index];
        const el = targetEl(step);
        const padding = 8;
        const gap = 12;
        const vw = window.innerWidth, vh = window.innerHeight;
        const pw = Math.min(340, vw - 20);
        popover.style.width = pw + 'px';

        if (!el || el.offsetParent === null) {
          highlight.style.display = 'none';
          // center popover on screen if no target
          const ph = popover.offsetHeight;
          popover.style.left = (vw/2 - pw/2) + 'px';
          popover.style.top = (vh/2 - ph/2) + 'px';
          return;
        }

        const r = el.getBoundingClientRect();
        // Highlight box
        highlight.style.display = 'block';
        highlight.style.left = (Math.max(10, r.left - padding)) + 'px';
        highlight.style.top = (Math.max(10, r.top - padding)) + 'px';
        highlight.style.width = (r.width + padding*2) + 'px';
        highlight.style.height = (r.height + padding*2) + 'px';

        // Popover positioning that avoids covering the highlight
        const ph = popover.offsetHeight;

        /**
     * Checks if a position is valid for the popover.
     * @param {number} left - The left position.
     * @param {number} top - The top position.
     * @returns {boolean} - Whether the position is valid.
     */
        function fits(left, top) {
          // within viewport margins
          if (left < 12 || left + pw > vw - 12) return false;
          if (top < 12 || top + ph > vh - 12) return false;
          // avoid overlapping the highlight rect (with small gap)
          const overlap = !(left + pw <= r.left - gap ||
                            left >= r.right + gap ||
                            top + ph <= r.top - gap ||
                            top >= r.bottom + gap);
          return !overlap;
        }

        // Preferred order: right, left, bottom, top
        const candidates = [];
        // right of target
        candidates.push({
          left: r.right + gap,
          top: Math.min(Math.max(12, r.top), vh - ph - 12)
        });
        // left of target
        candidates.push({
          left: r.left - pw - gap,
          top: Math.min(Math.max(12, r.top), vh - ph - 12)
        });
        // below target
        candidates.push({
          left: Math.min(Math.max(12, r.left), vw - pw - 12),
          top: r.bottom + gap
        });
        // above target
        candidates.push({
          left: Math.min(Math.max(12, r.left), vw - pw - 12),
          top: r.top - ph - gap
        });

        let placed = false;
        for (const c of candidates) {
          if (fits(c.left, c.top)) {
            popover.style.left = c.left + 'px';
            popover.style.top = c.top + 'px';
            placed = true;
            break;
          }
        }

        if (!placed) {
          // Fallback: clamp to screen near the target without strict overlap rules
          let left = Math.min(Math.max(12, r.right + gap), vw - pw - 12);
          let top = Math.min(Math.max(12, r.top), vh - ph - 12);
          popover.style.left = left + 'px';
          popover.style.top = top + 'px';
        }

        // Ensure in view for scrollable panels
        try { el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); } catch (_) {}
      }

      /**
   * Sets the current tour step.
   * @param {number} i - The index of the step to set.
   */
      function setStep(i) {
        if (i < 0 || i >= steps.length) { end(); return; }
        index = i;
        const step = steps[index];
        if (typeof step.ensure === 'function') step.ensure();
        titleEl.textContent = step.title;
        textEl.textContent = step.text;
        counterEl.textContent = `Step ${index + 1} of ${steps.length}`;
        btnPrev.disabled = index === 0;
        btnNext.textContent = index === steps.length - 1 ? 'Finish' : 'Next';
        show();
        // Slight delay to allow panels to render before positioning
        setTimeout(position, 50);
      }

      /**
   * Goes to the next tour step.
   */
      function next() { setStep(index + 1); }

      /**
   * Goes to the previous tour step.
   */
      function prev() { setStep(index - 1); }

      /**
   * Ends the tour.
   */
      function end() { hide(); index = -1; }

      /**
   * Handles key events for the tour.
   * @param {KeyboardEvent} e - The key event.
   */
      function onKey(e){ if (e.key === 'Escape') end(); if (e.key === 'ArrowRight' || e.key === 'Enter') next(); if (e.key === 'ArrowLeft') prev(); }

      if (btnStart) btnStart.addEventListener('click', () => setStep(0));
      btnNext.addEventListener('click', next);
      btnPrev.addEventListener('click', prev);
      btnSkip.addEventListener('click', end);

      // Optionally auto-suggest tour on first visit
      try {
        const seen = localStorage.getItem('vmaTourSeen');
        if (!seen) {
          // show subtle indicator by pulsing the Tour button
          btnStart?.classList.add('animate-pulse');
          btnStart?.addEventListener('click', () => localStorage.setItem('vmaTourSeen', '1'), { once: true });
        }
      } catch(_) {}
    })();

    // --- View Mode & Opacity ---
    /**
 * Sets the pointer-events style for the view overlays.
 * @param {string} value - The value to set for the pointer-events style.
 */
    function setViewOverlaysPointerEvents(value) {
        const elements = [dividerHandleX, dividerHandleY, lensHandle];
        elements.forEach(el => {
            if (el) el.style.pointerEvents = value;
        });
    }
    /**
 * Gets the size of the map.
 * @returns {Array<number>} - The width and height of the map.
 */
    function mapSize() { return map.getSize() || [0,0]; }
    /**
 * Updates the clip path of the warped map layer.
 */
    function updateClipPath() {
        const canvas = warpedMapLayer.getCanvas();
        if (!canvas) return;
        const [w, h] = mapSize();
        if (w === 0 || h === 0) return;

        if (appState.map.view.mode === 'overlay') canvas.style.clipPath = '';
        else if (appState.map.view.mode === 'side-x') canvas.style.clipPath = `polygon(${w * appState.map.view.sideRatio}px 0, ${w}px 0, ${w}px ${h}px, ${w * appState.map.view.sideRatio}px ${h}px)`;
        else if (appState.map.view.mode === 'side-y') canvas.style.clipPath = `polygon(0 ${h * appState.map.view.sideRatio}px, ${w}px ${h * appState.map.view.sideRatio}px, ${w}px ${h}px, 0 ${h}px)`;
        else if (appState.map.view.mode === 'spy') canvas.style.clipPath = `circle(${appState.map.view.lensRadius}px at ${w/2}px ${h/2}px)`;
    }
    /**
 * Sets the view mode of the map.
 * @param {string} mode - The view mode to set.
 */
    function setMode(mode) {
      stopDrag();
      appState.map.view.mode = mode;
      if (viewModeButtons) {
          viewModeButtons.querySelectorAll('.view-mode-btn').forEach(btn => {
              btn.classList.toggle('active', btn.dataset.mode === mode);
          });
      }
      lockRotation(mode !== 'overlay');
      updateClipPath();
      updateDividersAndHandles();
      updateLensAndHandle();
      queueSaveState();
    }
    if (viewModeButtons) { viewModeButtons.addEventListener('click', (e) => { const button = e.target.closest('.view-mode-btn'); if (button && button.dataset.mode) { setMode(button.dataset.mode); } }); }
    opacityRange.addEventListener('input', () => {
      const v = parseFloat(opacityRange.value);
      opLabel.textContent = `${Math.round(v * 100)}%`;
      if (appState.map.currentMapId) {
        warpedMapLayer.setMapOpacity(appState.map.currentMapId, v);
      }
      queueSaveState();
    });
    map.on(['moveend', 'change:size'], () => {
        updateClipPath();
        updateDividersAndHandles();
        updateLensAndHandle();
    });

    /**
 * Handles the move event for the view mode dividers and handles.
 * @param {Event} e - The move event.
 */
    function onMove(e) {
      if (!Object.values(appState.map.dragging).some(Boolean)) return;
      const rect = document.getElementById('map').getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      const [w,h] = mapSize();
      if (appState.map.dragging.lensR) {
        const dx = x - w/2, dy = y - h/2;
        appState.map.view.lensRadius = Math.max(20, Math.min(Math.sqrt(dx*dx + dy*dy), Math.min(w,h)/2));
        updateLensAndHandle();
      } else if (appState.map.dragging.sideX) {
        appState.map.view.sideRatio = Math.max(0.01, Math.min(x / w, 0.99));
        updateDividersAndHandles();
      } else if (appState.map.dragging.sideY) {
        appState.map.view.sideRatio = Math.max(0.01, Math.min(y / h, 0.99));
        updateDividersAndHandles();
      }
      updateClipPath();
    }
    /**
 * Stops the drag event for the view mode dividers and handles.
 */
    function stopDrag(){
      const wasDragging = Object.values(appState.map.dragging).some(Boolean);
      appState.map.dragging = { sideX:false, sideY:false, lensR:false };
      if (wasDragging) {
        queueSaveState();
      }
    }
    dividerHandleX.addEventListener('pointerdown', (e)=>{ if (appState.map.view.mode!=='side-x') return; appState.map.dragging.sideX=true; e.target.setPointerCapture(e.pointerId); e.preventDefault(); });
    dividerHandleY.addEventListener('pointerdown', (e)=>{ if (appState.map.view.mode!=='side-y') return; appState.map.dragging.sideY=true; e.target.setPointerCapture(e.pointerId); e.preventDefault(); });
    lensHandle.addEventListener('pointerdown', (e)=>{ if (appState.map.view.mode!=='spy') return; appState.map.dragging.lensR=true; e.target.setPointerCapture(e.pointerId); e.preventDefault(); });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    /**
 * Updates the dividers and handles for the side-by-side view modes.
 */
    function updateDividersAndHandles() {
        const [w, h] = mapSize();
        const showX = appState.map.view.mode === 'side-x', showY = appState.map.view.mode === 'side-y';
        dividerXEl.style.display = showX ? 'block' : 'none';
        dividerHandleX.style.display = showX ? 'block' : 'none';
        if (showX) {
            const x = w * appState.map.view.sideRatio;
            dividerXEl.style.left = x + 'px'; dividerXEl.style.height = h + 'px';
            dividerHandleX.style.left = (x - 8) + 'px'; dividerHandleX.style.top  = (h/2 - 8) + 'px';
        }
        dividerYEl.style.display = showY ? 'block' : 'none';
        dividerHandleY.style.display = showY ? 'block' : 'none';
        if (showY) {
            const y = h * appState.map.view.sideRatio;
            dividerYEl.style.top = y + 'px'; dividerYEl.style.width = w + 'px';
            dividerHandleY.style.left = (w/2 - 8) + 'px'; dividerHandleY.style.top = (y - 8) + 'px';
        }
    }
    /**
 * Updates the lens and handle for the spyglass view mode.
 */
    function updateLensAndHandle() {
        const [w, h] = mapSize();
        const d = Math.max(20, appState.map.view.lensRadius * 2);
        const show = appState.map.view.mode === 'spy';
        lensEl.style.display = show ? 'block' : 'none';
        lensHandle.style.display = show ? 'block' : 'none';
        if (show) {
            lensEl.style.width=d+'px'; lensEl.style.height=d+'px';
            lensEl.style.left=(w/2 - appState.map.view.lensRadius)+'px'; lensEl.style.top=(h/2 - appState.map.view.lensRadius)+'px';
            lensHandle.style.left=(w/2 + appState.map.view.lensRadius - 8)+'px';
            lensHandle.style.top =(h/2 - 8)+'px';
        }
    }

    // --- Research/Annotation Functions ---
    /**
 * Escapes HTML characters in a string.
 * @param {string} s - The string to escape.
 * @returns {string} - The escaped string.
 */
    const escHtml = (s) => String(s==null?'':s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    /**
 * Formats a length in meters to a human-readable string.
 * @param {number} m - The length in meters.
 * @returns {string} - The formatted length.
 */
    function formatLen(m){ return (m>1000)? (m/1000).toFixed(2)+' km' : m.toFixed(1)+' m'; }
    /**
 * Formats an area in square meters to a human-readable string.
 * @param {number} a - The area in square meters.
 * @returns {string} - The formatted area.
 */
    function formatArea(a){ return (a>=1e6)? (a/1e6).toFixed(2)+' km²' : a.toFixed(1)+' m²'; }
    /**
 * Gets or assigns an ID to a feature.
 * @param {ol.Feature} feat - The feature to get or assign an ID to.
 * @returns {string} - The ID of the feature.
 */
    function getOrAssignId(feat){ if (!feat.getId()){ feat.setId('a'+(appState.research.featureIdCounter++)); } return feat.getId(); }
    /**
 * Gets the metric for a feature.
 * @param {ol.Feature} feat - The feature to get the metric for.
 * @returns {string} - The metric for the feature.
 */
    function metricForFeature(feat){
        const g = feat.getGeometry(); const t = g.getType();
        try{
            if (t==='Point'){
                const lonlat = ol.proj.toLonLat(g.getCoordinates());
                return lonlat[0].toFixed(5)+', '+lonlat[1].toFixed(5);
            } else if (t==='LineString'){
                return formatLen(ol.sphere.getLength(g, { projection: 'EPSG:3857' }));
            } else if (t==='Polygon'){
                return formatArea(ol.sphere.getArea(g, { projection: 'EPSG:3857' }));
            }
        } catch(_){ }
        return '—';
    }
    /**
 * Refreshes the annotation table.
 */
    function refreshAnnoTable(){
        const feats = researchSource.getFeatures();
        exportCsvBtn.disabled = (feats.length === 0);
        let html = '';
        feats.forEach(f => {
            const id = getOrAssignId(f);
            const label = f.get('label') || '';
            const isHidden = f.get('hidden');
            html += `<tr data-id="${id}" class="${isHidden ? 'opacity-50 bg-gray-50' : 'bg-white'}">
                <td class="px-4 py-2">
                    <input type="text" class="anno-label w-full bg-transparent border-none focus:outline-none" value="${escHtml(label)}" readonly />
                </td>
                <td class="px-4 py-2 whitespace-nowrap space-x-1">
                    <button class="anno-edit p-1 text-green-600 hover:text-green-800" title="Edit"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button class="anno-hide p-1 text-gray-600 hover:text-gray-800" title="${isHidden ? 'Show' : 'Hide'}">${isHidden ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>' : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>'}</button>
                    <button class="anno-del p-1 text-red-600 hover:text-red-800" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
                </td></tr>`;
        });
        annoTbody.innerHTML = html || '<tr><td colspan="2" class="p-4 text-center text-gray-500">No annotations yet.</td></tr>';
        annoTbody.querySelectorAll('tr[data-id]').forEach(row => {
            const id = row.dataset.id;
            const f = researchSource.getFeatureById(id);
            if (!f) return;
            const labelInput = row.querySelector('.anno-label');
            if (labelInput) {
                let clickTimer = null;
                const clickDelay = 250; // ms to wait for a double-click
                labelInput.addEventListener('click', () => {
                    if (!labelInput.readOnly) return; // Do nothing if already in edit mode
                    if (clickTimer === null) {
                        clickTimer = setTimeout(() => {
                            clickTimer = null;
                            map.getView().fit(f.getGeometry().getExtent(), { padding:[80,80,80,80], duration: 300, maxZoom: 18 });
                        }, clickDelay);
                    } else {
                        clearTimeout(clickTimer);
                        clickTimer = null;
                        labelInput.readOnly = false;
                        labelInput.focus();
                    }
                });

                labelInput.addEventListener('blur', () => {
                    labelInput.value = (labelInput.value || '').trim();
                    f.set('label', labelInput.value);
                    researchLayer.changed();
                    queueSaveState();
                    labelInput.readOnly = true;
                });
                labelInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        labelInput.blur(); // Trigger blur to save
                    }
                });
            }
            row.querySelector('.anno-edit').addEventListener('click', () => openAnnoModal(f)); // Keep the modal edit button
            row.querySelector('.anno-hide').addEventListener('click', () => { f.set('hidden', !f.get('hidden')); researchLayer.changed(); refreshAnnoTable(); });
            row.querySelector('.anno-del').addEventListener('click', () => { researchSource.removeFeature(f); });
        });
    }
    // Modify & Snap interactions
    appState.research.modifyInteraction = null;
    appState.research.snapInteraction = null;

    /**
 * Disables the modify interaction.
 */
    function disableModify(){
        if (appState.research.modifyInteraction) map.removeInteraction(appState.research.modifyInteraction);
        if (appState.research.snapInteraction) map.removeInteraction(appState.research.snapInteraction);
        appState.research.modifyInteraction = null;
        appState.research.snapInteraction = null;
        toolEditBtn?.classList.remove('active');
        setViewOverlaysPointerEvents('auto');
    }

    /**
 * Enables the modify interaction.
 */
    function enableModify(){
        // Turn off drawing if active
        if (appState.research.drawInteraction) {
            map.removeInteraction(appState.research.drawInteraction);
            appState.research.drawInteraction = null;
        }
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        toolEditBtn?.classList.add('active');
        // Keep pointer events enabled so features are interactive
        setViewOverlaysPointerEvents('auto');
        appState.research.modifyInteraction = new ol.interaction.Modify({
            source: researchSource,
            deleteCondition: (e) => ol.events.condition.platformModifierKeyOnly(e) && ol.events.condition.singleClick(e)
        });
        appState.research.snapInteraction = new ol.interaction.Snap({ source: researchSource });
        map.addInteraction(appState.research.modifyInteraction);
        map.addInteraction(appState.research.snapInteraction);
        appState.research.modifyInteraction.on('modifyend', () => { researchLayer.changed(); queueSaveState(); });
    }

    /**
 * Cleans up the current tool.
 */
    function cleanupTool(){
        if (appState.research.drawInteraction) map.removeInteraction(appState.research.drawInteraction);
        appState.research.drawInteraction = null;
        if (appState.research.keyDownFinish) document.removeEventListener('keydown', appState.research.keyDownFinish);
        if (appState.research.keyDownCancel) document.removeEventListener('keydown', appState.research.keyDownCancel);
        disableModify();
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    }
    /**
 * Sets the active tool.
 * @param {string} mode - The mode of the tool to set.
 */
    function setActiveTool(mode){
        cleanupTool();
        if (!mode || mode==='none') {
            setViewOverlaysPointerEvents('auto'); // Restore pointer events
            return;
        }

        setViewOverlaysPointerEvents('none'); // Disable pointer events to draw "through" them
        const typeMap = { point: 'Point', line: 'LineString', poly: 'Polygon' };
        if (!typeMap[mode]) return;
        // mark segmented button active
        const seg = { point: toolPointBtn, line: toolLineBtn, poly: toolPolyBtn }[mode];
        if (seg) seg.classList.add('active');

        appState.research.drawInteraction = new ol.interaction.Draw({ source: researchSource, type: typeMap[mode] });
        map.addInteraction(appState.research.drawInteraction);
        if (mode !== 'point') {
            appState.research.keyDownFinish = (e) => { if (e.key === 'Enter') { e.preventDefault(); try{ appState.research.drawInteraction.finishDrawing(); }catch(_){} } };
            document.addEventListener('keydown', appState.research.keyDownFinish);
            appState.research.keyDownCancel = (e) => { if (e.key === 'Escape') { e.preventDefault(); try{ appState.research.drawInteraction.abortDrawing(); }catch(_){} } };
            document.addEventListener('keydown', appState.research.keyDownCancel);
        }
        appState.research.drawInteraction.on('drawend', (e) => {
          getOrAssignId(e.feature);
          e.feature.set('details', '');
          e.feature.set('color', '#2563eb'); // default color
          e.feature.set('img1', '');
          e.feature.set('img2', '');
          e.feature.set('hidden', false);
          refreshAnnoTable();
          queueSaveState();
          cleanupTool();
        });
    }
    /**
 * Sets the tool mode.
 * @param {string} mode - The mode to set.
 */
    function setToolMode(mode){
        document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
        switch(mode){
          case 'point': setActiveTool('point'); break;
          case 'line': setActiveTool('line'); break;
          case 'poly': setActiveTool('poly'); break;
          case 'edit': enableModify(); break;
          default: cleanupTool(); break;
        }
    }
    toolModeGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.seg-btn');
        if (!btn) return;
        const mode = btn.dataset.mode;
        if (!mode) return;
        if (btn.classList.contains('active')) {
            // toggle off if clicking active mode
            cleanupTool();
        } else {
            setToolMode(mode);
        }
    });
    researchSource.on(['addfeature', 'removefeature', 'clear'], () => {
        refreshAnnoTable();
        queueSaveState();
        if (!document.getElementById('panelStory').classList.contains('hidden')) {
            const scene = appState.story.editingSceneIndex !== null ? appState.story.scenes[appState.story.editingSceneIndex] : null;
            populateSceneAnnotationList(scene ? scene.visibleFeatures : null);
        }
    });
    researchClear.addEventListener('click', () => { researchSource.clear(); });

    // (Manage dropdown removed; restored direct action buttons)

    // --- Annotation Modal Functions ---
    /**
 * Opens the annotation modal.
 * @param {ol.Feature} feature - The feature to edit.
 */
    function openAnnoModal(feature) {
      if (!feature) return;
      appState.ui.selectedFeatureId = feature.getId();
      annoTitle.textContent = `Edit Annotation (${appState.ui.selectedFeatureId})`;
      annoLabelInput.value = feature.get('label') || '';
      annoDetailsInput.value = feature.get('details') || '';
      annoColorInput.value = feature.get('color') || '#2563eb';
      const img1 = feature.get('img1') || '';
      const img2 = feature.get('img2') || '';
      annoImg1Input.value = img1;
      annoImg2Input.value = img2;
      if (img2) {
        annoImg2Container.classList.remove('hidden');
        addImg2Btn.classList.add('hidden');
      } else {
        annoImg2Container.classList.add('hidden');
        addImg2Btn.classList.remove('hidden');
      }
      annoModal.classList.remove('hidden');
    }
    /**
 * Closes the annotation modal.
 */
    function closeAnnoModal() {
      annoModal.classList.add('hidden');
      appState.ui.selectedFeatureId = null;
    }
    addImg2Btn.addEventListener('click', () => {
        annoImg2Container.classList.remove('hidden');
        addImg2Btn.classList.add('hidden');
    });
    removeImg2Btn.addEventListener('click', () => {
        annoImg2Input.value = '';
        annoImg2Container.classList.add('hidden');
        addImg2Btn.classList.remove('hidden');
    });
    saveAnnoBtn.addEventListener('click', () => {
      const feature = researchSource.getFeatureById(appState.ui.selectedFeatureId);
      if (!feature) return;
      feature.set('label', (annoLabelInput.value || '').trim());
      feature.set('details', (annoDetailsInput.value || '').trim());
      feature.set('color', annoColorInput.value);
      feature.set('img1', annoImg1Input.value.trim());
      feature.set('img2', annoImg2Input.value.trim());
      researchLayer.changed();
      refreshAnnoTable();
      queueSaveState();
      closeAnnoModal();
    });
    closeAnnoModalBtn.addEventListener('click', closeAnnoModal);
    annoModal.addEventListener('click', (e) => { if (e.target === annoModal) closeAnnoModal(); });

    // --- Popup Overlay & Metadata Modal ---
    const popupOverlay = new ol.Overlay({ element: popupContainer, autoPan: { animation: { duration: 250 } } });
    map.addOverlay(popupOverlay);
    popupCloser.onclick = () => { popupOverlay.setPosition(undefined); popupCloser.blur(); return false; };
    map.on('click', (evt) => {
      if (appState.research.drawInteraction) return;
      const feature = map.forEachFeatureAtPixel(evt.pixel, (f, layer) => layer === researchLayer ? f : undefined);
      if (feature && !feature.get('hidden')) {
        const label = feature.get('label');
        const details = feature.get('details');
        const img1 = feature.get('img1');
        const img2 = feature.get('img2');

        let content = `<h4 class="font-bold text-sm mb-2">${escHtml(label)}</h4><p class="text-xs max-h-16 overflow-y-auto">${escHtml(details)}</p>`;

        if (img1 || img2) {
          const canFlip = img1 && img2;
          const initialSrc = img1 || img2;
          content += `<img id="popup-image" src="${escHtml(initialSrc)}" alt="${escHtml(label)}" class="mt-2 rounded-md max-w-full ${canFlip ? 'cursor-pointer' : ''}" ${canFlip ? `data-img1-src="${escHtml(img1)}" data-img2-src="${escHtml(img2)}" data-state="1"` : ''}>`;
          if (canFlip) {
            content += `<div class="text-center text-xs text-gray-500 mt-1">Click image to flip</div>`;
          }
        }

        popupContent.innerHTML = content;
        popupOverlay.setPosition(evt.coordinate);

        const popupImage = document.getElementById('popup-image');
        if (popupImage && popupImage.dataset.img1Src) {
          popupImage.addEventListener('click', () => {
            const isState1 = popupImage.dataset.state === '1';
            popupImage.src = isState1 ? popupImage.dataset.img2Src : popupImage.dataset.img1Src;
            popupImage.dataset.state = isState1 ? '2' : '1';
          });
        }
      } else {
        popupOverlay.setPosition(undefined);
      }
    });

    /**
 * Opens the metadata modal.
 */
    function openMeta() { if (!metaBtn.disabled) metaModal.classList.remove('hidden'); }
    /**
 * Closes the metadata modal.
 */
    function closeMetaFn() { metaModal.classList.add('hidden'); }
    metaBtn.addEventListener('click', openMeta);
    closeMeta.addEventListener('click', closeMetaFn);
    metaModal.addEventListener('click', (e) => { if (e.target === metaModal) closeMetaFn(); });

    // --- Donate Modal ---
    /**
 * Opens the donate modal.
 */
    function openDonate() { donateModal.classList.remove('hidden'); }
    /**
 * Closes the donate modal.
 */
    function closeDonate() { donateModal.classList.add('hidden'); }
    donateBtn.addEventListener('click', openDonate);
    closeDonateBtn.addEventListener('click', closeDonate);
    donateModal.addEventListener('click', (e) => { if (e.target === donateModal) closeDonate(); });

    // --- Story Mode & Presentation ---
    /**
 * Populates the scene annotation list.
 * @param {Array<string>} [visibleIds=null] - The IDs of the visible features.
 */
    function populateSceneAnnotationList(visibleIds = null) {
        const features = researchSource.getFeatures();
        if (features.length === 0) {
            sceneAnnotationList.innerHTML = '<p class="text-xs text-gray-500 p-2">No annotations available to select.</p>';
            return;
        }
        sceneAnnotationList.innerHTML = '';

        features.forEach(f => {
            const id = f.getId();
            const label = f.get('label') || `Feature ${id}`;
            const isChecked = (visibleIds === null) ? !f.get('hidden') : visibleIds.includes(id);
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <input type="checkbox" id="anno-check-${id}" value="${id}" class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" ${isChecked ? 'checked' : ''}>
                <label for="anno-check-${id}" class="ml-2 block text-sm text-gray-900 truncate" title="${escHtml(label)}">${escHtml(label)}</label>
            `;
            sceneAnnotationList.appendChild(div);
        });
    }

    /**
 * Applies a scene to the map.
 * @param {object} scene - The scene to apply.
 */
    async function applyScene(scene) {
        if (!scene) return;
        setBasemap(scene.basemap);
        basemapSel.value = scene.basemap;
        if (scene.overlayId && scene.overlayId !== appState.map.loadedOverlayId) {
            await loadAllmaps(scene.overlayId);
        } else if (!scene.overlayId && appState.map.currentMapId) {
            // Hide current overlay but keep it cached to avoid reloads later
            try { warpedMapLayer.setMapOpacity(appState.map.currentMapId, 0); } catch(_) {}
            appState.map.currentMapId = null;
            appState.map.loadedOverlayId = null;
            metaBtn.disabled = true;
            zoomToMapBtn.disabled = true;
        }
        if (scene.overlayId && appState.map.currentMapId) {
            mapSelector.value = scene.overlayId;
            opacityRange.value = scene.opacity;
            opLabel.textContent = `${Math.round(scene.opacity * 100)}%`;
            warpedMapLayer.setMapOpacity(appState.map.currentMapId, scene.opacity);
        } else {
            mapSelector.value = '';
        }
        appState.map.view.sideRatio = scene.sideRatio || 0.5;
        appState.map.view.lensRadius = scene.lensRadius || 150;
        setMode(scene.viewMode || 'overlay');
        const animOpts = { center: scene.center, zoom: scene.zoom, duration: 1200, easing: ol.easing.inAndOut };
        if ((scene.viewMode || 'overlay') === 'overlay') animOpts.rotation = scene.rotation || 0;
        map.getView().animate(animOpts);
        researchSource.getFeatures().forEach(f => f.set('hidden', !scene.visibleFeatures.includes(f.getId())));
        researchLayer.changed();
        if (document.getElementById('panelAnnotations') && !document.getElementById('panelAnnotations').classList.contains('hidden')) {
          refreshAnnoTable();
        }
    }
    /**
 * Renders the story panel.
 */
    function renderStoryPanel() {
        storyList.innerHTML = '';
        const scenes = appState.story.scenes;
        if (scenes.length === 0) {
            storyList.innerHTML = `<li class="p-4 text-center text-gray-500" id="story-placeholder">No scenes captured yet.</li>`;
            downloadStoryBtn.disabled = true;
            presentStoryBtn.disabled = true;
            return;
        }
        downloadStoryBtn.disabled = false;
        presentStoryBtn.disabled = scenes.filter(s => !s.hidden).length === 0;
        scenes.forEach((scene, index) => {
            const li = document.createElement('li');
            const isHidden = !!scene.hidden;
            li.className = `p-3 flex items-center gap-3 cursor-move ${isHidden ? 'opacity-60 bg-gray-100' : ''}`;
            li.draggable = true;
            li.dataset.index = index;
            li.innerHTML = `<span class="flex-grow font-semibold text-gray-700 truncate" title="${escHtml(scene.title)}">${escHtml(scene.title)}</span>`;

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-1 flex-shrink-0';

            const editBtn = document.createElement('button');
            editBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`;
            editBtn.className = 'p-1.5 text-green-600 hover:bg-green-100 rounded-md';
            editBtn.title = 'Edit Scene';
            editBtn.onclick = (e) => { e.stopPropagation(); enterEditMode(index); };

            const duplicateBtn = document.createElement('button');
            duplicateBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
            duplicateBtn.className = 'p-1.5 text-blue-600 hover:bg-blue-100 rounded-md';
            duplicateBtn.title = 'Duplicate Scene';
            duplicateBtn.onclick = (e) => {
                e.stopPropagation();
                const sceneToCopy = appState.story.scenes[index];
                const newScene = JSON.parse(JSON.stringify(sceneToCopy));
                newScene.title = `${newScene.title} (Copy)`;
                appState.story.scenes.splice(index + 1, 0, newScene);
                renderStoryPanel();
            };

            const hideBtn = document.createElement('button');
            hideBtn.innerHTML = isHidden
                ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>`
                : `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
            hideBtn.className = 'p-1.5 text-gray-600 hover:bg-gray-200 rounded-md';
            hideBtn.title = isHidden ? 'Show in Presentation' : 'Hide from Presentation';
            hideBtn.onclick = (e) => { e.stopPropagation(); scene.hidden = !isHidden; renderStoryPanel(); };

            const delBtn = document.createElement('button');
            delBtn.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            delBtn.className = 'p-1.5 text-red-600 hover:bg-red-100 rounded-md';
            delBtn.title = 'Delete Scene';
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (appState.story.editingSceneIndex === index) exitEditMode();
                scenes.splice(index, 1);
                renderStoryPanel();
            };
            actionsDiv.appendChild(editBtn);
            actionsDiv.appendChild(duplicateBtn);
            actionsDiv.appendChild(hideBtn);
            actionsDiv.appendChild(delBtn);
            li.appendChild(actionsDiv);
            storyList.appendChild(li);
        });
        queueSaveState();
    }
    captureSceneBtn.addEventListener('click', () => {
        const view = map.getView();
        const visibleFeatures = Array.from(sceneAnnotationList.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
        const scene = {
            title: sceneTitleInput.value.trim(),
            details: sceneDetailsInput.value.trim(),
            delay: parseInt(sceneDelayInput.value, 10) || 5,
            center: view.getCenter(), zoom: view.getZoom(), rotation: view.getRotation(),
            basemap: basemapSel.value, overlayId: appState.map.loadedOverlayId,
            opacity: parseFloat(opacityRange.value), viewMode: appState.map.view.mode,
            sideRatio: appState.map.view.sideRatio, lensRadius: appState.map.view.lensRadius,
            visibleFeatures: visibleFeatures,
            hidden: appState.story.editingSceneIndex !== null ? appState.story.scenes[appState.story.editingSceneIndex].hidden : false
        };
        if (appState.story.editingSceneIndex !== null) {
            // Editing: if new title is empty, keep the old one.
            if (!scene.title) {
                scene.title = appState.story.scenes[appState.story.editingSceneIndex].title;
            }
            appState.story.scenes[appState.story.editingSceneIndex] = scene;
            exitEditMode();
        } else {
            // Creating: if title is empty, generate a default one.
            if (!scene.title) {
                scene.title = `Scene ${appState.story.scenes.length + 1}`;
            }
            appState.story.scenes.push(scene);
            sceneTitleInput.value = '';
            sceneDetailsInput.value = '';
            sceneDelayInput.value = '5';
        }
        renderStoryPanel();
    });
    /**
 * Enters edit mode for a scene.
 * @param {number} index - The index of the scene to edit.
 */
    function enterEditMode(index) {
        const scene = appState.story.scenes[index];
        if (!scene) return;
        appState.story.editingSceneIndex = index;
        applyScene(scene);
        sceneTitleInput.value = scene.title || '';
        sceneDetailsInput.value = scene.details || '';
        sceneDelayInput.value = scene.delay || 5;
        captureSceneBtn.textContent = 'Save Changes';
        captureSceneBtn.classList.replace('bg-blue-600', 'bg-green-600');
        cancelEditBtn.classList.remove('hidden');
        populateSceneAnnotationList(scene.visibleFeatures);
    }
    /**
 * Exits edit mode for a scene.
 */
    function exitEditMode() {
        appState.story.editingSceneIndex = null;
        sceneTitleInput.value = '';
        sceneDetailsInput.value = '';
        sceneDelayInput.value = '5';
        captureSceneBtn.textContent = 'Capture Scene';
        captureSceneBtn.classList.replace('bg-indigo-600', 'bg-indigo-600');
        cancelEditBtn.classList.add('hidden');
        populateSceneAnnotationList();
    }
    cancelEditBtn.addEventListener('click', exitEditMode);
    downloadStoryBtn.addEventListener('click', () => {
        if (appState.story.scenes.length === 0) return;
        const geoJsonFormat = new ol.format.GeoJSON();
        const featuresGeoJson = geoJsonFormat.writeFeaturesObject(researchSource.getFeatures(), { featureProjection: 'EPSG:3857' });
        const storyData = { features: featuresGeoJson, scenes: appState.story.scenes };
        const blob = new Blob([JSON.stringify(storyData, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `story-${new Date().toISOString().replace(/[:.]/g, '-')}.json`; a.click();
        URL.revokeObjectURL(url);
    });
    loadStoryBtn.addEventListener('click', () => loadStoryInput.click());
    loadStoryInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const loadedData = JSON.parse(String(reader.result || '{}'));
                if (loadedData && loadedData.features && Array.isArray(loadedData.scenes)) {
                    researchSource.clear();
                    // Assign titles to untitled scenes to make them stable
                    loadedData.scenes.forEach((scene, i) => {
                        if (!scene.title) {
                            scene.title = `Scene ${i + 1}`;
                        }
                    });
                    const features = new ol.format.GeoJSON().readFeatures(loadedData.features, { featureProjection: 'EPSG:3857' });
                    researchSource.addFeatures(features);
                    appState.story.scenes = loadedData.scenes;
                    renderStoryPanel();
                } else { alert('Invalid story file format.'); }
            } catch (err) { alert('Could not parse story file.'); }
            loadStoryInput.value = '';
        };
        reader.readAsText(file);
    });

    // --- Story Drag & Drop ---
    let dragStartIndex;
    storyList.addEventListener('dragstart', (e) => {
        const target = e.target.closest('li[draggable="true"]');
        if (target) {
            dragStartIndex = parseInt(target.dataset.index, 10);
            e.dataTransfer.effectAllowed = 'move';
            setTimeout(() => target.classList.add('opacity-30'), 0);
        }
    });
    storyList.addEventListener('dragend', (e) => {
        e.target.closest('li[draggable="true"]')?.classList.remove('opacity-30');
        dragStartIndex = undefined;
    });
    storyList.addEventListener('dragover', (e) => {
        e.preventDefault(); // This is necessary to allow a drop
    });
    storyList.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropTarget = e.target.closest('li[draggable="true"]');
        if (dropTarget && typeof dragStartIndex === 'number') {
            const dropIndex = parseInt(dropTarget.dataset.index, 10);
            if (dragStartIndex !== dropIndex) {
                const [movedItem] = appState.story.scenes.splice(dragStartIndex, 1);
                appState.story.scenes.splice(dropIndex, 0, movedItem);
                renderStoryPanel();
            }
        }
    });

    /**
 * Shows a slide in the presentation.
 * @param {number} index - The index of the slide to show.
 */
    async function showSlide(index) {
        if (index < 0 || index >= appState.story.presentationScenes.length) return;
        popupOverlay.setPosition(undefined);
        appState.story.currentPresentationIndex = index;
        const scene = appState.story.presentationScenes[index];
        await applyScene(scene);
        presentationTitle.textContent = scene.title || `Scene ${index + 1}`;
        presentationDetails.textContent = scene.details || '';
        presentationCounter.textContent = `${index + 1} / ${appState.story.presentationScenes.length}`;
        presentationPrev.disabled = index === 0;
        presentationNext.disabled = index === appState.story.presentationScenes.length - 1;
    }
    /**
 * Pauses the autoplay of the presentation.
 */
    function pauseAutoplay() {
        if (!appState.story.isPlaying && !appState.story.autoplayTimer) return;
        appState.story.isPlaying = false;
        if (appState.story.autoplayTimer) {
            clearTimeout(appState.story.autoplayTimer);
            appState.story.autoplayTimer = null;
        }
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
    /**
 * Plays the autoplay of the presentation.
 */
    async function playAutoplay() {
        if (appState.story.isPlaying) return;

        // If at the end, restart from the beginning.
        if (appState.story.currentPresentationIndex >= appState.story.presentationScenes.length - 1) {
            appState.story.currentPresentationIndex = -1;
        }

        appState.story.isPlaying = true;
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');

        async function next() {
            if (!appState.story.isPlaying) return;
            const nextIndex = appState.story.currentPresentationIndex + 1;
            if (nextIndex < appState.story.presentationScenes.length) {
                await showSlide(nextIndex);
                if (appState.story.isPlaying) { // Check again in case it was paused during await
                    if (nextIndex >= appState.story.presentationScenes.length - 1) {
                        pauseAutoplay(); // Reached the end
                        return;
                    }
                    const currentScene = appState.story.presentationScenes[nextIndex];
                    const delay = (currentScene.delay || 2) * 1000;
                    appState.story.autoplayTimer = setTimeout(next, delay);
                }
            } else {
                pauseAutoplay(); // Autoplay ends
            }
        }
        if (appState.story.currentPresentationIndex === -1) {
            next(); // Start immediately if we're restarting
        } else {
            const currentScene = appState.story.presentationScenes[appState.story.currentPresentationIndex];
            const initialDelay = (currentScene?.delay || 2) * 1000;
            appState.story.autoplayTimer = setTimeout(next, initialDelay);
        }
    }
    /**
 * Starts the presentation.
 */
    function startPresentation() {
        appState.story.presentationScenes = appState.story.scenes.filter(s => !s.hidden);
        if (appState.story.presentationScenes.length === 0) return;
        updateSidebar(true); // Collapse sidebar for presentation
        presentationOverlay.classList.remove('hidden');
        pauseAutoplay(); // Reset autoplay state
        showSlide(0);
    }
    /**
 * Exits the presentation.
 */
    function exitPresentation() {
        pauseAutoplay();
        presentationOverlay.classList.add('hidden');
        appState.story.currentPresentationIndex = -1;
        appState.story.presentationScenes = [];
    }
    presentStoryBtn.addEventListener('click', startPresentation);
    presentationNext.addEventListener('click', () => { pauseAutoplay(); showSlide(appState.story.currentPresentationIndex + 1); });
    presentationPrev.addEventListener('click', () => { pauseAutoplay(); showSlide(appState.story.currentPresentationIndex - 1); });
    presentationPlayPause.addEventListener('click', () => { if (appState.story.isPlaying) pauseAutoplay(); else playAutoplay(); });
    presentationExit.addEventListener('click', exitPresentation);
    document.addEventListener('keydown', (e) => {
        if (presentationOverlay.classList.contains('hidden')) return;
        if (e.key === 'ArrowRight') { pauseAutoplay(); showSlide(appState.story.currentPresentationIndex + 1); }
        else if (e.key === 'ArrowLeft') { pauseAutoplay(); showSlide(appState.story.currentPresentationIndex - 1); }
        else if (e.key === 'Escape') exitPresentation();
    });

    // --- Search Logic (in Research Panel) ---
    /**
 * Renders the search results.
 * @param {Array<object>} items - The search results to render.
 */
    function renderSearchItems(items){
        if (!items || !items.length){ searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">No results found.</div>'; return; }
        searchResults.innerHTML = '';
        items.forEach((it) => {
            const div = document.createElement('div');
            div.className = 'p-2 border-b border-gray-200 cursor-pointer hover:bg-gray-100 flex items-center gap-2';
            const title = escHtml(it.display_name || `${it.type || ''}`);
            div.innerHTML = `<div class="flex-grow min-w-0"><div class="font-semibold text-sm text-gray-800 truncate">${title}</div></div><button type="button" class="add-search-btn px-2 py-1 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">Add</button>`;
            div.addEventListener('click', (e) => { if(!e.target.classList.contains('add-search-btn')) zoomToSearchResult(it); });
            div.querySelector('.add-search-btn').addEventListener('click', (ev) => { ev.stopPropagation(); addResultToAnnotations(it); });
            searchResults.appendChild(div);
        });
    }
    /**
 * Creates a feature from a search result.
 * @param {object} it - The search result.
 * @returns {ol.Feature} - The created feature.
 */
    function createFeatureFromSearchResult(it) {
        try {
            let feat = null;
            if (it.geojson) feat = new ol.format.GeoJSON().readFeature({ type: 'Feature', geometry: it.geojson }, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
            else if (it.lat && it.lon) feat = new ol.Feature({ geometry: new ol.geom.Point(ol.proj.fromLonLat([Number(it.lon), Number(it.lat)])) });
            if (feat) feat.set('label', it.display_name || it.name || '');
            return feat;
        } catch (e) { console.warn("Could not create feature from search result:", e); return null; }
    }
    /**
 * Zooms to a search result.
 * @param {object} it - The search result to zoom to.
 */
    function zoomToSearchResult(it) {
        searchSource.clear();
        const feat = createFeatureFromSearchResult(it);
        if (!feat) return;
        searchSource.addFeature(feat);
        const geom = feat.getGeometry();
        if (geom.getType() === 'Point') map.getView().animate({ center: geom.getCoordinates(), duration: 400, zoom: Math.max(map.getView().getZoom() || 12, 16) });
        else map.getView().fit(geom.getExtent(), { padding: [80, 80, 80, 80], duration: 400, maxZoom: 18 });
    }
    /**
 * Adds a search result to the annotations.
 * @param {object} it - The search result to add.
 */
    function addResultToAnnotations(it) {
        const feat = createFeatureFromSearchResult(it);
        if (!feat) return;
        researchSource.addFeature(feat);
        searchSource.clear();
        searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Feature added to annotations.</div>';
        searchQuery.value = '';
    }
    const MIN_SEARCH_INTERVAL = 1000;
    /**
 * Runs a search.
 */
    async function runSearchNow() {
        const q = (searchQuery?.value || '').trim();
        if (!q) { searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Enter a place or address to search.</div>'; return; }
        if (appState.search.abortController) appState.search.abortController.abort();
        appState.search.abortController = new AbortController();
        searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Searching...</div>';
        try {
            const params = new URLSearchParams({ format: 'jsonv2', q, addressdetails: '1', polygon_geojson: '1', limit: '10' });
            const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: appState.search.abortController.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            renderSearchItems(await res.json());
        } catch (err) {
            if (err.name !== 'AbortError') searchResults.innerHTML = '<div class="p-4 text-center text-sm text-red-600">Search failed.</div>';
        }
    }
    /**
 * Queues a search.
 */
    function queueSearch() {
        if (appState.search.timer) clearTimeout(appState.search.timer);
        const now = Date.now();
        const wait = Math.max(0, MIN_SEARCH_INTERVAL - (now - appState.search.lastSearchTime));
        appState.search.timer = setTimeout(() => { appState.search.lastSearchTime = now; runSearchNow(); }, wait + 400);
    }
    searchQuery.addEventListener('input', queueSearch);
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', () => {
            searchQuery.value = '';
            searchSource.clear();
            searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Enter a place or address to search.</div>';
            if (appState.search.abortController) appState.search.abortController.abort();
        });
    }
    searchLocate.addEventListener('click', () => {
        if (!('geolocation' in navigator)) { alert('Geolocation is not supported.'); return; }
        searchResults.innerHTML = '<div class="p-4 text-center text-sm text-gray-500">Locating...</div>';
        navigator.geolocation.getCurrentPosition(pos => {
            const center = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude]);
            searchSource.clear();
            searchSource.addFeature(new ol.Feature({ geometry: new ol.geom.Point(center) }));
            map.getView().animate({ center, duration: 500, zoom: Math.max(map.getView().getZoom() || 12, 16) });
            searchResults.innerHTML = '<div class="p-4 text-center text-sm text-green-600">Centered on your location.</div>';
        }, err => {
            searchResults.innerHTML = `<div class="p-4 text-center text-sm text-red-600">Could not get location: ${err.message}</div>`;
        });
    });

    // --- CSV Import/Export Functions ---
    const geoJsonFormat = new ol.format.GeoJSON();
    /**
 * Escapes a value for use in a CSV file.
 * @param {*} val - The value to escape.
 * @returns {string} - The escaped value.
 */
    function csvEscape(val) {
        if (val == null) return '';
        const s = String(val);
        if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
    }
    /**
 * Converts a feature to a CSV row.
 * @param {ol.Feature} f - The feature to convert.
 * @returns {string} - The CSV row.
 */
    function featureToCsvRow(f) {
        const geojson = JSON.stringify(geoJsonFormat.writeGeometryObject(f.getGeometry(), { featureProjection: 'EPSG:3857' }));
        return [f.getId() || '', f.getGeometry().getType(), f.get('label') || '', f.get('details') || '', f.get('color') || '#2563eb', f.get('img1') || '', f.get('img2') || '', geojson].map(csvEscape).join(',');
    }
    /**
 * Downloads the annotations as a GeoJSON file.
 */
    function downloadGeoJSON() {
        const format = new ol.format.GeoJSON();
        // Write as true GeoJSON in EPSG:4326 for GIS compatibility
        const featureCollection = format.writeFeaturesObject(
            researchSource.getFeatures(),
            { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' }
        );
        const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotations-${new Date().toISOString().replace(/[:.]/g, '-')}.geojson`;
        a.click();
        URL.revokeObjectURL(url);
    }
    /**
 * Parses a CSV line.
 * @param {string} line - The CSV line to parse.
 * @returns {Array<string>} - The parsed CSV line.
 */
    function parseCsvLine(line) {
        const out = []; let cur = ''; let i = 0; let inQ = false;
        while (i < line.length) {
            const ch = line[i++];
            if (inQ) { if (ch === '"') { if (i < line.length && line[i] === '"') { cur += '"'; i++; } else { inQ = false; } } else { cur += ch; } }
            else { if (ch === ',') { out.push(cur); cur = ''; } else if (ch === '"') { inQ = true; } else { cur += ch; } }
        }
        out.push(cur);
        return out;
    }
    /**
 * Imports annotations from a GeoJSON file.
 * @param {string} text - The content of the GeoJSON file.
 */
    function importGeoJSON(text) {
        let json;
        try { json = JSON.parse(text); } catch (_) { alert('Invalid GeoJSON file.'); return; }
        try {
            const format = new ol.format.GeoJSON();
            const feats = format.readFeatures(json, { dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857' });
            feats.forEach(f => { getOrAssignId(f); });
            researchSource.addFeatures(feats);
            refreshAnnoTable();
            queueSaveState();
        } catch (e) {
            console.error(e);
            alert('Failed to import GeoJSON.');
        }
    }
    /**
 * Imports annotations from a CSV file.
 * @param {string} text - The content of the CSV file.
 */
    function importCsv(text) {
        const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (!lines.length) return;
        const header = parseCsvLine(lines.shift()).map(h => h.trim().toLowerCase());
        const geojsonIndex = header.indexOf('geojson');
        if (geojsonIndex === -1) { alert("Import failed: CSV must contain a 'geojson' column."); return; }
        const colMap = { id: 'id', label: 'label', details: 'details', color: 'color', img1: 'img1', img2: 'img2' };
        for (const line of lines) {
            const cols = parseCsvLine(line);
            if (!cols[geojsonIndex]) continue;
            try {
                const geom = geoJsonFormat.readGeometry(JSON.parse(cols[geojsonIndex]), { featureProjection: 'EPSG:3857' });
                const feat = new ol.Feature({ geometry: geom });
                for (const prop in colMap) {
                    const idx = header.indexOf(prop);
                    if (idx !== -1 && cols[idx]) {
                        if (prop !== 'id') feat.set(prop, cols[idx]);
                    }
                }
                let id = cols[header.indexOf('id')]?.trim();
                if (id) feat.setId(id); else getOrAssignId(feat);
                researchSource.addFeature(feat);
            } catch (_) {}
        }
    }
    exportCsvBtn.addEventListener('click', downloadGeoJSON);
    importCsvBtn.addEventListener('click', () => importCsvInput.click());
    importCsvInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const text = String(reader.result || '');
            const name = (file.name || '').toLowerCase();
            if (name.endsWith('.geojson') || name.endsWith('.json') || /^\s*\{/.test(text)) {
                importGeoJSON(text);
            } else {
                importCsv(text);
            }
            importCsvInput.value = '';
        };
        reader.readAsText(file);
    });

    // --- Right-click & Utility Functions ---
    /**
 * Hides the coordinate menu.
 */
    function hideCoordMenu(){ if (coordMenu) coordMenu.classList.add('hidden'); }
    map.getViewport().addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const coord = map.getCoordinateFromPixel(map.getEventPixel(e));
        if (!coord) return;
        const [lon, lat] = ol.proj.toLonLat(coord, 'EPSG:3857');
        coordValue.textContent = `${lon.toFixed(6)}, ${lat.toFixed(6)}`;
        coordMenu.classList.remove('hidden');
        coordMenu.style.left = `${e.clientX + 4}px`;
        coordMenu.style.top = `${e.clientY + 4}px`;
    });
    /**
 * Copies a value to the clipboard.
 * @param {HTMLElement} el - The element that was clicked.
 * @param {string} val - The value to copy.
 */
    async function doCopy(el, val){
        if (!val || val === '—') return;
        await navigator.clipboard.writeText(val);
        const old = el.textContent;
        el.textContent = 'Copied!';
        setTimeout(() => el.textContent = old, 900);
    }
    coordCopy.addEventListener('click', () => doCopy(coordCopy, coordValue.textContent));
    coordValue.addEventListener('click', () => doCopy(coordValue, coordValue.textContent));
    coordClose.addEventListener('click', hideCoordMenu);
    document.addEventListener('pointerdown', (e) => { if (!coordMenu.classList.contains('hidden') && !coordMenu.contains(e.target)) hideCoordMenu(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hideCoordMenu(); closeMetaFn(); closeAnnoModal(); exitPresentation(); } });
    if (clearStateBtn) {
        clearStateBtn.addEventListener('click', () => {
            if (!confirm('Clear all saved data, maps, and reload? This cannot be undone.')) return;
            try {
                // Clear localStorage keys used by the app
                localStorage.removeItem(APP_STATE_KEY);
                localStorage.removeItem('vmaTourSeen');
            } catch(_) {}
            try { saveStateTimer && clearTimeout(saveStateTimer); } catch(_) {}

            // Clear annotations and story
            try { researchSource.clear(); } catch(_) {}
            try { appState.story.scenes = []; renderStoryPanel(); } catch(_) {}

            // Clear overlays and caches
            try { warpedMapLayer.clear(); } catch(_) {}
            try { warpedMapLayerB.clear(); } catch(_) {}
            try {
                appState.map.overlayCache = {};
                appState.map.overlayA = { id: null, mapId: null };
                appState.map.overlayB = { id: null, mapId: null };
                appState.map.currentMapId = null;
                appState.map.loadedOverlayId = null;
            } catch(_) {}

            // Reset compare and UI selections
            try {
                if (compareToggle) { compareToggle.checked = false; appState.map.compare.enabled = false; appState.map.compare.flip = false; }
                if (mapSelector) mapSelector.value = '';
                if (mapSelectorB) mapSelectorB.value = '';
                if (customMapIdInput) customMapIdInput.value = '';
                updateOverlayOrder?.();
                updateBasemapVisibility?.();
                updateClipPath?.();
                updateSwapButtonState?.();
                updateOpacityTargetNote?.();
            } catch(_) {}

            // Attempt to clear IndexedDB databases for this origin (best-effort)
            try {
                if (indexedDB && indexedDB.databases) {
                    indexedDB.databases().then(dbs => {
                        try { dbs.forEach(db => db && db.name && indexedDB.deleteDatabase(db.name)); } catch(_) {}
                    }).finally(() => setTimeout(() => location.reload(), 50));
                    return; // reload scheduled above
                }
            } catch(_) {}

            // Fallback reload
            setTimeout(() => location.reload(), 50);
        });
    }

    // --- Metadata Summary Renderer ---
    /**
 * Renders the metadata summary.
 * @param {object} annotation - The annotation to render the metadata for.
 * @param {ol.Feature} feature - The feature to render the metadata for.
 * @param {ol.Extent} extent3857 - The extent of the feature in EPSG:3857.
 */
    function renderMetadataSummary(annotation, feature, extent3857) {
      const props = annotation || {};
      const extent4326 = extent3857 ? ol.proj.transformExtent(extent3857, 'EPSG:3857', 'EPSG:4326') : null;
      const fmtDate = (d) => { try { return new Date(d).toLocaleString(); } catch { return d; } };
      const rows = [];
      const addRow = (k, v) => v && rows.push(`<div class="font-semibold text-gray-600">${k}</div><div class="break-words">${v}</div>`);
      addRow('Type', props.type);
      addRow('Created', fmtDate(props.created));
      if (props.resource?.id) addRow('Resource', `<a class="text-indigo-600 hover:underline" href="${escHtml(props.resource.id)}" target="_blank">${escHtml(props.resource.id)}</a>`);
      if (props.resource?.width) addRow('Dimensions', `${props.resource.width} x ${props.resource.height} px`);
      if (extent4326) addRow('Extent (lon/lat)', `${extent4326[0].toFixed(4)}, ${extent4326[1].toFixed(4)} → ${extent4326[2].toFixed(4)}, ${extent4326[3].toFixed(4)}`);
      metaSummary.innerHTML = `<div class="grid grid-cols-[max-content,1fr] gap-x-4 gap-y-2">${rows.join('')}</div>`;
    }

    // --- State Persistence ---
    /**
 * Saves the app state to local storage.
 */
    function saveAppState() {
        try {
            const state = {
                basemap: basemapSel.value,
                overlayId: appState.map.loadedOverlayId,
                view: {
                    ...appState.map.view,
                    opacity: parseFloat(opacityRange.value)
                },
                mapView: {
                    center: map.getView().getCenter(),
                    zoom: map.getView().getZoom(),
                    rotation: map.getView().getRotation()
                },
                annotations: geoJsonFormat.writeFeaturesObject(researchSource.getFeatures(), { featureProjection: 'EPSG:3857' }),
                story: appState.story.scenes
            };
            localStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.error("Failed to save app state:", e);
        }
    }
    let saveStateTimer = null;
    /**
 * Queues a save of the app state.
 */
    function queueSaveState() {
        if (saveStateTimer) clearTimeout(saveStateTimer);
        saveStateTimer = setTimeout(saveAppState, 1000);
    }
    // Ensure state is flushed on page unload
    window.addEventListener('beforeunload', () => {
        try { if (saveStateTimer) { clearTimeout(saveStateTimer); saveAppState(); } } catch(_) {}
    });
    /**
 * Loads the app state from local storage.
 */
    async function loadAppState() {
        const savedStateJSON = localStorage.getItem(APP_STATE_KEY);
        if (!savedStateJSON) return;
        try {
            const state = JSON.parse(savedStateJSON);
            if (state.mapView) map.getView().setProperties(state.mapView);
            if (state.annotations) researchSource.addFeatures(new ol.format.GeoJSON().readFeatures(state.annotations, { featureProjection: 'EPSG:3857' }));
            if (state.story) appState.story.scenes = state.story;
            if (state.basemap) { setBasemap(state.basemap); basemapSel.value = state.basemap; }
            if (state.view) {
                appState.map.view.sideRatio = state.view.sideRatio || 0.5;
                appState.map.view.lensRadius = state.view.lensRadius || 150;
                setMode(state.view.mode || 'overlay');
                const opacity = state.view.opacity || 0.8;
                opacityRange.value = opacity;
                opLabel.textContent = `${Math.round(opacity * 100)}%`;
            }
            if (state.overlayId) {
                mapSelector.value = state.overlayId;
                await loadAllmaps(state.overlayId);
                if (state.view?.opacity && appState.map.currentMapId) {
                    warpedMapLayer.setMapOpacity(appState.map.currentMapId, state.view.opacity);
                }
            }
        } catch (e) {
            console.error("Failed to load app state:", e);
            localStorage.removeItem(APP_STATE_KEY);
        }
    }

    // --- App Initialization ---
    /**
 * Populates the map selector.
 * @param {string} [filterType='all'] - The type of maps to show.
 */
    function populateMapSelector(filterType = 'all') {
        const filteredMaps = filterType === 'all'
            ? allMapsData
            : allMapsData.filter(m => m.type === filterType);

        mapSelector.innerHTML = '<option value="" disabled selected>Select a map from the list...</option>';
        filteredMaps.forEach(map => {
            const option = document.createElement('option');
            option.value = map.id;
            option.textContent = map.name;
            mapSelector.appendChild(option);
        });
    }

    /**
 * Populates the type filter.
 */
    function populateTypeFilter() {
        const typeCounts = allMapsData.reduce((counts, map) => {
            if (map.type) {
                counts[map.type] = (counts[map.type] || 0) + 1;
            }
            return counts;
        }, {});

        const sortedTypes = Object.keys(typeCounts).sort();

        mapTypeFilter.innerHTML = `<option value="all" selected>All Types (${allMapsData.length})</option>`;
        sortedTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = `${type} (${typeCounts[type]})`;
            mapTypeFilter.appendChild(option);
        });
    }

    /**
 * Loads and parses the map dataset.
 */
    async function loadAndParseMapDataset() {
      const googleSheetUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQivs6N80xA_Pgs0J8MMMTGcH4YLzjhhyxPUoMcoQTxHjUyRXo5FMOICXDSxayDcLYisABkoqvXiIiA/pub?gid=0&single=true&output=csv';
      try {
        const response = await fetch(googleSheetUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        const lines = csvText.trim().split(/\r?\n/);
        const header = lines.shift().split(',').map(h => h.trim().toLowerCase());
        const nameIndex = header.indexOf('name');
        const idIndex = header.indexOf('id');
        const typeIndex = header.indexOf('type');
        if (nameIndex === -1 || idIndex === -1) throw new Error("CSV must have 'name' and 'id' columns.");

        allMapsData = lines.map(line => {
          const values = line.match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g) || [];
          const name = (values[nameIndex] || '').replace(/"/g, '').trim();
          const id = (values[idIndex] || '').replace(/"/g, '').trim();
          const type = typeIndex > -1 ? (values[typeIndex] || '').replace(/"/g, '').trim() : 'Uncategorized';
          return (name && id) ? { name, id, type } : null;
        }).filter(Boolean);

        populateTypeFilter();
        populateMapSelector('all');
      } catch (error) {
        console.error("Could not load map dataset:", error);
        if (statusEl) {
          statusEl.textContent = 'Failed to load map list.';
          statusEl.classList.add('text-red-600');
        }
      }
    }
    /**
 * Loads a map from the URL or the default map.
 */
    async function loadFromUrlOrDefault() {
        const qid = new URL(location.href).searchParams.get('id');
        if (qid && qid !== appState.map.loadedOverlayId) {
            mapSelector.value = qid;
            await loadAllmaps(qid);
            return;
        }
        if (!appState.map.loadedOverlayId) {
            const firstMapId = mapSelector.options[1]?.value;
            if (firstMapId) {
                mapSelector.value = firstMapId;
                await loadAllmaps(firstMapId);
            }
        }
    }

    // --- Initial Run ---
    updateSidebar(false);
    showTab('Map');
    loadAndParseMapDataset().then(() => loadAppState()).then(() => loadFromUrlOrDefault()).then(() => {
        refreshAnnoTable(); renderStoryPanel();
    }).catch(console.error);
