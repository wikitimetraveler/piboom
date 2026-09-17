/**
 * Dinosaur Hall — procedural Three.js Mesozoic diorama.
 * Named bones, skeleton view, walk/bone-tour simulations, era restage.
 * Development work by David Lane
 */
(function () {
  'use strict';

  const HUMAN_HEIGHT_M = 1.75;
  const BONE_HIGHLIGHT = 0xf0c14a;

  let renderer;
  let scene;
  let camera;
  let raf = 0;
  let running = false;
  let reduced = false;
  let mount;
  let canvas;
  let raycaster;
  let pointer = { x: 0, y: 0 };
  let faunaGroup;
  let ground;
  let water;
  let ambient;
  let keyLight;
  let fillLight;
  let fog;
  let humanSilhouette;
  let speciesIndex = new Map();
  let activeEra = 'jurassic';
  let selectedId = null;
  let camTween = null;
  let homeCam = { x: 0, y: 4.5, z: 18 };
  let idleT = 0;
  let onSelectCb = null;
  let onBoneCb = null;
  let speciesData = [];
  let erasData = [];
  let disposed = false;
  let skeletonMode = false;
  let simMode = null; // null | 'walk' | 'bones'
  let simBoneIndex = 0;
  let simBoneTimer = 0;
  let highlightedBone = null;

  function prefersReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function makeMat(THREE, params) {
    return new THREE.MeshStandardMaterial(params);
  }

  function addBone(THREE, parent, geo, mat, boneName, x, y, z) {
    const mesh = new THREE.Mesh(geo, mat.clone ? mat.clone() : mat);
    // Always clone so highlight/skeleton can mutate per-mesh
    if (!mat.clone) {
      /* MeshStandardMaterial always has clone */
    }
    mesh.material = mat.clone();
    mesh.position.set(x || 0, y || 0, z || 0);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.boneName = boneName;
    mesh.userData.baseColor = mesh.material.color.getHex();
    mesh.userData.baseEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0;
    parent.add(mesh);
    if (!parent.userData.bones) parent.userData.bones = [];
    if (boneName && !parent.userData.bones.includes(boneName)) {
      parent.userData.bones.push(boneName);
    }
    return mesh;
  }

  function scaleGroupToLength(group, lengthM) {
    const target = Math.max(0.4, lengthM * 0.22);
    group.scale.setScalar(target);
    return group;
  }

  function buildTheropod(THREE, mats, opts) {
    const g = new THREE.Group();
    g.userData.bones = [];
    const body = addBone(THREE, g, new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), mats.body, 'dorsal vertebrae', 0, 0.85, 0);
    body.rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.SphereGeometry(0.22, 10, 10), mats.body, 'skull', 0.55, 1.05, 0);
    addBone(THREE, g, new THREE.ConeGeometry(0.1, 0.35, 8), mats.accent, 'mandible', 0.78, 0.95, 0).rotation.z = -Math.PI / 2;
    addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.55, 3, 6), mats.body, 'caudal vertebrae', -0.55, 0.75, 0).rotation.z = Math.PI / 2;
    const femurR = addBone(THREE, g, new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), mats.leg, 'right femur', 0.1, 0.35, 0.12);
    const femurL = addBone(THREE, g, new THREE.CapsuleGeometry(0.07, 0.45, 3, 6), mats.leg, 'left femur', 0.1, 0.35, -0.12);
    g.userData.legBones = [femurR, femurL];
    if (opts && opts.smallArms) {
      addBone(THREE, g, new THREE.CapsuleGeometry(0.04, 0.18, 2, 6), mats.accent, 'right humerus', 0.25, 0.95, 0.18).rotation.z = 0.6;
      addBone(THREE, g, new THREE.CapsuleGeometry(0.04, 0.18, 2, 6), mats.accent, 'left humerus', 0.25, 0.95, -0.18).rotation.z = 0.6;
    } else {
      addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.28, 2, 6), mats.accent, 'right humerus', 0.2, 0.95, 0.2).rotation.z = 0.5;
      addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.28, 2, 6), mats.accent, 'left humerus', 0.2, 0.95, -0.2).rotation.z = 0.5;
    }
    addBone(THREE, g, new THREE.BoxGeometry(0.35, 0.12, 0.4), mats.accent, 'pelvis', -0.05, 0.7, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.25, 0.1, 0.35), mats.accent, 'scapula', 0.2, 1.0, 0);
    return g;
  }

  function buildSauropod(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.45, 1.1, 4, 10), mats.body, 'dorsal vertebrae', 0, 1.1, 0).rotation.z = Math.PI / 2;
    const neck = addBone(THREE, g, new THREE.CapsuleGeometry(0.12, 1.4, 3, 8), mats.body, 'cervical vertebrae', 0.95, 1.8, 0);
    neck.rotation.z = -0.85;
    addBone(THREE, g, new THREE.SphereGeometry(0.18, 8, 8), mats.body, 'skull', 1.55, 2.55, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.1, 1.6, 3, 8), mats.body, 'caudal vertebrae', -1.1, 0.95, 0).rotation.z = 0.35;
    const legs = [];
    [
      [0.35, 0.22, 'right femur'],
      [0.35, -0.22, 'left femur'],
      [-0.35, 0.22, 'right tibia'],
      [-0.35, -0.22, 'left tibia']
    ].forEach(([x, z, name]) => {
      legs.push(addBone(THREE, g, new THREE.CapsuleGeometry(0.1, 0.7, 3, 6), mats.leg, name, x, 0.45, z));
    });
    g.userData.legBones = legs;
    addBone(THREE, g, new THREE.BoxGeometry(0.5, 0.2, 0.55), mats.accent, 'pelvis', -0.2, 0.95, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.4, 0.18, 0.5), mats.accent, 'scapula', 0.35, 1.15, 0);
    return g;
  }

  function buildStegosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.35, 1.0, 4, 10), mats.body, 'dorsal vertebrae', 0, 0.85, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.SphereGeometry(0.16, 8, 8), mats.body, 'skull', 0.7, 0.75, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.7, 3, 6), mats.body, 'caudal vertebrae', -0.75, 0.7, 0).rotation.z = 0.2;
    for (let i = 0; i < 6; i += 1) {
      const plate = addBone(THREE, g, new THREE.BoxGeometry(0.04, 0.35, 0.28), mats.accent, 'dermal plate', 0.4 - i * 0.18, 1.25, (i % 2) * 0.08);
      plate.rotation.y = 0.15;
    }
    addBone(THREE, g, new THREE.ConeGeometry(0.05, 0.28, 6), mats.accent, 'thagomizer spike', -1.05, 0.85, 0.12);
    addBone(THREE, g, new THREE.ConeGeometry(0.05, 0.28, 6), mats.accent, 'thagomizer spike', -1.05, 0.85, -0.12);
    const legs = [];
    [
      [0.3, 0.18, 'right femur'],
      [0.3, -0.18, 'left femur'],
      [-0.25, 0.18, 'right tibia'],
      [-0.25, -0.18, 'left tibia']
    ].forEach(([x, z, name]) => {
      legs.push(addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.45, 3, 6), mats.leg, name, x, 0.35, z));
    });
    g.userData.legBones = legs;
    addBone(THREE, g, new THREE.BoxGeometry(0.4, 0.14, 0.45), mats.accent, 'pelvis', -0.1, 0.7, 0);
    return g;
  }

  function buildCeratopsian(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.38, 0.9, 4, 10), mats.body, 'dorsal vertebrae', 0, 0.9, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.SphereGeometry(0.28, 10, 10), mats.body, 'skull', 0.65, 1.0, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.08, 0.55, 0.7), mats.accent, 'parietal frill', 0.45, 1.25, 0);
    addBone(THREE, g, new THREE.ConeGeometry(0.06, 0.35, 6), mats.accent, 'nasal horn', 0.9, 1.15, 0).rotation.z = -Math.PI / 2;
    addBone(THREE, g, new THREE.ConeGeometry(0.04, 0.22, 6), mats.accent, 'right brow horn', 0.72, 1.2, 0.18).rotation.z = -0.9;
    addBone(THREE, g, new THREE.ConeGeometry(0.04, 0.22, 6), mats.accent, 'left brow horn', 0.72, 1.2, -0.18).rotation.z = -0.9;
    const legs = [];
    [
      [0.3, 0.2, 'right femur'],
      [0.3, -0.2, 'left femur'],
      [-0.3, 0.2, 'right tibia'],
      [-0.3, -0.2, 'left tibia']
    ].forEach(([x, z, name]) => {
      legs.push(addBone(THREE, g, new THREE.CapsuleGeometry(0.09, 0.5, 3, 6), mats.leg, name, x, 0.4, z));
    });
    g.userData.legBones = legs;
    addBone(THREE, g, new THREE.BoxGeometry(0.4, 0.16, 0.5), mats.accent, 'pelvis', -0.1, 0.75, 0);
    return g;
  }

  function buildHadrosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.32, 0.95, 4, 10), mats.body, 'dorsal vertebrae', 0, 0.95, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.SphereGeometry(0.2, 8, 8), mats.body, 'skull', 0.65, 1.15, 0);
    addBone(THREE, g, new THREE.CylinderGeometry(0.05, 0.08, 0.45, 8), mats.accent, 'cranial crest', 0.7, 1.55, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.1, 0.8, 3, 6), mats.body, 'caudal vertebrae', -0.7, 0.75, 0).rotation.z = 0.25;
    const legs = [];
    [
      [0.25, 0.15, 'right femur'],
      [0.25, -0.15, 'left femur'],
      [-0.2, 0.15, 'right tibia'],
      [-0.2, -0.15, 'left tibia']
    ].forEach(([x, z, name]) => {
      legs.push(addBone(THREE, g, new THREE.CapsuleGeometry(0.07, 0.5, 3, 6), mats.leg, name, x, 0.4, z));
    });
    g.userData.legBones = legs;
    addBone(THREE, g, new THREE.BoxGeometry(0.35, 0.14, 0.4), mats.accent, 'pelvis', -0.05, 0.75, 0);
    return g;
  }

  function buildAnkylosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.4, 0.85, 4, 10), mats.body, 'dorsal vertebrae', 0, 0.7, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.SphereGeometry(0.22, 8, 8), mats.body, 'skull', 0.6, 0.65, 0);
    for (let i = 0; i < 5; i += 1) {
      addBone(THREE, g, new THREE.BoxGeometry(0.2, 0.08, 0.25), mats.accent, 'osteoderm', 0.3 - i * 0.2, 1.0, 0);
    }
    addBone(THREE, g, new THREE.SphereGeometry(0.18, 8, 8), mats.accent, 'tail club', -0.95, 0.55, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.55, 3, 6), mats.body, 'caudal vertebrae', -0.55, 0.55, 0).rotation.z = Math.PI / 2;
    const legs = [];
    [
      [0.28, 0.2, 'right femur'],
      [0.28, -0.2, 'left femur'],
      [-0.25, 0.2, 'right tibia'],
      [-0.25, -0.2, 'left tibia']
    ].forEach(([x, z, name]) => {
      legs.push(addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.35, 3, 6), mats.leg, name, x, 0.28, z));
    });
    g.userData.legBones = legs;
    addBone(THREE, g, new THREE.BoxGeometry(0.4, 0.14, 0.45), mats.accent, 'pelvis', -0.05, 0.55, 0);
    return g;
  }

  function buildPterosaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.1, 0.45, 3, 8), mats.body, 'dorsal vertebrae', 0, 1.8, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.ConeGeometry(0.06, 0.4, 6), mats.accent, 'skull', 0.4, 1.9, 0).rotation.z = -Math.PI / 2;
    addBone(THREE, g, new THREE.BoxGeometry(0.05, 0.35, 0.12), mats.accent, 'cranial crest', -0.05, 2.15, 0);
    const wingL = addBone(THREE, g, new THREE.BoxGeometry(1.4, 0.04, 0.45), mats.wing, 'left wing finger', 0, 1.85, 0.55);
    wingL.rotation.x = 0.15;
    const wingR = addBone(THREE, g, new THREE.BoxGeometry(1.4, 0.04, 0.45), mats.wing, 'right wing finger', 0, 1.85, -0.55);
    wingR.rotation.x = -0.15;
    g.userData.wingBones = [wingL, wingR];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.04, 0.25, 2, 6), mats.leg, 'humerus', 0.1, 1.75, 0);
    addBone(THREE, g, new THREE.BoxGeometry(0.2, 0.08, 0.15), mats.accent, 'pelvis', -0.15, 1.7, 0);
    return g;
  }

  function buildMosasaur(THREE, mats) {
    const g = new THREE.Group();
    g.userData.bones = [];
    addBone(THREE, g, new THREE.CapsuleGeometry(0.28, 1.4, 4, 10), mats.body, 'dorsal vertebrae', 0, 0.35, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.ConeGeometry(0.18, 0.45, 8), mats.body, 'skull', 0.95, 0.4, 0).rotation.z = -Math.PI / 2;
    addBone(THREE, g, new THREE.BoxGeometry(0.35, 0.04, 0.2), mats.accent, 'right paddle', 0.2, 0.25, 0.28);
    addBone(THREE, g, new THREE.BoxGeometry(0.35, 0.04, 0.2), mats.accent, 'left paddle', 0.2, 0.25, -0.28);
    addBone(THREE, g, new THREE.BoxGeometry(0.35, 0.45, 0.05), mats.accent, 'caudal fin', -1.0, 0.45, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.12, 0.7, 3, 6), mats.body, 'caudal vertebrae', -0.55, 0.35, 0).rotation.z = Math.PI / 2;
    addBone(THREE, g, new THREE.BoxGeometry(0.25, 0.12, 0.3), mats.accent, 'pelvis', -0.1, 0.3, 0);
    return g;
  }

  function buildHuman(THREE, mats) {
    const g = new THREE.Group();
    addBone(THREE, g, new THREE.CapsuleGeometry(0.08, 0.35, 3, 6), mats.human, 'torso', 0, 0.95, 0);
    addBone(THREE, g, new THREE.SphereGeometry(0.09, 8, 8), mats.human, 'head', 0, 1.25, 0);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.4, 2, 6), mats.human, 'right leg', 0, 0.45, 0.06);
    addBone(THREE, g, new THREE.CapsuleGeometry(0.05, 0.4, 2, 6), mats.human, 'left leg', 0, 0.45, -0.06);
    g.userData.isHuman = true;
    return g;
  }

  function matsFor(THREE, isDino) {
    return {
      body: makeMat(THREE, {
        color: isDino ? 0x6b7a4a : 0x4a6a7a,
        roughness: 0.78,
        metalness: 0.05
      }),
      accent: makeMat(THREE, {
        color: isDino ? 0xa87838 : 0x3a8a8e,
        roughness: 0.65,
        metalness: 0.08
      }),
      leg: makeMat(THREE, { color: 0x4a5538, roughness: 0.85, metalness: 0.02 }),
      wing: makeMat(THREE, {
        color: 0x5a7080,
        roughness: 0.7,
        metalness: 0.04,
        transparent: true,
        opacity: 0.85
      }),
      human: makeMat(THREE, { color: 0x2a3038, roughness: 0.9, metalness: 0 })
    };
  }

  function applySkeletonLook(creature, on) {
    if (!creature) return;
    creature.traverse((obj) => {
      if (!obj.isMesh || !obj.material || obj.userData.isHuman) return;
      if (on) {
        obj.material.color.setHex(0xe8dcc8);
        obj.material.emissive?.setHex(0x222018);
        obj.material.roughness = 0.55;
        obj.material.metalness = 0.12;
        if (obj.material.transparent) obj.material.opacity = 0.95;
      } else {
        obj.material.color.setHex(obj.userData.baseColor || 0x6b7a4a);
        obj.material.emissive?.setHex(0x000000);
        obj.material.roughness = 0.78;
        obj.material.metalness = 0.05;
      }
    });
  }

  function clearBoneHighlight(creature) {
    if (!creature) return;
    creature.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      if (skeletonMode) {
        obj.material.emissive?.setHex(0x222018);
      } else {
        obj.material.emissive?.setHex(0x000000);
        if (obj.userData.baseColor != null) obj.material.color.setHex(obj.userData.baseColor);
      }
    });
    highlightedBone = null;
  }

  function highlightBone(speciesId, boneName) {
    const creature = speciesIndex.get(speciesId);
    if (!creature || !boneName) return false;
    clearBoneHighlight(creature);
    let found = false;
    creature.traverse((obj) => {
      if (!obj.isMesh || obj.userData.boneName !== boneName) return;
      found = true;
      obj.material.emissive?.setHex(BONE_HIGHLIGHT);
      obj.material.emissiveIntensity = 0.65;
    });
    if (found) {
      highlightedBone = boneName;
      if (onBoneCb) onBoneCb(boneName, speciesId);
      const status = document.getElementById('dhStageStatus');
      if (status) status.textContent = `Bone: ${boneName}`;
    }
    return found;
  }

  function listBones(speciesId) {
    const creature = speciesIndex.get(speciesId);
    return creature?.userData?.bones ? [...creature.userData.bones] : [];
  }

  function buildCreature(THREE, sp) {
    const mats = matsFor(THREE, sp.isDinosaur !== false);
    let g;
    switch (sp.bodyPlan) {
      case 'sauropod':
        g = buildSauropod(THREE, mats);
        break;
      case 'stegosaur':
        g = buildStegosaur(THREE, mats);
        break;
      case 'ceratopsian':
        g = buildCeratopsian(THREE, mats);
        break;
      case 'hadrosaur':
        g = buildHadrosaur(THREE, mats);
        break;
      case 'ankylosaur':
        g = buildAnkylosaur(THREE, mats);
        break;
      case 'pterosaur':
        g = buildPterosaur(THREE, mats);
        break;
      case 'mosasaur':
        g = buildMosasaur(THREE, mats);
        break;
      case 'theropod':
      default:
        g = buildTheropod(THREE, mats, { smallArms: sp.id === 'tyrannosaurus' });
        break;
    }
    scaleGroupToLength(g, sp.lengthM || 5);
    g.userData.speciesId = sp.id;
    g.userData.era = sp.era;
    g.userData.bodyPlan = sp.bodyPlan;
    g.userData.isDinosaur = sp.isDinosaur !== false;
    g.userData.lengthM = sp.lengthM;
    g.userData.baseRotY = 0;
    g.traverse((obj) => {
      if (obj.isMesh) obj.userData.speciesId = sp.id;
    });
    if (skeletonMode) applySkeletonLook(g, true);
    return g;
  }

  function layoutPositions(list) {
    const n = list.length;
    const radius = 5.5;
    return list.map((sp, i) => {
      const a = (i / Math.max(n, 1)) * Math.PI * 1.4 - Math.PI * 0.7;
      const r = radius + (i % 3) * 1.2;
      let y = 0;
      if (sp.bodyPlan === 'pterosaur') y = 1.2 + (i % 2) * 0.4;
      if (sp.bodyPlan === 'mosasaur') y = -0.15;
      return { x: Math.sin(a) * r, y, z: Math.cos(a) * r - 2 };
    });
  }

  function clearFauna() {
    if (!faunaGroup) return;
    while (faunaGroup.children.length) {
      const child = faunaGroup.children[0];
      faunaGroup.remove(child);
      child.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }
    speciesIndex.clear();
  }

  function restage(eraId) {
    if (!scene || typeof window.THREE === 'undefined') return;
    const THREE = window.THREE;
    activeEra = eraId || activeEra;
    const era = erasData.find((e) => e.id === activeEra) || erasData[1] || erasData[0];
    const pal = era?.palette || {};

    if (fog) {
      fog.color.set(pal.fog || '#6a8f5a');
      fog.near = 12;
      fog.far = 42;
    }
    if (scene) scene.background = new THREE.Color(pal.sky || '#a8c878');
    if (ground?.material) ground.material.color.set(pal.ground || '#4a6b3c');
    if (water?.material) water.material.color.set(pal.water || '#3a7a7e');
    if (keyLight) {
      keyLight.color.set(activeEra === 'cretaceous' ? 0xffc070 : 0xffe8c8);
      keyLight.intensity = activeEra === 'triassic' ? 1.05 : 1.2;
    }
    if (fillLight) {
      fillLight.color.set(activeEra === 'triassic' ? 0xc45a3a : 0x4a8a6a);
      fillLight.intensity = 0.35;
    }

    clearFauna();
    const visible = speciesData.filter((sp) => sp.era === activeEra);
    const positions = layoutPositions(visible);
    visible.forEach((sp, i) => {
      const creature = buildCreature(THREE, sp);
      const pos = positions[i] || { x: i * 2, y: 0, z: 0 };
      creature.position.set(pos.x, pos.y, pos.z);
      creature.userData.baseY = pos.y;
      creature.userData.baseRotY = Math.atan2(-pos.x, -pos.z + 2) + Math.PI;
      creature.rotation.y = creature.userData.baseRotY;
      faunaGroup.add(creature);
      speciesIndex.set(sp.id, creature);
    });

    if (humanSilhouette && faunaGroup) {
      faunaGroup.add(humanSilhouette);
      humanSilhouette.position.set(0.8, 0, 6.5);
      humanSilhouette.visible = true;
    }

    if (selectedId && !speciesIndex.has(selectedId)) {
      selectedId = null;
    }
  }

  function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
        else child.material.dispose();
      }
    });
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(raf);
    raf = 0;
    running = false;
    simMode = null;
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    camTween = null;
    clearFauna();
    disposeObject3D(ground);
    disposeObject3D(water);
    disposeObject3D(humanSilhouette);
    if (renderer) {
      renderer.dispose();
      if (renderer.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer = null;
    }
    scene = null;
    camera = null;
    faunaGroup = null;
    ground = null;
    water = null;
    humanSilhouette = null;
  }

  function resize() {
    if (!renderer || !camera || !mount) return;
    const w = Math.max(120, mount.clientWidth || window.innerWidth);
    const h = Math.max(120, mount.clientHeight || 400);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function setRunning(on) {
    if (on === running || disposed) return;
    running = on;
    if (on) raf = requestAnimationFrame(tick);
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  function updateSimulations(dt) {
    if (!selectedId || reduced) return;
    const creature = speciesIndex.get(selectedId);
    if (!creature) return;

    if (simMode === 'walk') {
      const t = idleT * 4;
      const legs = creature.userData.legBones || [];
      legs.forEach((leg, i) => {
        if (!leg) return;
        const phase = i % 2 === 0 ? t : t + Math.PI;
        leg.rotation.x = Math.sin(phase) * 0.45;
      });
      const wings = creature.userData.wingBones || [];
      wings.forEach((wing, i) => {
        if (!wing) return;
        wing.rotation.z = Math.sin(idleT * 5 + i) * 0.25;
      });
      creature.position.y = (creature.userData.baseY || 0) + Math.abs(Math.sin(t)) * 0.08;
      creature.rotation.y = (creature.userData.baseRotY || 0) + Math.sin(idleT * 0.6) * 0.08;
    }

    if (simMode === 'bones') {
      simBoneTimer += dt;
      if (simBoneTimer > 1.4) {
        simBoneTimer = 0;
        const bones = creature.userData.bones || [];
        if (bones.length) {
          simBoneIndex = (simBoneIndex + 1) % bones.length;
          highlightBone(selectedId, bones[simBoneIndex]);
        }
      }
    }
  }

  function tick(t) {
    if (!running || !renderer || !scene || !camera || disposed) return;
    raf = requestAnimationFrame(tick);
    const now = t * 0.001;
    const dt = Math.min(0.05, now - (idleT || now));
    idleT = now;
    if (!reduced && !camTween && !selectedId) {
      camera.position.x = homeCam.x + Math.sin(idleT * 0.12) * 0.35;
      camera.position.y = homeCam.y + Math.sin(idleT * 0.1) * 0.12;
      camera.lookAt(0, 1.2, 0);
    }
    if (faunaGroup && !reduced) {
      faunaGroup.children.forEach((child, i) => {
        if (child.userData.isHuman) return;
        if (child.userData.speciesId === selectedId && simMode) return;
        if (child.userData.bodyPlan === 'pterosaur') {
          child.position.y = (child.userData.baseY || 0) + Math.sin(idleT * 1.2 + i) * 0.08;
        } else {
          child.rotation.y = (child.userData.baseRotY || child.rotation.y) + Math.sin(idleT * 0.4 + i) * 0.0008;
        }
      });
    }
    updateSimulations(dt);
    renderer.render(scene, camera);
  }

  function showFallback(reason) {
    const fallback = document.getElementById('dhFallback');
    const status = document.getElementById('dhStageStatus');
    if (fallback) {
      fallback.hidden = false;
      fallback.setAttribute('aria-hidden', 'false');
    }
    if (canvas) canvas.style.display = 'none';
    if (status) status.textContent = reason || 'Static diorama (WebGL unavailable)';
  }

  function easeCameraTo(target, done) {
    if (!camera || !target) {
      if (done) done();
      return;
    }
    const look = { x: target.x, y: target.y + 1.0, z: target.z };
    // Gentle nudge — keep most of the diorama in frame (no hard snap)
    const dest = {
      x: target.x * 0.35 + homeCam.x * 0.65,
      y: Math.max(3.2, homeCam.y - 0.4),
      z: Math.max(12, homeCam.z - 2.5)
    };
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    if (reduced || typeof window.gsap === 'undefined') {
      camera.position.set(dest.x, dest.y, dest.z);
      camera.lookAt(look.x, look.y, look.z);
      if (done) done();
      return;
    }
    const state = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    camTween = window.gsap.to(state, {
      duration: 0.85,
      ease: 'power2.out',
      x: dest.x,
      y: dest.y,
      z: dest.z,
      onUpdate() {
        camera.position.set(state.x, state.y, state.z);
        camera.lookAt(look.x, look.y, look.z);
      },
      onComplete() {
        camTween = null;
        if (done) done();
      }
    });
  }

  function resetCamera(animate) {
    const dest = { ...homeCam };
    if (camTween && typeof camTween.kill === 'function') camTween.kill();
    selectedId = null;
    simMode = null;
    const btn = document.getElementById('dhResetCam');
    if (btn) btn.hidden = true;
    if (!camera) return;
    if (!animate || reduced || typeof window.gsap === 'undefined') {
      camera.position.set(dest.x, dest.y, dest.z);
      camera.lookAt(0, 1.2, 0);
      return;
    }
    const state = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    camTween = window.gsap.to(state, {
      duration: 0.9,
      ease: 'power2.inOut',
      x: dest.x,
      y: dest.y,
      z: dest.z,
      onUpdate() {
        camera.position.set(state.x, state.y, state.z);
        camera.lookAt(0, 1.2, 0);
      },
      onComplete() {
        camTween = null;
      }
    });
  }

  function spotlight(speciesId, opts) {
    const creature = speciesIndex.get(speciesId);
    const status = document.getElementById('dhStageStatus');
    const btn = document.getElementById('dhResetCam');
    if (!creature) {
      if (status) status.textContent = 'That animal is in another era — switch eras to see it.';
      return false;
    }
    selectedId = speciesId;
    if (btn) btn.hidden = false;
    if (status) {
      const sp = speciesData.find((s) => s.id === speciesId);
      status.textContent = sp ? `Spotlight: ${sp.commonName}` : 'Spotlight';
    }
    easeCameraTo(creature.position, opts?.done);
    if (onSelectCb && !opts?.silent) onSelectCb(speciesId);
    return true;
  }

  function setSkeletonMode(on) {
    skeletonMode = Boolean(on);
    speciesIndex.forEach((creature) => applySkeletonLook(creature, skeletonMode));
    const status = document.getElementById('dhStageStatus');
    if (status) status.textContent = skeletonMode ? 'Skeleton view — named bones' : 'Flesh view';
  }

  function startSimulation(mode) {
    if (!selectedId) return false;
    simMode = mode || 'walk';
    simBoneIndex = 0;
    simBoneTimer = 0;
    if (simMode === 'bones') {
      setSkeletonMode(true);
      const bones = listBones(selectedId);
      if (bones[0]) highlightBone(selectedId, bones[0]);
    }
    const status = document.getElementById('dhStageStatus');
    if (status) {
      status.textContent =
        simMode === 'bones' ? 'Simulation: bone tour' : 'Simulation: locomotion';
    }
    return true;
  }

  function stopSimulation() {
    simMode = null;
    if (selectedId) {
      const creature = speciesIndex.get(selectedId);
      if (creature) {
        clearBoneHighlight(creature);
        const legs = creature.userData.legBones || [];
        legs.forEach((leg) => {
          if (leg) leg.rotation.x = 0;
        });
        creature.position.y = creature.userData.baseY || 0;
        creature.rotation.y = creature.userData.baseRotY || creature.rotation.y;
      }
    }
  }

  function pickAt(clientX, clientY) {
    if (!renderer || !camera || !faunaGroup) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(faunaGroup.children, true);
    for (let i = 0; i < hits.length; i += 1) {
      const hit = hits[i].object;
      const id = hit?.userData?.speciesId;
      if (!id) continue;
      const bone = hit.userData.boneName;
      spotlight(id);
      if (bone) highlightBone(id, bone);
      return;
    }
  }

  function initScene() {
    const THREE = window.THREE;
    mount = document.getElementById('dhStage');
    canvas = document.getElementById('dhCanvas');
    if (!mount || !canvas || typeof THREE === 'undefined') {
      showFallback('Static diorama (Three.js unavailable)');
      return false;
    }

    reduced = prefersReducedMotion();
    disposed = false;

    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (_) {
      showFallback('Static diorama (WebGL unavailable)');
      return false;
    }

    renderer.setClearColor(0x000000, 0);
    scene = new THREE.Scene();
    fog = new THREE.Fog(0xa8c878, 12, 42);
    scene.fog = fog;
    scene.background = new THREE.Color(0xa8c878);

    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(homeCam.x, homeCam.y, homeCam.z);
    camera.lookAt(0, 1.2, 0);

    ambient = new THREE.AmbientLight(0xf6efe2, 0.55);
    scene.add(ambient);
    keyLight = new THREE.DirectionalLight(0xffe8c8, 1.2);
    keyLight.position.set(6, 10, 4);
    scene.add(keyLight);
    fillLight = new THREE.DirectionalLight(0x4a8a6a, 0.35);
    fillLight.position.set(-5, 3, -2);
    scene.add(fillLight);

    ground = new THREE.Mesh(
      new THREE.CircleGeometry(22, 48),
      makeMat(THREE, { color: 0x4a6b3c, roughness: 0.92, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    water = new THREE.Mesh(
      new THREE.CircleGeometry(8, 32),
      makeMat(THREE, {
        color: 0x3a7a7e,
        roughness: 0.35,
        metalness: 0.15,
        transparent: true,
        opacity: 0.85
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(-6, 0.02, -4);
    scene.add(water);

    faunaGroup = new THREE.Group();
    scene.add(faunaGroup);

    humanSilhouette = buildHuman(THREE, matsFor(THREE, true));
    humanSilhouette.scale.setScalar(HUMAN_HEIGHT_M * 0.55);
    humanSilhouette.userData.isHuman = true;

    raycaster = new THREE.Raycaster();
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
    if (ro) ro.observe(mount);
    window.addEventListener('resize', resize, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        setRunning(vis && !disposed);
      },
      { threshold: 0.05 }
    );
    io.observe(mount);

    canvas.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      pickAt(ev.clientX, ev.clientY);
    });

    document.getElementById('dhResetCam')?.addEventListener('click', () => resetCamera(true));

    if (reduced) {
      const status = document.getElementById('dhStageStatus');
      if (status) status.textContent = 'Diorama ready (reduced motion)';
    }

    setRunning(true);
    return true;
  }

  window.DinosaurHallScene = {
    init(opts) {
      speciesData = opts?.species || [];
      erasData = opts?.eras || [];
      onSelectCb = typeof opts?.onSelect === 'function' ? opts.onSelect : null;
      onBoneCb = typeof opts?.onBone === 'function' ? opts.onBone : null;
      const ok = initScene();
      if (ok) {
        restage(opts?.era || 'jurassic');
        const status = document.getElementById('dhStageStatus');
        if (status && !reduced) status.textContent = 'Click a creature · use era chips to restage';
      }
      return ok;
    },
    setEra(eraId) {
      restage(eraId);
      resetCamera(false);
      const status = document.getElementById('dhStageStatus');
      const era = erasData.find((e) => e.id === eraId);
      if (status && era) status.textContent = `${era.label} diorama · ${era.years}`;
    },
    spotlight,
    resetCamera,
    dispose,
    setSkeletonMode,
    startSimulation,
    stopSimulation,
    highlightBone,
    listBones,
    getSkeletonMode() {
      return skeletonMode;
    },
    getSimMode() {
      return simMode;
    },
    getHighlightedBone() {
      return highlightedBone;
    },
    getActiveEra() {
      return activeEra;
    },
    getSelectedId() {
      return selectedId;
    }
  };
})();
