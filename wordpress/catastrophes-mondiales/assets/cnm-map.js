(function () {
    "use strict";

    var CATEGORY_META = {
        seisme: { label: "Séismes", color: "#c0392b" },
        feu: { label: "Feux de forêt", color: "#e67e22" },
        tempete: { label: "Tempêtes", color: "#2980b9" },
        volcan: { label: "Volcans", color: "#8e44ad" },
        inondation: { label: "Inondations", color: "#16a085" },
        secheresse: { label: "Sécheresses", color: "#b7950b" },
        glace: { label: "Glace", color: "#5dade2" },
        glissement: { label: "Glissements de terrain", color: "#6e4b2a" },
        neige: { label: "Neige", color: "#85929e" },
        temperature: { label: "Températures extrêmes", color: "#d35400" },
        poussiere: { label: "Poussière / brume", color: "#a1887f" },
        autre: { label: "Autres", color: "#7f8c8d" }
    };

    function categoryMeta(cat) {
        return CATEGORY_META[cat] || CATEGORY_META.autre;
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

        var layerGroup = L.layerGroup().addTo(map);
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

        function buildToolbar(categoriesPresent) {
            if (!toolbarEl) return;
            toolbarEl.innerHTML = "";
            categoriesPresent.forEach(function (cat) {
                var meta = categoryMeta(cat);
                var btn = document.createElement("button");
                btn.type = "button";
                btn.className = "is-active";
                btn.dataset.category = cat;
                btn.innerHTML = '<span class="cnm-dot" style="background:' + meta.color + '"></span>' + meta.label;
                btn.addEventListener("click", function () {
                    var isActive = btn.classList.toggle("is-active");
                    if (!activeFilters) {
                        activeFilters = categoriesPresent.slice();
                    }
                    if (isActive) {
                        if (activeFilters.indexOf(cat) === -1) activeFilters.push(cat);
                    } else {
                        activeFilters = activeFilters.filter(function (c) { return c !== cat; });
                    }
                    renderMarkers();
                });
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
                var categoriesPresent = [];
                allEvents.forEach(function (e) {
                    if (categoriesPresent.indexOf(e.category) === -1) {
                        categoriesPresent.push(e.category);
                    }
                });
                buildToolbar(categoriesPresent);
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
