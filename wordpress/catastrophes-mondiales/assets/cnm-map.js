(function () {
    "use strict";

    // Ordre et libellés calqués sur le menu demandé (worldnaturaldisasters.com), en français.
    var CATEGORY_ORDER = [
        "seisme", "feu", "inondation", "tsunami", "tempete", "cyclone", "tornade",
        "volcan", "glissement", "avalanche", "secheresse", "chaleur", "froid",
        "pluie", "submersion", "meteo_extreme", "autre"
    ];
    var CATEGORY_META = {
        seisme: { label: "Séisme", color: "#c0392b" },
        feu: { label: "Feu de forêt", color: "#e67e22" },
        inondation: { label: "Inondation", color: "#16a085" },
        tsunami: { label: "Tsunami", color: "#1abc9c" },
        tempete: { label: "Tempête sévère", color: "#2980b9" },
        cyclone: { label: "Ouragan / Cyclone / Typhon", color: "#2471a3" },
        tornade: { label: "Tornade", color: "#5b2c6f" },
        volcan: { label: "Activité volcanique", color: "#8e44ad" },
        glissement: { label: "Glissement de terrain", color: "#6e4b2a" },
        avalanche: { label: "Avalanche", color: "#5dade2" },
        secheresse: { label: "Sécheresse", color: "#b7950b" },
        chaleur: { label: "Vague de chaleur", color: "#d35400" },
        froid: { label: "Vague de froid", color: "#5499c7" },
        pluie: { label: "Fortes pluies", color: "#1f618d" },
        submersion: { label: "Onde de tempête", color: "#117864" },
        meteo_extreme: { label: "Conditions météo extrêmes", color: "#85929e" },
        autre: { label: "Autre risque", color: "#7f8c8d" }
    };

    function categoryMeta(cat) {
        return CATEGORY_META[cat] || CATEGORY_META.autre;
    }

    function clusterSizeClass(count) {
        if (count >= 25) return "cnm-cluster-large";
        if (count >= 10) return "cnm-cluster-medium";
        return "cnm-cluster-small";
    }

    function markerRadius(event) {
        if (event.category === "seisme" && event.magnitude) {
            return Math.max(4, event.magnitude * 2.2);
        }
        return 7;
    }

    function formatDate(iso) {
        if (!iso) return "date inconnue";
        var d = new Date(iso);
        if (isNaN(d.getTime())) return "date inconnue";
        return d.toLocaleString("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    function initMap(root) {
        var mapEl = root.querySelector("[data-cnm-map]");
        var loadingEl = root.querySelector("[data-cnm-loading]");
        var errorEl = root.querySelector("[data-cnm-error]");
        var updatedEl = root.querySelector("[data-cnm-updated]");
        var countEl = root.querySelector("[data-cnm-count]");
        var toolbarEl = root.querySelector("[data-cnm-toolbar]");
        var viewportEl = root.querySelector(".cnm-viewport");
        var fullscreenBtn = root.querySelector("[data-cnm-fullscreen]");
        var dataUrl = root.getAttribute("data-data-url");
        var presetCategories = (root.getAttribute("data-categories") || "")
            .split(",")
            .map(function (c) { return c.trim(); })
            .filter(Boolean);

        var map = L.map(mapEl, { worldCopyJump: true }).setView([20, 10], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: "© OpenStreetMap",
            maxZoom: 12
        }).addTo(map);

        function resyncMapSize() {
            map.invalidateSize();
            map.setView([20, 10], map.getZoom());
        }
        // Le conteneur peut ne pas avoir sa largeur finale au moment de l'init
        // (mise en page du thème, polices, colonnes flex) : on recale la carte
        // une fois le rendu stabilisé, puis à chaque redimensionnement.
        setTimeout(resyncMapSize, 150);
        setTimeout(resyncMapSize, 800);
        window.addEventListener("resize", resyncMapSize);

        var layerGroup = L.markerClusterGroup({
            maxClusterRadius: 55,
            iconCreateFunction: function (cluster) {
                var count = cluster.getChildCount();
                var size = count >= 25 ? 44 : count >= 10 ? 38 : 32;
                return L.divIcon({
                    html: '<div class="cnm-cluster-icon ' + clusterSizeClass(count) + '" style="width:' + size + 'px;height:' + size + 'px">' + count + '</div>',
                    className: "cnm-cluster-wrapper",
                    iconSize: L.point(size, size)
                });
            }
        }).addTo(map);
        var activeFilters = null;
        var allEvents = [];

        function isFullscreen() {
            return document.fullscreenElement === viewportEl;
        }

        function updateFullscreenBtn() {
            if (!fullscreenBtn) return;
            var active = isFullscreen();
            fullscreenBtn.textContent = active ? "✕" : "⛶";
            fullscreenBtn.title = active ? "Quitter le plein écran" : "Plein écran";
            fullscreenBtn.setAttribute("aria-label", fullscreenBtn.title);
        }

        if (fullscreenBtn && viewportEl) {
            if (!viewportEl.requestFullscreen && !viewportEl.webkitRequestFullscreen) {
                fullscreenBtn.hidden = true;
            } else {
                fullscreenBtn.addEventListener("click", function () {
                    if (isFullscreen()) {
                        if (document.exitFullscreen) document.exitFullscreen();
                        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                    } else if (viewportEl.requestFullscreen) {
                        viewportEl.requestFullscreen();
                    } else if (viewportEl.webkitRequestFullscreen) {
                        viewportEl.webkitRequestFullscreen();
                    }
                });
                ["fullscreenchange", "webkitfullscreenchange"].forEach(function (evt) {
                    document.addEventListener(evt, function () {
                        updateFullscreenBtn();
                        setTimeout(function () { map.invalidateSize(); }, 50);
                    });
                });
            }
        }

        function renderMarkers() {
            layerGroup.clearLayers();
            var shown = 0;
            allEvents.forEach(function (event) {
                if (activeFilters && activeFilters.indexOf(event.category) === -1) {
                    return;
                }
                var meta = categoryMeta(event.category);
                var marker = L.circleMarker([event.lat, event.lon], {
                    radius: markerRadius(event),
                    color: meta.color,
                    fillColor: meta.color,
                    fillOpacity: 0.65,
                    weight: 1.5
                });
                var lines = [
                    "<strong>" + escapeHtml(event.title) + "</strong>",
                    meta.label + (event.magnitude ? " • M " + event.magnitude.toFixed(1) : ""),
                    formatDate(event.date)
                ];
                if (event.url) {
                    lines.push('<a href="' + event.url + '" target="_blank" rel="noopener noreferrer">Détails →</a>');
                }
                marker.bindPopup('<div class="cnm-popup">' + lines.join("<br>") + "</div>");
                marker.addTo(layerGroup);
                shown++;
            });
            if (countEl) {
                countEl.textContent = shown + " événement(s) affiché(s) sur " + allEvents.length;
            }
        }

        function escapeHtml(str) {
            var div = document.createElement("div");
            div.textContent = str || "";
            return div.innerHTML;
        }

        function buildToolbar(allCategories, counts) {
            if (!toolbarEl) return;
            toolbarEl.innerHTML = "";
            var buttons = {};

            function setAllActive(active) {
                activeFilters = active ? null : [];
                Object.keys(buttons).forEach(function (cat) {
                    buttons[cat].classList.toggle("is-active", active);
                });
                allBtn.classList.toggle("is-active", active);
            }

            var allBtn = document.createElement("button");
            allBtn.type = "button";
            allBtn.className = "is-active cnm-toolbar-all";
            allBtn.textContent = "Tous les risques";
            allBtn.addEventListener("click", function () { setAllActive(true); renderMarkers(); });
            toolbarEl.appendChild(allBtn);

            allCategories.forEach(function (cat) {
                var meta = categoryMeta(cat);
                var count = counts[cat] || 0;
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "is-active" + (count === 0 ? " is-empty" : "");
                btn.dataset.category = cat;
                btn.innerHTML = '<span class="cnm-dot" style="background:' + meta.color + '"></span>' +
                    meta.label + ' <span class="cnm-count">(' + count + ')</span>';
                btn.addEventListener("click", function () {
                    if (activeFilters === null) {
                        activeFilters = allCategories.slice();
                    }
                    var isActive = btn.classList.toggle("is-active");
                    if (isActive) {
                        if (activeFilters.indexOf(cat) === -1) activeFilters.push(cat);
                    } else {
                        activeFilters = activeFilters.filter(function (c) { return c !== cat; });
                    }
                    allBtn.classList.toggle("is-active", activeFilters.length === allCategories.length);
                    renderMarkers();
                });
                buttons[cat] = btn;
                toolbarEl.appendChild(btn);
            });
        }

        fetch(dataUrl, { cache: "no-store" })
            .then(function (resp) {
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                return resp.json();
            })
            .then(function (data) {
                allEvents = (data.events || []).filter(function (e) {
                    return typeof e.lat === "number" && typeof e.lon === "number";
                });
                if (presetCategories.length) {
                    allEvents = allEvents.filter(function (e) {
                        return presetCategories.indexOf(e.category) !== -1;
                    });
                }
                var counts = {};
                allEvents.forEach(function (e) {
                    counts[e.category] = (counts[e.category] || 0) + 1;
                });
                var categoryList = presetCategories.length
                    ? CATEGORY_ORDER.filter(function (c) { return presetCategories.indexOf(c) !== -1; })
                    : CATEGORY_ORDER;
                buildToolbar(categoryList, counts);
                renderMarkers();

                if (updatedEl) {
                    updatedEl.textContent = data.generated_at
                        ? "Dernière mise à jour : " + formatDate(data.generated_at)
                        : "Mise à jour inconnue";
                }
                if (loadingEl) loadingEl.hidden = true;
            })
            .catch(function (err) {
                if (loadingEl) loadingEl.hidden = true;
                if (errorEl) {
                    errorEl.hidden = false;
                    errorEl.textContent = "Impossible de charger les données (" + err.message + ").";
                }
            });
    }

    function init() {
        document.querySelectorAll("[data-cnm-app]").forEach(initMap);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
