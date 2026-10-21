# SnapCravings: installable web version (PWA)
Static files only; no build step. `index.html` is the prototype byte-for-byte plus head tags (manifest, icons, theme color) and a hidden camera input; no CSS or copy changed.
Local test: `cd web && python3 -m http.server 8080` then open http://localhost:8080 (service workers need https or localhost).
Deploy: see mobile-build-plan.md, section "Web version right away". Not deployed.
