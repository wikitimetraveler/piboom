# 3D Graphic Artist — library reference

## CDN snippets (brownfield)

Three.js (global build):

```html
<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
  }
}
</script>
<script type="module" src="/path/to/scene.js"></script>
```

GSAP (matches HyperFrame video pages):

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
```

## In-repo anchors

| Pattern | Path |
| --- | --- |
| WebGL2 shader atmosphere | `public/shared/js/ice-ocean-scene.js` |
| WebGL2 auth gate | `public/shared/js/finance-fire-gate.js` |
| GSAP HyperFrame shells | `video/*/index.html` |
| CSS 3D product flips | `public/donuts/css/donuts.css`, `public/donuts/js/donuts-gallery.js` |
| Highlight reel hooks | `public/donuts/js/donuts-story-reel.js` |

## Asset guidance

- Prefer **GLB** over OBJ/FBX in browser.
- Texture sizes: 1k–2k max for hero props; power-of-two when mipmaps matter.
- Keep alpha textures simple; test on dark bakery / Lane backgrounds.
- For Pip / product likeness: start with existing PNGs as `THREE.Texture` planes before commissioning models.

## Teardown checklist

1. `cancelAnimationFrame`
2. `renderer.dispose()`
3. Traverse scene: `geometry.dispose()`, `material.dispose()`, map textures dispose
4. Remove canvas from DOM
5. Kill GSAP tweens targeting the scene (`gsap.killTweensOf(...)`)
