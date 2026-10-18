import * as THREE from 'three';

/**
 * Try-D original procedural pullover hoodie.
 * Coordinates: front faces +Z; garment height is about 0.82 units.
 * Components are separate meshes so seams, hood, pocket, cuffs and cords catch light.
 */
export function createCustomHoodie(): THREE.Group {
  const root = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: '#121214', roughness: 0.9, metalness: 0.01 });
  const rib = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.96 });
  const seam = new THREE.MeshStandardMaterial({ color: '#242427', roughness: 0.94 });
  const cordMat = new THREE.MeshStandardMaterial({ color: '#77777b', roughness: 0.72 });
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    return mesh;
  };

  // Smooth tailored torso, generated as elliptical horizontal rings.
  const rings: Array<[number, number, number]> = [
    [-0.405, 0.235, 0.105], [-0.385, 0.255, 0.12], [-0.30, 0.265, 0.13],
    [-0.12, 0.275, 0.135], [0.12, 0.285, 0.13], [0.245, 0.30, 0.115],
    [0.305, 0.255, 0.10], [0.33, 0.16, 0.09]
  ];
  const radial = 48;
  const vertices: number[] = [];
  const indices: number[] = [];
  rings.forEach(([y, rx, rz], j) => {
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      const shoulder = j >= 5 ? 1 - Math.max(0, j - 5) * 0.025 : 1;
      vertices.push(Math.cos(a) * rx * shoulder, y, Math.sin(a) * rz);
    }
  });
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * (radial + 1) + i, b = a + radial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const torsoGeo = new THREE.BufferGeometry();
  torsoGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  torsoGeo.setIndex(indices);
  torsoGeo.computeVertexNormals();
  add(torsoGeo, fabric, 'hoodie-body');

  // A tapered sleeve between two points, with the tube axis aligned to the shoulder.
  const makeSleeve = (side: number) => {
    const start = new THREE.Vector3(side * 0.235, 0.245, 0);
    const end = new THREE.Vector3(side * 0.49, -0.12, 0.015);
    const direction = end.clone().sub(start);
    const sleeve = add(new THREE.CylinderGeometry(0.074, 0.105, direction.length(), 32, 10, false), fabric, side < 0 ? 'sleeve-left' : 'sleeve-right');
    sleeve.position.copy(start).add(end).multiplyScalar(0.5);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    // Soft folds are subtle raised lines along the outer sleeve.
    const cuff = add(new THREE.CylinderGeometry(0.065, 0.073, 0.075, 32, 1, false), rib, side < 0 ? 'cuff-left' : 'cuff-right');
    const cuffStart = end.clone().add(new THREE.Vector3(0, -0.035, 0));
    cuff.position.copy(cuffStart);
    cuff.quaternion.copy(sleeve.quaternion);
  };
  makeSleeve(-1);
  makeSleeve(1);

  // Ribbed waistband and neck opening.
  add(new THREE.CylinderGeometry(0.255, 0.255, 0.055, 48, 1, false), rib, 'ribbed-waistband').position.y = -0.398;
  const collar = add(new THREE.TorusGeometry(0.095, 0.018, 12, 48), rib, 'neck-rib');
  collar.position.set(0, 0.31, 0);
  collar.rotation.x = Math.PI / 2;

  // Hood: softly rounded raised shell behind the neck with an open face.
  const hood = add(new THREE.SphereGeometry(0.145, 40, 28, 0, Math.PI * 2, 0.08, Math.PI * 0.88), fabric, 'hood-shell');
  hood.scale.set(0.9, 1.12, 0.72);
  hood.position.set(0, 0.365, -0.075);
  const hoodOpening = add(new THREE.TorusGeometry(0.102, 0.012, 10, 40), seam, 'hood-opening-seam');
  hoodOpening.position.set(0, 0.355, 0.018);
  hoodOpening.rotation.x = Math.PI / 2;

  // Front kangaroo pocket, gently curved to follow the torso.
  const pocketShape = new THREE.Shape();
  pocketShape.moveTo(-0.155, 0.065);
  pocketShape.lineTo(0.155, 0.065);
  pocketShape.lineTo(0.14, -0.035);
  pocketShape.quadraticCurveTo(0, -0.105, -0.14, -0.035);
  pocketShape.closePath();
  const pocketGeo = new THREE.ShapeGeometry(pocketShape, 24);
  const pocket = add(pocketGeo, seam, 'kangaroo-pocket');
  pocket.position.set(0, -0.15, 0.126);
  // Pocket stitching line around the panel.
  const stitchPoints = [
    new THREE.Vector3(-0.155, -0.085, 0.129),
    new THREE.Vector3(-0.14, -0.25, 0.129),
    new THREE.Vector3(0, -0.255, 0.132),
    new THREE.Vector3(0.14, -0.25, 0.129),
    new THREE.Vector3(0.155, -0.085, 0.129)
  ];
  const stitchCurve = new THREE.CatmullRomCurve3(stitchPoints);
  add(new THREE.TubeGeometry(stitchCurve, 36, 0.0022, 5, false), cordMat, 'pocket-stitching');

  // Two drawstrings hang naturally from the hood opening.
  [-1, 1].forEach((s) => {
    const points = [
      new THREE.Vector3(s * 0.035, 0.315, 0.105),
      new THREE.Vector3(s * 0.04, 0.24, 0.12),
      new THREE.Vector3(s * 0.052, 0.16, 0.124)
    ];
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.0045, 8, false), cordMat, s < 0 ? 'drawstring-left' : 'drawstring-right');
  });

  // Small vertical seam details on the body and cuffs add fabric definition.
  [-1, 1].forEach((s) => {
    const points = [
      new THREE.Vector3(s * 0.225, 0.22, 0.094),
      new THREE.Vector3(s * 0.24, 0.05, 0.116),
      new THREE.Vector3(s * 0.245, -0.16, 0.119),
      new THREE.Vector3(s * 0.24, -0.34, 0.108)
    ];
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.0017, 5, false), seam, s < 0 ? 'body-seam-left' : 'body-seam-right');
  });

  return root;
}
